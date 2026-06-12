import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { categoryHref } from "@/lib/shop-links";
import {
  ShopPageView,
  buildCategoryLookup,
  findCategoryByParam,
  type ShopCategory,
  type ShopViewParams,
} from "@/components/shop/ShopPageView";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface Props {
  params: Promise<{ category: string }>;
  searchParams: Promise<Omit<ShopViewParams, "category">>;
}

type CategoryCopy = {
  title: string;
  description: string;
  intro: string[];
};

// SEO copy for the top-level categories, keyed by the live Square slugs.
// Categories without an entry fall back to a sensible template, so new
// categories added in Square still get a working landing page.
const CATEGORY_COPY: Record<string, CategoryCopy> = {
  "brakes-components": {
    title: "Go Kart Brakes — Pads, Discs, Calipers & Master Cylinders",
    description:
      "Shop go kart brake pads, brake discs, calipers, master cylinders, brake lines and bleeding tools. Genuine kart brake parts shipped Australia-wide from Sydney.",
    intro: [
      "Everything you need to pull a racing kart up: brake pads, brake discs, calipers, master cylinders, nylon brake line, brake fluid and bleeding tools. We stock parts to suit popular chassis including Arrow, CRG and OTK, plus universal components for club and endurance karts.",
      "Not sure which pads or disc size suit your kart? Contact us with your chassis model and we'll point you at the right part. Orders ship Australia-wide from our Sydney workshop.",
    ],
  },
  "steering-components": {
    title: "Go Kart Steering — Wheels, Columns, Hubs & Components",
    description:
      "Go kart steering wheels, steering columns, boss kits, tie rods and steering components for racing karts. Shipped Australia-wide from Sydney.",
    intro: [
      "Steering wheels, steering columns, boss kit adapters, tie rods, heim joints and the small hardware that keeps your kart pointing where you want it. We carry parts to suit OMP and MOMO pattern wheels and chassis like CRG, Arrow and OTK.",
    ],
  },
  "engines-accessories-2": {
    title: "Go Kart Engines & Parts — Rotax, Honda, Briggs & Torini",
    description:
      "Go kart engines and engine parts: Rotax, Honda GX, Briggs & Stratton, Torini and IAME. Pistons, carburettors, clutches and rebuild parts shipped Australia-wide.",
    intro: [
      "Engines and engine parts for sprint and endurance karting — Rotax pistons, jets and rebuild components, Honda GX160/GX200 and clone parts, Briggs & Stratton, Torini and IAME spares, clutches, carburettors and exhausts.",
      "We also rebuild and tune kart engines in-house. If you'd rather have it done than do it yourself, book the engine in through our services page.",
    ],
  },
  "chassis-components-2": {
    title: "Kart Chassis Components — Bumpers, Protectors & Floor Trays",
    description:
      "Go kart chassis components: bumpers, side pods, chassis protectors, floor trays, seat stays and mounting hardware. Shipped Australia-wide.",
    intro: [
      "Chassis hardware and protection for racing karts — front and rear bumpers, side pods, chassis protectors, floor trays, seat stays and the brackets and mounts that hold it all together.",
    ],
  },
  "nuts-bolts-washers": {
    title: "Kart Nuts, Bolts & Countersunk Washers",
    description:
      "Kart-spec nuts, bolts, countersunk washers and fasteners — M6, M8 and M10 hardware for go kart seats, bodywork and chassis. Shipped Australia-wide.",
    intro: [
      "Kart-spec fasteners in the sizes karts actually use: M6 and M8 countersunk washers, high-tensile bolts, nyloc nuts, wheel nuts and seat hardware. Cheaper to get them right the first time than to drill out a rounded bolt at the track.",
    ],
  },
  "axles-components": {
    title: "Go Kart Axles & Components — 50mm Axles, Hubs & Keys",
    description:
      "Go kart axles, rear hubs, axle keys, collars and bearing hangers. 50mm kart axles in multiple stiffness ratings, shipped Australia-wide.",
    intro: [
      "Rear axles and everything that hangs off them — 50mm axles in different stiffness ratings, rear wheel hubs, axle keys, collars and circlips. Axle choice changes how your kart grips; ask us if you're not sure whether to go softer or harder for your track.",
    ],
  },
  "fuel-tank-accessories": {
    title: "Go Kart Fuel Tanks & Accessories",
    description:
      "Go kart fuel tanks, fuel lines, filters, taps and fittings — including genuine Honda GX160/GX200 fuel tanks. Shipped Australia-wide from Sydney.",
    intro: [
      "Fuel tanks and fuel system parts for karts and 4-stroke engines — tanks, fuel line, T-pieces, filters, taps, bleeder fittings and genuine Honda GX160/GX200 tanks and caps.",
    ],
  },
  bearings: {
    title: "Go Kart Bearings & Carriers — Kingpin, Axle & Wheel Bearings",
    description:
      "Go kart bearings: kingpin bearings, axle bearings, bearing carriers and wheel bearings for racing karts. Shipped Australia-wide from Sydney.",
    intro: [
      "Kingpin bearings, axle bearings, bearing carriers and hangers, and wheel bearings for racing karts. Worn bearings are the cheapest lap time you'll ever buy back — if the kart feels vague or the axle spins rough, start here.",
    ],
  },
  chains: {
    title: "Go Kart Chains & Accessories — 219 Pitch Kart Chains",
    description:
      "Go kart chains and chain accessories: 219 pitch CZ chains, chain breakers, lube and guards for sprint and endurance karting. Shipped Australia-wide.",
    intro: [
      "Kart chains and chain care — 219 pitch racing chains including CZ, chain breakers, chain lube and guards. Match your chain length to your sprocket combination; contact us if you need help working out links for your gearing.",
    ],
  },
  "wheels-accessories-2": {
    title: "Go Kart Wheels & Rims — Magnesium & Alloy",
    description:
      "Go kart wheels and rims: magnesium wheel sets, alloy rims, wheel nuts and accessories for racing karts. Shipped Australia-wide from Sydney.",
    intro: [
      "Racing kart wheels and accessories — magnesium wheel sets for serious racers, alloy rims for club days, plus wheel nuts, studs and valve hardware. Magnesium runs cooler and keeps tyre temperatures more consistent over a run; ask us what suits your class.",
    ],
  },
  racewear: {
    title: "Karting Racewear & Supporter Gear",
    description:
      "Karting racewear: race suits, gloves, boots and DS Racing supporter gear. Shipped Australia-wide from Sydney.",
    intro: [
      "Race suits, gloves, boots and DS Racing Karts supporter gear. Custom racewear is made to order — sizing and lead times vary, so get in touch before ordering if you're between sizes.",
    ],
  },
  "sprockets-carriers": {
    title: "Go Kart Sprockets & Carriers — Split Sprockets & 219 Pitch",
    description:
      "Go kart sprockets and sprocket carriers: split sprockets, 219 pitch rear sprockets and clutch sprockets. Shipped Australia-wide from Sydney.",
    intro: [
      "Rear sprockets, split sprockets, sprocket carriers and clutch sprockets for racing karts. Split sprockets save you pulling the axle apart for a gearing change — worth it the first time it starts raining ten minutes before a final.",
    ],
  },
  "sticker-kits": {
    title: "Kart Stickers, Number Plates & Graphics Kits",
    description:
      "Kart sticker kits, race numbers and number plate graphics for go karts. Shipped Australia-wide from Sydney.",
    intro: [
      "Sticker kits, race numbers and number plates to keep your kart looking sharp and legal for scrutineering.",
    ],
  },
  "protective-gear": {
    title: "Karting Protective Gear — Rib Protectors & Neck Braces",
    description:
      "Karting protective gear: rib protectors, neck braces and body protection for kart racers. Shipped Australia-wide from Sydney.",
    intro: [
      "Rib protectors, neck braces and body protection for kart racers of all ages. If you've ever finished a race day with bruised ribs, you already know why this category exists.",
    ],
  },
  "accessories-karting": {
    title: "Karting Accessories — Covers, Trolleys & Track Gear",
    description:
      "Karting accessories: kart covers, trolleys, tools and pit gear for race days. Shipped Australia-wide from Sydney.",
    intro: [
      "The gear that makes race days easier — kart covers, trolleys, stands, tools and pit accessories.",
    ],
  },
  helmets: {
    title: "Karting Helmets",
    description:
      "Karting helmets for kart racing — youth and adult sizes. Shipped Australia-wide from Sydney.",
    intro: [
      "Helmets suitable for karting in youth and adult sizes. Check your club's current standards before buying, and contact us if you need help with sizing.",
    ],
  },
  "chassis-2": {
    title: "Go Kart Chassis — Race-Ready Karts & Rolling Chassis",
    description:
      "Go kart chassis and rolling chassis for sprint and endurance racing, including the DSR Predator 4-stroke endurance chassis. Sydney, shipped Australia-wide.",
    intro: [
      "New and race-prepared kart chassis for sprint and endurance racing — including our own DSR Predator, the purpose-built 4-stroke twin endurance chassis designed and built right here.",
      "Looking for something second-hand? Check the pre-loved chassis page, or contact us about chassis straightening and full race prep in our workshop.",
    ],
  },
  "car-racing": {
    title: "Car Racing Parts & Accessories",
    description:
      "Car racing parts and accessories from DS Racing Karts. Shipped Australia-wide from Sydney.",
    intro: [
      "Parts and accessories for car racing — browse the subcategories or use the search to find a specific part.",
    ],
  },
  services: {
    title: "Kart Servicing & Race Support",
    description:
      "Kart servicing, engine tuning, chassis straightening and race support from DS Racing Karts in Sydney.",
    intro: [
      "These are our bookable workshop services. For the full rundown of what we do — servicing, engine builds, chassis straightening and trackside support — see the services page or contact us to make an appointment.",
    ],
  },
  miscellaneous: {
    title: "Karting Odds & Ends",
    description:
      "Miscellaneous go kart parts and karting accessories. Shipped Australia-wide from Sydney.",
    intro: [
      "The parts that don't fit neatly anywhere else. If you can't find what you're after, use the search above or contact us — if it exists in karting, we can usually get it.",
    ],
  },
};

function fallbackCopy(name: string): CategoryCopy {
  const lower = name.toLowerCase();
  return {
    title: `${name} — Go Kart Parts`,
    description: `Shop ${lower} for racing go karts at DS Racing Karts. Genuine parts shipped Australia-wide from our Sydney workshop.`,
    intro: [
      `Browse our range of ${lower} for racing go karts. Can't find the exact part you need? Contact us — we can source most karting parts from our suppliers within 24–48 hours.`,
    ],
  };
}

async function resolveCategory(categoryParam: string) {
  const supabase = await createClient();
  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, parent_id, slug, square_id")
    .order("name");

  const lookup = buildCategoryLookup((categories || []) as ShopCategory[]);
  return findCategoryByParam(lookup.dedupedCategories, categoryParam);
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { category } = await params;
  const sp = await searchParams;
  const resolved = await resolveCategory(category);
  if (!resolved) notFound();

  const copy = CATEGORY_COPY[resolved.slug] ?? fallbackCopy(resolved.name);
  const canonicalParams = new URLSearchParams();
  if (sp.page && sp.page !== "1") canonicalParams.set("page", sp.page);
  const canonicalQs = canonicalParams.toString();

  return {
    title: copy.title,
    description: copy.description,
    alternates: {
      canonical: `${categoryHref(resolved.slug)}${canonicalQs ? `?${canonicalQs}` : ""}`,
    },
    robots: sp.search?.trim()
      ? {
          index: false,
          follow: true,
        }
      : undefined,
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { category } = await params;
  const sp = await searchParams;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://dsracingkarts.com.au";

  const resolved = await resolveCategory(category);
  if (!resolved) notFound();

  // Name-slugified variants ("brakes-and-components") consolidate onto the
  // one canonical URL per category.
  if (resolved.slug !== category) {
    permanentRedirect(categoryHref(resolved.slug));
  }

  const copy = CATEGORY_COPY[resolved.slug] ?? fallbackCopy(resolved.name);
  const isFirstPlainPage = (!sp.page || sp.page === "1") && !sp.search;

  return (
    <>
      <ShopPageView
        params={{ ...sp, category: resolved.slug }}
        basePath={categoryHref(resolved.slug)}
      />

      {/* SEO copy — first page only, so paginated views stay lean */}
      {isFirstPlainPage && (
        <section className="max-w-7xl mx-auto px-4 pb-12 md:pb-16">
          <div className="border-t border-surface-600/50 pt-8 max-w-3xl">
            <div className="flex items-center gap-3 mb-4">
              <span className="h-[1px] w-6 bg-brand-red" />
              <h2 className="font-heading text-xs uppercase tracking-[0.3em] text-brand-red">
                About {resolved.name}
              </h2>
            </div>
            <div className="space-y-3 text-text-secondary text-sm leading-relaxed">
              {copy.intro.map((paragraph, idx) => (
                <p key={idx}>{paragraph}</p>
              ))}
            </div>
          </div>
        </section>
      )}

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "BreadcrumbList",
                itemListElement: [
                  { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
                  { "@type": "ListItem", position: 2, name: "Shop", item: `${siteUrl}/shop` },
                  {
                    "@type": "ListItem",
                    position: 3,
                    name: resolved.name,
                    item: `${siteUrl}${categoryHref(resolved.slug)}`,
                  },
                ],
              },
              {
                "@type": "CollectionPage",
                name: copy.title,
                description: copy.description,
                url: `${siteUrl}${categoryHref(resolved.slug)}`,
                isPartOf: {
                  "@type": "WebSite",
                  name: "DS Racing Karts",
                  url: siteUrl,
                },
              },
            ],
          }),
        }}
      />
    </>
  );
}
