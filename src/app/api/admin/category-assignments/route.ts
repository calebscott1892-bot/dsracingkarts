import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";

const STOP_WORDS = new Set([
  "and",
  "the",
  "for",
  "with",
  "kit",
  "set",
  "inc",
  "kart",
  "karts",
  "part",
  "parts",
  "race",
  "racing",
  "go",
  "to",
  "of",
  "in",
  "on",
  "at",
  "by",
  "or",
  "x",
  "mm",
  "rear",
  "front",
  "black",
  "blue",
  "red",
  "silver",
  "gold",
]);

type Category = {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
};

type CategorizedProduct = {
  id: string;
  square_token: string | null;
  name: string;
  sku: string | null;
  description_plain: string | null;
  product_categories?: { category_id: string }[];
};

type UncategorizedProduct = {
  id: string;
  square_token: string | null;
  name: string;
  slug: string;
  sku: string | null;
  description_plain: string | null;
};

type SuggestionInsertRow = {
  product_id: string;
  product_square_token: string | null;
  product_name: string;
  previous_category_ids: string[];
  suggested_category_id: string | null;
  confidence: number;
  rationale: string;
  status: "pending";
};

function tokenize(value: string) {
  return (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

function scoreCategory(
  productTokens: string[],
  categoryProfile: {
    nameTokens: Set<string>;
    corpusWeights: Map<string, number>;
    exampleProducts: string[];
  }
) {
  let score = 0;
  const matchedNameTokens = new Set<string>();
  const matchedCorpusTokens = new Set<string>();

  for (const token of productTokens) {
    if (categoryProfile.nameTokens.has(token)) {
      score += 5;
      matchedNameTokens.add(token);
    }

    const corpusWeight = categoryProfile.corpusWeights.get(token) || 0;
    if (corpusWeight > 0) {
      score += Math.min(corpusWeight, 4);
      matchedCorpusTokens.add(token);
    }
  }

  const normalized =
    productTokens.length === 0
      ? 0
      : Math.min(0.9999, score / Math.max(productTokens.length * 6, 1));

  return {
    score,
    confidence: normalized,
    matchedNameTokens: Array.from(matchedNameTokens),
    matchedCorpusTokens: Array.from(matchedCorpusTokens).slice(0, 10),
  };
}

async function verifyAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: admin } = await supabase
    .from("admin_profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!admin || !["admin", "super_admin"].includes(admin.role)) return null;
  return { userId: user.id };
}

async function fetchPaginated<T>(
  runQuery: (from: number, to: number) => Promise<{ data: T[] | null; error: any }>
) {
  const pageSize = 1000;
  const rows: T[] = [];
  let page = 0;

  while (true) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await runQuery(from, to);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < pageSize) break;
    page += 1;
  }

  return rows;
}

async function loadUncategorizedProducts(service: ReturnType<typeof createServiceClient>) {
  try {
    return await fetchPaginated<UncategorizedProduct>(async (from, to) =>
      await service
        .from("uncategorized_products")
        .select("id, square_token, name, slug, sku, description_plain")
        .order("name")
        .range(from, to)
    );
  } catch (error: any) {
    if (error?.code !== "PGRST205") throw error;

    const activeProducts = await fetchPaginated<CategorizedProduct & { slug: string }>(async (from, to) =>
      await service
        .from("products")
        .select(
          `
          id,
          square_token,
          name,
          slug,
          sku,
          description_plain,
          product_categories ( category_id )
        `
        )
        .eq("status", "active")
        .order("name")
        .range(from, to)
    );

    return activeProducts.filter(
      (product) => !product.product_categories || product.product_categories.length === 0
    );
  }
}

async function generateSuggestions(service: ReturnType<typeof createServiceClient>, userId: string) {
  const categories = await fetchPaginated<Category>(async (from, to) =>
    await service.from("categories").select("id, name, slug, parent_id").order("name").range(from, to)
  );

  const categorizedProducts = await fetchPaginated<CategorizedProduct>(async (from, to) =>
    await service
      .from("products")
      .select(
        `
        id,
        square_token,
        name,
        sku,
        description_plain,
        product_categories ( category_id )
      `
      )
      .eq("status", "active")
      .range(from, to)
  );

  const uncategorizedProducts = await loadUncategorizedProducts(service);

  const categoryProfiles = new Map(
    categories.map((category) => [
      category.id,
      {
        id: category.id,
        name: category.name,
        slug: category.slug,
        parent_id: category.parent_id,
        nameTokens: new Set(tokenize(category.name)),
        corpusWeights: new Map<string, number>(),
        exampleProducts: [] as string[],
      },
    ])
  );

  for (const product of categorizedProducts) {
    if (!product.product_categories?.length) continue;
    const productTokens = tokenize(
      [product.name, product.sku, product.description_plain].filter(Boolean).join(" ")
    );
    if (productTokens.length === 0) continue;

    for (const assignment of product.product_categories) {
      const profile = categoryProfiles.get(assignment.category_id);
      if (!profile) continue;

      for (const token of productTokens) {
        profile.corpusWeights.set(token, (profile.corpusWeights.get(token) || 0) + 1);
      }

      if (profile.exampleProducts.length < 5) {
        profile.exampleProducts.push(product.name);
      }
    }
  }

  const suggestionRows: SuggestionInsertRow[] = [];

  let highConfidenceCount = 0;
  let mediumConfidenceCount = 0;
  let lowConfidenceCount = 0;
  let noMatchCount = 0;

  for (const product of uncategorizedProducts) {
    const productTokens = tokenize(
      [product.name, product.sku, product.description_plain].filter(Boolean).join(" ")
    );

    if (productTokens.length === 0) {
      noMatchCount += 1;
      suggestionRows.push({
        product_id: product.id,
        product_square_token: product.square_token,
        product_name: product.name,
        previous_category_ids: [],
        suggested_category_id: null,
        confidence: 0,
        rationale: "No useful tokens found in product title, SKU, or description. Manual review required.",
        status: "pending",
      });
      continue;
    }

    const ranked = Array.from(categoryProfiles.values())
      .map((profile) => ({
        profile,
        ...scoreCategory(productTokens, profile),
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    const best = ranked[0];
    if (!best) {
      noMatchCount += 1;
      suggestionRows.push({
        product_id: product.id,
        product_square_token: product.square_token,
        product_name: product.name,
        previous_category_ids: [],
        suggested_category_id: null,
        confidence: 0,
        rationale: "No category overlap detected from existing categorised products. Manual review required.",
        status: "pending",
      });
      continue;
    }

    const runnerUp = ranked[1];
    const clearlyBetter = !runnerUp || best.score >= runnerUp.score * 1.35;
    const confidenceBand =
      best.confidence >= 0.55 && clearlyBetter
        ? "high"
        : best.confidence >= 0.35
          ? "medium"
          : "low";

    if (confidenceBand === "high") highConfidenceCount += 1;
    else if (confidenceBand === "medium") mediumConfidenceCount += 1;
    else lowConfidenceCount += 1;

    suggestionRows.push({
      product_id: product.id,
      product_square_token: product.square_token,
      product_name: product.name,
      previous_category_ids: [],
      suggested_category_id: best.profile.id,
      confidence: Number(best.confidence.toFixed(4)),
      rationale: [
        best.matchedNameTokens.length
          ? `Matched category name tokens: ${best.matchedNameTokens.join(", ")}`
          : null,
        best.matchedCorpusTokens.length
          ? `Matched existing product vocabulary: ${best.matchedCorpusTokens.join(", ")}`
          : null,
        best.profile.exampleProducts.length
          ? `Example products already in category: ${best.profile.exampleProducts.join(" | ")}`
          : null,
        runnerUp
          ? `Next closest option: ${runnerUp.profile.name} (${runnerUp.confidence.toFixed(2)})`
          : null,
      ]
        .filter(Boolean)
        .join(". "),
      status: "pending",
    });
  }

  const { data: run, error: runError } = await service
    .from("category_assignment_runs")
    .insert({
      mode: "suggestion",
      source: "admin",
      notes: `Generated ${suggestionRows.length} review rows from ${uncategorizedProducts.length} uncategorized products. High confidence: ${highConfidenceCount}. Medium confidence: ${mediumConfidenceCount}. Low confidence: ${lowConfidenceCount}. No strong match: ${noMatchCount}.`,
      created_by: userId,
    })
    .select("id")
    .single();

  if (runError || !run) {
    throw runError || new Error("Failed to create category assignment run");
  }

  const chunkSize = 200;
  for (let index = 0; index < suggestionRows.length; index += chunkSize) {
    const chunk = suggestionRows.slice(index, index + chunkSize).map((row) => ({
      run_id: run.id,
      ...row,
    }));

    const { error } = await service.from("category_assignment_suggestions").insert(chunk);
    if (error) throw error;
  }

  return {
    runId: run.id,
    uncategorizedCount: uncategorizedProducts.length,
    suggestedCount: suggestionRows.length,
    highConfidenceCount,
    mediumConfidenceCount,
    lowConfidenceCount,
    noMatchCount,
  };
}

export async function POST() {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const service = createServiceClient();
    const summary = await generateSuggestions(service, admin.userId);

    revalidatePath("/admin/category-assignments");

    return NextResponse.json({ summary });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to generate category suggestions" },
      { status: 500 }
    );
  }
}
