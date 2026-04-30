# Category Assignment Guardrails

This document is the safety contract for future category automation.

## Non-negotiables

1. Only touch products that currently have **no category assignments**.
2. Never overwrite or "improve" a product that already has one or more categories.
3. Every suggestion and every applied change must be logged.
4. Every applied change must be reversible.
5. Changes should be reviewable in one place so the client can quickly spot and correct mistakes.

## What problem this is solving

The client is manually categorising imported supplier products in Square.
That work is high-effort and must be protected.

Future imports may include many uncategorised items. We want a system that can:

- inspect only uncategorised products
- recommend likely categories
- optionally apply approved matches
- leave a full audit trail

## Safe approach

### Phase 1 - Suggest only

- build a candidate set from products that are already categorised
- compare uncategorised products using:
  - title similarity
  - shared brand tokens
  - shared SKU patterns
  - description keywords
  - existing category vocabulary
- write suggestions into `category_assignment_suggestions`
- do not apply changes automatically

### Phase 2 - Human review

- admin reviews pending suggestions
- admin approves or rejects each one
- only approved suggestions can be applied

### Phase 3 - Apply with audit

- apply category only if the product is still uncategorised at apply time
- write the change to `category_assignment_audit`
- record the run in `category_assignment_runs`

## Data structures added

- `uncategorized_products` view
- `category_assignment_runs`
- `category_assignment_suggestions`
- `category_assignment_audit`
- `apply_category_assignment_suggestion(...)` database function

## Important implementation rule

At the moment of applying a suggestion, the system must re-check:

- product still exists
- product is still active
- product still has zero category assignments

If any of those are false, skip the apply and log the skip.

## Safety mechanism now in place

The database apply function is intentionally defensive:

- it locks the suggestion row before applying
- it re-checks whether the product already has any category assignments
- if the product is no longer uncategorised, it does **not** apply anything
- it records a `skipped` audit entry instead

This is the main protection against accidentally overwriting the client's manual categorisation work.

## Issue 1 - "One item with sizes/options, not 10 duplicate items"

This is possible, but it is a separate problem from categorisation.

Two safer paths exist:

1. Fix the product structure in Square so sizes/colours become real variations.
2. Build a storefront grouping layer that visually groups same-family items without rewriting Square data.

Path 2 is safer than auto-merging records in Square, but still needs careful rules because grouped items must not combine unrelated products.

## Issue 2 - Old ranking URLs spreadsheet

This is not necessarily an upsell scare tactic.

If there are old ranking URLs that now 404 or redirect badly, that can absolutely waste existing SEO equity.
The safest workflow is:

1. import the spreadsheet
2. verify which URLs are really broken
3. map each one to the closest live destination
4. add explicit redirects
5. keep a redirect register so nothing is lost later

## Recommended next build step

Build a dry-run categorisation tool that:

- reads only `uncategorized_products`
- generates suggestions
- stores them without applying
- exports a reviewable report for approval

That tool now exists as:

- `scripts/generate-category-suggestions.mjs`

Current behaviour:

- reads active categorised products and active uncategorised products
- scores likely categories based on title / sku / description token overlap
- exports review files into `tmp/`
- does not write any category assignments
- does not modify Square
- does not modify already-categorised items
