import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { CategoryGrid } from "@/components/shop/CategoryGrid";
import { HeroVideo } from "@/components/layout/HeroVideo";
import { NewsletterSignup } from "@/components/layout/NewsletterSignup";
import { GameTeaser } from "@/components/sections/GameTeaser";
import { HistorySection } from "@/components/sections/HistorySection";
import { Speedometer } from "@/components/sections/Speedometer";
import { ReviewsCarousel } from "@/components/sections/ReviewsCarousel";
import { HomeFaqAccordion } from "@/components/sections/HomeFaqAccordion";
import { ChevronRight, Shield, Wrench, Truck } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Go Kart Parts, Service & Racewear | Sydney",
  description:
    "Shop go kart parts, racewear, servicing, engine tuning and custom race gear from DS Racing Karts in Sydney.",
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
    question: "Can I buy used or preloved kart chassis through DS Racing Karts?",
    answer:
      "Yes. We also run a preloved chassis section for second-hand Predator and endurance kart listings.",
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

export default async function HomePage() {
  const supabase = await createClient();

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

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://dsracingkarts.com.au";
  const featuredCategories = (categories || []).slice(0, 7);

  return (
    <>
      <h1 className="sr-only">
        DS Racing Karts - Go kart parts, kart servicing, racewear, and performance support in Sydney
      </h1>

      <HeroVideo />

      <div className="chequered-stripe" />

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

      <Speedometer />

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
                "@type": "LocalBusiness",
                name: "DS Racing Karts",
                url: siteUrl,
                description: "Go kart parts supplier and service centre in Sydney, Australia.",
                telephone: "+61492454854",
                address: {
                  "@type": "PostalAddress",
                  addressLocality: "Sydney",
                  addressRegion: "NSW",
                  addressCountry: "AU",
                },
                openingHoursSpecification: {
                  "@type": "OpeningHoursSpecification",
                  dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
                  opens: "09:00",
                  closes: "17:00",
                },
                priceRange: "$$",
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
