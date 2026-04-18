import Link from "next/link";
import Image from "next/image";
import { formatPrice } from "@/lib/utils";
import type { Product } from "@/types/database";

interface Props {
  product: Pick<Product, "id" | "name" | "slug" | "base_price" | "primary_image_url"> & {
    product_variations?: { price: number; sale_price: number | null }[];
  };
  priority?: boolean;
}

// Tiny dark blur placeholder — same carbon-dark tone as the card background
const BLUR_DATA_URL =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPjxyZWN0IHdpZHRoPSI4IiBoZWlnaHQ9IjgiIGZpbGw9IiMxYTFhMWEiLz48L3N2Zz4=";

export function ProductCard({ product, priority = false }: Props) {
  const hasVariations = product.product_variations && product.product_variations.length > 1;
  const lowestPrice = product.base_price || product.product_variations?.[0]?.price || 0;
  const hasSale = product.product_variations?.some((v) => v.sale_price);

  return (
    <Link href={`/product/${product.slug}`} className="group animate-fade-in">
      <div className="card-hover">
        {/* Image */}
        <div className="aspect-square bg-surface-700 relative overflow-hidden">
          {product.primary_image_url ? (
            <Image
              src={product.primary_image_url}
              alt={product.name}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover group-hover:scale-105 transition-transform duration-500"
              placeholder="blur"
              blurDataURL={BLUR_DATA_URL}
              priority={priority}
              loading={priority ? undefined : "lazy"}
              quality={72}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-text-muted text-xs carbon-bg">
              <span className="font-heading uppercase tracking-wider opacity-50">No image</span>
            </div>
          )}

          {/* Sale badge */}
          {hasSale && (
            <span className="absolute top-0 right-0 badge-sale">
              Sale
            </span>
          )}

          {/* Bottom red line on hover */}
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-brand-red
                          scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
        </div>

        {/* Info */}
        <div className="p-3 md:p-4">
          <h3 className="text-sm font-medium text-text-secondary line-clamp-2
                         group-hover:text-white transition-colors duration-200">
            {product.name}
          </h3>
          <p className="mt-1.5 font-heading text-lg tracking-wide">
            {hasVariations && (
              <span className="text-text-muted text-xs font-body mr-1">from</span>
            )}
            <span className="text-white">{formatPrice(lowestPrice)}</span>
          </p>
        </div>
      </div>
    </Link>
  );
}
