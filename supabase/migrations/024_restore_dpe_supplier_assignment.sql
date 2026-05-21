-- ============================================================
-- DS Racing Karts - restore confirmed DPE supplier assignments
--
-- Migration 023 renamed the original DPE import to IKD. The client later
-- confirmed the DPE Product Export rows are DPE except for a small overlap
-- set that appears in both the IKD and DPE source files and needs manual
-- review.
-- ============================================================

do $$
declare
  v_dpe_id uuid;
  v_ikd_id uuid;
begin
  insert into suppliers (name, square_vendor_id, notes, updated_at)
  values (
    'DPE',
    'BF27OEIZZJD6ZN4U',
    'Restored after source cross-check against DPE Product Export and IKD stocklist.',
    now()
  )
  on conflict (name) do update
  set
    square_vendor_id = excluded.square_vendor_id,
    updated_at = now()
  returning id into v_dpe_id;

  select id into v_ikd_id
  from suppliers
  where lower(name) = 'ikd'
  limit 1;

  if v_ikd_id is null then
    return;
  end if;

  update product_supplier_costs
  set
    supplier_id = v_dpe_id,
    updated_at = now()
  where supplier_id = v_ikd_id
    and source = 'DPE Product Export.csv'
    and upper(supplier_sku) not in (
      'MCAB30',
      'MCAB40',
      'MCAB50',
      'MCSV3',
      'OLMTBC',
      'OLMTCC',
      'OLMTDG',
      'OLMX9271',
      'OLMX9272',
      'OLXPSBL',
      'Z273240',
      'ZZ220',
      'ZZ230'
    );
end;
$$;
