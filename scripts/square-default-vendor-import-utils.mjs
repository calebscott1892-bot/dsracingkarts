export const DEFAULT_VENDOR_IMPORT_HEADERS = [
  "Token",
  "Item Name",
  "Variation Name",
  "Description",
  "SKU",
  "Price",
  "Default Vendor Name",
  "Default Vendor Code",
  "Default Unit Cost",
];

function cleanString(value) {
  return value == null ? "" : String(value).trim();
}

function formatMoney(value) {
  if (value == null || value === "") return "";
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(parsed)) return cleanString(value);
  return parsed.toFixed(2);
}

function csvEscape(value) {
  const stringValue = value == null ? "" : String(value);
  if (/[",\r\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function productDescription(product) {
  return cleanString(product.description ?? product.description_plain ?? "");
}

function groupSupplierCosts(supplierCosts) {
  const byVariation = new Map();
  const byProduct = new Map();

  for (const cost of supplierCosts) {
    if (cost.variation_id) {
      if (!byVariation.has(cost.variation_id)) byVariation.set(cost.variation_id, []);
      byVariation.get(cost.variation_id).push(cost);
    }

    if (cost.product_id && !cost.variation_id) {
      if (!byProduct.has(cost.product_id)) byProduct.set(cost.product_id, []);
      byProduct.get(cost.product_id).push(cost);
    }
  }

  return { byVariation, byProduct };
}

function chooseSupplierCost(variation, groupedCosts) {
  const exact = groupedCosts.byVariation.get(variation.id) || [];
  if (exact.length === 1) return { cost: exact[0] };
  if (exact.length > 1) return { reason: "multiple supplier costs for variation" };

  const productCosts = groupedCosts.byProduct.get(variation.product_id) || [];
  if (productCosts.length === 1) return { cost: productCosts[0] };
  if (productCosts.length > 1) return { reason: "multiple product-level supplier costs" };

  return { reason: "missing supplier cost" };
}

function compareVariations(a, b, productById) {
  const productA = productById.get(a.product_id);
  const productB = productById.get(b.product_id);
  const nameCompare = cleanString(productA?.name).localeCompare(cleanString(productB?.name));
  if (nameCompare !== 0) return nameCompare;

  const orderCompare = Number(a.sort_order || 0) - Number(b.sort_order || 0);
  if (orderCompare !== 0) return orderCompare;

  const variationNameCompare = cleanString(a.name).localeCompare(cleanString(b.name));
  if (variationNameCompare !== 0) return variationNameCompare;

  return cleanString(a.sku).localeCompare(cleanString(b.sku));
}

function skippedVariation(product, variation, reason) {
  return {
    product_id: product?.id ?? variation.product_id,
    product_name: cleanString(product?.name),
    variation_id: variation.id,
    variation_name: cleanString(variation.name || "Regular"),
    sku: cleanString(variation.sku ?? product?.sku),
    reason,
  };
}

export function buildDefaultVendorImportRows({
  products,
  variations,
  supplierCosts,
}) {
  const productById = new Map(products.map((product) => [product.id, product]));
  const groupedCosts = groupSupplierCosts(supplierCosts);
  const rows = [];
  const skipped = [];

  const sortedVariations = [...variations].sort((a, b) =>
    compareVariations(a, b, productById)
  );

  for (const variation of sortedVariations) {
    const product = productById.get(variation.product_id);
    if (!product) {
      skipped.push(skippedVariation(null, variation, "missing product"));
      continue;
    }

    const token = cleanString(variation.square_token);
    if (!token) {
      skipped.push(skippedVariation(product, variation, "missing Square variation token"));
      continue;
    }

    const { cost, reason } = chooseSupplierCost(variation, groupedCosts);
    if (!cost) {
      skipped.push(skippedVariation(product, variation, reason));
      continue;
    }

    const vendorName = cleanString(cost.suppliers?.name);
    if (!vendorName) {
      skipped.push(skippedVariation(product, variation, "missing supplier name"));
      continue;
    }

    rows.push({
      Token: token,
      "Item Name": cleanString(product.name),
      "Variation Name": cleanString(variation.name || "Regular"),
      Description: productDescription(product),
      SKU: cleanString(variation.sku ?? product.sku),
      Price: formatMoney(variation.price ?? product.base_price),
      "Default Vendor Name": vendorName,
      "Default Vendor Code": cleanString(cost.supplier_sku),
      "Default Unit Cost": formatMoney(cost.wholesale_price),
    });
  }

  return { rows, skipped };
}

export function summarizeDefaultVendorImportRows(rows, skipped) {
  const vendorCounts = new Map();
  for (const row of rows) {
    const vendorName = row["Default Vendor Name"];
    vendorCounts.set(vendorName, (vendorCounts.get(vendorName) || 0) + 1);
  }

  return {
    importRows: rows.length,
    skippedRows: skipped.length,
    vendors: [...vendorCounts.entries()].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
    ),
  };
}

export function rowsToCsv(rows, headers = DEFAULT_VENDOR_IMPORT_HEADERS) {
  return [
    headers.map(csvEscape).join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")),
  ].join("\n");
}
