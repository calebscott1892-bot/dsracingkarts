# Legacy URL Audit - 2026-04-30

Source spreadsheet:

- `C:\Users\belac\Downloads\dsracingkarts.com.au-Performance-on-Search-2026-04-29.xlsx`

## Summary

This was **not** just generic upsell fluff.

The spreadsheet contains a mix of:

- old product URLs that already redirect correctly
- old category / page URLs that currently 404

## Findings from the audit

### Already okay

Old product URLs with trailing numeric IDs are generally fine now.
They resolve to the modern slug-only product URL, for example:

- `/product/fully-customised-kart-racewear-package/212` -> `/product/fully-customised-kart-racewear-package`
- `/product/dsr-predator-4ss-chassis/395` -> `/product/dsr-predator-4ss-chassis`

### Definitely broken before this patch

Examples that returned `404` during the audit:

- `/custom-racewear`
- `/our-services`
- `/about-us`
- `/gallery`
- `/4-stroke-go-kart-servicing-sydney`
- `/shop/stub-axles-accessories/27`
- `/shop/tyres/36`
- `/shop/steering-components/24`
- `/shop/engines-accessories/4`
- `/shop/wheels-accessories/17`
- `/shop/hubs/9`
- `/shop/brakes-components/6`
- `/shop/honda-gx200/32`
- `/shop/plastics-accessories/10`

## Redirects added in code

Safe redirects were added for:

- `/shop/:slug/:legacyId` -> `/shop?category=:slug`
- `/custom-racewear` -> `/services#custom-racewear`
- `/our-services` -> `/services`
- `/about-us` -> `/about`
- `/gallery` -> `/services/racewear-gallery`
- `/4-stroke-go-kart-servicing-sydney` -> `/services`

## Still unresolved on purpose

The following type of URL should not be redirected blindly:

- `/s/stories/...`

Those need a content decision first, because redirecting an old article to an unrelated page can create a poor user experience and a soft-404 in search.

## Recommendation

1. Deploy the redirect patch.
2. Re-run the spreadsheet audit after deployment.
3. Review any remaining article/content URLs individually.
