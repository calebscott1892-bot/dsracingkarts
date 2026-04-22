import { createClient } from "@/lib/supabase/server";
import { CategoriesManager } from "./CategoriesManager";

export default async function AdminCategoriesPage() {
  const supabase = await createClient();

  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, slug, parent_id")
    .order("sort_order")
    .order("name");

  const { data: productCounts } = await supabase
    .from("product_categories")
    .select("category_id");

  const countMap = new Map<string, number>();
  for (const pc of productCounts || []) {
    countMap.set(pc.category_id, (countMap.get(pc.category_id) || 0) + 1);
  }

  const enriched = (categories || []).map((c) => ({
    ...c,
    productCount: countMap.get(c.id) || 0,
  }));

  return <CategoriesManager categories={enriched} />;
}
