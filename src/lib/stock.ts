export const ZERO_STOCK_CONTACT_MESSAGE =
  "Many items not currently in stock may be available within 24-48 hours. Please contact us to confirm ETA.";

type InventoryLike = {
  quantity?: number | string | null;
} | null | undefined;

type InventoryRelation = InventoryLike | InventoryLike[];

export type VariationWithInventory = {
  inventory?: InventoryRelation;
};

export function getInventoryRecord(inventory: InventoryRelation) {
  return Array.isArray(inventory) ? inventory[0] ?? null : inventory ?? null;
}

export function getInventoryQuantity(variation: VariationWithInventory) {
  const inventory = getInventoryRecord(variation.inventory);
  if (!inventory?.quantity && inventory?.quantity !== 0) return null;

  const quantity =
    typeof inventory.quantity === "number"
      ? inventory.quantity
      : Number.parseInt(String(inventory.quantity), 10);

  return Number.isFinite(quantity) ? quantity : null;
}

export function isUnavailableByStock(
  variation: VariationWithInventory,
  isStockable = true
) {
  if (!isStockable) return false;
  const quantity = getInventoryQuantity(variation);
  return quantity !== null && quantity <= 0;
}

export function hasEnoughStockForQuantity(
  variation: VariationWithInventory,
  requestedQuantity: number,
  isStockable = true
) {
  if (!isStockable) return true;
  const quantity = getInventoryQuantity(variation);

  // Missing inventory means unknown/non-managed in legacy rows; only explicit
  // zero or insufficient stock should block checkout.
  if (quantity === null) return true;
  return quantity >= requestedQuantity;
}
