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
      ('Liam Cockcroft',
       'These guys are really solid. Bel is super helpful and Dion knows his stuff. DSR can provide top level technical support if you are looking at getting in to, or progressing at karting. I can''t thank them or recommend them highly enough. Much love, DSR.',
       'Google', 5, 1),
      ('Riley Schwarz',
       'Dion and Bel have looked after us for a number of years. The work they''ve done for our kart is amazing, not to mention the amazing chassis that they built and custom powder coated for us. Could not be happier or recommend more!',
       'Google', 5, 2),
      ('AOR Specialised Transport Services NSW',
       'Absolutely amazing to deal with. I''ve recently purchased a complete enduro kart from the DSR team and I couldn''t be happier. A weapon on the track and the tech & mechanical support that comes with it all is priceless. Thanks guys. Team Promove Motosport.',
       'Google', 5, 3),
      ('Jeffrey Thompson',
       'We purchased our endurance kart from DS Racing Karts in 2022. Dion and Bel have delivered excellent customer service for parts and repairs and have also been very generous with their time and advice. This has enabled us to get the most from our kart and helped us to 1st in class and 3rd outright in the 2024 ERC 12hr at Eastern Creek. Thank you Bel and Dion.',
       'Google', 5, 4),
      ('Keith Gillan',
       'Got into ERC endurance karting series thanks to DSR. I didn''t know it at the time, but DSR are a top tier team and we were extremely lucky to have their support during the season. They will do anything to ensure you are enjoying yourself on track and provide you with the goods to run at the front of the pack. From the go kart chassis, spare parts, and service I can''t fault them. They work so hard to help out anyone at the track. 5 stars!',
       'Google', 5, 5),
      ('Dilly Jathoul',
       'Very good and thorough with their work. Dion works really hard to help, fix and guide you with your kart and to save you money on them as well. The best in my opinion.',
       'Google', 5, 6),
      ('Steve McAlister',
       'I raced with DSR for about 12 months in the local enduro kart series, great team to work with, friendly, knowledgeable and very professional. I''m pretty picky when it comes to mechanical stuff and in the world of endurance karting, not having mechanical failures is a major thing. Highly recommend if you either want parts or advice!',
       'Google', 5, 7),
      ('Mick Kerslake',
       'First time using DS Racing for repairs. Dropped kart off on Saturday and was finished Monday. New seat fitted and engine problem solved. Highly recommend.',
       'Google', 5, 8),
      ('Ryley Morgan',
       'Awesome to deal with, supplied us with a fast kart for the Eastern Creek 24hr!',
       'Google', 5, 9),
      ('John Markwick',
       'Massive shout out to Dion at DS Racing Karts. Always available to offer advice and answer any questions I have. Super competitive pricing with prompt shipping of parts. Won''t shop anywhere else now.',
       'Google', 5, 10),
      ('Annie White',
       'Massive thanks to Dion & Bel for all the advice and guidance. Customer service is second to none. Nothing is too much trouble and their knowledge of all things karting/motorsport is unbelievable. Highly recommended!',
       'Google', 5, 11);
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
