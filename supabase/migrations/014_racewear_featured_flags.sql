-- ============================================================
-- DS Racing Karts - racewear gallery curation controls
-- Lets admin choose which images appear on the Services page
-- and which stay in the full gallery only.
-- Safe to run more than once.
-- ============================================================

alter table racewear_gallery
  add column if not exists is_featured boolean not null default false;

-- Keep the long-standing manually curated local images featured by default.
update racewear_gallery
set is_featured = true
where image_url like '/images/history/%';
