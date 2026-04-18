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
  const sorted = [...images].sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0));
  const [activeIndex, setActiveIndex] = useState(0);

  if (sorted.length === 0) {
    return (
      <div className="aspect-square bg-surface-700 carbon-bg flex items-center justify-center">
        <span className="text-text-muted text-sm font-heading uppercase tracking-wider opacity-40">
          No images available
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
