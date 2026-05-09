-- ============================================================
-- DS Racing Karts - #77 and Postmates team profile fixes
-- Makes public fallback teams real editable admin records and
-- assigns the requested media.
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
select '77', 'Dale Arrowsmith', '4SS Heavy', '#831100', '131,17,0', '/images/history/%2377.jpeg', null, 0, true
where not exists (
  select 1 from team_profiles
  where lower(team_name) = 'dale arrowsmith'
     or kart_number = '77'
);

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
select '3', 'PostMates Racing', null, '#3b82f6', '59,130,246', '/images/history/team 3.jpeg', null, 9, true
where not exists (
  select 1 from team_profiles
  where lower(team_name) in ('postmates racing', 'postmates')
     or kart_number = '3'
);

update team_profiles
set
  kart_number = '77',
  logo_url = '/images/history/%2377.jpeg',
  is_active = true
where lower(team_name) = 'dale arrowsmith'
   or kart_number = '77';

update team_profiles
set
  kart_number = '3',
  tagline = null,
  logo_url = '/images/history/team 3.jpeg',
  is_active = true
where lower(team_name) in ('postmates racing', 'postmates')
   or kart_number = '3';
