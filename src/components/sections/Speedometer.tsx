"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const STATS = [
  { value: 3500, suffix: "+", label: "Parts in Stock" },
  { value: 40, suffix: "", label: "Years in Karting" },
  { value: 1000, suffix: "+", label: "Karts Serviced" },
  { value: 48, suffix: "", label: "Tracks Raced On Nationally" },
];

// Real go-kart tachometer: 0-16,000 RPM, redline at 13,000+
const MAX_RPM = 16000;
const REDLINE_RPM = 13000;
const TICK_COUNT = 9; // 0, 2, 4, 6, 8, 10, 12, 14, 16 (x1000)
const ARC_START_ANGLE = -225; // degrees (7 o'clock position)
const ARC_END_ANGLE = 45; // degrees (5 o'clock position)
const ARC_SWEEP = ARC_END_ANGLE - ARC_START_ANGLE; // 270 degrees total

function TachometerSVG({ rpm }: { rpm: number }) {
  const rpmFraction = Math.min(rpm / MAX_RPM, 1);
  const needleAngle = ARC_START_ANGLE + rpmFraction * ARC_SWEEP;

  // Arc path for the gauge background (270 degree arc)
  const cx = 200, cy = 200, r = 160;
  const arcPath = describeArc(cx, cy, r, ARC_START_ANGLE, ARC_END_ANGLE);
  const filledArcPath = describeArc(cx, cy, r, ARC_START_ANGLE, needleAngle);
  const redZoneStart = ARC_START_ANGLE + (REDLINE_RPM / MAX_RPM) * ARC_SWEEP;
  const redZonePath = describeArc(cx, cy, r, redZoneStart, ARC_END_ANGLE);

  const isRedline = rpm >= REDLINE_RPM;

  return (
    <svg viewBox="0 0 400 320" className="w-full max-w-md mx-auto" style={{ overflow: "visible" }}>
      <defs>
        <filter id="needleGlow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="redGlow">
          <feGaussianBlur stdDeviation="8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Outer bezel ring */}
      <circle cx={cx} cy={cy} r="185" fill="none" stroke="#333" strokeWidth="3" />
      <circle cx={cx} cy={cy} r="182" fill="#0a0a0a" />

      {/* Inner dark face */}
      <circle cx={cx} cy={cy} r="175" fill="#111" />

      {/* Red zone background arc */}
      <path d={redZonePath} fill="none" stroke="rgba(230,0,18,0.15)" strokeWidth="28" strokeLinecap="butt" />

      {/* Background arc (unfilled gauge) */}
      <path d={arcPath} fill="none" stroke="#2a2a2a" strokeWidth="10" strokeLinecap="round" />

      {/* Filled arc (progress) */}
      <path
        d={filledArcPath}
        fill="none"
        stroke={isRedline ? "#e60012" : "#d4af37"}
        strokeWidth="10"
        strokeLinecap="round"
        filter={isRedline ? "url(#redGlow)" : undefined}
      />

      {/* Tick marks and labels */}
      {Array.from({ length: TICK_COUNT }).map((_, i) => {
        const rpmVal = i * 2000;
        const fraction = rpmVal / MAX_RPM;
        const angle = ARC_START_ANGLE + fraction * ARC_SWEEP;
        const rad = (angle * Math.PI) / 180;
        const isRedZone = rpmVal >= REDLINE_RPM;

        // Major tick
        const innerR = 148;
        const outerR = 168;
        const x1 = cx + innerR * Math.cos(rad);
        const y1 = cy + innerR * Math.sin(rad);
        const x2 = cx + outerR * Math.cos(rad);
        const y2 = cy + outerR * Math.sin(rad);

        // Label position
        const labelR = 132;
        const lx = cx + labelR * Math.cos(rad);
        const ly = cy + labelR * Math.sin(rad);

        return (
          <g key={i}>
            <line
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={isRedZone ? "#e60012" : "#888"}
              strokeWidth={3}
            />
            <text
              x={lx} y={ly + 4}
              textAnchor="middle"
              fontSize="13"
              fontFamily="var(--font-digital)"
              fontWeight="bold"
              fill={isRedZone ? "#e60012" : "#aaa"}
            >
              {rpmVal / 1000}
            </text>
          </g>
        );
      })}

      {/* Minor ticks (every 1000) */}
      {Array.from({ length: TICK_COUNT * 2 - 1 }).map((_, i) => {
        if (i % 2 === 0) return null; // skip major ticks
        const rpmVal = i * 1000;
        const fraction = rpmVal / MAX_RPM;
        const angle = ARC_START_ANGLE + fraction * ARC_SWEEP;
        const rad = (angle * Math.PI) / 180;
        const isRedZone = rpmVal >= REDLINE_RPM;

        const innerR = 155;
        const outerR = 165;
        const x1 = cx + innerR * Math.cos(rad);
        const y1 = cy + innerR * Math.sin(rad);
        const x2 = cx + outerR * Math.cos(rad);
        const y2 = cy + outerR * Math.sin(rad);

        return (
          <line
            key={i}
            x1={x1} y1={y1} x2={x2} y2={y2}
            stroke={isRedZone ? "#e60012" : "#555"}
            strokeWidth={1.5}
          />
        );
      })}

      {/* RED ZONE label */}
      {(() => {
        const labelAngle = ARC_START_ANGLE + ((REDLINE_RPM + 1000) / MAX_RPM) * ARC_SWEEP;
        const labelRad = (labelAngle * Math.PI) / 180;
        const labelR2 = 108;
        return (
          <text
            x={cx + labelR2 * Math.cos(labelRad)}
            y={cy + labelR2 * Math.sin(labelRad) + 3}
            textAnchor="middle"
            fontSize="8"
            fontFamily="var(--font-digital)"
            fill="#e60012"
            opacity="0.7"
          >
            REDLINE
          </text>
        );
      })()}

      {/* Needle — CSS transform anchored at center, never leaves the gauge */}
      <g
        style={{
          transformOrigin: `${cx}px ${cy}px`,
          transform: `rotate(${needleAngle + 90}deg)`,
        }}
        filter="url(#needleGlow)"
      >
        <polygon
          points={`${cx},${cy - 145} ${cx - 4},${cy - 5} ${cx},${cy + 8} ${cx + 4},${cy - 5}`}
          fill="#e60012"
        />
      </g>

      {/* Center cap */}
      <circle cx={cx} cy={cy} r="12" fill="#1a1a1a" stroke="#444" strokeWidth="2" />
      <circle cx={cx} cy={cy} r="4" fill="#e60012" />

      {/* Digital RPM readout */}
      <rect x={cx - 40} y={cy + 30} width="80" height="28" rx="3" fill="#0a0a0a" stroke="#333" strokeWidth="1" />
      <text
        x={cx} y={cy + 48}
        textAnchor="middle"
        fontSize="16"
        fontFamily="var(--font-digital)"
        fontWeight="bold"
        fill={isRedline ? "#e60012" : "#ffffff"}
      >
        {Math.round(rpm).toLocaleString()}
      </text>
      <text
        x={cx} y={cy + 70}
        textAnchor="middle"
        fontSize="9"
        fontFamily="var(--font-digital)"
        fill="#666"
      >
        RPM
      </text>

      {/* Brand text */}
      <text
        x={cx} y={cy - 40}
        textAnchor="middle"
        fontSize="10"
        fontFamily="var(--font-digital)"
        fill="#555"
        letterSpacing="3"
      >
        DSR
      </text>
    </svg>
  );
}

// Helper: SVG arc path
function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const startRad = (startAngle * Math.PI) / 180;
  const endRad = (endAngle * Math.PI) / 180;
  const x1 = cx + r * Math.cos(startRad);
  const y1 = cy + r * Math.sin(startRad);
  const x2 = cx + r * Math.cos(endRad);
  const y2 = cy + r * Math.sin(endRad);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
}

export function Speedometer() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [rpm, setRpm] = useState(0);
  const [counters, setCounters] = useState(STATS.map(() => 0));

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const ctx = gsap.context(() => {
      // RPM needle — driven by scroll, 0 to 14500 RPM (just past redline)
      const rpmObj = { val: 0 };
      ScrollTrigger.create({
        trigger: section,
        start: "top 70%",
        end: "bottom 30%",
        scrub: 1.5,
        onUpdate: (self) => {
          const progress = self.progress;
          let targetRpm: number;

          if (progress < 0.85) {
            // Smooth ramp from 0 to 14500
            targetRpm = progress / 0.85 * 14500;
          } else {
            // Rev bounce at redline: oscillate between 13000-15000
            const revPhase = (progress - 0.85) / 0.15;
            const bounce = Math.sin(revPhase * Math.PI * 4) * 1000;
            targetRpm = 14000 + bounce;
          }

          rpmObj.val = targetRpm;
          setRpm(Math.max(0, Math.round(rpmObj.val)));
        },
      });

      // Stat counters
      STATS.forEach((stat, i) => {
        const obj = { val: 0 };
        gsap.to(obj, {
          val: stat.value,
          duration: 1.5,
          ease: "power2.out",
          scrollTrigger: {
            trigger: `.stat-${i}`,
            start: "top 85%",
            onUpdate: () => {
              setCounters(prev => {
                const next = [...prev];
                next[i] = Math.round(obj.val);
                return next;
              });
            },
          },
        });
      });
    }, section);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="relative py-24 md:py-32 bg-racing-dark carbon-fiber overflow-hidden">
      <div className="relative z-10 max-w-5xl mx-auto px-4">
        {/* Title */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <span className="h-[1px] w-8 bg-racing-red" />
            <span className="font-heading text-xs tracking-[0.4em] text-racing-red uppercase">
              Performance
            </span>
            <span className="h-[1px] w-8 bg-racing-red" />
          </div>
          <h2 className="section-heading">
            Pushing to the <span className="text-racing-red">Redline</span>
          </h2>
        </div>

        {/* Tachometer — React-controlled, never flies off */}
        <div className="mb-16">
          <TachometerSVG rpm={rpm} />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8">
          {STATS.map((stat, i) => (
            <div
              key={stat.label}
              className={`stat-${i} text-center p-6 bg-racing-black/50 border border-surface-600/30`}
            >
              <div className="font-digital text-4xl md:text-5xl font-bold text-racing-red mb-2">
                {counters[i].toLocaleString()}{stat.suffix}
              </div>
              <div className="font-heading text-xs uppercase tracking-[0.2em] text-text-muted">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
