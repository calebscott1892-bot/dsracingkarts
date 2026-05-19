export type CheckoutOrderItemForSquare = {
  product_id: string;
  variation_id: string;
  product_name: string;
  variation_name: string | null;
  sku: string | null;
  quantity: number;
  unit_price: number;
  square_variation_token?: string | null;
};

export function buildSquareOrderLineItems(items: CheckoutOrderItemForSquare[]) {
  return items.map((item) => ({
    name: item.product_name,
    variationName: item.variation_name !== "Regular" ? item.variation_name || undefined : undefined,
    quantity: String(item.quantity),
    note: item.sku ? `SKU: ${item.sku}` : undefined,
    catalogObjectId: item.square_variation_token || undefined,
    basePriceMoney: {
      amount: BigInt(Math.round(item.unit_price * 100)),
      currency: "AUD",
    },
    metadata: {
      product_id: item.product_id,
      variation_id: item.variation_id,
      sku: item.sku || "",
    },
  }));
}
