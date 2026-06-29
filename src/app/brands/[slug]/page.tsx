import { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProductCard } from "@/components/shop/ProductCard";
import { SITE_URL } from "@/lib/site-url";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface BrandConfig {
  name: string;
  searchTerm: string;
  logo?: string;
  logoDark?: boolean;
  title: string;
  metaDescription: string;
  heading: string;
  intro: string[];
  shopSearch: string;
}

const BRANDS: Record<string, BrandConfig> = {
  rotax: {
    name: "Rotax",
    searchTerm: "Rotax",
    logo: "/images/brands/rotax.svg",
    title: "Rotax Kart Parts Australia | DS Racing Karts",
    metaDescription:
      "Shop Rotax kart parts Australia-wide — pistons, carburettors, ignition, clutches, rebuild kits and accessories for Rotax Max, DD2 and Junior engines. Expert advice from DS Racing Karts, Sydney.",
    heading: "Rotax Kart Parts",
    intro: [
      "DS Racing Karts stocks a wide range of genuine and aftermarket parts for Rotax Max, Rotax DD2 and Rotax Junior engines. From pistons, rings and gaskets to carburettors, ignition coils, clutches and complete rebuild kits — we carry the parts that keep your Rotax on the grid.",
      "All Rotax parts ship Australia-wide from our Sydney workshop. Not sure which part you need? Our team has decades of experience with Rotax engines and can point you in the right direction before you order.",
    ],
    shopSearch: "Rotax",
  },
  iame: {
    name: "IAME",
    searchTerm: "IAME",
    logo: "/images/brands/iame.png",
    title: "IAME Kart Parts Australia | DS Racing Karts",
    metaDescription:
      "IAME kart parts Australia-wide — X30, KA100, Leopard, Parilla and more. Pistons, carburettors, clutches, exhausts and rebuild components from DS Racing Karts, Sydney.",
    heading: "IAME Kart Parts",
    intro: [
      "IAME engines power some of the most competitive classes on the Australian karting grid, and DS Racing Karts carries the parts to keep them running. We stock components for X30, KA100, Leopard, Parilla and other IAME powerplants — pistons, reeds, carburettors, clutches, exhausts and rebuild hardware.",
      "Orders ship Australia-wide. If you're chasing a specific IAME part and can't find it in our shop, get in touch — we can source most components through our supplier network.",
    ],
    shopSearch: "IAME",
  },
  otk: {
    name: "OTK Kart Group",
    searchTerm: "OTK",
    logo: "/images/brands/otk.png",
    title: "OTK Kart Parts Australia | DS Racing Karts",
    metaDescription:
      "OTK kart parts Australia — Tony Kart, Kosmic, Exprit and Redspeed chassis parts, axles, hubs, bearings, frames and accessories. DS Racing Karts, Sydney.",
    heading: "OTK Kart Parts",
    intro: [
      "The OTK Kart Group — home of Tony Kart, Kosmic, Exprit and Redspeed — is one of the most successful chassis manufacturers in world karting, and DS Racing Karts carries the parts to keep OTK karts competitive. Axles, hubs, spindles, bearings, frame protectors, stub axles, front and rear bumpers and more.",
      "We service OTK chassis in our Campbelltown workshop and can advise on setup as well as parts selection. Shipping Australia-wide from Sydney.",
    ],
    shopSearch: "OTK",
  },
  vortex: {
    name: "Vortex",
    searchTerm: "Vortex",
    logo: "/images/brands/vortex.png",
    title: "Vortex Kart Engine Parts Australia | DS Racing Karts",
    metaDescription:
      "Vortex kart engine parts Australia — RokGP, Rok Junior, Mini Rok, VLR and DDJ components. Pistons, carburettors, clutches and rebuild parts from DS Racing Karts, Sydney.",
    heading: "Vortex Kart Parts",
    intro: [
      "Vortex engines — including the Rok GP, Rok Junior, Mini Rok, VLR and DDJ — are a staple of Australian club and state-level karting. DS Racing Karts stocks a range of Vortex engine parts: pistons, reeds, carburettors, clutches, ignition components and more.",
      "We service and rebuild Vortex engines in-house. Whether you need a single wear part or a full refresh, we can help. Parts ship Australia-wide from our Sydney workshop.",
    ],
    shopSearch: "Vortex",
  },
  arrow: {
    name: "Arrow Kart",
    searchTerm: "Arrow",
    logo: "/images/brands/arrow.png",
    title: "Arrow Kart Parts Australia | DS Racing Karts",
    metaDescription:
      "Arrow kart parts Australia — AX9, X1, X3 and SX4 chassis components, axles, hubs, bearings, bodywork and frame parts. DS Racing Karts, Sydney.",
    heading: "Arrow Kart Parts",
    intro: [
      "Arrow Kart chassis have a loyal following across Australian club and sprint racing. DS Racing Karts stocks Arrow kart parts including axles, hubs, spindles, bearings, frame protectors, bodywork and chassis hardware to suit AX9, X1, X3 and SX4 models.",
      "We also service Arrow chassis in our workshop — if your kart needs more than just parts, book a service appointment. Shipping Australia-wide from Sydney.",
    ],
    shopSearch: "Arrow",
  },
  "kart-republic": {
    name: "Kart Republic",
    searchTerm: "Kart Republic",
    logo: "/images/brands/kart-republic.png",
    title: "Kart Republic Parts Australia | DS Racing Karts",
    metaDescription:
      "Kart Republic kart parts Australia — KR1, KR2 and junior chassis components, axles, hubs and accessories. DS Racing Karts, Sydney.",
    heading: "Kart Republic Parts",
    intro: [
      "Kart Republic has quickly become one of the most competitive chassis brands in global and Australian karting. DS Racing Karts stocks Kart Republic parts for KR1, KR2 and junior chassis — axles, hubs, spindles, bearings, bodywork protectors and frame hardware.",
      "We service Kart Republic chassis and can advise on setup and parts. Orders ship Australia-wide from Sydney.",
    ],
    shopSearch: "Kart Republic",
  },
  dpe: {
    name: "DPE",
    searchTerm: "DPE",
    title: "DPE Kart Parts Australia | DS Racing Karts",
    metaDescription:
      "DPE kart parts Australia — wide range of DPE components available online, sourced from our supplier and dispatched Australia-wide. DS Racing Karts, Sydney.",
    heading: "DPE Kart Parts",
    intro: [
      "DS Racing Karts supplies a range of DPE kart parts through our supplier network. DPE components are available to order online and are dispatched directly from our supplier — usually within 5 business days.",
      "If you need a specific DPE part that isn't listed, contact us and we'll check stock through our network. Shipping Australia-wide from Sydney.",
    ],
    shopSearch: "DPE",
  },
  crg: {
    name: "CRG Kart",
    searchTerm: "CRG",
    logo: "/images/brands/crg.png",
    title: "CRG Kart Parts Australia | DS Racing Karts",
    metaDescription:
      "CRG kart parts Australia — Black Star, Road Rebel and Heron chassis components. DS Racing Karts services and supplies CRG karts from Sydney.",
    heading: "CRG Kart Parts",
    intro: [
      "CRG is one of the world's most recognised kart chassis brands, with decades of race-winning pedigree. DS Racing Karts services CRG karts in our Campbelltown workshop and can supply parts including chassis hardware, axles, hubs and bodywork.",
      "Looking for a specific CRG part? Contact us and we'll track it down through our supplier network. Shipping Australia-wide from Sydney.",
    ],
    shopSearch: "CRG",
  },
};

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const brand = BRANDS[slug];
  if (!brand) return {};

  return {
    title: brand.title,
    description: brand.metaDescription,
    alternates: { canonical: `/brands/${slug}` },
    openGraph: {
      title: brand.title,
      description: brand.metaDescription,
      url: `${SITE_URL}/brands/${slug}`,
    },
  };
}

export function generateStaticParams() {
  return Object.keys(BRANDS).map((slug) => ({ slug }));
}

export default async function BrandPage({ params }: Props) {
  const { slug } = await params;
  const brand = BRANDS[slug];
  if (!brand) notFound();

  const supabase = await createClient();
  const { data: products } = await supabase
    .from("products")
    .select(
      "id, name, slug, sku, base_price, primary_image_url, is_stockable, product_variations ( price, sale_price, sku, inventory ( quantity, stock_status ) )"
    )
    .eq("status", "active")
    .eq("visibility", "visible")
    .eq("is_sellable", true)
    .ilike("name", `%${brand.searchTerm}%`)
    .order("name")
    .limit(24);

  const shopSearchUrl = `/shop?search=${encodeURIComponent(brand.shopSearch)}`;

  return (
    <>
      {/* Hero */}
      <section className="relative bg-racing-black carbon-fiber py-16 md:py-20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-3 mb-6">
            <span className="h-[1px] w-8 bg-racing-red" />
            <Link
              href="/brands"
              className="font-heading text-xs tracking-[0.4em] text-racing-red uppercase hover:text-white transition-colors"
            >
              Brands We Service
            </Link>
            <span className="h-[1px] w-8 bg-racing-red" />
          </div>

          {brand.logo && (
            <div
              className={`inline-flex items-center justify-center rounded-md mb-6 p-4 ${brand.logoDark ? "bg-racing-black border border-white/10" : "bg-white"}`}
              style={{ width: 180, height: 90 }}
            >
              <Image
                src={brand.logo}
                alt={`${brand.name} logo`}
                width={150}
                height={75}
                className="object-contain w-full h-full"
              />
            </div>
          )}

          <h1 className="font-heading text-4xl md:text-6xl uppercase tracking-[0.08em] text-white mb-4">
            {brand.heading.split(" ").slice(0, -1).join(" ")}{" "}
            <span className="text-racing-red">{brand.heading.split(" ").slice(-1)}</span>
          </h1>
          <p className="text-white/50 text-sm font-heading uppercase tracking-[0.2em] mb-6">
            Australia-Wide Shipping · Expert Advice · Sydney Workshop
          </p>
        </div>
      </section>

      <div className="chequered-stripe" />

      {/* Intro copy */}
      <section className="bg-racing-black py-10 md:py-14">
        <div className="max-w-3xl mx-auto px-4 space-y-4">
          {brand.intro.map((para, i) => (
            <p key={i} className="text-white/70 leading-relaxed">
              {para}
            </p>
          ))}
        </div>
      </section>

      {/* Products */}
      <section className="bg-racing-black pb-16 md:pb-24">
        <div className="max-w-6xl mx-auto px-4">
          {products && products.length > 0 ? (
            <>
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-heading text-xl md:text-2xl uppercase tracking-[0.08em] text-white">
                  {brand.name} <span className="text-racing-red">Parts in Stock</span>
                </h2>
                <Link
                  href={shopSearchUrl}
                  className="text-racing-red font-heading text-xs uppercase tracking-[0.15em] hover:text-white transition-colors"
                >
                  View All →
                </Link>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4">
                {products.map((product, i) => (
                  <ProductCard key={product.id} product={product} priority={i < 6} />
                ))}
              </div>
              <div className="mt-10 text-center">
                <Link
                  href={shopSearchUrl}
                  className="inline-block bg-racing-red text-white font-heading text-sm uppercase tracking-[0.15em] px-8 py-3 hover:bg-racing-red/90 transition-colors"
                >
                  Shop All {brand.name} Parts
                </Link>
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <p className="text-white/50 mb-6">
                Contact us for {brand.name} parts — we can source most components through our supplier network.
              </p>
              <Link
                href="/contact"
                className="inline-block bg-racing-red text-white font-heading text-sm uppercase tracking-[0.15em] px-8 py-3 hover:bg-racing-red/90 transition-colors"
              >
                Get in Touch
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: brand.title,
            description: brand.metaDescription,
            url: `${SITE_URL}/brands/${slug}`,
            breadcrumb: {
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
                { "@type": "ListItem", position: 2, name: "Brands", item: `${SITE_URL}/brands` },
                { "@type": "ListItem", position: 3, name: brand.name, item: `${SITE_URL}/brands/${slug}` },
              ],
            },
          }),
        }}
      />
    </>
  );
}
