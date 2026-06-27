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
  // Some logos are white/light artwork that only reads on a dark tile.
  dark?: boolean;
}

// Chassis, engines, components, brakes, seats and electronics we fit, tune and
// service. Maverick leads — we service his karts even though we'd never stock
// one. (Categorisation is a first pass; easy to shuffle in this array.)
const serviceBrands: Brand[] = [
  { name: "Maverick Kart", logo: "/images/brands/maverick.jpg", featured: true },
  { name: "OTK Kart Group" },
  { name: "Kart Republic" },
  { name: "CRG Kart" },
  { name: "Arrow", logo: "/images/brands/arrow.png" },
  { name: "KG Kart", logo: "/images/brands/kg.png" },
  { name: "Senzo" },
  { name: "Prodezine" },
  { name: "DELTA" },
  { name: "Italsport" },
  { name: "Rotax", logo: "/images/brands/rotax.svg" },
  { name: "IAME" },
  { name: "Vortex" },
  { name: "Honda", logo: "/images/brands/honda.svg" },
  { name: "Honda Aftermarket" },
  { name: "Briggs & Stratton" },
  { name: "Torini", logo: "/images/brands/torini.png" },
  { name: "Tillotson" },
  { name: "Walbro" },
  { name: "Kartech", logo: "/images/brands/kartech.png" },
  { name: "Righetti Ridolfi" },
  { name: "Talon Engineering", logo: "/images/brands/talon.png" },
  { name: "Noram", logo: "/images/brands/noram.jpg" },
  { name: "Ferodo" },
  { name: "Dent Brakes" },
  { name: "Tillett" },
  { name: "IMAF" },
  { name: "Sniper" },
  { name: "GT GoKart Wheels" },
  { name: "K1R Racing Products" },
  { name: "NR Racing", logo: "/images/brands/nr.png" },
  { name: "Greyhound" },
  { name: "AiM (MyChron)" },
  { name: "Alfano" },
];

// Oils, lubricants, spark plugs, chains and tyres we supply from our suppliers.
const supplyBrands: Brand[] = [
  { name: "Castrol", logo: "/images/brands/castrol.svg" },
  { name: "Motul", logo: "/images/brands/motul.svg" },
  { name: "Penrite" },
  { name: "Valvoline", logo: "/images/brands/valvoline.svg" },
  { name: "ELF", logo: "/images/brands/elf.svg" },
  { name: "Maxima" },
  { name: "Vrooam Lubricants" },
  { name: "Xeramic" },
  { name: "NGK", logo: "/images/brands/ngk.svg" },
  { name: "Denso", logo: "/images/brands/denso.svg" },
  { name: "Champion" },
  { name: "D.I.D", logo: "/images/brands/did.png" },
  { name: "CZ Chains" },
  { name: "RK Racing Chain", logo: "/images/brands/rk.png" },
  { name: "Dunlop", logo: "/images/brands/dunlop.svg" },
  { name: "Maxxis", logo: "/images/brands/maxxis.svg" },
  { name: "Jecko", logo: "/images/brands/jecko.png", dark: true },
];

function BrandTile({ brand }: { brand: Brand }) {
  return (
    <div
      className={`group relative flex items-center justify-center rounded-md overflow-hidden aspect-[3/2] ${
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
            Oils, lubricants, spark plugs, chains and tyres — sourced from our suppliers and ready
            when you are.
          </p>
          <BrandGrid brands={supplyBrands} />
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
