-- ============================================================
-- DS Racing Karts - category assignment guardrails
-- Preparation for safe semi-automated categorisation of NEW,
-- currently uncategorised products only.
--
-- Nothing here auto-assigns categories by itself.
-- This migration only creates audit + suggestion tables and a
-- view of products that currently have no category rows.
-- ============================================================

create table if not exists category_assignment_runs (
  id uuid primary key default gen_random_uuid(),
  mode text not null check (mode in ('manual', 'suggestion', 'applied', 'reverted')),
  source text not null default 'admin',
  notes text not null default '',
  created_by uuid references admin_profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists category_assignment_suggestions (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references category_assignment_runs(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  product_square_token text,
  product_name text not null,
  previous_category_ids uuid[] not null default '{}',
  suggested_category_id uuid not null references categories(id) on delete cascade,
  confidence numeric(5,4) not null default 0,
  rationale text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'applied', 'reverted', 'skipped')),
  approved_by uuid references admin_profiles(id) on delete set null,
  approved_at timestamptz,
  applied_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_category_assignment_suggestions_run
  on category_assignment_suggestions(run_id);

create index if not exists idx_category_assignment_suggestions_product
  on category_assignment_suggestions(product_id);

create index if not exists idx_category_assignment_suggestions_status
  on category_assignment_suggestions(status);

create table if not exists category_assignment_audit (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references category_assignment_runs(id) on delete set null,
  product_id uuid not null references products(id) on delete cascade,
  product_square_token text,
  product_name text not null,
  action text not null check (action in ('manual', 'suggested', 'applied', 'reverted', 'skipped')),
  previous_category_ids uuid[] not null default '{}',
  new_category_ids uuid[] not null default '{}',
  note text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  changed_by uuid references admin_profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_category_assignment_audit_product
  on category_assignment_audit(product_id, created_at desc);

create or replace view uncategorized_products as
select
  p.id,
  p.square_token,
  p.name,
  p.slug,
  p.sku,
  p.description_plain,
  p.primary_image_url,
  p.created_at,
  p.updated_at
from products p
left join product_categories pc on pc.product_id = p.id
where p.status = 'active'
group by
  p.id,
  p.square_token,
  p.name,
  p.slug,
  p.sku,
  p.description_plain,
  p.primary_image_url,
  p.created_at,
  p.updated_at
having count(pc.category_id) = 0;

create or replace function apply_category_assignment_suggestion(
  p_suggestion_id uuid,
  p_changed_by uuid default null,
  p_note text default ''
)
returns jsonb
language plpgsql
as $$
declare
  v_suggestion category_assignment_suggestions%rowtype;
  v_existing_category_ids uuid[];
  v_existing_category_count integer;
begin
  select *
  into v_suggestion
  from category_assignment_suggestions
  where id = p_suggestion_id
  for update;

  if not found then
    raise exception 'Category suggestion % not found', p_suggestion_id;
  end if;

  select
    coalesce(array_agg(pc.category_id order by pc.category_id), '{}'::uuid[]),
    count(pc.category_id)
  into v_existing_category_ids, v_existing_category_count
  from product_categories pc
  where pc.product_id = v_suggestion.product_id;

  if v_existing_category_count > 0 then
    update category_assignment_suggestions
    set
      status = 'skipped',
      approved_by = coalesce(approved_by, p_changed_by),
      approved_at = coalesce(approved_at, now())
    where id = v_suggestion.id;

    insert into category_assignment_audit (
      run_id,
      product_id,
      product_square_token,
      product_name,
      action,
      previous_category_ids,
      new_category_ids,
      note,
      metadata,
      changed_by
    )
    values (
      v_suggestion.run_id,
      v_suggestion.product_id,
      v_suggestion.product_square_token,
      v_suggestion.product_name,
      'skipped',
      v_existing_category_ids,
      v_existing_category_ids,
      coalesce(nullif(p_note, ''), 'Skipped because product was no longer uncategorized at apply time.'),
      jsonb_build_object(
        'reason', 'product_already_categorized',
        'suggestion_id', v_suggestion.id,
        'suggested_category_id', v_suggestion.suggested_category_id
      ),
      p_changed_by
    );

    return jsonb_build_object(
      'status', 'skipped',
      'reason', 'product_already_categorized',
      'product_id', v_suggestion.product_id,
      'existing_category_ids', v_existing_category_ids
    );
  end if;

  insert into product_categories (product_id, category_id)
  values (v_suggestion.product_id, v_suggestion.suggested_category_id)
  on conflict do nothing;

  update category_assignment_suggestions
  set
    status = 'applied',
    approved_by = coalesce(approved_by, p_changed_by),
    approved_at = coalesce(approved_at, now()),
    applied_at = now()
  where id = v_suggestion.id;

  insert into category_assignment_audit (
    run_id,
    product_id,
    product_square_token,
    product_name,
    action,
    previous_category_ids,
    new_category_ids,
    note,
    metadata,
    changed_by
  )
  values (
    v_suggestion.run_id,
    v_suggestion.product_id,
    v_suggestion.product_square_token,
    v_suggestion.product_name,
    'applied',
    '{}'::uuid[],
    array[v_suggestion.suggested_category_id],
    coalesce(nullif(p_note, ''), 'Applied approved category suggestion.'),
    jsonb_build_object(
      'suggestion_id', v_suggestion.id,
      'suggested_category_id', v_suggestion.suggested_category_id,
      'confidence', v_suggestion.confidence,
      'rationale', v_suggestion.rationale
    ),
    p_changed_by
  );

  return jsonb_build_object(
    'status', 'applied',
    'product_id', v_suggestion.product_id,
    'category_id', v_suggestion.suggested_category_id
  );
end;
$$;
