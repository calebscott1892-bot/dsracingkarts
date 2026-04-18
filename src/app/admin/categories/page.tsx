import { createClient } from "@/lib/supabase/server";

export default async function AdminCategoriesPage() {
  const supabase = await createClient();

  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, slug, parent_id")
    .order("sort_order")
    .order("name");

  // Get product counts per category
  const { data: productCounts } = await supabase
    .from("product_categories")
    .select("category_id");

  const countMap = new Map<string, number>();
  for (const pc of productCounts || []) {
    countMap.set(pc.category_id, (countMap.get(pc.category_id) || 0) + 1);
  }

  const parents = (categories || []).filter((c) => !c.parent_id);
  const childrenOf = (parentId: string) =>
    (categories || []).filter((c) => c.parent_id === parentId);

  const nameOf = (id: string | null) =>
    categories?.find((c) => c.id === id)?.name || "—";

  return (
    <div>
      <h1 className="font-heading text-3xl uppercase tracking-wider mb-6">Categories</h1>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-text-muted text-left bg-surface-700/50">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3">Parent</th>
              <th className="px-4 py-3">Products</th>
            </tr>
          </thead>
          <tbody>
            {parents.map((parent) => (
              <>
                <tr
                  key={parent.id}
                  className="border-t border-surface-600/50 hover:bg-surface-700/30"
                >
                  <td className="px-4 py-3 text-white font-medium">
                    {parent.name}
                  </td>
                  <td className="px-4 py-3 text-text-muted font-mono text-xs">
                    {parent.slug}
                  </td>
                  <td className="px-4 py-3 text-text-muted">—</td>
                  <td className="px-4 py-3 font-mono text-text-secondary">
                    {countMap.get(parent.id) || 0}
                  </td>
                </tr>
                {childrenOf(parent.id).map((child) => (
                  <tr
                    key={child.id}
                    className="border-t border-surface-600/30 hover:bg-surface-700/30"
                  >
                    <td className="px-4 py-3 text-text-secondary pl-10">
                      <span className="text-text-muted mr-2">└</span>
                      {child.name}
                    </td>
                    <td className="px-4 py-3 text-text-muted font-mono text-xs">
                      {child.slug}
                    </td>
                    <td className="px-4 py-3 text-text-muted text-xs">
                      {nameOf(child.parent_id)}
                    </td>
                    <td className="px-4 py-3 font-mono text-text-secondary">
                      {countMap.get(child.id) || 0}
                    </td>
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>

        {(!categories || categories.length === 0) && (
          <p className="text-text-muted text-center py-8">No categories found.</p>
        )}
      </div>

      <p className="text-text-muted text-xs mt-4 text-center">
        {categories?.length || 0} categories total
      </p>
    </div>
  );
}
