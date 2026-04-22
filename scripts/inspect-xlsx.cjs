#!/usr/bin/env node
/**
 * Quick utility: inspect the Stocklist RRP.xlsx structure
 * Prints sheet names, column headers, row count, and 3 sample rows.
 * Usage: node scripts/inspect-xlsx.cjs "path/to/file.xlsx"
 */
const XLSX = require("xlsx");
const path = require("path");

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: node scripts/inspect-xlsx.cjs <path-to-xlsx>");
  process.exit(1);
}

const workbook = XLSX.readFile(path.resolve(filePath));
console.log("\nSheets:", workbook.SheetNames);

for (const sheetName of workbook.SheetNames) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Sheet: "${sheetName}"`);
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  console.log(`Rows: ${rows.length}`);

  if (rows.length === 0) {
    console.log("(empty)");
    continue;
  }

  const headers = Object.keys(rows[0]);
  console.log(`\nColumns (${headers.length}):`);
  headers.forEach((h, i) => console.log(`  [${i}] ${h}`));

  console.log(`\nSample rows (first 3):`);
  rows.slice(0, 3).forEach((row, i) => {
    console.log(`\n  Row ${i + 1}:`);
    for (const [key, val] of Object.entries(row)) {
      if (val !== "" && val !== null && val !== undefined) {
        console.log(`    ${key}: ${String(val).substring(0, 100)}`);
      }
    }
  });
}
