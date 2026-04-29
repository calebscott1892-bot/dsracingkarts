import { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import ServiceExpandGrid from "@/components/sections/ServiceExpandGrid";
import { createServiceClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Our Services",
  description: "Go kart servicing, engine tuning, chassis setup, and race preparation. Sydney's trusted kart specialists.",
  alternates: {
    canonical: "/services",
  },
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

function isRemoteImage(src: string) {
  return src.startsWith("http://") || src.startsWith("https://");
}

const services = [
  {
    iconName: "Wrench" as const,
    title: "Kart Servicing",
    description: "Full kart service including engine maintenance, clutch adjustment, chain and sprocket replacement, and comprehensive safety checks.",
    details: [
      "Our full kart service covers every component of your machine — from the engine and clutch through to the braking system, steering, and chain drive. We inspect and replace worn parts before they become a problem.",
      "Whether you're running a weekend hire kart or a competitive endurance machine, every kart gets the same thorough treatment. We log all work so you have a full service history for your chassis.",
    ],
    includes: [
      "Engine inspection & oil change",
      "Clutch adjustment & inspection",
      "Chain & sprocket check/replacement",
      "Brake pad & disc inspection",
      "Steering & tie-rod check",
      "Full safety inspection",
    ],
  },
  {
    iconName: "Gauge" as const,
    title: "Engine Tuning",
    description: "Performance engine tuning for both 2-stroke and 4-stroke engines. Get the most out of your kart on race day.",
    details: [
      "Our engine tuning service is designed to keep your engine running reliably and within class rules. We work with all major engine platforms including Yamaha KT100, Rotax, IAME, Briggs & Stratton, Honda GX200, and Torini.",
      "Jetting adjustments and ignition timing are tuned to your specific class rules and driving style.",
    ],
    includes: [
      "Carburettor jetting & tuning",
      "Ignition timing optimisation",
      "Class compliance verification",
    ],
  },
  {
    iconName: "Settings" as const,
    title: "Chassis Setup",
    description: "Expert chassis setup and alignment to suit your driving style and track conditions. We fine-tune ride height, caster, camber, and more.",
    details: [
      "Chassis setup can make or break your lap times. Our experienced mechanics will work with you to dial in the perfect setup for your weight, driving style, and the specific track you're racing on.",
      "We adjust all key parameters including front-end geometry, seat position, axle stiffness, ride height, and tyre pressures to give you a balanced, predictable kart.",
    ],
    includes: [
      "Camber & caster adjustment",
      "Ride height fine-tuning",
      "Seat positioning & fitting",
      "Axle stiffness selection",
      "Tyre pressure recommendations",
      "Corner-weight balancing",
    ],
  },
  {
    iconName: "Zap" as const,
    title: "Engine Servicing",
    description: "Comprehensive engine servicing for 2-stroke and 4-stroke kart engines across all classes. Keep your engine running at its best.",
    details: [
      "Endurance racing puts extreme demands on equipment. Our engine servicing is built around reliability-first engineering — because the fastest kart is the one still running at the chequered flag.",
      "We service all major engine platforms including Honda GX200, Briggs & Stratton L206 and Animal, Torini, Yamaha KT100, Rotax, and IAME. From pre-race inspections to full post-race tear-downs, we cover everything your team needs.",
    ],
    includes: [
      "Full engine inspection & servicing",
      "Valve adjustment & lapping",
      "Oil system service",
      "Governor & throttle linkage setup",
      "Pre-race reliability checks",
      "Post-race tear-down reports",
    ],
  },
  {
    iconName: "Shield" as const,
    title: "Race Preparation",
    description: "Complete race-day prep including safety checks, tyre management, jetting, and pre-race engine warm-up procedures.",
    details: [
      "Our race-prep service ensures your kart arrives at the track ready to compete. We handle everything from safety compliance through to performance optimisation so you can focus on driving.",
      "Available as a one-off service or as ongoing race-weekend support. We can also provide trackside assistance for endurance events.",
    ],
    includes: [
      "Full safety compliance check",
      "Tyre fitting & pressure setup",
      "Jetting for weather conditions",
      "Engine warm-up & tuning",
      "Data logger setup (if fitted)",
      "Spare parts inventory check",
    ],
  },
  {
    iconName: "Users" as const,
    title: "Driver Coaching",
    description: "One-on-one coaching and setup advice from experienced racers. Improve your lap times and race craft.",
    details: [
      "Whether you're a beginner learning the basics or an experienced racer looking to shave tenths off your lap times, our coaching program is tailored to your level and goals.",
      "Sessions cover driving technique, race-craft strategy, data analysis, and kart setup understanding. We'll help you read the track, manage tyres, and execute clean overtakes.",
    ],
    includes: [
      "On-track driving technique",
      "Braking & turn-in points",
      "Race-craft & overtaking strategy",
      "Data analysis & debrief",
      "Setup feedback & adjustment",
      "Mental preparation tips",
    ],
  },
  {
    iconName: "Shirt" as const,
    title: "Custom Racewear",
    description: "Custom-designed race suits, gloves, and gear tailored to your team colours. Look fast, feel fast.",
    details: [
      "Stand out on the grid with custom racewear designed to your team's identity. We work with leading manufacturers to produce high-quality suits, gloves, and accessories in your exact colours and branding.",
      "All gear meets CIK-FIA safety standards and is available in both adult and junior sizes. Bulk team orders welcome with discounted pricing.",
    ],
    includes: [
      "Custom race suit design",
      "Team-branded gloves",
      "Matching rib protectors",
      "Neck braces & accessories",
      "Bulk team order discounts",
      "Junior sizing available",
    ],
  },
];

// Fallback hardcoded entries used before the DB table is seeded or if the query fails
const FALLBACK_GALLERY = [
  { id: "1", group_label: "Wilson / Enhanced HVAC", image_url: "/images/history/Racewear1.jpeg", alt_text: "Wilson \u2013 Enhanced HVAC race suit design render" },
  { id: "2", group_label: "NCR \u2013 No Chance Racing", image_url: "/images/history/racewear2.webp", alt_text: "NCR No Chance Racing \u2013 race suit design render" },
  { id: "3", group_label: "NCR \u2013 No Chance Racing", image_url: "/images/history/racewear6.webp", alt_text: "NCR No Chance Racing \u2013 finished suit on driver" },
  { id: "4", group_label: "Stratco", image_url: "/images/history/racewear3.webp", alt_text: "Stratco / Lawrence & Hanson \u2013 race suit design render" },
  { id: "5", group_label: "DSR Racing Suit", image_url: "/images/history/racewear4.webp", alt_text: "DSR race suit \u2013 design render (front & back)" },
  { id: "6", group_label: "DSR Racing Suit", image_url: "/images/history/racewear4irl.jpg", alt_text: "DSR race suit \u2013 finished suit on driver" },
  { id: "7", group_label: "RK Racing Studio \u2013 HR42", image_url: "/images/history/racewear9.webp", alt_text: "HR42 RK Racing Studio \u2013 finished race suit" },
  { id: "8", group_label: "RK Racing Studio \u2013 HR42", image_url: "/images/history/racewear7.webp", alt_text: "HR42 \u2013 custom race boots" },
  { id: "9", group_label: "RK Racing Studio \u2013 HR42", image_url: "/images/history/racewear7gloves.webp", alt_text: "HR42 \u2013 custom racing gloves" },
  { id: "10", group_label: "STC Motorsport", image_url: "/images/history/racewear5.jpg", alt_text: "STC Motorsport \u2013 Chloe Ford in custom race suit" },
  { id: "11", group_label: "BARBEN Architectural Hardware", image_url: "/images/history/racewear8.jpg", alt_text: "BARBEN Architectural Hardware \u2013 team race suits at Eastern Creek" },
  { id: "12", group_label: "DSR Branded Apparel", image_url: "/images/history/racewearDRS.webp", alt_text: "DSR custom hoodie \u2013 front" },
  { id: "13", group_label: "DSR Branded Apparel", image_url: "/images/history/RacewearDRSback.webp", alt_text: "DSR racing jersey \u2013 at the track" },
];

export default async function ServicesPage() {
  const supabase = createServiceClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://dsracingkarts.com.au";
  const { data: dbGallery } = await supabase
    .from("racewear_gallery")
    .select("id, group_label, image_url, alt_text, is_featured")
    .eq("is_active", true)
    .eq("is_featured", true)
    .order("sort_order")
    .order("created_at");

  const galleryEntries = (dbGallery && dbGallery.length > 0) ? dbGallery : FALLBACK_GALLERY;

  // Build grouped structure from flat list
  const racewearGroups = galleryEntries.reduce<Record<string, { src: string; alt: string }[]>>((acc, entry) => {
    (acc[entry.group_label] ??= []).push({ src: entry.image_url, alt: entry.alt_text });
    return acc;
  }, {});

  return (
    <>
      {/* Hero */}
      <section className="relative bg-racing-black overflow-hidden py-20 md:py-28">
        {/* Background photo */}
        <Image
          src="/images/history/Services1.jpg"
          alt=""
          fill
          className="object-cover opacity-30"
          priority
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/40 to-racing-black" />

        <div className="relative z-10 max-w-4xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <span className="h-[1px] w-8 bg-racing-red" />
            <span className="font-heading text-xs tracking-[0.4em] text-racing-red uppercase">What We Do</span>
            <span className="h-[1px] w-8 bg-racing-red" />
          </div>
          <h1 className="font-heading text-4xl md:text-6xl uppercase tracking-[0.1em] text-white mb-4">
            Our <span className="text-racing-red">Services</span>
          </h1>
          <p className="text-text-secondary max-w-lg mx-auto">
            From routine servicing to full race preparation — we provide everything you need to get on track and stay competitive.
          </p>
        </div>
      </section>

      <div className="chequered-stripe" />

      {/* Services Grid */}
      <section className="max-w-5xl mx-auto px-4 py-16 md:py-20">
        <div className="flex items-center gap-3 mb-2">
          <span className="h-[1px] w-8 bg-racing-red" />
          <span className="font-heading text-xs tracking-[0.3em] text-racing-red uppercase">Click any service to learn more</span>
        </div>
        <ServiceExpandGrid services={services} />
      </section>

      {/* ── Workshop Showcase with cut-corner image ── */}
      <section className="max-w-5xl mx-auto px-4 py-12 md:py-16">
        <div className="grid md:grid-cols-2 gap-10 md:gap-14 items-center">
          {/* Text */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="h-[1px] w-8 bg-racing-red" />
              <span className="font-heading text-xs tracking-[0.3em] text-racing-red uppercase">Our Workshop</span>
            </div>
            <h2 className="font-heading text-2xl md:text-3xl uppercase tracking-[0.1em] text-white mb-4">
              Built for <span className="text-racing-red">Performance</span>
            </h2>
            <div className="space-y-4 text-white/70 leading-relaxed">
              <p>
                Every kart that comes through our workshop gets the same treatment — whether
                it&apos;s a weekend hire kart or a championship contender. We don&apos;t cut corners
                on quality.
              </p>
              <p>
                With decades of hands-on racing and engineering experience, our workshop is equipped
                to handle everything from routine servicing to custom
                chassis fabrication.
              </p>
              <p>
                We service all kart engines — 2-stroke and 4-stroke — including Briggs &amp; Stratton,
                Honda GX200, Torini, Rotax, IAME, and more. From regular servicing to race-day prep, trust the experts.
              </p>
              <p>
                We specialise in most 2 &amp; 4 stroke kart engine &amp; chassis servicing.
              </p>
              <p className="text-white/50 text-sm">
                Looking for a chassis?{" "}
                <Link href="/predator-chassis" className="text-racing-red hover:text-racing-red/80 underline underline-offset-2 transition-colors">
                  Browse our chassis marketplace →
                </Link>
              </p>
            </div>
            <Link
              href="/contact"
              className="inline-block mt-6 bg-racing-red text-white font-heading text-sm uppercase tracking-[0.15em] px-8 py-3 hover:bg-racing-red/90 transition-colors"
            >
              Book a Service
            </Link>
          </div>

          {/* Image with cut corners (top-left & bottom-right) */}
          <div className="relative">
            <div className="relative overflow-hidden">
              <Image
                src="/images/history/Services.jpg"
                alt="DS Racing Karts workshop"
                width={800}
                height={600}
                className="w-full h-auto object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
              {/* Top-left corner cut — background triangle */}
              <div
                className="absolute top-0 left-0 w-16 h-16 md:w-24 md:h-24"
                style={{
                  background: "linear-gradient(to bottom right, #0a0a0a 50%, transparent 50%)",
                }}
              />
              {/* Bottom-right corner cut — background triangle */}
              <div
                className="absolute bottom-0 right-0 w-16 h-16 md:w-24 md:h-24"
                style={{
                  background: "linear-gradient(to top left, #0a0a0a 50%, transparent 50%)",
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Custom Racewear Showcase ── */}
      <section id="custom-racewear" className="max-w-6xl mx-auto px-4 py-12 md:py-16 scroll-mt-28">
        <div className="flex items-center gap-3 mb-2">
          <span className="h-[1px] w-8 bg-racing-red" />
          <span className="font-heading text-xs tracking-[0.3em] text-racing-red uppercase">Custom Racewear</span>
        </div>
        <h2 className="font-heading text-2xl md:text-3xl uppercase tracking-[0.1em] text-white mb-3">
          Look Fast, <span className="text-racing-red">Feel Fast</span>
        </h2>
        <p className="text-white/60 text-sm mb-8 max-w-xl">
          Custom-designed race suits, gloves, and gear tailored to your team colours. Here&apos;s some of the racewear we&apos;ve produced.
        </p>

        {Object.entries(racewearGroups).map(([label, images]) => (
          <div key={label} className="mb-8">
            <p className="text-xs text-white/30 uppercase tracking-[0.2em] font-heading mb-2">{label}</p>
            <div className={`grid gap-3 ${
              images.length === 1 ? "grid-cols-1 max-w-[320px]" :
              images.length === 2 ? "grid-cols-2" :
              "grid-cols-3"
            }`}>
              {images.map(({ src, alt }) => (
                <div key={src} className="relative aspect-[3/4] bg-racing-dark border border-white/10 overflow-hidden group/img">
                  <Image
                    src={src}
                    alt={alt}
                    fill
                    unoptimized={isRemoteImage(src)}
                    className="object-cover transition-transform duration-500 group-hover/img:scale-105"
                    sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover/img:opacity-100 transition-opacity duration-300" />
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="text-center mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/contact"
            className="inline-block bg-racing-red text-white font-heading text-sm uppercase tracking-[0.15em] px-8 py-3 hover:bg-racing-red/90 transition-colors"
          >
            Enquire About Custom Racewear
          </Link>
          <Link
            href="/services/racewear-gallery"
            className="inline-block border border-white/20 text-white font-heading text-sm uppercase tracking-[0.15em] px-8 py-3 hover:border-racing-red hover:text-racing-red transition-colors"
          >
            See More
          </Link>
        </div>
      </section>

      <div className="chequered-stripe" />

      {/* ── Chassis Knowledge ── */}
      <section className="max-w-4xl mx-auto px-4 py-16 md:py-20">
        <div className="flex items-center gap-3 mb-10">
          <span className="h-[1px] w-8 bg-racing-red" />
          <h2 className="font-heading text-2xl md:text-3xl uppercase tracking-[0.1em] text-white">
            Know Your <span className="text-racing-red">Chassis</span>
          </h2>
        </div>

        {/* Sprint chassis */}
        <div className="mb-12">
          <h3 className="font-heading text-lg uppercase tracking-[0.1em] text-white mb-4">
            What is a Sprint Go Kart Chassis?
          </h3>
          <p className="text-white/70 leading-relaxed mb-6">
            A sprint go kart chassis is a lightweight, open-wheel frame designed for sprint racing on
            short, bitumen circuits. It differs from oval or enduro kart chassis in its construction,
            handling characteristics, and intended use.
          </p>
          <div className="grid sm:grid-cols-2 gap-4 mb-6">
            {[
              { label: "Tubular Frame", detail: "Made of steel tubing, typically 28mm–32mm in diameter, with no suspension — flex in the chassis itself aids handling." },
              { label: "Wheelbase", detail: "Generally around 1040mm–1060mm for adult karts and shorter for junior karts." },
              { label: "Adjustability", detail: "Many chassis allow for adjustments in camber, caster, ride height, and seat position to optimise handling." },
              { label: "Braking System", detail: "Hydraulic disc brakes, usually only on the rear axle, though some high-end models have front brakes for advanced classes." },
              { label: "Steering", detail: "Direct steering with a simple tie rod and spindle setup." },
              { label: "Axle", detail: "Hollow metal axle (typically 30mm–50mm in diameter) with various levels of stiffness to affect handling." },
              { label: "Tyres & Wheels", detail: "Slick or wet tyres depending on weather conditions, mounted on lightweight aluminium or magnesium wheels." },
            ].map((spec) => (
              <div key={spec.label} className="p-4 bg-white/5 border-l-[3px] border-l-racing-red">
                <h4 className="font-heading text-xs uppercase tracking-[0.15em] text-white mb-1">{spec.label}</h4>
                <p className="text-sm text-white/60 leading-relaxed">{spec.detail}</p>
              </div>
            ))}
          </div>
          <p className="text-white/70 leading-relaxed">
            In most cases these will have a 2-stroke engine from Yamaha or more powerful versions like
            a Leopard or a Rotax. The choice of chassis and engine depends on the age of the driver,
            their weight, and what they intend to do with the go kart in terms of racing category.
          </p>
        </div>

        {/* Endurance chassis */}
        <div className="mb-12">
          <h3 className="font-heading text-lg uppercase tracking-[0.1em] text-white mb-4">
            What is an Endurance Go Kart Chassis?
          </h3>
          <p className="text-white/70 leading-relaxed mb-4">
            An endurance go kart chassis in many instances is the same as a sprint chassis but most
            likely will have a 4-stroke engine fitted to it. It will use similar plastics, seat,
            steering wheel, rims and tyres but have the less powerful but more reliable 4-stroke motor fitted.
          </p>
          <p className="text-white/70 leading-relaxed">
            For some categories a twin engine endurance go kart chassis will be used where there is an
            engine on the left and right of the rear of the kart, typically a Honda GX200 or Briggs
            &amp; Stratton L206 or Animal engine. This type of go kart is used for endurance racing
            with races of 2, 3, 6 or 24 hours in length.
          </p>
        </div>

        {/* DSR Predator */}
        <div className="relative overflow-hidden bg-racing-black">
          <video
            src="/images/history/chasis.mp4"
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover opacity-25"
          />
          <div className="relative z-10 p-8 md:p-10">
            <h3 className="font-heading text-lg uppercase tracking-[0.1em] text-white mb-4">
              Can You Buy an Australian Designed Endurance Go Kart Chassis?
            </h3>
            <p className="text-text-secondary leading-relaxed mb-6">
              The Predator Chassis is an Australian design that is manufactured in Sydney to be used for
              twin engine endurance go karting events. Designed by experienced race car driver Dion, it
              is a chassis used by many teams that has won numerous titles and races.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/contact" className="btn-primary px-8">Enquire About the Predator</Link>
              <Link href="/predator-chassis" className="btn-secondary px-8">Looking to Buy Second-Hand?</Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h2 className="font-heading text-2xl uppercase tracking-[0.1em] text-white mb-4">
          Need Parts?
        </h2>
        <p className="text-white/60 mb-6">
          Browse our full range of go kart parts, accessories, and racewear.
        </p>
        <Link href="/shop" className="btn-primary px-8">Shop Now</Link>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "WebPage",
                name: "DS Racing Karts Services",
                url: `${siteUrl}/services`,
              },
              ...services.map((service) => ({
                "@type": "Service",
                serviceType: service.title,
                provider: {
                  "@type": "Organization",
                  name: "DS Racing Karts",
                  url: siteUrl,
                },
                areaServed: "AU",
                description: service.description,
              })),
            ],
          }),
        }}
      />
    </>
  );
}
