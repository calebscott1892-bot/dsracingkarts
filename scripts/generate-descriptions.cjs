/**
 * Generate product descriptions via Claude for products whose existing
 * description is empty or very short (< 60 chars — e.g. Square shorthand
 * like "1.6mm x 2000mm" or the name echoed back).
 *
 * Safety:
 *   - A backup of all products has already been written to backups/ before
 *     this script runs. Restore from there if anything goes wrong.
 *   - Only touches products with description length < 60 chars. Products
 *     with substantive descriptions (>=60 chars) are never overwritten.
 *   - Preserves the existing short text (specs, fitment notes) inside the
 *     generated description — the model is told to keep it verbatim.
 *   - --dry-run prints 5 sample outputs without writing to DB.
 *   - --limit=N caps the run (useful for trial runs after dry-run).
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... node scripts/generate-descriptions.js --dry-run
 *   ANTHROPIC_API_KEY=sk-... node scripts/generate-descriptions.js --limit=5
 *   ANTHROPIC_API_KEY=sk-... node scripts/generate-descriptions.js
 */

const { createClient } = require("@supabase/supabase-js");
const Anthropic = require("@anthropic-ai/sdk").default;

const SUPABASE_URL = "https://bqkefjpoejjgxdxueiod.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxa2VmanBvZWpqZ3hkeHVlaW9kIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTY1NDE4OCwiZXhwIjoyMDkxMjMwMTg4fQ.rZgp-5fhb6x_RIBIa9AXus3nsbaXb6Iz_4vpWsmryoQ";

const MIN_EXISTING_LEN = 60; // only expand descriptions shorter than this
const SLEEP_MS = 300; // tiny pause between API calls
const MODEL = "claude-haiku-4-5-20251001"; // cheapest current model

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const LIMIT_ARG = args.find((a) => a.startsWith("--limit="));
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split("=")[1], 10) : null;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You write concise, factual e-commerce product descriptions for DS Racing Karts, an Australian go-kart parts retailer.

Rules:
- 2-3 short sentences, 40-70 words total. No headings, no bullet points, no emoji.
- Tone: professional, motorsport-oriented. Avoid hype words like "premium", "ultimate", "experience".
- If the input contains specs (dimensions, materials, fitment), preserve them verbatim and weave them into the prose.
- Never invent specifications, brand claims, compatibility, or certifications that aren't in the input.
- Never promise warranties, shipping times, or stock availability.
- Write plain text — no HTML, no markdown.
- End with the category context implicitly (e.g. racing application) but don't literally say "suitable for racing".`;

function buildUserPrompt({ name, category, existing }) {
  return `Product name: ${name}
Category: ${category || "Go-kart part"}
Existing short description / specs: ${existing || "(none)"}

Write the description.`;
}

async function generate({ name, category, existing }) {
  const resp = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 300,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserPrompt({ name, category, existing }) }],
  });
  const text = resp.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
  return { text, usage: resp.usage };
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("❌ ANTHROPIC_API_KEY env var not set.");
    process.exit(1);
  }

  // Fetch products + their primary category for context
  const { data: products, error } = await supabase
    .from("products")
    .select(`
      id, name, description,
      product_categories ( categories ( name ) )
    `)
    .order("name");

  if (error) {
    console.error("DB error:", error);
    process.exit(1);
  }

  const targets = products.filter((p) => (p.description || "").trim().length < MIN_EXISTING_LEN);
  console.log(`Total products: ${products.length}`);
  console.log(`Targets (<${MIN_EXISTING_LEN} char desc): ${targets.length}`);
  console.log(`Mode: ${DRY_RUN ? "DRY RUN (5 samples, no writes)" : LIMIT ? `LIMIT ${LIMIT}` : "FULL RUN"}`);
  console.log(`Model: ${MODEL}\n`);

  const queue = DRY_RUN ? targets.slice(0, 5) : LIMIT ? targets.slice(0, LIMIT) : targets;

  let success = 0;
  let fail = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (let i = 0; i < queue.length; i++) {
    const p = queue[i];
    const category = p.product_categories?.[0]?.categories?.name || "";
    const existing = (p.description || "").trim();

    try {
      const { text, usage } = await generate({
        name: p.name,
        category,
        existing,
      });
      totalInputTokens += usage.input_tokens || 0;
      totalOutputTokens += usage.output_tokens || 0;

      console.log(`\n[${i + 1}/${queue.length}] ${p.name}`);
      console.log(`  category: ${category || "(none)"}`);
      console.log(`  existing: ${existing || "(empty)"}`);
      console.log(`  → ${text}`);

      if (!DRY_RUN) {
        const { error: updateErr } = await supabase
          .from("products")
          .update({
            description: text,
            description_plain: text, // also update plain-text mirror used in SEO/structured data
          })
          .eq("id", p.id);
        if (updateErr) {
          console.error(`  ❌ update failed: ${updateErr.message}`);
          fail++;
          continue;
        }
      }
      success++;
    } catch (err) {
      console.error(`  ❌ API error: ${err.message}`);
      fail++;
    }

    if (i < queue.length - 1) await new Promise((r) => setTimeout(r, SLEEP_MS));
  }

  console.log(`\n─────────────────────────`);
  console.log(`Done. Success: ${success}, Failed: ${fail}`);
  console.log(`Tokens — input: ${totalInputTokens}, output: ${totalOutputTokens}`);
  // Haiku 4.5 pricing: $1/Mtok input, $5/Mtok output (approx)
  const cost = (totalInputTokens / 1_000_000) * 1 + (totalOutputTokens / 1_000_000) * 5;
  console.log(`Estimated cost: $${cost.toFixed(3)}`);
  if (DRY_RUN) {
    console.log(`\nDRY RUN — no DB writes performed. Review samples above.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
