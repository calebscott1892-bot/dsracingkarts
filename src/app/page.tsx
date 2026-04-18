import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ProductCard } from "@/components/shop/ProductCard";
import { CategoryGrid } from "@/components/shop/CategoryGrid";
import { HeroVideo } from "@/components/layout/HeroVideo";
import { NewsletterSignup } from "@/components/layout/NewsletterSignup";
import { GameTeaser } from "@/components/sections/GameTeaser";
import { HistorySection } from "@/components/sections/HistorySection";
import { Speedometer } from "@/components/sections/Speedometer";
import { Shield, Wrench, Truck, ChevronRight } from "lucide-react";

export default async function HomePage() {
  const supabase = await createClient();

  const { data: featuredProducts } = await supabase
    .from("products")
    .select(`
      id, name, slug, base_price, primary_image_url,
      product_variations ( price, sale_price )
    `)
    .eq("status", "active")
    .eq("visibility", "visible")
    .order("created_at", { ascending: false })
    .limit(8);

  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, slug, image_url")
    .is("parent_id", null)
    .order("name")
    .limit(8);

  return (
    <>
      {/* ── Hero Video Sequence ── */}
      <HeroVideo />

      {/* ── Chequered Divider ── */}
      <div className="chequered-stripe" />

      {/* ── Trust Banner ── */}
      <section className="relative bg-racing-dark carbon-fiber border-b border-surface-600/20">
        <div className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { icon: Shield, title: "Race-Ready Parts", text: "Thousands of products — dealer for all major importers & US/UK suppliers", accent: "text-racing-red" },
            { icon: Wrench, title: "Expert Service", text: "Professional kart setup & engine tuning in Sydney", accent: "text-racing-gold" },
            { icon: Truck, title: "Australia-Wide", text: "Shipping available nationwide — quoted per order", accent: "text-racing-red" },
          ].map(({ icon: Icon, title, text, accent }) => (
            <div key={title} className="flex items-start gap-4 py-2">
              <div className={`${accent} shrink-0 mt-0.5`}>
                <Icon size={22} strokeWidth={1.5} />
              </div>
              <div>
                <h3 className="font-heading text-sm uppercase tracking-[0.15em] text-white mb-1">{title}</h3>
                <p className="text-text-muted text-xs leading-relaxed">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Mini-Game Teaser ── */}
      <GameTeaser />

      {/* ── Chequered Divider ── */}
      <div className="chequered-stripe-sm" />

      {/* ── Categories ── */}
      <section id="categories" className="max-w-7xl mx-auto px-4 py-16 md:py-20 scroll-mt-24">
        <div className="flex items-end justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className="h-[1px] w-8 bg-racing-red" />
              <span className="font-heading text-xs tracking-[0.4em] text-racing-red uppercase">Browse</span>
            </div>
            <h2 className="section-heading">
              Shop by <span className="text-racing-red">Category</span>
            </h2>
          </div>
          <Link
            href="/#categories"
            className="hidden md:flex items-center gap-1 font-heading text-xs uppercase tracking-[0.15em]
                       text-text-muted hover:text-racing-red transition-colors"
          >
            View All <ChevronRight size={14} />
          </Link>
        </div>
        <CategoryGrid categories={categories || []} />
      </section>

      {/* ── Chequered Divider ── */}
      <div className="chequered-stripe" />

      {/* ── History Section ── */}
      <HistorySection />

      {/* ── Chequered Divider ── */}
      <div className="chequered-stripe" />

      {/* ── Speedometer ── */}
      <Speedometer />

      {/* ── Chequered Divider ── */}
      <div className="chequered-stripe-sm" />

      {/* ── Featured Products ── */}
      <section className="max-w-7xl mx-auto px-4 py-16 md:py-20">
        <div className="flex items-end justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className="h-[1px] w-8 bg-racing-gold" />
              <span className="font-heading text-xs tracking-[0.4em] text-racing-gold uppercase">New In</span>
            </div>
            <h2 className="section-heading">
              Latest <span className="text-racing-red">Products</span>
            </h2>
          </div>
          <Link
            href="/shop"
            className="hidden md:flex items-center gap-1 font-heading text-xs uppercase tracking-[0.15em]
                       text-text-muted hover:text-racing-red transition-colors"
          >
            View All <ChevronRight size={14} />
          </Link>
        </div>
        <div className="product-grid">
          {featuredProducts?.map((product, idx) => (
            <ProductCard
              key={product.id}
              product={product as any}
              priority={idx < 4}
            />
          ))}
        </div>
        <div className="mt-8 text-center md:hidden">
          <Link href="/shop" className="btn-secondary text-sm">View All Products</Link>
        </div>
      </section>

      {/* ── Divider ── */}
      <div className="max-w-7xl mx-auto px-4"><div className="racing-line" /></div>

      {/* ── Newsletter ── */}
      <section className="max-w-3xl mx-auto px-4 py-16 md:py-20">
        <NewsletterSignup />
      </section>

      {/* ── Structured Data ── */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "LocalBusiness",
            name: "DS Racing Karts",
            url: process.env.NEXT_PUBLIC_SITE_URL || "https://dsracingkarts.com.au",
            description: "Go kart parts supplier and service centre in Sydney, Australia.",
            telephone: "+61-2-XXXX-XXXX",
            address: { "@type": "PostalAddress", addressLocality: "Sydney", addressRegion: "NSW", addressCountry: "AU" },
            openingHoursSpecification: {
              "@type": "OpeningHoursSpecification",
              dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
              opens: "09:00",
              closes: "17:00",
            },
            priceRange: "$$",
          }),
        }}
      />
    </>
  );
}
