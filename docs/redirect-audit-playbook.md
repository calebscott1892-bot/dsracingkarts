# Legacy URL Redirect Audit Playbook

This is the safe workflow for checking claims about "broken old ranking URLs".

## Why this matters

This is not automatically an upsell scare tactic.

If older URLs used to rank, and they now 404, loop, or point to weak destinations,
that can waste SEO value and create a bad user experience.

## What we need to verify

For each legacy URL in the spreadsheet:

1. Does it return `200`, `301/308`, `404`, or an error?
2. If it redirects, does it land on the right replacement page?
3. If it is broken, what is the best modern destination?
4. Should it redirect permanently?

## Safe process

1. Import the spreadsheet of legacy URLs.
2. Test every URL in a scriptable batch.
3. Record the current response status and final destination.
4. Map only genuinely broken or badly-routed URLs to the closest live replacement.
5. Keep a redirect register in the repo so future migrations do not lose the mapping.

## Recommended spreadsheet columns

- `legacy_url`
- `current_status`
- `final_url`
- `issue_type`
- `recommended_target`
- `notes`
- `implemented`

## Important rule

Never create blanket redirects based only on string similarity.

Each redirect should map to the closest real equivalent page so we do not create
irrelevant landings or soft-404 behaviour.
