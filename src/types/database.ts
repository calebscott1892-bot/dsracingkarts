/** Core database types matching the Supabase schema */

export type ProductStatus = "active" | "draft" | "archived";
export type OrderStatus = "pending" | "paid" | "processing" | "shipped" | "delivered" | "cancelled" | "refunded";
export type StockStatus = "in_stock" | "out_of_stock" | "unknown";
export type UserRole = "customer" | "admin" | "super_admin";
export type Visibility = "visible" | "hidden" | "unavailable";

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parent_id: string | null;
  square_id: string | null;
  sort_order: number;
  image_url: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  children?: Category[];
  product_count?: number;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  description_plain: string | null;
  sku: string | null;
  square_token: string | null;
  status: ProductStatus;
  visibility: Visibility;
  item_type: string;
  weight_kg: number | null;
  seo_title: string | null;
  seo_description: string | null;
  base_price: number | null;
  primary_image_url: string | null;
  shipping_enabled: boolean;
  is_sellable: boolean;
  is_stockable: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  // Joined
  categories?: Category[];
  variations?: ProductVariation[];
  images?: ProductImage[];
}

export interface ProductVariation {
  id: string;
  product_id: string;
  name: string;
  sku: string | null;
  square_token: string | null;
  price: number;
  sale_price: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  // Joined
  options?: VariationOption[];
  inventory?: Inventory;
}

export interface VariationOption {
  id: string;
  variation_id: string;
  option_name: string;
  option_value: string;
}

export interface ProductImage {
  id: string;
  product_id: string;
  url: string;
  alt_text: string | null;
  sort_order: number;
  is_primary: boolean;
}

export interface Inventory {
  id: string;
  variation_id: string;
  quantity: number;
  stock_status: StockStatus;
  low_stock_alert: boolean;
  low_stock_threshold: number;
  updated_at: string;
}

export interface Customer {
  id: string;
  auth_id: string | null;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postcode: string | null;
  country: string;
  created_at: string;
}

export interface Order {
  id: string;
  order_number: string;
  customer_id: string | null;
  status: OrderStatus;
  subtotal: number;
  shipping_cost: number;
  tax: number;
  total: number;
  shipping_name: string | null;
  shipping_line1: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
  shipping_postcode: string | null;
  shipping_country: string;
  square_payment_id: string | null;
  customer_notes: string | null;
  admin_notes: string | null;
  paid_at: string | null;
  shipped_at: string | null;
  created_at: string;
  // Joined
  items?: OrderItem[];
  customer?: Customer;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  variation_id: string | null;
  product_name: string;
  variation_name: string | null;
  sku: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
}

/** Cart types (client-side, not in DB) */
export interface CartItem {
  product_id: string;
  product_slug: string;
  variation_id: string;
  product_name: string;
  variation_name: string;
  sku: string | null;
  price: number;
  quantity: number;
  image_url: string | null;
  max_quantity: number;
}

export interface Cart {
  items: CartItem[];
  subtotal: number;
  item_count: number;
}
