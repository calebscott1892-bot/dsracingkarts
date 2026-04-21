-- ============================================================
-- DS Racing Karts — Migration 003
-- Adds: team_profiles, announcements
-- ============================================================

-- ============================================================
-- TEAM PROFILES
-- ============================================================
create table team_profiles (
  id            uuid primary key default uuid_generate_v4(),
  kart_number   text not null,
  team_name     text not null,
  tagline       text,
  accent_color  text not null default '#ef4444',
  accent_rgb    text not null default '239,68,68',
  logo_url      text,
  website_url   text,
  sort_order    int not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create trigger trg_team_profiles_updated
  before update on team_profiles
  for each row execute function update_updated_at();

alter table team_profiles enable row level security;

-- Public can read active team profiles
create policy "team_profiles_public_read" on team_profiles
  for select using (is_active = true);

-- Admin can do anything
create policy "team_profiles_admin_all" on team_profiles
  for all using (
    auth.uid() in (
      select id from admin_profiles where role in ('admin', 'super_admin')
    )
  );

-- ============================================================
-- ANNOUNCEMENTS
-- ============================================================
create type announcement_type as enum ('info', 'warning', 'event', 'promo');

create table announcements (
  id          uuid primary key default uuid_generate_v4(),
  title       text not null,
  body        text not null,
  type        announcement_type not null default 'info',
  cta_label   text,
  cta_url     text,
  is_active   boolean not null default true,
  starts_at   timestamptz,
  ends_at     timestamptz,
  sort_order  int not null default 0,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create trigger trg_announcements_updated
  before update on announcements
  for each row execute function update_updated_at();

alter table announcements enable row level security;

-- Public can read active, in-window announcements
create policy "announcements_public_read" on announcements
  for select using (
    is_active = true
    and (starts_at is null or starts_at <= now())
    and (ends_at   is null or ends_at   >= now())
  );

-- Admin can do anything
create policy "announcements_admin_all" on announcements
  for all using (
    auth.uid() in (
      select id from admin_profiles where role in ('admin', 'super_admin')
    )
  );

-- ============================================================
-- STORAGE BUCKET for team logos
-- ============================================================
-- Run in Supabase dashboard:
-- insert into storage.buckets (id, name, public) values ('team-logos', 'team-logos', true);
