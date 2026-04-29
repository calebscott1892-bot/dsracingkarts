import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Custom Racewear Gallery",
  description: "Explore the full DS Racing Karts custom racewear gallery.",
  alternates: {
    canonical: "/services/racewear-gallery",
  },
};

const FALLBACK_GALLERY = [
  { id: "1", group_label: "Wilson / Enhanced HVAC", image_url: "/images/history/Racewear1.jpeg", alt_text: "Wilson Enhanced HVAC race suit design render" },
  { id: "2", group_label: "NCR / No Chance Racing", image_url: "/images/history/racewear2.webp", alt_text: "NCR No Chance Racing race suit design render" },
  { id: "3", group_label: "NCR / No Chance Racing", image_url: "/images/history/racewear6.webp", alt_text: "NCR No Chance Racing finished suit on driver" },
  { id: "4", group_label: "Stratco", image_url: "/images/history/racewear3.webp", alt_text: "Stratco race suit design render" },
  { id: "5", group_label: "DSR Racing Suit", image_url: "/images/history/racewear4.webp", alt_text: "DSR race suit design render front and back" },
  { id: "6", group_label: "DSR Racing Suit", image_url: "/images/history/racewear4irl.jpg", alt_text: "DSR race suit finished on driver" },
  { id: "7", group_label: "RK Racing Studio / HR42", image_url: "/images/history/racewear9.webp", alt_text: "HR42 RK Racing Studio finished race suit" },
  { id: "8", group_label: "RK Racing Studio / HR42", image_url: "/images/history/racewear7.webp", alt_text: "HR42 custom race boots" },
  { id: "9", group_label: "RK Racing Studio / HR42", image_url: "/images/history/racewear7gloves.webp", alt_text: "HR42 custom racing gloves" },
  { id: "10", group_label: "STC Motorsport", image_url: "/images/history/racewear5.jpg", alt_text: "STC Motorsport custom race suit" },
  { id: "11", group_label: "BARBEN Architectural Hardware", image_url: "/images/history/racewear8.jpg", alt_text: "BARBEN team race suits" },
  { id: "12", group_label: "DSR Branded Apparel", image_url: "/images/history/racewearDRS.webp", alt_text: "DSR custom hoodie front" },
  { id: "13", group_label: "DSR Branded Apparel", image_url: "/images/history/RacewearDRSback.webp", alt_text: "DSR racing jersey at track" },
];

export default async function RacewearGalleryPage() {
  const supabase = await createClient();
  const { data: dbGallery } = await supabase
    .from("racewear_gallery")
    .select("id, group_label, image_url, alt_text")
    .eq("is_active", true)
    .order("sort_order")
    .order("created_at");

  const galleryEntries = dbGallery && dbGallery.length > 0 ? dbGallery : FALLBACK_GALLERY;

  return (
    <div className="max-w-6xl mx-auto px-4 py-12 md:py-16">
      <div className="flex items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-3">
            <span className="h-[1px] w-8 bg-racing-red" />
            <span className="font-heading text-xs tracking-[0.3em] text-racing-red uppercase">Custom Racewear</span>
          </div>
          <h1 className="font-heading text-3xl md:text-4xl uppercase tracking-[0.1em] text-white">
            Full <span className="text-racing-red">Gallery</span>
          </h1>
        </div>
        <Link href="/services" className="btn-secondary text-sm px-5">Back to Services</Link>
      </div>

      <p className="text-white/60 text-sm mb-8 max-w-2xl">
        This page is ready for expanded racewear uploads. As new photos are added in admin, they will automatically appear here.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
        {galleryEntries.map((entry) => (
          <div key={entry.id} className="group relative aspect-[3/4] overflow-hidden border border-white/10 bg-racing-dark">
            <Image
              src={entry.image_url}
              alt={entry.alt_text || entry.group_label || "Custom racewear"}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-3">
              <p className="text-[10px] md:text-xs text-white/90 uppercase tracking-[0.15em] font-heading line-clamp-2">
                {entry.group_label}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10 text-center">
        <Link href="/contact" className="btn-primary text-sm px-6 py-3">
          Enquire About Custom Racewear
        </Link>
      </div>
    </div>
  );
}
