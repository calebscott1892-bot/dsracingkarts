-- Fix decrement_inventory to prevent negative inventory values
-- and validate inputs before applying the update.

create or replace function decrement_inventory(
  p_variation_id uuid,
  p_quantity int
)
returns void as $$
begin
  -- Reject nonsensical quantity
  if p_quantity <= 0 then
    raise exception 'p_quantity must be a positive integer, got %', p_quantity;
  end if;

  -- Decrement, but never below zero
  update inventory
  set quantity = greatest(0, quantity - p_quantity)
  where variation_id = p_variation_id;

  -- If no row updated, the variation has no inventory record — silently ignore
  -- (some products may not track inventory; this is intentional)
end;
$$ language plpgsql security definer;
