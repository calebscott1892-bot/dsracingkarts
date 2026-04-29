import Link from "next/link";
import Image from "next/image";
import { formatPrice } from "@/lib/utils";
import type { Product } from "@/types/database";

interface Props {
  product: Pick<Product, "id" | "name" | "slug" | "sku" | "base_price" | "primary_image_url"> & {
    product_variations?: { price: number; sale_price: number | null; sku?: string | null }[];
  };
  priority?: boolean;
}

// Tiny dark blur placeholder — same carbon-dark tone as the card background
const BLUR_DATA_URL =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPjxyZWN0IHdpZHRoPSI4IiBoZWlnaHQ9IjgiIGZpbGw9IiMxYTFhMWEiLz48L3N2Zz4=";

// Generic placeholder slugs we treat as "no image" — render the styled
// product-name fallback instead so a sea of identical placeholders never
// appears in the grid.
function isRealProductImage(url: string | null | undefined): url is string {
  if (!url) return false;
  return !url.endsWith("/images/image-coming-soon.svg");
}

export function ProductCard({ product, priority = false }: Props) {
  const hasVariations = product.product_variations && product.product_variations.length > 1;
  const lowestPrice = product.base_price || product.product_variations?.[0]?.price || 0;
  const hasSale = product.product_variations?.some((v) => v.sale_price);
  const displaySku = product.sku || product.product_variations?.find((v) => v.sku)?.sku;
  const realImage = isRealProductImage(product.primary_image_url);

  return (
    <Link href={`/product/${product.slug}`} scroll className="group animate-fade-in">
      <div className="card-hover">
        {/* Image */}
        <div className="aspect-square bg-surface-700 relative overflow-hidden">
          {realImage ? (
            <Image
              src={product.primary_image_url as string}
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
            <ProductNameFallback name={product.name} />
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
          {displaySku && (
            <p className="mt-1 font-mono text-[11px] text-text-muted truncate">
              SKU: {displaySku}
            </p>
          )}
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

/**
 * Branded fallback for products without a real image. Each product gets its
 * own card showing its name prominently — far better than 3000+ products all
 * sharing the same generic "image coming soon" placeholder.
 */
function ProductNameFallback({ name }: { name: string }) {
  // Hash the name into a stable subtle hue shift so the cards aren't all
  // identical even when several products share similar names.
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  const hueShift = ((hash % 11) + 11) % 11; // 0–10° micro shift
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center
                 bg-[#141414] carbon-bg"
      style={{
        backgroundImage:
          `linear-gradient(135deg, rgba(230,0,18,0.06), transparent 55%),
           radial-gradient(circle at 50% 22%, rgba(230,0,18,0.18), transparent 55%)`,
      }}
    >
      <span
        className="absolute top-2 left-2 right-2 h-[1px] bg-gradient-to-r from-transparent via-racing-red/50 to-transparent"
        style={{ filter: `hue-rotate(${hueShift}deg)` }}
      />
      <span
        className="absolute bottom-2 left-2 right-2 h-[1px] bg-gradient-to-r from-transparent via-racing-red/50 to-transparent"
        style={{ filter: `hue-rotate(${hueShift}deg)` }}
      />
      <span className="font-heading text-[9px] tracking-[0.35em] text-racing-red/80 uppercase mb-2">
        DS Racing Karts
      </span>
      <span className="font-heading text-xs md:text-sm uppercase tracking-[0.08em] text-white/90 leading-snug line-clamp-3">
        {name}
      </span>
      <span className="font-heading text-[9px] tracking-[0.3em] text-text-muted/70 uppercase mt-3">
        Image coming soon
      </span>
    </div>
  );
}
