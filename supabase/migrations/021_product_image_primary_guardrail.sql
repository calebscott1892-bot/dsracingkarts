-- DS Racing Karts - product image primary guardrail
-- Prevents a product from having more than one primary image.

create unique index if not exists product_images_one_primary_per_product
  on product_images(product_id)
  where is_primary is true;
