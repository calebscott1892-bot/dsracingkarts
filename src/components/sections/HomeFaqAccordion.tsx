"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

interface FaqItem {
  question: string;
  answer: string;
}

export function HomeFaqAccordion({ items }: { items: FaqItem[] }) {
  return (
    <div className="grid gap-3">
      {items.map((item, index) => (
        <FaqRow key={item.question} item={item} defaultOpen={index === 0} />
      ))}
    </div>
  );
}

function FaqRow({ item, defaultOpen = false }: { item: FaqItem; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (contentRef.current) setHeight(contentRef.current.scrollHeight);
  }, [open, item.answer]);

  return (
    <div
      className={`overflow-hidden border transition-all duration-300 ${
        open
          ? "border-racing-red/30 bg-surface-700/60 shadow-[0_12px_40px_rgba(230,0,18,0.08)]"
          : "border-surface-600/40 bg-surface-700/30 hover:border-racing-red/20 hover:bg-surface-700/45"
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-4 px-4 py-4 text-left"
        aria-expanded={open}
      >
        <div className="flex-1 min-w-0">
          <p className="font-heading text-sm uppercase tracking-[0.08em] text-white">
            {item.question}
          </p>
        </div>
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center border transition-all duration-300 ${
            open ? "border-racing-red/40 bg-racing-red text-white" : "border-surface-500/40 text-text-muted"
          }`}
        >
          <ChevronDown size={16} className={`transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
        </div>
      </button>

      <div
        className="transition-all duration-300 ease-out"
        style={{ maxHeight: open ? `${height}px` : "0px", opacity: open ? 1 : 0 }}
      >
        <div ref={contentRef} className="px-4 pb-4">
          <div className="mb-4 h-px bg-gradient-to-r from-racing-red/45 via-racing-red/10 to-transparent" />
          <p className="max-w-3xl text-sm leading-relaxed text-text-secondary">{item.answer}</p>
        </div>
      </div>
    </div>
  );
}
