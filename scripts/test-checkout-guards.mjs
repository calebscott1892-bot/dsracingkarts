#!/usr/bin/env node

import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import ts from "typescript";

async function importTs(relativePath) {
  const source = await readFile(new URL(relativePath, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const outputDir = new URL("../.tmp/test-modules/", import.meta.url);
  await mkdir(outputDir, { recursive: true });
  const outputFile = new URL(`${relativePath.replace(/[^a-z0-9]/gi, "_")}.mjs`, outputDir);
  await writeFile(outputFile, outputText);
  return import(outputFile.href);
}

const {
  findCustomerPhoneConflict,
  getPhoneSearchCandidates,
  getSquarePhoneSearchCandidate,
  normalizeAustralianPhoneForMatch,
  normalizePhoneForSquare,
} = await importTs("../src/lib/phone.ts");
const {
  buildSquareOrderLineItems,
} = await importTs("../src/lib/checkout-guards.ts");
const { assertResendSuccess } = await importTs("../src/lib/email.ts");
const { isSquareNotFoundError } = await importTs("../src/lib/square-errors.ts");

assert.equal(normalizePhoneForSquare("0439 762 051"), "+61439762051");
assert.equal(normalizePhoneForSquare("61439762051"), "+61439762051");
assert.equal(normalizePhoneForSquare("+61 439 762 051"), "+61439762051");
assert.equal(normalizePhoneForSquare("123"), undefined);

assert.equal(normalizeAustralianPhoneForMatch("0439 762 051"), "0439762051");
assert.equal(normalizeAustralianPhoneForMatch("61439762051"), "0439762051");
assert.equal(normalizeAustralianPhoneForMatch("+61 439 762 051"), "0439762051");
assert.deepEqual(getPhoneSearchCandidates("0439 762 051"), ["+61439762051", "0439762051"]);
assert.equal(
  getSquarePhoneSearchCandidate("0439 762 051"),
  "+61439762051",
  "Square customer search must use E.164 only; local AU phone format is rejected by Square"
);

const phoneConflict = findCustomerPhoneConflict(
  [
    { id: "existing", email: "existing@example.com", phone: "0439 762 051" },
    { id: "same-email", email: "new@example.com", phone: "0439 762 051" },
  ],
  "new@example.com",
  "61439762051"
);
assert.equal(
  phoneConflict?.id,
  "existing",
  "checkout should block a new email using another customer's phone number"
);
assert.equal(
  findCustomerPhoneConflict(
    [{ id: "same-email", email: "new@example.com", phone: "0439 762 051" }],
    "new@example.com",
    "61439762051"
  ),
  null,
  "same customer email can update its own phone format"
);

assert.doesNotThrow(() => assertResendSuccess({ data: { id: "email-id" }, error: null }));
assert.throws(
  () =>
    assertResendSuccess({
      data: null,
      error: { name: "invalid_from_address", message: "Invalid sender", statusCode: 422 },
    }),
  /Resend email failed.*Invalid sender/
);

assert.equal(isSquareNotFoundError({ statusCode: 404 }), true);
assert.equal(isSquareNotFoundError({ errors: [{ code: "NOT_FOUND" }] }), true);
assert.equal(isSquareNotFoundError({ statusCode: 500 }), false);

const [squareLineItem] = buildSquareOrderLineItems([
  {
    product_id: "product-1",
    variation_id: "variation-1",
    product_name: "Catalog Part",
    variation_name: "Regular",
    sku: "SKU-1",
    quantity: 2,
    unit_price: 12.34,
    square_variation_token: "SQUAREVAR1",
  },
]);
assert.equal(
  squareLineItem.catalogObjectId,
  "SQUAREVAR1",
  "Square order line items should reference the CatalogItemVariation so Square can associate inventory/catalog data"
);
assert.equal(squareLineItem.basePriceMoney.amount, 1234n);

console.log("checkout guard tests passed");
