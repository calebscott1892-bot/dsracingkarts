-- ============================================================
-- DS Racing Karts — Migration 008
-- Adds image_url column to chassis_listings for optional
-- photo uploads on the Preloved Predator Chassis page.
-- ============================================================

ALTER TABLE chassis_listings
  ADD COLUMN IF NOT EXISTS image_url text;

-- Storage bucket policy notes:
-- Create a public bucket called 'chassis-photos' in the Supabase dashboard.
-- Allow anonymous uploads with a storage policy:
--   INSERT: true (or limited to authenticated service role)
-- The public URL will be stored in image_url.
