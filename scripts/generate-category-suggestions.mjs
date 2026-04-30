import fs from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);
const outputDir = path.join(process.cwd(), "tmp");

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

function tokenize(value) {
  return (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

function scoreCategory(productTokens, categoryProfile) {
  let score = 0;
  const matchedNameTokens = [];
  const matchedCorpusTokens = [];

  for (const token of productTokens) {
    if (categoryProfile.nameTokens.has(token)) {
      score += 5;
      matchedNameTokens.push(token);
    }

    const corpusWeight = categoryProfile.corpusWeights.get(token) || 0;
    if (corpusWeight > 0) {
      score += Math.min(corpusWeight, 4);
      matchedCorpusTokens.push(token);
    }
  }

  const normalized =
    productTokens.length === 0
      ? 0
      : Math.min(0.9999, score / Math.max(productTokens.length * 6, 1));

  return {
    score,
    confidence: normalized,
    matchedNameTokens: [...new Set(matchedNameTokens)],
    matchedCorpusTokens: [...new Set(matchedCorpusTokens)].slice(0, 10),
  };
}

function csvEscape(value) {
  const stringValue = value == null ? "" : String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

async function fetchPaginated(table, queryBuilder, pageSize = 1000) {
  let page = 0;
  const rows = [];

  while (true) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await queryBuilder().range(from, to);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < pageSize) break;
    page += 1;
  }

  return rows;
}

async function main() {
  const categories = await fetchPaginated("categories", () =>
    supabase.from("categories").select("id, name, slug, parent_id").order("name")
  );

  const categorizedProducts = await fetchPaginated("products", () =>
    supabase
      .from("products")
      .select(
        `
        id,
        square_token,
        name,
        sku,
        description_plain,
        product_categories (
          category_id,
          categories ( id, name, slug, parent_id )
        )
      `
      )
      .eq("status", "active")
  );

  let uncategorizedProducts;
  try {
    uncategorizedProducts = await fetchPaginated("uncategorized_products", () =>
      supabase
        .from("uncategorized_products")
        .select("id, square_token, name, slug, sku, description_plain")
        .order("name")
    );
  } catch (error) {
    if (error?.code !== "PGRST205") throw error;

    const activeProducts = await fetchPaginated("products", () =>
      supabase
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
    );

    uncategorizedProducts = activeProducts.filter(
      (product) => !product.product_categories || product.product_categories.length === 0
    );
  }

  const categoryProfiles = new Map();
  for (const category of categories) {
    categoryProfiles.set(category.id, {
      id: category.id,
      name: category.name,
      slug: category.slug,
      parent_id: category.parent_id,
      nameTokens: new Set(tokenize(category.name)),
      corpusWeights: new Map(),
      exampleProducts: [],
    });
  }

  for (const product of categorizedProducts) {
    const productTokens = tokenize(
      [product.name, product.sku, product.description_plain].filter(Boolean).join(" ")
    );
    if (!product.product_categories?.length || productTokens.length === 0) continue;

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

  const suggestionRows = [];

  for (const product of uncategorizedProducts) {
    const productTokens = tokenize(
      [product.name, product.sku, product.description_plain].filter(Boolean).join(" ")
    );

    if (productTokens.length === 0) {
      suggestionRows.push({
        product_id: product.id,
        square_token: product.square_token,
        product_name: product.name,
        sku: product.sku || "",
        suggested_category_id: "",
        suggested_category_name: "",
        confidence: 0,
        rationale: "No useful tokens found in product title / sku / description.",
        review_status: "manual_review_required",
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
      suggestionRows.push({
        product_id: product.id,
        square_token: product.square_token,
        product_name: product.name,
        sku: product.sku || "",
        suggested_category_id: "",
        suggested_category_name: "",
        confidence: 0,
        rationale: "No category overlap detected from existing categorised products.",
        review_status: "manual_review_required",
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

    suggestionRows.push({
      product_id: product.id,
      square_token: product.square_token,
      product_name: product.name,
      sku: product.sku || "",
      suggested_category_id: best.profile.id,
      suggested_category_name: best.profile.name,
      confidence: Number(best.confidence.toFixed(4)),
      confidence_band: confidenceBand,
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
      ]
        .filter(Boolean)
        .join(". "),
      alternatives: ranked
        .slice(1)
        .map((entry) => `${entry.profile.name} (${entry.confidence.toFixed(2)})`)
        .join(" | "),
      review_status: confidenceBand === "high" ? "review_recommended" : "manual_review_required",
    });
  }

  await fs.mkdir(outputDir, { recursive: true });

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const jsonPath = path.join(outputDir, `category-suggestions-${stamp}.json`);
  const csvPath = path.join(outputDir, `category-suggestions-${stamp}.csv`);

  await fs.writeFile(jsonPath, JSON.stringify(suggestionRows, null, 2));

  const columns = [
    "product_id",
    "square_token",
    "product_name",
    "sku",
    "suggested_category_id",
    "suggested_category_name",
    "confidence",
    "confidence_band",
    "review_status",
    "rationale",
    "alternatives",
  ];

  const csv = [
    columns.join(","),
    ...suggestionRows.map((row) => columns.map((column) => csvEscape(row[column] ?? "")).join(",")),
  ].join("\n");

  await fs.writeFile(csvPath, csv);

  const summary = {
    uncategorizedCount: uncategorizedProducts.length,
    suggestedCount: suggestionRows.filter((row) => row.suggested_category_id).length,
    highConfidenceCount: suggestionRows.filter((row) => row.confidence_band === "high").length,
    mediumConfidenceCount: suggestionRows.filter((row) => row.confidence_band === "medium").length,
    manualReviewCount: suggestionRows.filter((row) => row.review_status === "manual_review_required").length,
    jsonPath,
    csvPath,
  };

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
