-- Keep the public team carousel free of placeholder copy and lock in
-- the two client-supplied team images on existing databases.

update team_profiles
set tagline = null
where lower(trim(coalesce(tagline, ''))) = 'profile coming soon';

update team_profiles
set
  kart_number = '77',
  logo_url = '/images/history/%2377.jpeg',
  is_active = true
where lower(team_name) like '%dale arrowsmith%'
   or kart_number = '77';

update team_profiles
set
  kart_number = '3',
  team_name = 'PostMates Racing',
  tagline = null,
  logo_url = '/images/history/team 3.jpeg',
  is_active = true
where lower(team_name) in ('postmates racing', 'postmates', 'post mates racing')
   or kart_number = '3';
