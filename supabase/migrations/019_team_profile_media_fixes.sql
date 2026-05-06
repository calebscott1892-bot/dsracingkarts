-- ============================================================
-- DS Racing Karts - team profile media fixes
-- Keeps seeded/team fallback data aligned with the public team cards.
-- Safe to run more than once.
-- ============================================================

update team_profiles
set
  logo_url = '/images/history/Scaff.png',
  is_active = true
where lower(team_name) = 'scaff it up';

update team_profiles
set
  logo_url = null,
  is_active = true
where lower(team_name) = 'dale arrowsmith';

update team_profiles
set
  kart_number = '83',
  logo_url = '/images/history/Skidmark Logo.jpeg',
  is_active = true
where lower(team_name) like '%skid mark%';

update team_profiles
set
  logo_url = '/images/history/Claw-Construction-Logo.png',
  website_url = coalesce(nullif(website_url, ''), 'https://clawconstruction.com.au/'),
  is_active = true
where lower(team_name) = 'claw racing';
