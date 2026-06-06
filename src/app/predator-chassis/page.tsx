import { createClient } from "@/lib/supabase/server";
import { PredatorChassisClient } from "./PredatorChassisClient";
import type { Metadata } from "next";
import Image from "next/image";
import { unstable_noStore as noStore } from "next/cache";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Preloved Predator Chassis Available",
  description: "The DSR Predator — Australian-built enduro kart chassis designed and tuned by DS Racing Karts. Buy or sell a used Predator through our community board.",
  alternates: {
    canonical: "/predator-chassis",
  },
};

const FEATURES = [
  {
    heading: "Australian Built",
    body: "Designed and fabricated locally — built for Australian conditions and enduro-spec racing.",
  },
  {
    heading: "Enduro Proven",
    body: "Multiple podiums at Eastern Creek endurance karting events. The Predator is built to run flat-out for 12–24 hours.",
  },
  {
    heading: "Custom Setup",
    body: "Each chassis is set up by Dion personally. Geometry, seat position, and balance dialled in before delivery.",
  },
  {
    heading: "Support Included",
    body: "DS Racing Karts provides ongoing technical support to every Predator customer — at the track and over the phone.",
  },
  {
    heading: "Powder Coated",
    body: "Custom powder coat available in any colour — your chassis, your look.",
  },
  {
    heading: "Full Parts Backup",
    body: "All wear items and spares are stocked in-house. No waiting on international shipments.",
  },
];

const USED_CHASSIS_IMAGE = {
  src: "/Chasis/image.png",
  alt: "Used red kart chassis available through DS Racing Karts",
  width: 1200,
  height: 1600,
};

export default async function PredatorChassisPage() {
  noStore();
  const supabase = await createClient();
  const { data: listings } = await supabase
    .from("chassis_listings")
    .select("id, listing_type, description, asking_price, chassis_year, condition, created_at, image_url")
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  return (
    <main className="bg-surface-950 min-h-screen">

      {/* ── Hero: video background ── */}
      <section className="relative min-h-[70vh] flex items-end overflow-hidden">
        <video
          src="/images/history/chasis.mp4"
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Dark gradient overlay so text is legible */}
        <div className="absolute inset-0 bg-gradient-to-t from-surface-950 via-surface-950/60 to-surface-950/20" />

        <div className="relative z-10 max-w-5xl mx-auto px-4 pb-16 w-full">
          <div className="flex items-center gap-3 mb-4">
            <span className="h-[1px] w-8 bg-brand-red" />
            <span className="font-heading text-xs tracking-[0.4em] text-brand-red uppercase">
              DS Racing Karts
            </span>
          </div>
          <h1 className="font-heading text-5xl md:text-7xl uppercase tracking-[0.05em] text-white mb-4">
            DSR <span className="text-brand-red">Predator</span>
          </h1>
          <p className="text-text-secondary text-lg max-w-xl leading-relaxed">
            Australian-built. Enduro-proven. The chassis of choice for serious endurance karting competitors across NSW.
          </p>
          <a
            href="#submit-listing"
            className="btn-primary mt-8 inline-flex items-center gap-2"
          >
            Buy or Sell a Predator
          </a>
        </div>
      </section>

      {/* ── Chequered divider ── */}
      <div className="chequered-stripe" />

      {/* Featured used chassis */}
      <section className="max-w-5xl mx-auto px-4 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.85fr)_minmax(320px,1fr)] gap-8 lg:gap-10 items-center">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="h-[1px] w-8 bg-brand-red" />
              <span className="font-heading text-xs tracking-[0.35em] text-brand-red uppercase">
                Used Chassis
              </span>
            </div>
            <h2 className="font-heading text-3xl md:text-4xl uppercase tracking-[0.08em] text-white mb-4">
              Used Chassis For Sale
            </h2>
            <p className="text-text-secondary leading-relaxed mb-6">
              Current used chassis photo. Contact DS Racing Karts for availability, inspection details, and what is included with the chassis.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <a href="/contact" className="btn-primary text-sm text-center">
                Ask About This Chassis
              </a>
              <a href="#submit-listing" className="btn-secondary text-sm text-center">
                List Yours
              </a>
            </div>
          </div>

          <figure className="overflow-hidden border border-surface-600 bg-surface-900">
            <Image
              src={USED_CHASSIS_IMAGE.src}
              alt={USED_CHASSIS_IMAGE.alt}
              width={USED_CHASSIS_IMAGE.width}
              height={USED_CHASSIS_IMAGE.height}
              sizes="(min-width: 1024px) 480px, 100vw"
              className="h-auto w-full object-contain"
            />
            <figcaption className="border-t border-surface-700 px-4 py-3 text-xs text-text-muted">
              Used chassis available through DS Racing Karts.
            </figcaption>
          </figure>
        </div>
      </section>

      {/* ── Features grid ── */}
      <section className="max-w-5xl mx-auto px-4 py-16">
        <div className="flex items-center gap-3 mb-10">
          <span className="h-[1px] w-8 bg-brand-red" />
          <h2 className="font-heading text-2xl uppercase tracking-[0.1em]">Why Predator</h2>
          <span className="h-[1px] w-8 bg-brand-red" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f) => (
            <div key={f.heading} className="card p-6 border-t-2 border-brand-red">
              <h3 className="font-heading text-sm uppercase tracking-wider text-white mb-2">{f.heading}</h3>
              <p className="text-sm text-text-secondary leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Chequered divider ── */}
      <div className="chequered-stripe-sm" />

      {/* ── Buy/Sell board + form ── */}
      <PredatorChassisClient approvedListings={listings ?? []} />

    </main>
  );
}
