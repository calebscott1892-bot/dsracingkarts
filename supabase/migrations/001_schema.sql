-- ============================================================
-- DS Racing Karts — Supabase Schema
-- Next.js + Supabase + Square Web Payments
-- ============================================================

-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";  -- fuzzy text search

-- ============================================================
-- ENUM TYPES
-- ============================================================
create type product_status as enum ('active', 'draft', 'archived');
create type order_status as enum ('pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded');
create type stock_status as enum ('in_stock', 'out_of_stock', 'unknown');
create type user_role as enum ('customer', 'admin', 'super_admin');
create type visibility as enum ('visible', 'hidden', 'unavailable');

-- ============================================================
-- 1. CATEGORIES (self-referencing for nesting)
-- ============================================================
create table categories (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,
  slug          text not null unique,
  description   text,
  parent_id     uuid references categories(id) on delete set null,
  square_id     text unique,           -- original Square category token
  sort_order    int default 0,
  image_url     text,
  seo_title     text,
  seo_description text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index idx_categories_parent on categories(parent_id);
create index idx_categories_slug on categories(slug);

-- ============================================================
-- 2. PRODUCTS
-- ============================================================
create table products (
  id              uuid primary key default uuid_generate_v4(),
  name            text not null,
  slug            text not null unique,
  description     text,                  -- stored as HTML from Square
  description_plain text,                -- stripped plaintext for search
  sku             text,
  square_token    text unique,           -- original Square item token
  status          product_status default 'active',
  visibility      visibility default 'visible',
  item_type       text default 'Physical good',
  weight_kg       numeric(8,3),
  seo_title       text,
  seo_description text,
  permalink       text,
  gtin            text,
  shipping_enabled  boolean default true,
  is_sellable     boolean default true,
  is_stockable    boolean default true,
  is_archived     boolean default false,
  -- Denormalised fields for fast listing queries
  base_price      numeric(10,2),         -- lowest variation price
  primary_image_url text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index idx_products_slug on products(slug);
create index idx_products_status on products(status);
create index idx_products_square on products(square_token);
-- Full-text search index
create index idx_products_search on products using gin (
  (to_tsvector('english', coalesce(name,'') || ' ' || coalesce(description_plain,'') || ' ' || coalesce(sku,'')))
);
-- Trigram index for fuzzy/autocomplete search
create index idx_products_name_trgm on products using gin (name gin_trgm_ops);

-- ============================================================
-- 3. PRODUCT ↔ CATEGORY (many-to-many)
-- ============================================================
create table product_categories (
  product_id  uuid not null references products(id) on delete cascade,
  category_id uuid not null references categories(id) on delete cascade,
  primary key (product_id, category_id)
);

create index idx_pc_category on product_categories(category_id);

-- ============================================================
-- 4. PRODUCT VARIATIONS
-- ============================================================
create table product_variations (
  id              uuid primary key default uuid_generate_v4(),
  product_id      uuid not null references products(id) on delete cascade,
  name            text not null default 'Regular',  -- "Small", "Medium", etc.
  sku             text,
  square_token    text unique,
  price           numeric(10,2) not null,
  sale_price      numeric(10,2),
  sort_order      int default 0,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index idx_variations_product on product_variations(product_id);
create index idx_variations_sku on product_variations(sku);

-- ============================================================
-- 5. VARIATION OPTIONS (Size, Colour, Type, etc.)
-- ============================================================
create table variation_options (
  id            uuid primary key default uuid_generate_v4(),
  variation_id  uuid not null references product_variations(id) on delete cascade,
  option_name   text not null,           -- "Size", "Colour"
  option_value  text not null            -- "Small", "Red"
);

create index idx_varopts_variation on variation_options(variation_id);

-- ============================================================
-- 6. PRODUCT IMAGES
-- ============================================================
create table product_images (
  id          uuid primary key default uuid_generate_v4(),
  product_id  uuid not null references products(id) on delete cascade,
  url         text not null,
  alt_text    text,
  sort_order  int default 0,
  is_primary  boolean default false,
  created_at  timestamptz default now()
);

create index idx_images_product on product_images(product_id);

-- ============================================================
-- 7. STOCK / INVENTORY
-- ============================================================
create table inventory (
  id            uuid primary key default uuid_generate_v4(),
  variation_id  uuid not null references product_variations(id) on delete cascade,
  quantity      int not null default 0,
  stock_status  stock_status generated always as (
    case
      when quantity > 0 then 'in_stock'::stock_status
      when quantity <= 0 then 'out_of_stock'::stock_status
    end
  ) stored,
  low_stock_alert   boolean default false,
  low_stock_threshold int default 0,
  updated_at    timestamptz default now()
);

create unique index idx_inventory_variation on inventory(variation_id);

-- ============================================================
-- 8. CUSTOMERS
-- ============================================================
create table customers (
  id          uuid primary key default uuid_generate_v4(),
  auth_id     uuid unique references auth.users(id) on delete set null,
  email       text unique not null,
  first_name  text,
  last_name   text,
  phone       text,
  -- Address
  address_line1 text,
  address_line2 text,
  city        text,
  state       text,
  postcode    text,
  country     text default 'AU',
  -- Metadata
  square_customer_id text unique,
  notes       text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create index idx_customers_email on customers(email);
create index idx_customers_auth on customers(auth_id);

-- ============================================================
-- 9. ORDERS
-- ============================================================
create table orders (
  id              uuid primary key default uuid_generate_v4(),
  order_number    text unique not null,  -- human-readable DSR-0001
  customer_id     uuid references customers(id) on delete set null,
  status          order_status default 'pending',
  -- Pricing
  subtotal        numeric(10,2) not null default 0,
  shipping_cost   numeric(10,2) default 0,
  tax             numeric(10,2) default 0,
  total           numeric(10,2) not null default 0,
  -- Shipping address (snapshot at order time)
  shipping_name   text,
  shipping_line1  text,
  shipping_line2  text,
  shipping_city   text,
  shipping_state  text,
  shipping_postcode text,
  shipping_country  text default 'AU',
  -- Square payment
  square_payment_id text,
  square_order_id   text,
  -- Notes
  customer_notes  text,
  admin_notes     text,
  -- Timestamps
  paid_at         timestamptz,
  shipped_at      timestamptz,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index idx_orders_customer on orders(customer_id);
create index idx_orders_status on orders(status);
create index idx_orders_number on orders(order_number);

-- Auto-incrementing order number
create sequence order_number_seq start 1001;

create or replace function generate_order_number()
returns trigger as $$
begin
  new.order_number := 'DSR-' || lpad(nextval('order_number_seq')::text, 5, '0');
  return new;
end;
$$ language plpgsql;

create trigger trg_order_number
  before insert on orders
  for each row
  when (new.order_number is null)
  execute function generate_order_number();

-- ============================================================
-- 10. ORDER LINE ITEMS
-- ============================================================
create table order_items (
  id            uuid primary key default uuid_generate_v4(),
  order_id      uuid not null references orders(id) on delete cascade,
  product_id    uuid references products(id) on delete set null,
  variation_id  uuid references product_variations(id) on delete set null,
  -- Snapshot at order time
  product_name  text not null,
  variation_name text,
  sku           text,
  quantity      int not null default 1,
  unit_price    numeric(10,2) not null,
  total_price   numeric(10,2) not null
);

create index idx_order_items_order on order_items(order_id);

-- ============================================================
-- 11. NEWSLETTER SUBSCRIBERS
-- ============================================================
create table newsletter_subscribers (
  id          uuid primary key default uuid_generate_v4(),
  email       text unique not null,
  subscribed  boolean default true,
  source      text default 'website',
  created_at  timestamptz default now()
);

-- ============================================================
-- 12. ADMIN PROFILES (extends Supabase auth)
-- ============================================================
create table admin_profiles (
  id        uuid primary key references auth.users(id) on delete cascade,
  role      user_role not null default 'admin',
  name      text,
  created_at timestamptz default now()
);

-- ============================================================
-- UTILITY: updated_at trigger
-- ============================================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Apply to all tables with updated_at
create trigger trg_categories_updated before update on categories for each row execute function update_updated_at();
create trigger trg_products_updated before update on products for each row execute function update_updated_at();
create trigger trg_variations_updated before update on product_variations for each row execute function update_updated_at();
create trigger trg_inventory_updated before update on inventory for each row execute function update_updated_at();
create trigger trg_customers_updated before update on customers for each row execute function update_updated_at();
create trigger trg_orders_updated before update on orders for each row execute function update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Enable RLS on all tables
alter table categories enable row level security;
alter table products enable row level security;
alter table product_categories enable row level security;
alter table product_variations enable row level security;
alter table variation_options enable row level security;
alter table product_images enable row level security;
alter table inventory enable row level security;
alter table customers enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table newsletter_subscribers enable row level security;
alter table admin_profiles enable row level security;

-- Helper: check if current user is admin
create or replace function is_admin()
returns boolean as $$
begin
  return exists (
    select 1 from admin_profiles
    where id = auth.uid()
    and role in ('admin', 'super_admin')
  );
end;
$$ language plpgsql security definer;

-- ---- PUBLIC READ (storefront) ----

-- Categories: anyone can read
create policy "categories_public_read" on categories
  for select using (true);

-- Products: anyone can read active/visible
create policy "products_public_read" on products
  for select using (status = 'active' and visibility = 'visible');

-- Product categories: anyone can read
create policy "pc_public_read" on product_categories
  for select using (true);

-- Variations: anyone can read
create policy "variations_public_read" on product_variations
  for select using (true);

-- Variation options: anyone can read
create policy "varopts_public_read" on variation_options
  for select using (true);

-- Images: anyone can read
create policy "images_public_read" on product_images
  for select using (true);

-- Inventory: anyone can read (for stock status display)
create policy "inventory_public_read" on inventory
  for select using (true);

-- ---- ADMIN FULL ACCESS ----

create policy "categories_admin_all" on categories
  for all using (is_admin()) with check (is_admin());

create policy "products_admin_all" on products
  for all using (is_admin()) with check (is_admin());

create policy "pc_admin_all" on product_categories
  for all using (is_admin()) with check (is_admin());

create policy "variations_admin_all" on product_variations
  for all using (is_admin()) with check (is_admin());

create policy "varopts_admin_all" on variation_options
  for all using (is_admin()) with check (is_admin());

create policy "images_admin_all" on product_images
  for all using (is_admin()) with check (is_admin());

create policy "inventory_admin_all" on inventory
  for all using (is_admin()) with check (is_admin());

create policy "orders_admin_all" on orders
  for all using (is_admin()) with check (is_admin());

create policy "order_items_admin_all" on order_items
  for all using (is_admin()) with check (is_admin());

create policy "customers_admin_all" on customers
  for all using (is_admin()) with check (is_admin());

create policy "newsletter_admin_all" on newsletter_subscribers
  for all using (is_admin()) with check (is_admin());

create policy "admin_profiles_admin_read" on admin_profiles
  for select using (is_admin());

-- ---- CUSTOMER OWN DATA ----

-- Customers can read/update their own record
create policy "customers_own_read" on customers
  for select using (auth_id = auth.uid());

create policy "customers_own_update" on customers
  for update using (auth_id = auth.uid());

-- Customers can read their own orders
create policy "orders_own_read" on orders
  for select using (
    customer_id in (select id from customers where auth_id = auth.uid())
  );

-- Customers can read their own order items
create policy "order_items_own_read" on order_items
  for select using (
    order_id in (
      select o.id from orders o
      join customers c on c.id = o.customer_id
      where c.auth_id = auth.uid()
    )
  );

-- Newsletter: anyone can insert (signup)
create policy "newsletter_public_insert" on newsletter_subscribers
  for insert with check (true);

-- ============================================================
-- STORAGE BUCKET for product images
-- ============================================================
-- Run in Supabase dashboard or via API:
-- insert into storage.buckets (id, name, public) values ('product-images', 'product-images', true);
