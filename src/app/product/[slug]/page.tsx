import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { AddToCartButton } from "@/components/shop/AddToCartButton";
import { ProductImageGallery } from "@/components/shop/ProductImageGallery";
import { formatPrice } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import sanitizeHtml from "sanitize-html";
import type { Metadata } from "next";

// Always render fresh from Supabase — admin/Square product edits appear instantly.
export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: product } = await supabase
    .from("products")
    .select("name, seo_title, seo_description, description_plain, product_images(url, is_primary, sort_order)")
    .eq("slug", slug)
    .single();

  if (!product) return { title: "Product Not Found" };

  const title = product.seo_title || product.name;
  const description =
    product.seo_description ||
    product.description_plain?.substring(0, 160) ||
    "";

  const images = (product.product_images || [])
    .sort((a: any, b: any) => {
      if (a.is_primary && !b.is_primary) return -1;
      if (!a.is_primary && b.is_primary) return 1;
      return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    });
  const ogImage = images[0]?.url;

  return {
    title,
    description,
    alternates: { canonical: `/product/${slug}` },
    openGraph: {
      title,
      description,
      type: "website",
      url: `/product/${slug}`,
      images: ogImage ? [{ url: ogImage }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: product } = await supabase
    .from("products")
    .select(`
      *,
      product_images ( id, url, alt_text, sort_order, is_primary ),
      product_variations (
        id, name, sku, price, sale_price, sort_order,
        variation_options ( option_name, option_value ),
        inventory ( quantity, stock_status )
      ),
      product_categories ( categories ( id, name, slug ) )
    `)
    .eq("slug", slug)
    .single();

  if (!product) notFound();

  const variations = product.product_variations || [];
  const images = product.product_images || [];
  const categories = (product.product_categories || []).map(
    (pc: any) => pc.categories
  );
  const variationPrices = variations
    .map((v: any) => v.sale_price || v.price)
    .filter((price: number | null) => typeof price === "number" && Number.isFinite(price));
  const hasVariations = variations.length > 0;

  variations.sort((a: any, b: any) => a.sort_order - b.sort_order);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 md:py-12">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-xs text-text-muted mb-8">
        <Link href="/" className="hover:text-white transition-colors">Home</Link>
        <ChevronRight size={12} />
        <Link href="/shop" className="hover:text-white transition-colors">Shop</Link>
        {categories[0] && (
          <>
            <ChevronRight size={12} />
            <Link
              href={`/shop?category=${categories[0].slug}`}
              className="hover:text-white transition-colors"
            >
              {categories[0].name}
            </Link>
          </>
        )}
        <ChevronRight size={12} />
        <span className="text-text-secondary truncate max-w-[120px] sm:max-w-[200px]">{product.name}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-14">
        {/* Image gallery */}
        <ProductImageGallery images={images} productName={product.name} />

        {/* Product info */}
        <div>
          {/* Category badge */}
          {categories[0] && (
            <Link
              href={`/shop?category=${categories[0].slug}`}
              className="inline-block font-heading text-xs tracking-[0.3em] text-brand-red uppercase
                         mb-3 hover:text-brand-red-light transition-colors"
            >
              {categories[0].name}
            </Link>
          )}

          <h1 className="font-heading text-2xl md:text-3xl lg:text-4xl uppercase tracking-[0.08em] text-white mb-3">
            {product.name}
          </h1>

          {product.sku && (
            <p className="text-text-muted text-xs font-heading tracking-wider mb-5">
              SKU: {product.sku}
            </p>
          )}

          {/* Price range */}
          <div className="mb-6 pb-6 border-b border-surface-600/50">
            {!hasVariations ? (
              <p className="text-sm text-text-muted font-heading uppercase tracking-wider">
                Contact us for pricing
              </p>
            ) : variations.length === 1 ? (
              <p className="text-3xl font-heading tracking-wide">
                {variations[0].sale_price ? (
                  <>
                    <span className="text-brand-red">{formatPrice(variations[0].sale_price)}</span>
                    <span className="text-text-muted line-through text-lg ml-3">
                      {formatPrice(variations[0].price)}
                    </span>
                  </>
                ) : (
                  <span className="text-white">{formatPrice(variations[0].price)}</span>
                )}
              </p>
            ) : (
              <p className="text-3xl font-heading tracking-wide">
                <span className="text-text-muted text-sm font-body mr-1">From</span>
                <span className="text-white">
                  {formatPrice(Math.min(...variationPrices))}
                </span>
              </p>
            )}
          </div>

          {/* Add to cart */}
          <AddToCartButton product={product} variations={variations} />

          {/* Description */}
          {product.description && (
            <div className="mt-10 pt-8 border-t border-surface-600/50">
              <div className="flex items-center gap-3 mb-5">
                <span className="h-[1px] w-6 bg-brand-red" />
                <h2 className="font-heading text-xs uppercase tracking-[0.3em] text-brand-red">
                  Description
                </h2>
              </div>
              <div
                className="text-text-secondary text-sm leading-relaxed space-y-3 break-words
                           [&_strong]:text-white [&_b]:text-white
                           [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1
                           [&_a]:text-brand-red [&_a]:underline
                           [&_img]:max-w-full [&_img]:h-auto
                           [&_table]:block [&_table]:overflow-x-auto [&_table]:max-w-full"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(product.description, {
                  allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img']),
                  allowedAttributes: { ...sanitizeHtml.defaults.allowedAttributes, img: ['src', 'alt', 'width', 'height'] },
                }) }}
              />
            </div>
          )}

          {/* Structured data */}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "Product",
                name: product.name,
                description: product.description_plain,
                sku: product.sku,
                image: images[0]?.url,
                offers: hasVariations
                  ? {
                      "@type": "AggregateOffer",
                      lowPrice: Math.min(...variationPrices),
                      highPrice: Math.max(
                        ...variations.map((v: any) => v.price)
                      ),
                      priceCurrency: "AUD",
                      availability:
                        variations.some(
                          (v: any) => v.inventory?.stock_status === "in_stock"
                        )
                          ? "https://schema.org/InStock"
                          : "https://schema.org/OutOfStock",
                    }
                  : undefined,
              }),
            }}
          />
        </div>
      </div>
    </div>
  );
}
