-- ============================================================
-- DS Racing Karts - racewear gallery visibility defaults
-- Named client uploads should appear on the Services page by
-- default. The generic bulk gallery stays in the full gallery.
-- ============================================================

alter table racewear_gallery
  alter column is_featured set default true;

update racewear_gallery
set is_featured = true
where is_active = true
  and is_featured = false
  and btrim(group_label) <> ''
  and lower(btrim(group_label)) <> 'racewear gallery';
