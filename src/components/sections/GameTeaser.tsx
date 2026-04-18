"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

const DSRGrandPrix = dynamic(
  () => import("@/components/game/DSRGrandPrix").then(mod => ({ default: mod.DSRGrandPrix })),
  { ssr: false }
);

const C4FooterCredit = dynamic(
  () => import("@/components/c4-footer-credit/C4FooterCredit"),
  { ssr: false }
);

export function GameTeaser() {
  const [active, setActive] = useState(false);

  if (active) {
    return (
      <section className="py-8 bg-racing-black">
        <DSRGrandPrix onExit={() => setActive(false)} />
      </section>
    );
  }

  return (
    <section className="relative py-16 md:py-24 overflow-hidden bg-racing-black">
      {/* Animated chequered background */}
      <div className="absolute inset-0 chequered-bg opacity-15" />
      <div className="absolute inset-0 bg-gradient-to-b from-racing-black via-transparent to-racing-black" />

      <div className="relative z-10 text-center px-4">
        <h2 className="font-digital text-2xl md:text-4xl text-racing-gold tracking-[0.15em] mb-3">
          DSR GRAND PRIX
        </h2>
        <p className="text-text-muted text-sm mb-8 max-w-md mx-auto">
          Think you can handle the speed? Race head-to-head in our slot-car mini-game.
        </p>

        <button
          onClick={() => setActive(true)}
          className="relative inline-block group"
        >
          <span className="block btn-primary text-lg px-12 py-4 animate-pulse-glow">
            PRESS START
          </span>
        </button>

        <p className="text-text-muted text-xs font-digital tracking-wider mt-6">
          <span className="hidden md:inline">Use W/S and &uarr;/&darr; to race. Can you handle the speed?</span>
          <span className="md:hidden">Use the on-screen GAS &amp; BRAKE buttons to race!</span>
        </p>

        <div className="mt-8 flex items-center justify-center gap-1.5 text-text-muted/40 text-[10px] tracking-widest uppercase">
          <span>Built by</span>
          <C4FooterCredit href="https://c4studios.com.au" size={22} showText={false} colorScheme="dark" />
        </div>
      </div>
    </section>
  );
}
