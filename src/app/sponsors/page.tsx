import { Metadata } from "next";
import Image from "next/image";
import C4SponsorCard from "@/components/c4-footer-credit/C4SponsorCard";

export const metadata: Metadata = {
  title: "Our Sponsors & Partners",
  description:
    "The incredible brands and businesses that support DS Racing Karts. Proud partners in Australian karting.",
  alternates: {
    canonical: "/sponsors",
  },
};

interface SponsorLogo {
  src: string;
  alt: string;
  hoverSrc?: string;
}

const topRow: SponsorLogo[] = [
  { src: "/images/history/1.webp", alt: "Sponsor 1" },
  { src: "/images/history/2.webp", alt: "Sponsor 2" },
  { src: "/images/history/3.png", alt: "Sponsor 3" },
  { src: "/images/history/4.png", alt: "Sponsor 4" },
  { src: "/images/history/5.webp", alt: "Sponsor 5" },
  { src: "/images/history/6.jpg", alt: "Sponsor 6" },
  { src: "/images/history/7.png", alt: "Sponsor 7" },
  { src: "/images/history/8.png", alt: "Sponsor 8" },
  { src: "/images/history/9.png", alt: "Sponsor 9" },
  { src: "/images/history/10.webp", alt: "Sponsor 10" },
];

const bottomRow: SponsorLogo[] = [
  { src: "/images/history/12.png", alt: "Sponsor 12" },
  { src: "/images/history/13.jpg", alt: "Sponsor 13" },
  { src: "/images/history/14.png", alt: "Sponsor 14" },
  { src: "/images/history/15.jpg", alt: "Sponsor 15" },
  { src: "/images/history/16.png", alt: "Sponsor 16" },
  { src: "/images/history/17.webp", alt: "Sponsor 17" },
  { src: "/images/history/18.webp", alt: "Sponsor 18", hoverSrc: "/images/history/18.jpg" },
  { src: "/images/history/19.png", alt: "Sponsor 19" },
  { src: "c4", alt: "C4 Studios" },
];

function SponsorCard({ logo }: { logo: SponsorLogo }) {
  if (logo.hoverSrc) {
    return (
      <div className="group/logo flex-shrink-0 mx-2 md:mx-3 bg-white rounded-md overflow-hidden relative w-[140px] h-[80px] md:w-[180px] md:h-[100px]">
        <Image
          src={logo.src}
          alt={logo.alt}
          width={160}
          height={80}
          className="absolute inset-0 w-full h-full object-contain p-2 transition-opacity duration-700 ease-in-out group-hover/logo:opacity-0"
          sizes="180px"
        />
        <Image
          src={logo.hoverSrc}
          alt={logo.alt}
          width={160}
          height={80}
          className="absolute inset-0 w-full h-full object-contain p-2 opacity-0 transition-opacity duration-700 ease-in-out group-hover/logo:opacity-100"
          sizes="180px"
        />
      </div>
    );
  }

  return (
    <div className="flex-shrink-0 mx-1 md:mx-3 bg-white rounded-md overflow-hidden flex items-center justify-center w-[100px] h-[60px] md:w-[180px] md:h-[100px]">
      <Image
        src={logo.src}
        alt={logo.alt}
        width={160}
        height={80}
        className="object-contain p-2"
        sizes="180px"
      />
    </div>
  );
}

export default function SponsorsPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative bg-racing-black overflow-hidden py-24 md:py-32">
        {/* Subtle grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.3) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        <div className="relative z-10 max-w-3xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-3 mb-6">
            <span className="h-[1px] w-8 bg-racing-red" />
            <span className="font-heading text-xs tracking-[0.4em] text-racing-red uppercase">
              Our Partners
            </span>
            <span className="h-[1px] w-8 bg-racing-red" />
          </div>

          <h1 className="font-heading text-4xl md:text-6xl uppercase tracking-[0.1em] text-white mb-6">
            Sponsors &amp; <span className="text-racing-red">Supporters</span>
          </h1>

          <p className="text-white/70 leading-relaxed max-w-2xl mx-auto text-base md:text-lg">
            Racing is never a solo effort. Behind every lap, every podium, and every engine
            service stands a network of businesses who believe in what we do. We are proudly
            supported by some of the finest names in Australian motorsport and beyond — and
            we&apos;re honoured to call them partners.
          </p>
        </div>
      </section>

      <div className="chequered-stripe" />

      {/* Featured Club — SEK Australia */}
      <section className="bg-racing-black py-16 md:py-20">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex items-center justify-center gap-3 mb-10">
            <span className="h-[1px] w-8 bg-racing-red" />
            <h2 className="font-heading text-2xl md:text-3xl uppercase tracking-[0.1em] text-white text-center">
              Our <span className="text-racing-red">4-Stroke</span> Club
            </h2>
            <span className="h-[1px] w-8 bg-racing-red" />
          </div>

          <a
            href="https://www.sekaustralia.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="group block max-w-3xl mx-auto text-center"
          >
            {/* Logo — black slashes blend into page background */}
            <div className="relative mx-auto mb-6 max-w-[560px] md:max-w-[640px]">
              <Image
                src="/images/history/Sek Logo.jpg"
                alt="SEK Australia — Sportsman Enduro Karting"
                width={640}
                height={220}
                className="w-full h-auto"
                sizes="(max-width: 768px) 90vw, 640px"
                priority
              />
            </div>

            <p className="text-white/60 text-sm leading-relaxed mb-5 max-w-lg mx-auto">
              SEK is the endurance karting series we proudly support and race with — operating across NSW
              and QLD with sealed twin Honda 4-stroke engines. The ultimate balance of speed, reliability,
              and family-friendly competition.
            </p>
            <span className="inline-flex items-center gap-2 text-racing-red text-sm font-heading uppercase tracking-[0.15em] group-hover:gap-3 transition-all">
              Visit SEK Australia
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 17L17 7" /><path d="M7 7h10v10" />
              </svg>
            </span>
          </a>
        </div>
      </section>

      <div className="w-16 h-[1px] bg-racing-red/30 mx-auto" />

      {/* Scrolling Logo Carousel */}
      <section className="bg-racing-black py-16 md:py-24 overflow-hidden">
        <div className="max-w-5xl mx-auto px-4 mb-12 text-center">
          <h2 className="font-heading text-2xl md:text-3xl uppercase tracking-[0.1em] text-white mb-3">
            Proudly Supported <span className="text-racing-red">By</span>
          </h2>
          <p className="text-white/50 text-sm max-w-xl mx-auto">
            These incredible brands fuel our passion on and off the track.
          </p>
        </div>

        {/* Row 1 — scrolls left to right */}
        <div className="relative mb-6 overflow-hidden">
          {/* Fade edges */}
          <div className="pointer-events-none absolute inset-y-0 left-0 w-24 md:w-40 z-10 bg-gradient-to-r from-racing-black to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-24 md:w-40 z-10 bg-gradient-to-l from-racing-black to-transparent" />

          <div className="sponsor-track sponsor-track--ltr">
            {[...topRow, ...topRow, ...topRow].map((logo, i) => (
              <SponsorCard key={`r1-${i}`} logo={logo} />
            ))}
          </div>
        </div>

        {/* Row 2 — scrolls right to left */}
        <div className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-y-0 left-0 w-24 md:w-40 z-10 bg-gradient-to-r from-racing-black to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-24 md:w-40 z-10 bg-gradient-to-l from-racing-black to-transparent" />

          <div className="sponsor-track sponsor-track--rtl">
            {[...bottomRow, ...bottomRow, ...bottomRow].map((logo, i) => (
              logo.src === 'c4'
                ? <C4SponsorCard key={`r2-${i}`} />
                : <SponsorCard key={`r2-${i}`} logo={logo} />
            ))}
          </div>
        </div>
      </section>

      {/* Closing Statement */}
      <section className="bg-racing-black py-16 md:py-20">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <div className="w-12 h-[2px] bg-racing-red mx-auto mb-6" />
          <p className="text-white/60 leading-relaxed text-sm md:text-base">
            Interested in partnering with DS Racing Karts? We&apos;re always looking to
            build relationships with businesses that share our passion for motorsport.
          </p>
          <a
            href="/contact"
            className="inline-block mt-6 bg-racing-red text-white font-heading text-sm uppercase tracking-[0.15em] px-8 py-3 hover:bg-racing-red/90 transition-colors"
          >
            Get in Touch
          </a>
        </div>
      </section>
    </>
  );
}
