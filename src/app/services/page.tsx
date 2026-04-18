import { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import ServiceExpandGrid from "@/components/sections/ServiceExpandGrid";

export const metadata: Metadata = {
  title: "Our Services | DS Racing Karts",
  description: "Go kart servicing, engine tuning, chassis setup, and race preparation. Sydney's trusted kart specialists.",
};

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
      "Our engine tuning service is designed to extract maximum performance while maintaining reliability. We work with all major engine platforms including Yamaha KT100, Rotax, IAME, Briggs & Stratton, Honda GX200, and Torini.",
      "From jetting adjustments and ignition timing through to full port work and blueprinting, we tailor every tune to your specific class rules and driving style.",
    ],
    includes: [
      "Carburettor jetting & tuning",
      "Ignition timing optimisation",
      "Compression & leak-down testing",
      "Dyno testing (where applicable)",
      "Performance benchmarking",
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

export default function ServicesPage() {
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
      <section className="max-w-6xl mx-auto px-4 py-12 md:py-16">
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

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {[
            { src: "/images/history/Racewear1.jpeg", alt: "Custom race suit design" },
            { src: "/images/history/racewear2.webp", alt: "Team racewear" },
            { src: "/images/history/racewear3.webp", alt: "Custom race gear" },
            { src: "/images/history/racewear4.webp", alt: "Race suit design" },
            { src: "/images/history/racewear4irl.jpg", alt: "Race suit in action" },
            { src: "/images/history/racewear5.jpg", alt: "Team race suit" },
            { src: "/images/history/racewear6.webp", alt: "Custom karting gear" },
            { src: "/images/history/racewear7.webp", alt: "Race suit front" },
            { src: "/images/history/racewear7gloves.webp", alt: "Custom racing gloves" },
            { src: "/images/history/racewear8.jpg", alt: "Team branded racewear" },
            { src: "/images/history/racewear9.webp", alt: "Custom race gear design" },
            { src: "/images/history/racewearDRS.webp", alt: "DSR branded race suit" },
          ].map(({ src, alt }) => (
            <div key={src} className="relative aspect-[3/4] bg-racing-dark border border-white/10 overflow-hidden group">
              <Image
                src={src}
                alt={alt}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-105"
                sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </div>
          ))}
        </div>

        <div className="text-center mt-6">
          <Link
            href="/contact"
            className="inline-block bg-racing-red text-white font-heading text-sm uppercase tracking-[0.15em] px-8 py-3 hover:bg-racing-red/90 transition-colors"
          >
            Enquire About Custom Racewear
          </Link>
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
    </>
  );
}
