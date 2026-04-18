import Link from "next/link";
import Image from "next/image";
import type { Category } from "@/types/database";
import { CategoryIcon, hasCategoryIcon } from "@/components/icons/CategoryIcon";

interface Props {
  categories: Pick<Category, "id" | "name" | "slug" | "image_url">[];
}

export function CategoryGrid({ categories }: Props) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
      {categories.map((cat) => {
        const showIcon = !cat.image_url && hasCategoryIcon(cat.slug);
        return (
          <Link
            key={cat.id}
            href={`/shop?category=${cat.slug}`}
            className="group relative aspect-[4/3] overflow-hidden bg-surface-800
                       border border-surface-600/50 hover:border-brand-red/40 transition-all duration-300"
          >
            {cat.image_url ? (
              <Image
                src={cat.image_url}
                alt={cat.name}
                fill
                sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
                className="object-cover group-hover:scale-110 transition-transform duration-700"
              />
            ) : (
              <>
                <div className="absolute inset-0 carbon-bg bg-surface-800" />
                {/* Subtle radial glow behind icon */}
                <div
                  className="absolute inset-0 opacity-40 group-hover:opacity-70 transition-opacity duration-500"
                  style={{
                    background:
                      "radial-gradient(circle at 50% 42%, rgba(230,0,18,0.22), transparent 60%)",
                  }}
                />
                {showIcon && (
                  <div className="absolute inset-0 flex items-center justify-center pt-2 pb-10">
                    <CategoryIcon
                      slug={cat.slug}
                      className="w-20 h-20 md:w-24 md:h-24 text-brand-red/90
                                 group-hover:text-brand-red group-hover:scale-110
                                 transition-all duration-500"
                      style={{
                        filter:
                          "drop-shadow(0 0 8px rgba(230,0,18,0.45)) drop-shadow(0 0 2px rgba(230,0,18,0.8))",
                      }}
                    />
                  </div>
                )}
              </>
            )}

            {/* Dark gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent pointer-events-none" />

            {/* Red accent line at bottom */}
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-brand-red
                            scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />

            {/* Label */}
            <div className="absolute bottom-0 left-0 right-0 p-3 md:p-4">
              <h3 className="font-heading text-sm md:text-base uppercase tracking-[0.15em] text-white
                             group-hover:text-brand-red transition-colors duration-200">
                {cat.name}
              </h3>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
