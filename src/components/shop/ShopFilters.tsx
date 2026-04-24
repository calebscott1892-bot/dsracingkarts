"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { SlidersHorizontal, Gift } from "lucide-react";
import type { Category } from "@/types/database";

interface Props {
  categories: Pick<Category, "id" | "name" | "slug" | "parent_id">[];
  currentCategory?: string;
  currentSort?: string;
  currentSearch?: string;
}

export function ShopFilters({ categories, currentCategory, currentSort, currentSearch }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);

  function updateParam(key: string, value: string | undefined, closePanel = false) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete("page");
    if (closePanel) setFiltersOpen(false);
    router.push(`/shop?${params.toString()}`);
  }

  const parentCats = categories.filter((c) => !c.parent_id);
  const childrenOf = (parentId: string) =>
    categories.filter((c) => c.parent_id === parentId);

  const activeFilterCount =
    (currentCategory ? 1 : 0) +
    (currentSearch ? 1 : 0) +
    (currentSort && currentSort !== "name_asc" ? 1 : 0);

  const filterContent = (
    <>
      {/* Categories */}
      <div>
        <label className="font-heading text-xs uppercase tracking-[0.3em] text-brand-red block mb-3">
          Category
        </label>
        <ul className="space-y-0.5">
          <li>
            <button
              onClick={() => updateParam("category", undefined, true)}
              className={`text-sm w-full text-left px-3 py-1.5 transition-all ${
                !currentCategory
                  ? "text-white bg-brand-red/10 border-l-2 border-brand-red"
                  : "text-text-secondary hover:text-white hover:bg-surface-700/50 border-l-2 border-transparent"
              }`}
            >
              All Categories
            </button>
          </li>
          {parentCats.map((cat) => (
            <li key={cat.id}>
              <button
                onClick={() => updateParam("category", cat.slug, true)}
                className={`text-sm w-full text-left px-3 py-1.5 transition-all ${
                  currentCategory === cat.slug
                    ? "text-white bg-brand-red/10 border-l-2 border-brand-red"
                    : "text-text-secondary hover:text-white hover:bg-surface-700/50 border-l-2 border-transparent"
                }`}
              >
                {cat.name}
              </button>
              {childrenOf(cat.id).length > 0 && (
                <ul className="ml-4 space-y-0.5">
                  {childrenOf(cat.id).map((child) => (
                    <li key={child.id}>
                      <button
                        onClick={() => updateParam("category", child.slug, true)}
                        className={`text-xs w-full text-left px-3 py-1 transition-all ${
                          currentCategory === child.slug
                            ? "text-brand-red border-l border-brand-red"
                            : "text-text-muted hover:text-white border-l border-transparent"
                        }`}
                      >
                        {child.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* Sort */}
      <div>
        <label className="font-heading text-xs uppercase tracking-[0.3em] text-brand-red block mb-3">
          Sort By
        </label>
        <select
          value={currentSort || "name_asc"}
          onChange={(e) => updateParam("sort", e.target.value)}
          className="input-dark text-sm"
        >
          <option value="name_asc">Name: A to Z</option>
          <option value="price_asc">Price: Low to High</option>
          <option value="price_desc">Price: High to Low</option>
        </select>
      </div>

      {/* Gift card — sits apart from categories so it stays easy to spot */}
      <div>
        <label className="font-heading text-xs uppercase tracking-[0.3em] text-brand-red block mb-3">
          Gift Cards
        </label>
        <Link
          href="/gift-card"
          className="flex items-center gap-3 px-3 py-2.5 border border-racing-red/40 bg-racing-red/10 hover:bg-racing-red/15 hover:border-racing-red transition-colors"
        >
          <Gift size={18} className="text-racing-red shrink-0" strokeWidth={1.5} />
          <span className="flex-1 min-w-0">
            <span className="block font-heading text-xs uppercase tracking-[0.15em] text-white">
              Buy an E-Gift Card
            </span>
            <span className="block text-[11px] text-white/60 mt-0.5">
              $50 – $500 or custom
            </span>
          </span>
        </Link>
      </div>
    </>
  );

  return (
    <div className="space-y-6">
      {/* Mobile toggle */}
      <button
        onClick={() => setFiltersOpen(!filtersOpen)}
        aria-label="Toggle filters and sorting"
        aria-expanded={filtersOpen}
        className="lg:hidden flex items-center gap-2 text-sm text-text-secondary hover:text-white transition-colors w-full justify-between bg-surface-700 px-4 py-2.5"
      >
        <span className="flex items-center gap-2">
          <SlidersHorizontal size={16} />
          <span className="font-heading uppercase tracking-wider text-xs">Filters & Sort</span>
        </span>
        {activeFilterCount > 0 && (
          <span className="bg-brand-red text-white text-xs w-5 h-5 flex items-center justify-center font-heading">
            {activeFilterCount}
          </span>
        )}
      </button>

      {/* Filters — collapsible on mobile, always visible on desktop */}
      <div className={`space-y-8 ${filtersOpen ? "block" : "hidden"} lg:block`}>
        {filterContent}
      </div>
    </div>
  );
}
