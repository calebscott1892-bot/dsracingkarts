#!/usr/bin/env node

import assert from "node:assert/strict";

import {
  buildDefaultVendorImportRows,
  summarizeDefaultVendorImportRows,
} from "./square-default-vendor-import-utils.mjs";

const products = [
  {
    id: "product-1",
    name: "Single variation product",
    description: "Existing description",
  },
  {
    id: "product-2",
    name: "Sized product",
    description: null,
  },
];

const variations = [
  {
    id: "variation-1",
    product_id: "product-1",
    name: "Regular",
    sku: "ABC-001",
    square_token: "SQUAREVAR1",
    price: "123.45",
  },
  {
    id: "variation-2",
    product_id: "product-2",
    name: "Small",
    sku: "ABC-002-S",
    square_token: "SQUAREVAR2",
    price: "99.00",
  },
  {
    id: "variation-3",
    product_id: "product-2",
    name: "Large",
    sku: "ABC-002-L",
    square_token: "SQUAREVAR3",
    price: "109.00",
  },
];

const supplierCosts = [
  {
    product_id: "product-1",
    variation_id: "variation-1",
    supplier_sku: "VENDOR-1",
    wholesale_price: "55.50",
    suppliers: { name: "IKD" },
  },
  {
    product_id: "product-2",
    variation_id: "variation-2",
    supplier_sku: "VENDOR-2S",
    wholesale_price: "70.00",
    suppliers: { name: "Revolution Racegear" },
  },
];

const { rows, skipped } = buildDefaultVendorImportRows({
  products,
  variations,
  supplierCosts,
});

assert.deepEqual(rows, [
  {
    Token: "SQUAREVAR1",
    "Item Name": "Single variation product",
    "Variation Name": "Regular",
    Description: "Existing description",
    SKU: "ABC-001",
    Price: "123.45",
    "Default Vendor Name": "IKD",
    "Default Vendor Code": "VENDOR-1",
    "Default Unit Cost": "55.50",
  },
  {
    Token: "SQUAREVAR2",
    "Item Name": "Sized product",
    "Variation Name": "Small",
    Description: "",
    SKU: "ABC-002-S",
    Price: "99.00",
    "Default Vendor Name": "Revolution Racegear",
    "Default Vendor Code": "VENDOR-2S",
    "Default Unit Cost": "70.00",
  },
]);

assert.deepEqual(skipped, [
  {
    product_id: "product-2",
    product_name: "Sized product",
    variation_id: "variation-3",
    variation_name: "Large",
    sku: "ABC-002-L",
    reason: "missing supplier cost",
  },
]);

assert.deepEqual(summarizeDefaultVendorImportRows(rows, skipped), {
  importRows: 2,
  skippedRows: 1,
  vendors: [
    ["IKD", 1],
    ["Revolution Racegear", 1],
  ],
});

console.log("square default vendor import tests passed");
