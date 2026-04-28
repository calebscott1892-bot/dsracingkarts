-- ============================================================
-- DS Racing Karts - client follow-ups, 2026-04-28
-- Keeps Claw Racing profiles present and uses the Claw Construction logo.
-- Safe to run more than once.
-- ============================================================

insert into team_profiles (
  kart_number,
  team_name,
  tagline,
  accent_color,
  accent_rgb,
  logo_url,
  website_url,
  sort_order,
  is_active
)
values (
  '555',
  'Claw Racing',
  'Clutching every podium',
  '#ef4444',
  '239,68,68',
  '/images/history/Claw-Construction-Logo.png',
  'https://clawconstruction.com.au/',
  4,
  true
)
on conflict do nothing;

update team_profiles
set
  logo_url = '/images/history/Claw-Construction-Logo.png',
  website_url = coalesce(website_url, 'https://clawconstruction.com.au/'),
  is_active = true
where lower(team_name) like 'claw racing%';
