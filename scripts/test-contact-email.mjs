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
  buildContactEmailPayload,
  DEFAULT_TRANSACTIONAL_EMAIL_FROM,
  getContactEmailConfig,
} = await importTs("../src/lib/contact-email.ts");

assert.deepEqual(getContactEmailConfig({}), {
  from: DEFAULT_TRANSACTIONAL_EMAIL_FROM,
  to: "dsracing@bigpond.com",
});
assert.deepEqual(
  getContactEmailConfig({
    CONTACT_EMAIL_FROM: " DSR <verified@example.com> ",
    CONTACT_EMAIL_TO: " contact@example.com ",
    ORDER_NOTIFICATION_EMAIL: "orders@example.com",
  }),
  {
    from: "DSR <verified@example.com>",
    to: "contact@example.com",
  }
);
assert.equal(
  getContactEmailConfig({ ORDER_NOTIFICATION_EMAIL: "orders@example.com" }).to,
  "orders@example.com"
);

const payload = buildContactEmailPayload(
  {
    name: "Codex <Diagnostic>",
    email: "diagnostic@example.com",
    subject: "Custom Racewear\r\nBcc: hidden@example.com",
    message: "Hello <script>alert(1)</script>",
  },
  {}
);

assert.equal(payload.from, DEFAULT_TRANSACTIONAL_EMAIL_FROM);
assert.equal(payload.to, "dsracing@bigpond.com");
assert.equal(payload.replyTo, "diagnostic@example.com");
assert.equal(
  payload.subject,
  "[Custom Racewear Bcc: hidden@example.com] Contact from Codex <Diagnostic>"
);
assert.match(payload.html, /Codex &lt;Diagnostic&gt;/);
assert.match(payload.html, /Hello &lt;script&gt;alert\(1\)&lt;\/script&gt;/);
assert.doesNotMatch(payload.html, /<script>alert/);

console.log("contact email tests passed");
