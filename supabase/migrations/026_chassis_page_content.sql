-- ============================================================
-- Chassis page editable content
-- ============================================================

CREATE TABLE IF NOT EXISTS chassis_page_content (
  id                              int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  hero_eyebrow                    text NOT NULL DEFAULT 'DS Racing Karts',
  hero_title                      text NOT NULL DEFAULT 'DSR',
  hero_accent                     text NOT NULL DEFAULT 'Predator',
  hero_body                       text NOT NULL DEFAULT 'Australian-built. Enduro-proven. The chassis of choice for serious endurance karting competitors across NSW.',
  hero_cta_label                  text NOT NULL DEFAULT 'Buy or Sell a Predator',
  featured_eyebrow                text NOT NULL DEFAULT 'Used Chassis',
  featured_title                  text NOT NULL DEFAULT 'Used Chassis For Sale',
  featured_body                   text NOT NULL DEFAULT 'Current used chassis photo. Contact DS Racing Karts for availability, inspection details, and what is included with the chassis.',
  featured_primary_cta_label      text NOT NULL DEFAULT 'Ask About This Chassis',
  featured_secondary_cta_label    text NOT NULL DEFAULT 'List Yours',
  featured_image_url              text NOT NULL DEFAULT '/Chasis/image.png',
  featured_image_alt              text NOT NULL DEFAULT 'Used red kart chassis available through DS Racing Karts',
  featured_image_caption          text NOT NULL DEFAULT 'Used chassis available through DS Racing Karts.',
  active_listings_heading         text NOT NULL DEFAULT 'Active Listings',
  listing_form_heading            text NOT NULL DEFAULT 'List Your Chassis',
  listing_form_intro              text NOT NULL DEFAULT 'Looking to buy or sell a used DSR Predator? Fill in the form below. DS Racing Karts will review your submission and publish it to this board.',
  created_at                      timestamptz DEFAULT now(),
  updated_at                      timestamptz DEFAULT now()
);

INSERT INTO chassis_page_content (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE chassis_page_content ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view chassis page content" ON chassis_page_content;
CREATE POLICY "Public can view chassis page content"
  ON chassis_page_content FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can manage chassis page content" ON chassis_page_content;
CREATE POLICY "Admins can manage chassis page content"
  ON chassis_page_content FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());
