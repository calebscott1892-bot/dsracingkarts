-- ============================================================
-- DS Racing Karts - supplier / wholesale cost tracking
-- Supports supplier catalogue imports where Square/site products
-- may overlap across vendors (for example IKD and DPE).
-- Safe to run more than once.
-- ============================================================

create table if not exists suppliers (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  square_vendor_id text unique,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists product_supplier_costs (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid references products(id) on delete cascade,
  variation_id uuid references product_variations(id) on delete cascade,
  supplier_id uuid not null references suppliers(id) on delete cascade,
  supplier_sku text not null,
  supplier_item_name text not null,
  wholesale_price numeric(10,2),
  retail_price numeric(10,2),
  currency text not null default 'AUD',
  source text,
  source_row_number int,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint product_supplier_costs_supplier_sku_unique unique (supplier_id, supplier_sku),
  constraint product_supplier_costs_product_or_variation_chk check (
    product_id is not null or variation_id is not null
  )
);

create index if not exists idx_product_supplier_costs_product
  on product_supplier_costs(product_id);

create index if not exists idx_product_supplier_costs_variation
  on product_supplier_costs(variation_id);

create index if not exists idx_product_supplier_costs_supplier
  on product_supplier_costs(supplier_id);

insert into suppliers (name)
values ('DPE')
on conflict (name) do update
set updated_at = now();
