-- ============================================================
-- DS Racing Karts — Migration 009
-- Racewear gallery — DB-driven so admin can upload new
-- work without a code change.
-- ============================================================

CREATE TABLE IF NOT EXISTS racewear_gallery (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_label text        NOT NULL,
  image_url   text        NOT NULL,
  alt_text    text        NOT NULL DEFAULT '',
  sort_order  integer     NOT NULL DEFAULT 0,
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Index for ordered display
CREATE INDEX IF NOT EXISTS racewear_gallery_sort_idx
  ON racewear_gallery (sort_order, created_at);

-- Seed existing hardcoded gallery entries
INSERT INTO racewear_gallery (group_label, image_url, alt_text, sort_order) VALUES
  ('Wilson / Enhanced HVAC', '/images/history/Racewear1.jpeg',      'Wilson – Enhanced HVAC race suit design render',            10),
  ('NCR – No Chance Racing', '/images/history/racewear2.webp',      'NCR No Chance Racing – race suit design render',            20),
  ('NCR – No Chance Racing', '/images/history/racewear6.webp',      'NCR No Chance Racing – finished suit on driver',            21),
  ('Stratco',                '/images/history/racewear3.webp',      'Stratco / Lawrence & Hanson – race suit design render',     30),
  ('DSR Racing Suit',        '/images/history/racewear4.webp',      'DSR race suit – design render (front & back)',              40),
  ('DSR Racing Suit',        '/images/history/racewear4irl.jpg',    'DSR race suit – finished suit on driver',                   41),
  ('RK Racing Studio – HR42','/images/history/racewear9.webp',      'HR42 RK Racing Studio – finished race suit',                50),
  ('RK Racing Studio – HR42','/images/history/racewear7.webp',      'HR42 – custom race boots',                                  51),
  ('RK Racing Studio – HR42','/images/history/racewear7gloves.webp','HR42 – custom racing gloves',                               52),
  ('STC Motorsport',         '/images/history/racewear5.jpg',       'STC Motorsport – Chloe Ford in custom race suit',           60),
  ('BARBEN Architectural Hardware', '/images/history/racewear8.jpg','BARBEN Architectural Hardware – team race suits at Eastern Creek', 70),
  ('DSR Branded Apparel',    '/images/history/racewearDRS.webp',    'DSR custom hoodie – front',                                 80),
  ('DSR Branded Apparel',    '/images/history/RacewearDRSback.webp','DSR racing jersey – at the track',                          81)
ON CONFLICT DO NOTHING;

-- Storage bucket: create 'racewear-photos' (public) in Supabase dashboard.
