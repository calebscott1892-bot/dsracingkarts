"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

// Detailed top-down kart SVG
function DetailedKart({ color, id, number }: { color: string; id: string; number: string }) {
  const isDark = color === "#2060ff";
  const highlight = isDark ? "#4080ff" : "#ff3333";
  const helmetColor = isDark ? "#3366cc" : "#cc2200";

  return (
    <g id={id}>
      {/* Shadow */}
      <ellipse cx="2" cy="2" rx="22" ry="13" fill="rgba(0,0,0,0.3)" />

      {/* Rear wing */}
      <rect x="-26" y="-15" width="6" height="30" rx="1" fill={color} opacity="0.65" />
      <rect x="-26" y="-16" width="6" height="2" fill="#222" />
      <rect x="-26" y="14" width="6" height="2" fill="#222" />

      {/* Wheels with tread */}
      <rect x="10" y="-17" width="10" height="5" rx="1" fill="#1a1a1a" />
      <rect x="11" y="-16" width="8" height="3" fill="#333" />
      <rect x="10" y="12" width="10" height="5" rx="1" fill="#1a1a1a" />
      <rect x="11" y="13" width="8" height="3" fill="#333" />
      <rect x="-20" y="-17" width="10" height="5" rx="1" fill="#1a1a1a" />
      <rect x="-19" y="-16" width="8" height="3" fill="#333" />
      <rect x="-20" y="12" width="10" height="5" rx="1" fill="#1a1a1a" />
      <rect x="-19" y="13" width="8" height="3" fill="#333" />

      {/* Main body */}
      <path d="M-18,-11 L16,-8 L20,-4 L20,4 L16,8 L-18,11 Z" fill={color} />

      {/* Body highlight stripe */}
      <rect x="-14" y="-3" width="28" height="6" fill={highlight} opacity="0.3" />

      {/* Cockpit */}
      <ellipse cx="0" cy="0" rx="8" ry="7" fill="#0a0a0a" />

      {/* Helmet */}
      <circle cx="1" cy="0" r="5" fill={helmetColor} />
      {/* Visor */}
      <path d="M3,-2 A3,3 0 0,1 3,2 L1,1 L1,-1 Z" fill="#1a1a1a" />
      {/* Helmet shine */}
      <path d="M-2,-3 A4,4 0 0,1 3,-3" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1" />

      {/* Front nose */}
      <path d="M16,-6 L24,-2 L24,2 L16,6 Z" fill={color} />

      {/* Front wing */}
      <rect x="18" y="-14" width="7" height="28" rx="1" fill={color} opacity="0.75" />

      {/* Number circle */}
      <circle cx="-8" cy="0" r="5" fill="#fff" />
      <text x="-8" y="1" textAnchor="middle" fontSize="7" fontFamily="var(--font-digital)" fill="#0a0a0a" fontWeight="bold" dominantBaseline="middle">
        {number}
      </text>

      {/* Exhaust glow */}
      <circle cx="-22" cy="-4" r="2" fill="#ff6600" opacity="0.3">
        <animate attributeName="opacity" values="0.1;0.4;0.1" dur="0.3s" repeatCount="indefinite" />
      </circle>
      <circle cx="-22" cy="4" r="2" fill="#ff6600" opacity="0.3">
        <animate attributeName="opacity" values="0.1;0.4;0.1" dur="0.3s" begin="0.15s" repeatCount="indefinite" />
      </circle>
    </g>
  );
}

export function RaceAnimation() {
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: "bottom bottom",
          scrub: 0.8,
          pin: ".race-viewport",
          anticipatePin: 1,
          pinSpacing: true,
        },
      });

      // Both karts race across — starts slow, picks up speed
      tl.fromTo("#kart1",
        { x: 60, y: 225 },
        { x: 1100, y: 225, duration: 1, ease: "power1.in" },
        0
      );
      tl.fromTo("#kart2",
        { x: 60, y: 285 },
        { x: 1060, y: 285, duration: 1, ease: "power1.in" },
        0
      );

      // At 75%, kart 1 surges ahead
      tl.to("#kart1", { x: 1280, duration: 0.25, ease: "power2.in" }, 0.75);
      tl.to("#kart2", { x: 1180, duration: 0.25, ease: "power1.in" }, 0.75);

      // Drift at 90% — kart 1 sweeps diagonally across kart 2's line
      tl.to("#kart1", {
        y: 260,
        rotation: -15,
        duration: 0.06,
        ease: "power3.out",
      }, 0.90);
      // Correct back
      tl.to("#kart1", {
        y: 240,
        rotation: -5,
        duration: 0.04,
        ease: "power2.in",
      }, 0.96);

      // Speed lines get more intense as race progresses
      tl.fromTo(".speed-lines", { opacity: 0.05 }, { opacity: 0.5, duration: 1, ease: "none" }, 0);

      // Finish line flash
      tl.to(".finish-flash", { opacity: 1, duration: 0.01 }, 0.98);
      tl.to(".finish-flash", { opacity: 0, duration: 0.02 }, 0.99);

      // Title fades in
      tl.fromTo(".race-title",
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 0.15, ease: "power2.out" },
        0.05
      );

    }, section);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={sectionRef} className="h-[300vh] relative">
      <div className="race-viewport h-screen flex flex-col items-center justify-center overflow-hidden bg-racing-black">
        {/* Title */}
        <h2 className="race-title font-heading text-3xl md:text-5xl uppercase tracking-[0.15em] text-white mb-8 text-center z-10 opacity-0">
          Racing is in our <span className="text-racing-red">DNA</span>
        </h2>

        {/* Track SVG */}
        <div className="w-full max-w-5xl px-4 relative">
          <svg
            viewBox="0 0 1400 500"
            className="w-full h-auto"
          >
            {/* Grass background */}
            <rect x="0" y="0" width="1400" height="500" fill="#1a5c1a" />
            {/* Grass stripes */}
            {Array.from({ length: 25 }).map((_, i) => (
              <rect key={`grass${i}`} x="0" y={i * 20} width="1400" height="10" fill="#145214" opacity="0.5" />
            ))}

            {/* Sand/gravel runoff */}
            <rect x="30" y="165" width="1340" height="180" rx="6" fill="#c4a862" opacity="0.7" />

            {/* Speed lines background */}
            <g className="speed-lines" opacity="0.05">
              {Array.from({ length: 15 }).map((_, i) => (
                <line
                  key={i}
                  x1="0" y1={180 + i * 10}
                  x2="1400" y2={180 + i * 10}
                  stroke="#ffffff"
                  strokeWidth="1"
                  strokeDasharray="80 30"
                  opacity={0.3 + Math.random() * 0.4}
                />
              ))}
            </g>

            {/* Track kerbs — top */}
            {Array.from({ length: 46 }).map((_, i) => (
              <rect
                key={`kt${i}`}
                x={40 + i * 29}
                y="173"
                width="14"
                height="7"
                fill={i % 2 === 0 ? "#e60012" : "#ffffff"}
              />
            ))}

            {/* Track surface */}
            <rect x="40" y="180" width="1320" height="150" fill="#333" rx="3" />

            {/* Asphalt texture */}
            <rect x="40" y="230" width="1320" height="50" fill="#2a2a2a" opacity="0.4" />

            {/* Track kerbs — bottom */}
            {Array.from({ length: 46 }).map((_, i) => (
              <rect
                key={`kb${i}`}
                x={40 + i * 29}
                y="330"
                width="14"
                height="7"
                fill={i % 2 === 0 ? "#e60012" : "#ffffff"}
              />
            ))}

            {/* Centre dashed line */}
            <line
              x1="40" y1="255" x2="1360" y2="255"
              stroke="#ffffff"
              strokeWidth="2"
              strokeDasharray="18 14"
              opacity="0.2"
            />

            {/* Start line (chequered) */}
            <g>
              {Array.from({ length: 10 }).map((_, row) =>
                Array.from({ length: 2 }).map((_, col) => (
                  <rect
                    key={`sl${row}${col}`}
                    x={55 + col * 10}
                    y={182 + row * 15}
                    width="10"
                    height="15"
                    fill={(row + col) % 2 === 0 ? "#ffffff" : "#1a1a1a"}
                    opacity="0.4"
                  />
                ))
              )}
            </g>

            {/* Finish line (chequered, bigger) */}
            <g>
              {Array.from({ length: 10 }).map((_, row) =>
                Array.from({ length: 3 }).map((_, col) => (
                  <rect
                    key={`fl${row}${col}`}
                    x={1280 + col * 12}
                    y={182 + row * 15}
                    width="12"
                    height="15"
                    fill={(row + col) % 2 === 0 ? "#ffffff" : "#1a1a1a"}
                  />
                ))
              )}
            </g>

            {/* Finish flash overlay */}
            <rect className="finish-flash" x="1270" y="175" width="50" height="160" fill="#ffffff" opacity="0" />

            {/* Karts */}
            <DetailedKart color="#e60012" id="kart1" number="1" />
            <DetailedKart color="#2060ff" id="kart2" number="2" />
          </svg>
        </div>

        {/* Bottom text */}
        <p className="mt-8 font-digital text-xs tracking-[0.3em] text-text-muted uppercase z-10">
          Scroll to race
        </p>
      </div>
    </div>
  );
}
