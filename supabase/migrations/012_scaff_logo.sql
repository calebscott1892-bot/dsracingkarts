-- ============================================================
-- DS Racing Karts - Migration 012
-- Sets the Scaff It Up team logo to the provided Scaff PNG.
-- ============================================================

UPDATE team_profiles
SET logo_url = '/images/history/Scaff.png'
WHERE team_name = 'Scaff It Up';
