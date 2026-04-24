-- ============================================================
-- DS Racing Karts - Migration 011
-- Refreshes the homepage review set to the latest approved copy
-- and adds Facebook review-source entries alongside Google.
-- ============================================================

DELETE FROM reviews
WHERE author_name IN (
  'Liam Cockcroft',
  'Riley Schwarz',
  'AOR Specialised Transport Services NSW',
  'Jeffrey Thompson',
  'Keith Gillan',
  'Dilly Jathoul',
  'Steve McAlister',
  'Mick Kerslake',
  'Ryley Morgan',
  'John Markwick',
  'Annie White',
  'Stewart Shaw',
  'Dilly Jathol',
  'Troy Armstrong',
  'Vance Le Garde',
  'Anthony Damcevski'
);

INSERT INTO reviews (author_name, text, platform, rating, sort_order)
VALUES
  (
    'Stewart Shaw',
    'Great local karting business, always great workmanship for repairs and setup. Quick delivery for tyres and products! Highly recommend',
    'Facebook',
    5,
    1
  ),
  (
    'Dilly Jathol',
    'They are Very good and thorough with their work. Dion works really hard to help, fix and guide you with your kart and to save you money on them aswell. The best in my opinion.',
    'Facebook',
    5,
    2
  ),
  (
    'Troy Armstrong',
    'DSR have supported our team by setting up our kart, selling parts, offering advice and support. I appreciate everything you do for our team and endurance racing. I highly recommend DSR. Bel and Dion are out right legends and I love you both.',
    'Facebook',
    5,
    3
  ),
  (
    'Vance Le Garde',
    'Great service from DS Racing Karts. They always get deliveries off asap when you place your order',
    'Facebook',
    5,
    4
  ),
  (
    'Anthony Damcevski',
    'Hi Bel & Dion. I just wanted to thank you for making the last predator chassis for #420. I had the pleasure of driving the new kart for the first time today and it was absolutely fantastic!',
    'Facebook',
    5,
    5
  );
