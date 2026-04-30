-- ============================================================
-- DS Racing Karts - category assignment revert support
-- Adds a safe revert function for applied category suggestions.
-- ============================================================

create or replace function revert_category_assignment_suggestion(
  p_suggestion_id uuid,
  p_changed_by uuid default null,
  p_note text default ''
)
returns jsonb
language plpgsql
as $$
declare
  v_suggestion category_assignment_suggestions%rowtype;
  v_deleted_count integer;
begin
  select *
  into v_suggestion
  from category_assignment_suggestions
  where id = p_suggestion_id
  for update;

  if not found then
    raise exception 'Category suggestion % not found', p_suggestion_id;
  end if;

  if v_suggestion.status <> 'applied' then
    raise exception 'Only applied suggestions can be reverted. Current status: %', v_suggestion.status;
  end if;

  delete from product_categories
  where product_id = v_suggestion.product_id
    and category_id = v_suggestion.suggested_category_id;

  get diagnostics v_deleted_count = row_count;

  update category_assignment_suggestions
  set status = 'reverted'
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
    'reverted',
    array[v_suggestion.suggested_category_id],
    '{}'::uuid[],
    coalesce(nullif(p_note, ''), 'Reverted previously applied category suggestion.'),
    jsonb_build_object(
      'suggestion_id', v_suggestion.id,
      'suggested_category_id', v_suggestion.suggested_category_id,
      'deleted_assignment_count', v_deleted_count
    ),
    p_changed_by
  );

  return jsonb_build_object(
    'status', 'reverted',
    'product_id', v_suggestion.product_id,
    'category_id', v_suggestion.suggested_category_id,
    'deleted_assignment_count', v_deleted_count
  );
end;
$$;
