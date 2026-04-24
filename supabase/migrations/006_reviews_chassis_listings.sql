-- ============================================================
-- DS Racing Karts — Migration 006
-- Adds reviews table and chassis_listings (buy/sell board).
-- Safe to run multiple times — guarded with IF NOT EXISTS.
-- ============================================================

-- ============================================================
-- 1. REVIEWS
-- ============================================================
CREATE TABLE IF NOT EXISTS reviews (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_name  text NOT NULL,
  text         text NOT NULL,
  platform     text NOT NULL DEFAULT 'Google',   -- 'Google', 'Facebook', 'Direct', etc.
  rating       int  NOT NULL DEFAULT 5 CHECK (rating BETWEEN 1 AND 5),
  review_date  date,
  is_visible   boolean NOT NULL DEFAULT true,
  sort_order   int NOT NULL DEFAULT 0,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Public can only read visible reviews
DROP POLICY IF EXISTS "Public can read visible reviews" ON reviews;
CREATE POLICY "Public can read visible reviews"
  ON reviews FOR SELECT
  USING (is_visible = true);

-- Admins full access
DROP POLICY IF EXISTS "Admins can manage reviews" ON reviews;
CREATE POLICY "Admins can manage reviews"
  ON reviews FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================
-- 2. SEED existing reviews (hardcoded in ReviewsCarousel.tsx)
--    Uses a DO block to avoid column-alias conflicts with the
--    built-in 'text' type name, which caused parser errors in
--    the SELECT FROM (VALUES ...) AS v(...) pattern.
--    Guard: only inserts if the table is empty.
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM reviews LIMIT 1) THEN
    INSERT INTO reviews (author_name, text, platform, rating, sort_order) VALUES
      ('Stewart Shaw',
       'Great local karting business, always great workmanship for repairs and setup. Quick delivery for tyres and products! Highly recommend',
       'Facebook', 5, 1),
      ('Dilly Jathol',
       'They are Very good and thorough with their work. Dion works really hard to help, fix and guide you with your kart and to save you money on them aswell. The best in my opinion.',
       'Facebook', 5, 2),
      ('Troy Armstrong',
       'DSR have supported our team by setting up our kart, selling parts, offering advice and support. I appreciate everything you do for our team and endurance racing. I highly recommend DSR. Bel and Dion are out right legends and I love you both.',
       'Facebook', 5, 3),
      ('Vance Le Garde',
       'Great service from DS Racing Karts. They always get deliveries off asap when you place your order',
       'Facebook', 5, 4),
      ('Anthony Damcevski',
       'Hi Bel & Dion. I just wanted to thank you for making the last predator chassis for #420. I had the pleasure of driving the new kart for the first time today and it was absolutely fantastic!',
       'Facebook', 5, 5);
  END IF;
END $$;

-- ============================================================
-- 3. CHASSIS LISTINGS (buy/sell board)
-- ============================================================
CREATE TABLE IF NOT EXISTS chassis_listings (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_type    text NOT NULL CHECK (listing_type IN ('buy', 'sell')),
  contact_name    text NOT NULL,
  contact_email   text NOT NULL,
  contact_phone   text,
  description     text NOT NULL,
  asking_price    numeric(10,2),        -- NULL for "make offer" or buy requests
  chassis_year    int,
  condition       text CHECK (condition IN ('new', 'excellent', 'good', 'fair', 'parts-only')),
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'sold', 'expired')),
  admin_notes     text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chassis_listings_status ON chassis_listings(status);
CREATE INDEX IF NOT EXISTS idx_chassis_listings_type   ON chassis_listings(listing_type);

ALTER TABLE chassis_listings ENABLE ROW LEVEL SECURITY;

-- Anyone can submit a listing (INSERT only, no email verification needed at this stage)
DROP POLICY IF EXISTS "Public can submit chassis listings" ON chassis_listings;
CREATE POLICY "Public can submit chassis listings"
  ON chassis_listings FOR INSERT
  WITH CHECK (true);

-- Public can view approved or sold listings only
DROP POLICY IF EXISTS "Public can view approved chassis listings" ON chassis_listings;
CREATE POLICY "Public can view approved chassis listings"
  ON chassis_listings FOR SELECT
  USING (status IN ('approved', 'sold'));

-- Admins have full access
DROP POLICY IF EXISTS "Admins can manage chassis listings" ON chassis_listings;
CREATE POLICY "Admins can manage chassis listings"
  ON chassis_listings FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());
