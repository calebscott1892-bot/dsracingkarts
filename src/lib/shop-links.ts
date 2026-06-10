// Must match the live Square category slug ("Chassis" → "chassis-2"). Using the
// canonical slug means the chassis category recognises itself (e.g. the Predator
// pre-loved cross-link) when reached via normal navigation, instead of relying
// on the category-name fallback in the shop page. Verified against the DB.
export const CHASSIS_CATEGORY_SLUG = "chassis-2";
export const CHASSIS_CATEGORY_HREF = `/shop?category=${CHASSIS_CATEGORY_SLUG}`;
