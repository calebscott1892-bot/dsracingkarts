import { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Brands We Service & Supply",
  description:
    "DS Racing Karts services every major kart chassis and engine brand on the Australian grid — Rotax, IAME, Vortex, OTK, Kart Republic, Maverick and more — and supplies the oils, chains, tyres and consumables to keep them running.",
  alternates: {
    canonical: "/brands",
  },
};

// One source of truth for the logo wall. `logo` points at a file in
// /public/images/brands; when it's undefined the tile falls back to a clean
// name plate, so the grid always looks intentional while logos are sourced.
// `featured` gives a brand the red-ringed "front and centre" treatment.
interface Brand {
  name: string;
  logo?: string;
  featured?: boolean;
  dark?: boolean;
  // href links the tile to a brand landing page (SEO) or external URL.
  href?: string;
}

// Chassis, engines, components, brakes, seats and electronics we fit, tune and
// service. Maverick leads — we service his karts even though we'd never stock
// one. (Categorisation is a first pass; easy to shuffle in this array.)
const serviceBrands: Brand[] = [
  { name: "Maverick Kart", logo: "/images/brands/maverick.jpg", featured: true },
  { name: "DS Racing Karts", logo: "/images/brands/dsr.png" },
  // Chassis — the karts we set up, tune and service
  { name: "OTK Kart Group", logo: "/images/brands/otk.png", href: "/brands/otk" },
  { name: "Tony Kart" },
  { name: "Kosmic" },
  { name: "Redspeed" },
  { name: "Kart Republic", logo: "/images/brands/kart-republic.png", href: "/brands/kart-republic" },
  { name: "CRG Kart", logo: "/images/brands/crg.png", href: "/brands/crg" },
  { name: "Arrow", logo: "/images/brands/arrow.png", href: "/brands/arrow" },
  { name: "Birel ART" },
  { name: "Praga" },
  { name: "Parolin" },
  { name: "Energy Corse" },
  { name: "FA Kart" },
  { name: "DAP" },
  { name: "MS Kart" },
  { name: "Phoenix Karts" },
  { name: "Omega Karts", logo: "/images/brands/omega-karts.png" },
  // Engines
  { name: "Rotax", logo: "/images/brands/rotax.svg", href: "/brands/rotax" },
  { name: "IAME", logo: "/images/brands/iame.png", href: "/brands/iame" },
  { name: "Vortex", logo: "/images/brands/vortex.png", href: "/brands/vortex" },
  { name: "Honda", logo: "/images/brands/honda.svg" },
  { name: "Briggs & Stratton", logo: "/images/brands/briggs.png" },
  { name: "Torini", logo: "/images/brands/torini.png" },
  { name: "Tillotson" },
  { name: "Walbro", logo: "/images/brands/walbro.png" },
  { name: "K1R Racing Products", logo: "/images/brands/k1r.png" },
];

// Everything we supply — oils, lubricants, plugs, chains and tyres, plus the
// components, seats, brakes and data gear we stock from our suppliers.
const supplyBrands: Brand[] = [
  { name: "Castrol", logo: "/images/brands/castrol.svg" },
  { name: "Motul", logo: "/images/brands/motul.svg" },
  { name: "Penrite", logo: "/images/brands/penrite.png", dark: true },
  { name: "Valvoline", logo: "/images/brands/valvoline.svg" },
  { name: "ELF", logo: "/images/brands/elf.svg" },
  { name: "Maxima", logo: "/images/brands/maxima.png" },
  { name: "Vrooam Lubricants", logo: "/images/brands/vrooam.png" },
  { name: "Xeramic", logo: "/images/brands/xeramic.png" },
  { name: "NGK", logo: "/images/brands/ngk.svg" },
  { name: "Denso", logo: "/images/brands/denso.svg" },
  { name: "Champion", logo: "/images/brands/champion.png" },
  { name: "D.I.D", logo: "/images/brands/did.png" },
  { name: "CZ Chains", logo: "/images/brands/cz-chains.png" },
  { name: "RK Racing Chain", logo: "/images/brands/rk.png" },
  { name: "Dunlop", logo: "/images/brands/dunlop.svg" },
  { name: "Maxxis", logo: "/images/brands/maxxis.svg" },
  { name: "Jecko", logo: "/images/brands/jecko.png", dark: true },
  // Components, seats, brakes, steering and data — moved from the service wall
  { name: "KG Kart", logo: "/images/brands/kg.png" },
  { name: "Senzo", logo: "/images/brands/senzo.png" },
  { name: "Prodezine", logo: "/images/brands/prodezine.png" },
  { name: "DELTA", logo: "/images/brands/delta.png" },
  { name: "Italsport", logo: "/images/brands/italsport.png" },
  { name: "Kartech", logo: "/images/brands/kartech.png" },
  { name: "Righetti Ridolfi", logo: "/images/brands/righetti.png" },
  { name: "Talon Engineering", logo: "/images/brands/talon.png" },
  { name: "Noram", logo: "/images/brands/noram.jpg" },
  { name: "Dent Brakes", logo: "/images/brands/dent-brakes.png", dark: true },
  { name: "Tillett", logo: "/images/brands/tillett.png", dark: true },
  { name: "IMAF", logo: "/images/brands/imaf.png" },
  { name: "Sniper", logo: "/images/brands/sniper.png", dark: true },
  { name: "AiM (MyChron)", logo: "/images/brands/aim.png" },
  { name: "Alfano", logo: "/images/brands/alfano.png", dark: true },
  { name: "NR Racing", logo: "/images/brands/nr.png" },
];

function BrandTile({ brand }: { brand: Brand }) {
  const inner = (
    <div
      className={`group relative flex items-center justify-center rounded-md overflow-hidden aspect-[3/2] transition-opacity ${
        brand.href ? "hover:opacity-80" : ""
      } ${
        brand.featured
          ? "bg-black ring-2 ring-racing-red shadow-[0_0_24px_rgba(230,0,18,0.25)]"
          : brand.dark
            ? "bg-racing-black border border-white/10"
            : "bg-white"
      }`}
    >
      {brand.featured && (
        <span className="absolute top-0 left-0 z-10 bg-racing-red text-white font-heading text-[8px] tracking-[0.2em] uppercase px-2 py-0.5">
          We service these
        </span>
      )}
      {brand.logo ? (
        <Image
          src={brand.logo}
          alt={`${brand.name} logo`}
          width={180}
          height={120}
          className="object-contain w-full h-full p-4"
          sizes="(max-width: 768px) 40vw, 180px"
        />
      ) : (
        <span className="px-2 text-center font-heading text-[11px] md:text-sm uppercase tracking-[0.08em] text-racing-black leading-tight">
          {brand.name}
        </span>
      )}
    </div>
  );

  return brand.href ? <Link href={brand.href}>{inner}</Link> : inner;
}

function BrandGrid({ brands }: { brands: Brand[] }) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 md:gap-4">
      {brands.map((b) => (
        <BrandTile key={b.name} brand={b} />
      ))}
    </div>
  );
}

export default function BrandsPage() {
  return (
    <>
      {/* Hero — servicing-first */}
      <section className="relative bg-racing-black carbon-fiber py-16 md:py-24">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-3 mb-6">
            <span className="h-[1px] w-8 bg-racing-red" />
            <span className="font-heading text-xs tracking-[0.4em] text-racing-red uppercase">
              Whatever You Race
            </span>
            <span className="h-[1px] w-8 bg-racing-red" />
          </div>
          <h1 className="font-heading text-4xl md:text-6xl uppercase tracking-[0.08em] text-white mb-6">
            Brands We <span className="text-racing-red">Service</span>
          </h1>
          <p className="text-white/70 leading-relaxed text-base md:text-lg">
            We service and tune every major chassis and engine brand on the Australian grid — no
            matter what badge is on your kart. From the latest OTK and Kart Republic machines to
            Rotax, IAME and Vortex powerplants, if it laps a circuit, we look after it. We also
            supply the oils, chains, tyres and consumables to keep it on track.
          </p>
        </div>
      </section>

      <div className="chequered-stripe" />

      {/* Service brands */}
      <section className="bg-racing-black py-14 md:py-20">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-center gap-3 mb-3">
            <span className="h-[1px] w-8 bg-racing-red" />
            <h2 className="font-heading text-2xl md:text-3xl uppercase tracking-[0.1em] text-white text-center">
              Chassis &amp; Engines We <span className="text-racing-red">Service</span>
            </h2>
            <span className="h-[1px] w-8 bg-racing-red" />
          </div>
          <p className="text-white/50 text-sm text-center max-w-2xl mx-auto mb-10">
            Servicing, tuning, rebuilds and race-day prep across every brand of chassis and engine
            we see in the workshop.
          </p>
          <BrandGrid brands={serviceBrands} />
        </div>
      </section>

      <div className="w-16 h-[1px] bg-racing-red/30 mx-auto" />

      {/* Supply brands */}
      <section className="bg-racing-black py-14 md:py-20">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-center gap-3 mb-3">
            <span className="h-[1px] w-8 bg-racing-red" />
            <h2 className="font-heading text-2xl md:text-3xl uppercase tracking-[0.1em] text-white text-center">
              Products We <span className="text-racing-red">Supply</span>
            </h2>
            <span className="h-[1px] w-8 bg-racing-red" />
          </div>
          <p className="text-white/50 text-sm text-center max-w-2xl mx-auto mb-10">
            Oils, lubricants, spark plugs, chains, tyres, seats, brakes, steering and data — sourced
            from our suppliers and ready when you are.
          </p>
          <BrandGrid brands={supplyBrands} />
          <p className="text-white/40 text-sm text-center mt-8 italic">
            …and thousands more. Just ask.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-racing-black py-16 md:py-20">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <div className="w-12 h-[2px] bg-racing-red mx-auto mb-6" />
          <p className="text-white/60 leading-relaxed text-sm md:text-base mb-6">
            Don&apos;t see your brand? We service just about everything on the grid. Get in touch and
            we&apos;ll sort it.
          </p>
          <Link
            href="/contact"
            className="inline-block bg-racing-red text-white font-heading text-sm uppercase tracking-[0.15em] px-8 py-3 hover:bg-racing-red/90 transition-colors"
          >
            Book a Service
          </Link>
        </div>
      </section>
    </>
  );
}
