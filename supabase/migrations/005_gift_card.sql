-- ============================================================
-- DS Racing Karts — Migration 005
-- Adds e-gift card product with fixed-amount variations.
-- Safe to run multiple times — all inserts are guarded.
-- ============================================================

-- Insert the gift card product (conflict on unique slug column)
INSERT INTO products (
  name, slug, description, description_plain, status, visibility,
  item_type, base_price, shipping_enabled, is_sellable, is_stockable
) VALUES (
  'DS Racing Karts E-Gift Card',
  'ds-racing-karts-e-gift-card',
  '<p>Give the gift of speed. The DS Racing Karts E-Gift Card can be redeemed against any product in our online store.</p><p>Available in fixed amounts of $50, $100, $200 and $500, or contact us for a custom amount.</p>',
  'Give the gift of speed. The DS Racing Karts E-Gift Card can be redeemed against any product in our online store. Available in fixed amounts of $50, $100, $200 and $500, or contact us for a custom amount.',
  'active',
  'visible',
  'Gift Card',
  50.00,
  false,
  true,
  false
)
ON CONFLICT (slug) DO NOTHING;

-- Insert variations — guarded with WHERE NOT EXISTS because product_variations
-- has no unique constraint on (product_id, sku), so ON CONFLICT DO NOTHING
-- would only catch primary key collisions (UUID, always unique) and fail silently.
WITH product AS (
  SELECT id FROM products WHERE slug = 'ds-racing-karts-e-gift-card'
)
INSERT INTO product_variations (product_id, name, sku, price, sort_order)
SELECT
  product.id,
  variation.name,
  variation.sku,
  variation.price,
  variation.sort_order
FROM product,
(VALUES
  ('$50 Gift Card',   'GIFTCARD-50',  50.00::numeric,  0),
  ('$100 Gift Card',  'GIFTCARD-100', 100.00::numeric, 1),
  ('$200 Gift Card',  'GIFTCARD-200', 200.00::numeric, 2),
  ('$500 Gift Card',  'GIFTCARD-500', 500.00::numeric, 3)
) AS variation(name, sku, price, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM product_variations pv
  WHERE pv.sku = variation.sku
);

-- Seed inventory rows for the gift card variations.
-- NOTE: stock_status is a GENERATED ALWAYS column — do NOT include it in the INSERT.
-- quantity > 0 automatically sets stock_status to 'in_stock'.
-- Guarded with WHERE NOT EXISTS on the unique variation_id index.
INSERT INTO inventory (variation_id, quantity)
SELECT pv.id, 9999
FROM product_variations pv
JOIN products p ON pv.product_id = p.id
WHERE p.slug = 'ds-racing-karts-e-gift-card'
AND NOT EXISTS (
  SELECT 1 FROM inventory i WHERE i.variation_id = pv.id
);
