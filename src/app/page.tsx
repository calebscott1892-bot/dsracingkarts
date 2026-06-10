import Link from "next/link";
import type { Metadata } from "next";
import { createPublicReadClient } from "@/lib/supabase/server";
import { CategoryGrid } from "@/components/shop/CategoryGrid";
import { HeroVideo } from "@/components/layout/HeroVideo";
import { NewsletterSignup } from "@/components/layout/NewsletterSignup";
import { GameTeaser } from "@/components/sections/GameTeaser";
import { HistorySection } from "@/components/sections/HistorySection";
import { Speedometer } from "@/components/sections/Speedometer";
import { ReviewsCarousel } from "@/components/sections/ReviewsCarousel";
import { HomeFaqAccordion } from "@/components/sections/HomeFaqAccordion";
import { ChevronRight, Shield, Wrench, Truck } from "lucide-react";

const GIFT_CARD_SLUG = "ds-racing-karts-e-gift-card";
const PARTS_AVAILABLE_FALLBACK = 3500;
const PARTS_AVAILABLE_ROUNDING = 500;

// The homepage shows only public catalog data (categories, reviews, an active-
// product count) — none of it is user-specific. Using the cookie-less read
// client lets Next statically render + ISR-cache the page, so we revalidate the
// data periodically instead of hitting Supabase three times on every request.
export const revalidate = 300;

export const metadata: Metadata = {
  title: "Go Kart Chassis, Parts, Service & Racewear | Sydney",
  description:
    "Having problems in karting? DS Racing Karts is your karting solutions specialist in Sydney — chassis, parts, servicing, engine tuning, and custom racewear, shipped Australia-wide.",
  alternates: {
    canonical: "/",
  },
};

const HOME_FAQS = [
  {
    question: "What go kart parts does DS Racing Karts stock?",
    answer:
      "We supply engines, chassis parts, brakes, steering components, sprockets, chains, accessories, racewear, and workshop consumables.",
  },
  {
    question: "Do you offer kart servicing in Sydney?",
    answer:
      "Yes. We handle kart servicing, engine checks, setup work, race preparation, and workshop support from our Sydney base.",
  },
  {
    question: "Can you ship parts Australia-wide?",
    answer: "Yes. We quote and ship orders nationwide across Australia.",
  },
  {
    question: "Do you work on 2-stroke and 4-stroke karts?",
    answer: "Yes. We service both 2-stroke and 4-stroke kart engines and chassis setups.",
  },
  {
    question: "Can DS Racing Karts help with race preparation?",
    answer:
      "Yes. We can help with race-day setup, safety checks, tyre prep, tuning, and general track-readiness.",
  },
  {
    question: "Do you provide custom racewear?",
    answer:
      "Yes. We organise custom race suits, gloves, apparel, and branded team gear tailored to your colours and logos.",
  },
  {
    question: "Can I buy kart chassis through DS Racing Karts?",
    answer:
      "Yes. Browse current chassis options in the shop, and check the pre-loved chassis page for used Predator listings.",
  },
  {
    question: "Do I need an appointment before visiting the workshop?",
    answer: "Yes. The workshop is appointment-only, so contact us first before visiting.",
  },
  {
    question: "Can you help identify the right parts for my kart?",
    answer:
      "Yes. If you are unsure which part fits your kart, contact us and we can help match the right components.",
  },
  {
    question: "Does DS Racing Karts support teams as well as individual drivers?",
    answer:
      "Yes. We support individual racers, endurance teams, branded team racewear, and workshop preparation for competition use.",
  },
];

function getPartsAvailableCount(productCount: number | null) {
  if (!productCount || productCount < PARTS_AVAILABLE_FALLBACK) {
    return PARTS_AVAILABLE_FALLBACK;
  }

  return Math.floor(productCount / PARTS_AVAILABLE_ROUNDING) * PARTS_AVAILABLE_ROUNDING;
}

export default async function HomePage() {
  const supabase = createPublicReadClient();

  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, slug, image_url, sort_order")
    .is("parent_id", null)
    .order("sort_order")
    .order("name");

  const { data: reviews } = await supabase
    .from("reviews")
    .select("id, author_name, text, platform, rating")
    .eq("is_visible", true)
    .order("sort_order")
    .order("created_at");

  const { count: productCount } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("status", "active")
    .eq("visibility", "visible")
    .eq("is_sellable", true)
    .neq("slug", GIFT_CARD_SLUG);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://dsracingkarts.com.au";
  const featuredCategories = (categories || []).slice(0, 7);
  const partsAvailableCount = getPartsAvailableCount(productCount);

  return (
    <>
      {/* Single H1 lives inside HeroVideo. The screen-reader-only paragraph
          here adds brand + location context for assistive tech without
          competing for H1 weight. */}
      <p className="sr-only">
        DS Racing Karts — go kart parts, kart servicing, racewear, and performance support in Sydney, Australia.
      </p>

      <script
        dangerouslySetInnerHTML={{
          __html: `if(location.pathname==="/"){history.scrollRestoration="manual";if(location.hash==="#categories"&&matchMedia("(max-width:767px)").matches){history.replaceState(history.state,"",location.pathname+location.search);}if(!location.hash){scrollTo(0,0);}}`,
        }}
      />

      <HeroVideo />

      <div className="chequered-stripe" />

      {/* Karting solutions strapline — sits between the hero and the value-
          prop cards. Doubles as a positioning statement and a "Karting
          Solutions" keyword anchor for SEO without keyword-stuffing. */}
      <section className="relative bg-racing-black border-b border-surface-600/20">
        <div className="max-w-4xl mx-auto px-4 py-10 md:py-12 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <span className="h-[1px] w-8 bg-racing-red" />
            <span className="font-heading text-xs tracking-[0.4em] text-racing-red uppercase">
              Your Karting Solutions
            </span>
            <span className="h-[1px] w-8 bg-racing-red" />
          </div>
          <p className="font-heading text-lg md:text-2xl uppercase tracking-[0.06em] text-white leading-snug">
            Having problems in karting?
            <br className="hidden md:block" />{" "}
            <span className="text-racing-red">Direct your attention to DSR</span> for your karting solutions.
          </p>
        </div>
      </section>

      <section className="relative bg-racing-dark carbon-fiber border-b border-surface-600/20">
        <div className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: Shield,
              title: "Race-Ready Parts",
              text: "Thousands of products - dealer for all major importers and US/UK suppliers",
              accent: "text-racing-red",
            },
            {
              icon: Wrench,
              title: "Expert Service",
              text: "Professional kart setup and engine tuning in Sydney",
              accent: "text-racing-gold",
            },
            {
              icon: Truck,
              title: "Australia-Wide",
              text: "Shipping available nationwide - quoted per order",
              accent: "text-racing-red",
            },
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

      <GameTeaser />

      <div className="chequered-stripe-sm" />

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
            href="/shop"
            className="hidden md:flex items-center gap-1 font-heading text-xs uppercase tracking-[0.15em] text-text-muted hover:text-racing-red transition-colors"
          >
            View All <ChevronRight size={14} />
          </Link>
        </div>
        <CategoryGrid
          categories={featuredCategories}
          extraTile={{ href: "/shop", title: "See More", subtitle: "Browse all products" }}
        />
      </section>

      <div className="chequered-stripe" />

      <HistorySection />

      <div className="chequered-stripe" />

      <Speedometer partsAvailableCount={partsAvailableCount} />

      <ReviewsCarousel reviews={reviews ?? []} />

      <div className="max-w-7xl mx-auto px-4">
        <div className="racing-line" />
      </div>

      <section className="max-w-5xl mx-auto px-4 py-10 md:py-14">
        <div className="flex items-center gap-3 mb-6">
          <span className="h-[1px] w-8 bg-racing-red" />
          <span className="font-heading text-xs tracking-[0.35em] text-racing-red uppercase">FAQ</span>
        </div>
        <h2 className="section-heading mb-6">
          Common <span className="text-racing-red">Questions</span>
        </h2>
        <HomeFaqAccordion items={HOME_FAQS} />
      </section>

      <section className="max-w-3xl mx-auto px-4 py-16 md:py-20">
        <NewsletterSignup />
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "Organization",
                name: "DS Racing Karts",
                url: siteUrl,
                logo: `${siteUrl}/images/history/Site Logo (2).png`,
                contactPoint: [
                  {
                    "@type": "ContactPoint",
                    telephone: "+61492454854",
                    contactType: "customer service",
                    areaServed: "AU",
                    availableLanguage: "en",
                  },
                ],
              },
              {
                "@type": ["LocalBusiness", "AutoPartsStore", "Store"],
                "@id": `${siteUrl}#business`,
                name: "DS Racing Karts",
                url: siteUrl,
                description:
                  "Sydney's karting solutions specialist — chassis, parts, servicing, and racewear. We help racers solve karting problems with hands-on workshop support, endurance kart preparation, 2-stroke and 4-stroke engine tuning, and custom team racewear. Australia-wide shipping.",
                telephone: "+61492454854",
                email: "dsracing@bigpond.com",
                image: `${siteUrl}/images/history/Site Logo (2).png`,
                logo: `${siteUrl}/images/history/Site Logo (2).png`,
                address: {
                  "@type": "PostalAddress",
                  streetAddress: "Long Reef Crescent",
                  addressLocality: "Woodbine",
                  addressRegion: "NSW",
                  postalCode: "2560",
                  addressCountry: "AU",
                },
                areaServed: [
                  { "@type": "Country", name: "Australia" },
                  { "@type": "AdministrativeArea", name: "New South Wales" },
                  { "@type": "City", name: "Sydney" },
                ],
                openingHoursSpecification: {
                  "@type": "OpeningHoursSpecification",
                  dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
                  opens: "09:00",
                  closes: "17:00",
                },
                priceRange: "$$",
                sameAs: ["https://www.facebook.com/dsracingkarts"],
              },
              {
                "@type": "WebSite",
                name: "DS Racing Karts",
                url: siteUrl,
                potentialAction: {
                  "@type": "SearchAction",
                  target: `${siteUrl}/shop?search={search_term_string}`,
                  "query-input": "required name=search_term_string",
                },
              },
              {
                "@type": "FAQPage",
                mainEntity: HOME_FAQS.map((faq) => ({
                  "@type": "Question",
                  name: faq.question,
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: faq.answer,
                  },
                })),
              },
            ],
          }),
        }}
      />
    </>
  );
}
