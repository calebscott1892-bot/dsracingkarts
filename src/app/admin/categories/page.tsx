import { createServiceClient } from "@/lib/supabase/server";
import { CategoriesManager } from "./CategoriesManager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminCategoriesPage() {
  const supabase = createServiceClient();

  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, slug, parent_id")
    .order("sort_order")
    .order("name");

  // The product_categories table has more than 1000 rows — Supabase's default
  // page size — so a plain .select() would silently undercount. Paginate to
  // get an accurate per-category total.
  const productCounts: { category_id: string }[] = [];
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("product_categories")
      .select("category_id")
      .range(from, from + pageSize - 1);
    if (error || !data || data.length === 0) break;
    productCounts.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  const countMap = new Map<string, number>();
  for (const pc of productCounts) {
    countMap.set(pc.category_id, (countMap.get(pc.category_id) || 0) + 1);
  }

  const enriched = (categories || []).map((c) => ({
    ...c,
    productCount: countMap.get(c.id) || 0,
  }));

  return <CategoriesManager categories={enriched} />;
}
