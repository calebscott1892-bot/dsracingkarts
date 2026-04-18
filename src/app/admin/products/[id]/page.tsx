import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { ProductEditForm } from "@/components/admin/ProductEditForm";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AdminProductEditPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: product } = await supabase
    .from("products")
    .select(`
      *,
      product_images ( id, url, alt_text, sort_order, is_primary ),
      product_variations (
        id, name, sku, price, sale_price, sort_order,
        variation_options ( id, option_name, option_value ),
        inventory ( id, quantity, low_stock_alert, low_stock_threshold )
      ),
      product_categories ( category_id, categories ( id, name, slug ) )
    `)
    .eq("id", id)
    .single();

  if (!product) notFound();

  const { data: allCategories } = await supabase
    .from("categories")
    .select("id, name, slug, parent_id")
    .order("name");

  return (
    <div>
      <h1 className="font-heading text-3xl uppercase tracking-wider mb-8">
        Edit Product
      </h1>
      <ProductEditForm
        product={product}
        allCategories={allCategories || []}
      />
    </div>
  );
}
