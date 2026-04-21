-- ============================================================
-- DS Racing Karts — Migration 004
-- Seeds hardcoded team profiles into team_profiles table.
-- Run in Supabase SQL Editor (safe to run once — uses ON CONFLICT DO NOTHING).
-- ============================================================

insert into team_profiles (kart_number, team_name, tagline, accent_color, accent_rgb, logo_url, website_url, sort_order, is_active)
values
  ('338', 'Scaff It Up',     'Building speed from the ground up', '#f97316', '249,115,22',  null,                                          null,                            0,  true),
  ('43',  'Kart Blanche',    'Full freedom on the track',         '#e2e8f0', '226,232,240', '/images/history/Kart-Blanche-43.jpeg',         null,                            1,  true),
  ('114', 'Skid Mark Racing','Leaving our mark on every lap',     '#22c55e', '34,197,94',   '/images/history/Skid Mark Marcing.jpeg',       null,                            2,  true),
  ('5',   'Claw Racing #2',  'Grip it and rip it',                '#a855f7', '168,85,247',  '/images/history/Claw Racing.jpg',             'https://clawconstruction.com.au/', 3, true),
  ('555', 'Claw Racing',     'Clutching every podium',            '#ef4444', '239,68,68',   '/images/history/Claw Racing.jpg',             'https://clawconstruction.com.au/', 4, true),
  ('272', 'Venom Racing',    'Striking fast, finishing first',    '#84cc16', '132,204,22',  null,                                          null,                            5,  true),
  ('285', 'Team 285',        'Profile coming soon',               '#64748b', '100,116,139', null,                                          null,                            6,  true),
  ('22',  'Kart GPT',        'Precision engineered racing',       '#06b6d4', '6,182,212',   '/images/history/KartGPT.jpeg',                null,                            7,  true),
  ('249', 'Torque it Up',    'Maximum torque, maximum send',      '#eab308', '234,179,8',   null,                                          null,                            8,  true),
  ('',    'PostMates Racing','Profile coming soon',               '#3b82f6', '59,130,246',  null,                                          null,                            9,  true)
on conflict do nothing;
