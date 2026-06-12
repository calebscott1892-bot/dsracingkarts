import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { AddToCartButton } from "@/components/shop/AddToCartButton";
import { ScrollToTopOnMount } from "@/components/layout/ScrollToTopOnMount";
import { ProductImageGallery } from "@/components/shop/ProductImageGallery";
import { formatPrice } from "@/lib/utils";
import { isRealProductImageUrl } from "@/lib/product-images";
import { isUnavailableByStock } from "@/lib/stock";
import { categoryHref } from "@/lib/shop-links";
import { ChevronRight } from "lucide-react";
import sanitizeHtml from "sanitize-html";
import type { Metadata } from "next";

// Always render fresh from Supabase — admin/Square product edits appear instantly.
export const dynamic = "force-dynamic";
export const revalidate = 0;

interface Props {
  params: Promise<{ slug: string }>;
}

function placeholderOgUrl(siteUrl: string, productName: string) {
  return `${siteUrl}/api/og/coming-soon?name=${encodeURIComponent(productName)}`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: product } = await supabase
    .from("products")
    .select("name, seo_title, seo_description, description_plain, product_images(url, is_primary, sort_order)")
    .eq("slug", slug)
    .eq("status", "active")
    .eq("visibility", "visible")
    .eq("is_sellable", true)
    .maybeSingle();

  if (!product) notFound();

  const title = product.seo_title || product.name;
  const description =
    product.seo_description ||
    product.description_plain?.substring(0, 160) ||
    "";

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://dsracingkarts.com.au";

  const realImages = (product.product_images || [])
    .filter((image: any) => isRealProductImageUrl(image.url))
    .sort((a: any, b: any) => {
      if (a.is_primary && !b.is_primary) return -1;
      if (!a.is_primary && b.is_primary) return 1;
      return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    });

  // Always supply at least one image so Facebook / Meta Catalog / Google
  // Shopping previews never show a blank tile. Falls back to a dynamic
  // branded "image coming soon" PNG with the product name baked in.
  const ogImage = realImages[0]?.url || placeholderOgUrl(siteUrl, product.name);

  return {
    title,
    description,
    alternates: { canonical: `/product/${slug}` },
    openGraph: {
      title,
      description,
      type: "website",
      url: `/product/${slug}`,
      images: [{ url: ogImage }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://dsracingkarts.com.au";

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
    .eq("status", "active")
    .eq("visibility", "visible")
    .eq("is_sellable", true)
    .maybeSingle();

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
  const displaySku = product.sku || variations.find((v: any) => v.sku)?.sku;
  // Mirror the storefront's real purchasability in structured data — Google
  // disapproves products whose markup says InStock while the page says
  // "Not available for immediate purchase" (availability mismatch).
  const anyVariationInStock = variations.some(
    (v: any) => !isUnavailableByStock(v, product.is_stockable !== false)
  );
  const schemaAvailability = anyVariationInStock
    ? "https://schema.org/InStock"
    : "https://schema.org/OutOfStock";
  const schemaShippingDetails = {
    "@type": "OfferShippingDetails",
    shippingDestination: {
      "@type": "DefinedRegion",
      addressCountry: "AU",
    },
    deliveryTime: {
      "@type": "ShippingDeliveryTime",
      handlingTime: {
        "@type": "QuantitativeValue",
        minValue: 1,
        maxValue: 2,
        unitCode: "DAY",
      },
      transitTime: {
        "@type": "QuantitativeValue",
        minValue: 2,
        maxValue: 8,
        unitCode: "DAY",
      },
    },
  };
  const schemaReturnPolicy = {
    "@type": "MerchantReturnPolicy",
    applicableCountry: "AU",
    returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
    merchantReturnDays: 14,
    returnMethod: "https://schema.org/ReturnByMail",
    returnFees: "https://schema.org/ReturnFeesCustomerResponsibility",
    merchantReturnLink: `${siteUrl}/shipping-returns`,
  };
  const cartProduct = {
    id: product.id,
    slug: product.slug,
    name: product.name,
    is_stockable: product.is_stockable,
    primary_image_url: isRealProductImageUrl(product.primary_image_url)
      ? product.primary_image_url
      : null,
  };

  variations.sort((a: any, b: any) => a.sort_order - b.sort_order);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 md:py-12">
      <ScrollToTopOnMount />
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-xs text-text-muted mb-8">
        <Link href="/" className="hover:text-white transition-colors">Home</Link>
        <ChevronRight size={12} />
        <Link href="/shop" className="hover:text-white transition-colors">Shop</Link>
        {categories[0] && (
          <>
            <ChevronRight size={12} />
            <Link
              href={categoryHref(categories[0].slug)}
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
              href={categoryHref(categories[0].slug)}
              className="inline-block font-heading text-xs tracking-[0.3em] text-brand-red uppercase mb-3 hover:text-brand-red-light transition-colors"
            >
              {categories[0].name}
            </Link>
          )}

          <h1 className="font-heading text-2xl md:text-3xl lg:text-4xl uppercase tracking-[0.08em] text-white mb-3">
            {product.name}
          </h1>

          {displaySku && (
            <p className="text-text-muted text-xs font-heading tracking-wider mb-5">
              SKU: {displaySku}
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
          <AddToCartButton product={cartProduct} variations={variations} />

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
                className="text-text-secondary text-sm leading-relaxed space-y-3 break-words [&_strong]:text-white [&_b]:text-white [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_a]:text-brand-red [&_a]:underline [&_img]:max-w-full [&_img]:h-auto [&_table]:block [&_table]:overflow-x-auto [&_table]:max-w-full"
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
                "@graph": [
                  {
                    "@type": "BreadcrumbList",
                    itemListElement: [
                      {
                        "@type": "ListItem",
                        position: 1,
                        name: "Home",
                        item: siteUrl,
                      },
                      {
                        "@type": "ListItem",
                        position: 2,
                        name: "Shop",
                        item: `${siteUrl}/shop`,
                      },
                      ...(categories[0]
                        ? [{
                            "@type": "ListItem",
                            position: 3,
                            name: categories[0].name,
                            item: `${siteUrl}${categoryHref(categories[0].slug)}`,
                          }]
                        : []),
                      {
                        "@type": "ListItem",
                        position: categories[0] ? 4 : 3,
                        name: product.name,
                        item: `${siteUrl}/product/${product.slug}`,
                      },
                    ],
                  },
                  {
                    "@type": "Product",
                    name: product.name,
                    description: product.description_plain,
                    sku: displaySku,
                    url: `${siteUrl}/product/${product.slug}`,
                    category: categories[0]?.name,
                    // Always advertise at least one image so Google
                    // Merchant / Meta Catalog won't drop the product for
                    // missing media. Falls back to the dynamic branded
                    // placeholder PNG with the product name baked in.
                    image: (() => {
                      const real = images
                        .map((image: any) => image.url)
                        .filter(
                          (url: any) =>
                            typeof url === "string" &&
                            isRealProductImageUrl(url)
                        );
                      if (real.length > 0) return real;
                      return [`${siteUrl}/api/og/coming-soon?name=${encodeURIComponent(product.name)}`];
                    })(),
                    brand: {
                      "@type": "Brand",
                      name: "DS Racing Karts",
                    },
                    offers: hasVariations && variationPrices.length > 0
                      ? variations.length === 1
                        ? {
                            "@type": "Offer",
                            price: variations[0].sale_price || variations[0].price,
                            priceCurrency: "AUD",
                            url: `${siteUrl}/product/${product.slug}`,
                            availability: schemaAvailability,
                            itemCondition: "https://schema.org/NewCondition",
                            shippingDetails: schemaShippingDetails,
                            hasMerchantReturnPolicy: schemaReturnPolicy,
                            seller: {
                              "@type": "Organization",
                              name: "DS Racing Karts",
                              url: siteUrl,
                            },
                          }
                        : {
                            "@type": "AggregateOffer",
                            lowPrice: Math.min(...variationPrices),
                            highPrice: Math.max(...variationPrices),
                            priceCurrency: "AUD",
                            offerCount: variations.length,
                            availability: schemaAvailability,
                            itemCondition: "https://schema.org/NewCondition",
                            shippingDetails: schemaShippingDetails,
                            hasMerchantReturnPolicy: schemaReturnPolicy,
                            seller: {
                              "@type": "Organization",
                              name: "DS Racing Karts",
                              url: siteUrl,
                            },
                          }
                      : undefined,
                  },
                ],
              }),
            }}
          />
        </div>
      </div>
    </div>
  );
}
