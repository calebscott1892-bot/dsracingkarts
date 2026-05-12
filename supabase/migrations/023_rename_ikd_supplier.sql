-- ============================================================
-- DS Racing Karts - correct first supplier import label
-- The first supplier import was IKD, not DPE.
-- Safe to run more than once.
-- ============================================================

do $$
declare
  v_dpe_id uuid;
  v_ikd_id uuid;
begin
  select id into v_dpe_id from suppliers where lower(name) = 'dpe' limit 1;
  select id into v_ikd_id from suppliers where lower(name) = 'ikd' limit 1;

  if v_dpe_id is null then
    return;
  end if;

  if v_ikd_id is null then
    update suppliers
    set
      name = 'IKD',
      notes = coalesce(notes, 'Renamed from DPE after client confirmed the first import was IKD.'),
      updated_at = now()
    where id = v_dpe_id;
  else
    delete from product_supplier_costs dpe_cost
    where dpe_cost.supplier_id = v_dpe_id
      and exists (
        select 1
        from product_supplier_costs ikd_cost
        where ikd_cost.supplier_id = v_ikd_id
          and ikd_cost.supplier_sku = dpe_cost.supplier_sku
      );

    update product_supplier_costs
    set supplier_id = v_ikd_id,
        updated_at = now()
    where supplier_id = v_dpe_id;

    delete from suppliers where id = v_dpe_id;
  end if;
end;
$$;
