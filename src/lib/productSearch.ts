const COMMON_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "application",
  "applications",
  "are",
  "as",
  "at",
  "bar",
  "be",
  "by",
  "can",
  "compatible",
  "competitive",
  "component",
  "components",
  "copied",
  "description",
  "designed",
  "direct",
  "durable",
  "fit",
  "fitment",
  "fits",
  "find",
  "for",
  "found",
  "from",
  "got",
  "i",
  "in",
  "into",
  "is",
  "it",
  "item",
  "lightweight",
  "me",
  "no",
  "of",
  "option",
  "or",
  "pasted",
  "price",
  "prices",
  "product",
  "products",
  "performance",
  "replacement",
  "require",
  "requiring",
  "search",
  "searched",
  "standard",
  "test",
  "the",
  "to",
  "try",
  "using",
  "with",
]);

const CONTEXT_STOP_WORDS = new Set([
  "actual",
  "decision",
  "endurance",
  "go",
  "kart",
  "karting",
  "racing",
]);

const PRODUCT_SEARCH_FIELDS = ["name", "sku", "description_plain"] as const;
const MAX_SEARCH_GROUPS = 8;
export const PRODUCT_SEARCH_RELATED_MATCH_ID_LIMIT = 100;

export type ProductSearchMode = "all" | "any";
export type ProductSearchTermGroups = string[][];
export type ProductSearchRelatedMatchIds = string[][];

function normalizeSearchInput(input: string) {
  return input
    .toLowerCase()
    .replace(/(\d+)\s*mm\b/g, "$1mm")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ");
}

function variantsForToken(token: string) {
  const variants = new Set([token]);
  const metricMatch = token.match(/^(\d+)mm$/);

  if (metricMatch) {
    variants.add(`${metricMatch[1]} mm`);
    variants.add(`${metricMatch[1]}-mm`);
  }

  if (token.endsWith("ies") && token.length > 4) {
    variants.add(`${token.slice(0, -3)}y`);
  } else if (token.endsWith("s") && token.length > 3) {
    variants.add(token.slice(0, -1));
  } else if (/^[a-z]+$/.test(token) && token.length > 3) {
    variants.add(`${token}s`);
  }

  return Array.from(variants);
}

export function getProductSearchTermGroups(input?: string | null): ProductSearchTermGroups {
  const tokens = normalizeSearchInput(input || "")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !COMMON_STOP_WORDS.has(token));

  const hasSpecificTokens = tokens.some((token) => !CONTEXT_STOP_WORDS.has(token));
  const filteredTokens = hasSpecificTokens
    ? tokens.filter((token) => !CONTEXT_STOP_WORDS.has(token))
    : tokens;

  const seen = new Set<string>();
  const groups: ProductSearchTermGroups = [];

  for (const token of filteredTokens) {
    if (seen.has(token)) continue;
    seen.add(token);
    groups.push(variantsForToken(token));
    if (groups.length >= MAX_SEARCH_GROUPS) break;
  }

  return groups;
}

function buildFieldFilters(terms: string[], relatedProductIds: string[] = []) {
  const filters = terms.flatMap((term) =>
    PRODUCT_SEARCH_FIELDS.map((field) => `${field}.ilike.%${term}%`)
  );

  const uniqueRelatedIds = Array.from(new Set(relatedProductIds))
    .filter((id) => /^[0-9a-f-]{36}$/i.test(id))
    .slice(0, PRODUCT_SEARCH_RELATED_MATCH_ID_LIMIT);
  if (uniqueRelatedIds.length > 0) {
    filters.push(`id.in.(${uniqueRelatedIds.join(",")})`);
  }

  return filters;
}

export function applyProductSearchFilter<T>(
  query: T,
  termGroups: ProductSearchTermGroups,
  mode: ProductSearchMode = "all",
  relatedMatchIds: ProductSearchRelatedMatchIds = [],
): T {
  if (termGroups.length === 0) return query;

  let filtered: any = query;

  if (mode === "all") {
    for (let index = 0; index < termGroups.length; index += 1) {
      const group = termGroups[index];
      filtered = filtered.or(buildFieldFilters(group, relatedMatchIds[index]).join(","));
    }
    return filtered as T;
  }

  filtered = filtered.or(buildFieldFilters(termGroups.flat(), relatedMatchIds.flat()).join(","));
  return filtered as T;
}

function includesAny(value: string, terms: string[]) {
  return terms.some((term) => value.includes(term));
}

export function scoreProductSearchResult(
  product: {
    name?: string | null;
    sku?: string | null;
    description_plain?: string | null;
    product_variations?: Array<{ name?: string | null; sku?: string | null }> | null;
    product_categories?: Array<{ categories?: { name?: string | null } | null }> | null;
  },
  termGroups: ProductSearchTermGroups,
) {
  if (termGroups.length === 0) return 0;

  const name = (product.name || "").toLowerCase();
  const sku = (product.sku || "").toLowerCase();
  const description = (product.description_plain || "").toLowerCase();
  const variations = (product.product_variations || [])
    .map((row) => `${row.name || ""} ${row.sku || ""}`)
    .join(" ")
    .toLowerCase();
  const categories = (product.product_categories || [])
    .map((row) => row.categories?.name || "")
    .join(" ")
    .toLowerCase();
  const combined = `${name} ${sku} ${variations} ${description} ${categories}`;

  let score = 0;
  for (const group of termGroups) {
    if (includesAny(name, group)) score += 8;
    if (includesAny(sku, group)) score += 6;
    if (includesAny(variations, group)) score += 5;
    if (includesAny(categories, group)) score += 4;
    if (includesAny(description, group)) score += 2;
    if (includesAny(combined, group)) score += 1;
  }

  if (termGroups.every((group) => includesAny(combined, group))) score += 20;

  return score;
}
