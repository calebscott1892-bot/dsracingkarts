"use client";

import { useState } from "react";
import Image from "next/image";

interface ImageData {
  id: string;
  url: string;
  alt_text: string | null;
  is_primary: boolean;
}

interface Props {
  images: ImageData[];
  productName: string;
}

export function ProductImageGallery({ images, productName }: Props) {
  const sorted = [...images]
    .filter((image) => image.url && !image.url.endsWith("/images/image-coming-soon.svg"))
    .sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0));
  const [activeIndex, setActiveIndex] = useState(0);

  if (sorted.length === 0) {
    return (
      <div
        className="aspect-square bg-[#141414] carbon-bg relative flex flex-col items-center justify-center px-6 text-center border border-surface-600/50"
        style={{
          backgroundImage:
            "linear-gradient(135deg, rgba(230,0,18,0.06), transparent 55%), radial-gradient(circle at 50% 22%, rgba(230,0,18,0.18), transparent 60%)",
        }}
      >
        <span className="absolute top-3 left-3 right-3 h-[1px] bg-gradient-to-r from-transparent via-racing-red/50 to-transparent" />
        <span className="absolute bottom-3 left-3 right-3 h-[1px] bg-gradient-to-r from-transparent via-racing-red/50 to-transparent" />
        <span className="font-heading text-[10px] tracking-[0.4em] text-racing-red/80 uppercase mb-3">
          DS Racing Karts
        </span>
        <span className="font-heading text-base md:text-lg uppercase tracking-[0.08em] text-white/90 leading-snug max-w-xs">
          {productName}
        </span>
        <span className="font-heading text-[10px] tracking-[0.3em] text-text-muted/70 uppercase mt-4">
          Image coming soon
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Main image */}
      <div className="aspect-square bg-surface-800 border border-surface-600/50 relative overflow-hidden group">
        <Image
          src={sorted[activeIndex].url}
          alt={sorted[activeIndex].alt_text || productName}
          fill
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="object-contain group-hover:scale-105 transition-transform duration-500"
          priority
        />
        {/* Corner accents */}
        <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-brand-red/40 pointer-events-none" />
        <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-brand-red/40 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-brand-red/40 pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-brand-red/40 pointer-events-none" />
      </div>

      {/* Thumbnail row */}
      {sorted.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {sorted.map((img, i) => (
            <button
              key={img.id}
              onClick={() => setActiveIndex(i)}
              aria-label={`View image ${i + 1} of ${sorted.length}`}
              aria-current={i === activeIndex ? "true" : undefined}
              className={`w-16 h-16 shrink-0 overflow-hidden transition-all ${
                i === activeIndex
                  ? "border-2 border-brand-red opacity-100"
                  : "border border-surface-600/50 opacity-50 hover:opacity-80"
              }`}
            >
              <Image
                src={img.url}
                alt={img.alt_text || `${productName} thumbnail ${i + 1}`}
                width={64}
                height={64}
                className="object-cover w-full h-full"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
