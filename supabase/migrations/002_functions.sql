-- Inventory decrement function (called from checkout API)
create or replace function decrement_inventory(
  p_variation_id uuid,
  p_quantity int
)
returns void as $$
begin
  update inventory
  set quantity = quantity - p_quantity
  where variation_id = p_variation_id;
end;
$$ language plpgsql security definer;
