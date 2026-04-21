import type { Metadata } from "next";
import { Inter, Oswald, Orbitron } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { CartProvider } from "@/hooks/useCart";
import { SmoothScroll } from "@/components/layout/SmoothScroll";
import { Analytics } from "@/components/layout/Analytics";
import { ActiveAnnouncement } from "@/components/layout/ActiveAnnouncement";

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
    default: "DS Racing Karts — Go Kart Parts & Service | Sydney",
    template: "%s | DS Racing Karts",
  },
  description:
    "Australia's trusted go kart parts supplier. Engines, chassis, brakes, racewear and more. Based in Sydney, shipping nationwide.",
  keywords: [
    "go kart parts",
    "kart racing",
    "Sydney",
    "karting",
    "engines",
    "chassis",
    "racing karts Australia",
    "karting solutions",
    "karting direct",
    "endurance racing club",
    "ERC",
    "sportsman enduro karting",
    "SEK",
    "the endurance karting association",
    "TEKA",
    "kart 88",
    "nutek",
    "the kartshed",
    "kartworks",
    "velocity kart shop",
    "st george kart centre",
    "CRG",
    "tillotson",
    "torini",
    "honda",
    "go kart parts Sydney",
    "endurance karting Australia",
    "kart servicing Sydney",
    "kart chassis",
    "kart engine tuning",
    "4 stroke endurance kart",
    "briggs and stratton kart",
    "honda gx200 kart",
    "DSR Predator",
    "go kart shop",
    "kart spare parts",
  ],
  openGraph: {
    type: "website",
    locale: "en_AU",
    url: process.env.NEXT_PUBLIC_SITE_URL || "https://dsracingkarts.com.au",
    siteName: "DS Racing Karts",
    title: "DS Racing Karts — Go Kart Parts & Service | Sydney",
    description: "Australia's trusted go kart parts supplier. Engines, chassis, brakes, racewear and more.",
  },
  twitter: {
    card: "summary_large_image",
    title: "DS Racing Karts — Go Kart Parts & Service | Sydney",
    description: "Australia's trusted go kart parts supplier. Engines, chassis, brakes, racewear and more.",
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://dsracingkarts.com.au"),
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
            <Header announcementSlot={<ActiveAnnouncement />} />
            <main className="min-h-screen">{children}</main>
            <Footer />
          </CartProvider>
        </SmoothScroll>
        <Analytics />
      </body>
    </html>
  );
}
