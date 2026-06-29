import type { Metadata } from "next";
import { Inter, Oswald, Orbitron } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { CartProvider } from "@/hooks/useCart";
import { SmoothScroll } from "@/components/layout/SmoothScroll";
import { Analytics } from "@/components/layout/Analytics";
import { ActiveAnnouncement } from "@/components/layout/ActiveAnnouncement";
import { BackButton } from "@/components/layout/BackButton";
import { PublicChrome } from "@/components/layout/PublicChrome";
import { SITE_URL } from "@/lib/site-url";

const heading = Oswald({
  subsets: ["latin"],
  weight: ["700"],
  variable: "--font-heading",
  display: "swap",
});

const body = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const digital = Orbitron({
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  variable: "--font-digital",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "DS Racing Karts | Kart Shop Sydney — Parts, Racewear & Servicing | Australia-Wide",
    template: "%s | DS Racing Karts",
  },
  description:
    "DS Racing Karts — Sydney's go kart specialists. 8,000+ kart parts, custom racewear, engine rebuilds and full servicing. OTK, IAME, Rotax, CRG and more. Shipping Australia-wide.",
  keywords: [
    // Tier 1 — money keywords
    "DS Racing Karts",
    "kart shop Sydney",
    "kart shop Australia",
    "go kart parts Australia",
    "kart parts Australia",
    "kart racing parts",
    "karting parts online",
    "kart workshop Sydney",
    "kart servicing Sydney",
    "kart repairs Sydney",
    // Tier 2 — products
    "kart tyres",
    "kart wheels",
    "kart chains",
    "kart sprockets",
    "kart brakes",
    "kart axles",
    "kart bearings",
    "kart seats",
    "kart steering wheels",
    "kart accessories",
    "kart helmets",
    "kart racewear",
    "custom kart suits",
    "kart gloves",
    "kart boots",
    // Tier 3 — brands
    "OTK parts",
    "CRG parts",
    "Arrow kart parts",
    "Rotax parts",
    "KA100 parts",
    "Vortex kart parts",
    "IAME parts",
    "Tillotson parts",
    "Revolution Racegear",
    "DPE kart parts",
    "IKD",
    // Tier 4 — services
    "kart setup",
    "kart tuning",
    "kart engine rebuild",
    "kart engine servicing",
    "kart preparation",
    "race kart setup",
    "kart chassis setup",
    // Tier 5 — local SEO
    "kart shop Campbelltown",
    "kart workshop Campbelltown",
    "kart parts NSW",
    "go kart shop Sydney",
    "go kart parts Sydney",
    "second hand karts Sydney",
    "used karts for sale Sydney",
    // Competitor terms (branded search capture)
    "karting solutions",
    "karting direct",
    "velocity kart shop",
    "st george kart centre",
    // Community / events
    "endurance racing club",
    "ERC",
    "endurance karting",
    "sportsman enduro karting",
    "SEK",
    "endurance karting Australia",
    // Legacy / specific
    "karting",
    "go kart parts",
    "kart spare parts",
    "go kart shop",
    "kart chassis",
    "racing karts Australia",
    "rotax max",
    "briggs and stratton kart",
    "honda gx200 kart",
    "4 stroke endurance kart",
  ],
  openGraph: {
    type: "website",
    locale: "en_AU",
    url: SITE_URL,
    siteName: "DS Racing Karts",
    title: "DS Racing Karts - Go Kart Chassis, Parts & Service | Sydney",
    description: "Sydney's karting solutions specialist — chassis, engines, brakes, racewear and more, shipped Australia-wide.",
  },
  twitter: {
    card: "summary_large_image",
    title: "DS Racing Karts - Go Kart Chassis, Parts & Service | Sydney",
    description: "Sydney's karting solutions specialist — chassis, engines, brakes, racewear and more, shipped Australia-wide.",
  },
  metadataBase: new URL(SITE_URL),
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${heading.variable} ${body.variable} ${digital.variable}`}>
      <body className="bg-racing-black text-text-primary font-body antialiased">
        <SmoothScroll>
          <CartProvider>
            <PublicChrome>
              <Header announcementSlot={<ActiveAnnouncement />} />
            </PublicChrome>
            <main className="min-h-screen">
              <BackButton />
              {children}
            </main>
            <PublicChrome>
              <Footer />
            </PublicChrome>
          </CartProvider>
        </SmoothScroll>
        <Analytics />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": ["LocalBusiness", "AutoPartsStore", "SportsGoodsStore"],
                  "@id": `${SITE_URL}/#business`,
                  name: "DS Racing Karts",
                  alternateName: ["DSR", "DS Racing Karts Sydney"],
                  description:
                    "Sydney's go kart specialists — 8,000+ kart parts, custom racewear, engine rebuilds and full chassis servicing. OTK, IAME, Rotax, CRG and more. Shipping Australia-wide.",
                  url: SITE_URL,
                  telephone: "+61492454854",
                  email: "dsracing@bigpond.com",
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
                    { "@type": "City", name: "Sydney" },
                    { "@type": "State", name: "New South Wales" },
                  ],
                  openingHoursSpecification: {
                    "@type": "OpeningHoursSpecification",
                    description: "By appointment only — contact us to arrange a visit.",
                  },
                  sameAs: ["https://www.facebook.com/dsracingkarts"],
                  hasOfferCatalog: {
                    "@type": "OfferCatalog",
                    name: "Kart Parts, Racewear & Services",
                    itemListElement: [
                      { "@type": "Offer", itemOffered: { "@type": "Product", name: "Kart Parts & Accessories" } },
                      { "@type": "Offer", itemOffered: { "@type": "Product", name: "Custom Kart Racewear & Suits" } },
                      { "@type": "Offer", itemOffered: { "@type": "Service", name: "Kart Servicing & Engine Rebuilds" } },
                      { "@type": "Offer", itemOffered: { "@type": "Service", name: "Chassis Setup & Tuning" } },
                    ],
                  },
                },
                {
                  "@type": "WebSite",
                  "@id": `${SITE_URL}/#website`,
                  url: SITE_URL,
                  name: "DS Racing Karts",
                  description: "Sydney's go kart specialists — parts, racewear, servicing and race prep.",
                  publisher: { "@id": `${SITE_URL}/#business` },
                  potentialAction: {
                    "@type": "SearchAction",
                    target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/shop?search={search_term_string}` },
                    "query-input": "required name=search_term_string",
                  },
                },
              ],
            }),
          }}
        />
      </body>
    </html>
  );
}



