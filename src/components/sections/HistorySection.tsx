"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { X, ZoomIn } from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

/* ── Timeline data: each node is a "stop" on the family-tree line ── */
const TIMELINE: {
  year: string;
  title: string;
  text: string;
  image: { src: string; alt: string };
  side: "left" | "right";
}[] = [
  {
    year: "The Early Days",
    title: "Where It All Started",
    text: "From the earliest kart tracks to backyard workshops — a lifelong obsession with speed was born.",
    image: { src: "/images/history/History1.jpg", alt: "The early days — kart #49 on track" },
    side: "left",
  },
  {
    year: "Growing Up",
    title: "Vintage Karting Memories",
    text: "Racing on dirt ovals and local circuits, the foundations of DS Racing were being laid one lap at a time.",
    image: { src: "/images/history/History 2.jpg", alt: "Vintage karting memories" },
    side: "right",
  },
  {
    year: "The Grind",
    title: "Racing Through the Years",
    text: "Every weekend was race day. Every weeknight was spent in the workshop. This isn't just a business — it's a way of life.",
    image: { src: "/images/history/History 3.jpg", alt: "Racing through the years" },
    side: "left",
  },
  {
    year: "Pushing Limits",
    title: "Engineering Excellence",
    text: "We designed and built the DSR Predator — a purpose-built 4-stroke twin engine chassis that became a benchmark in endurance racing.",
    image: { src: "/images/history/History 5.jpg", alt: "Pushing the limits" },
    side: "right",
  },
  {
    year: "The Workshop",
    title: "Where the Magic Happens",
    text: "From humble beginnings in Sydney's south-west, we've grown into one of Australia's most respected kart specialists.",
    image: { src: "/images/history/History 6.jpg", alt: "Workshop origins" },
    side: "left",
  },
  {
    year: "Community",
    title: "Team & Community",
    text: "We've held the stopwatch for first-timers and veterans alike. Every racer who walks through our door becomes part of the story.",
    image: { src: "/images/history/History 7.jpg", alt: "Team and community" },
    side: "right",
  },
  {
    year: "Championships",
    title: "Podium Moments",
    text: "Multiple endurance race victories, ERC podiums, and SEK class wins. The results speak for themselves.",
    image: { src: "/images/history/History 8.jpg", alt: "Championship moments" },
    side: "left",
  },
  {
    year: "Today",
    title: "The Legacy Continues",
    text: "The smell of burnt rubber. The roar of either a 2-stroke or 4-stroke at redline. The feeling when you nail that perfect lap. That's what drives us.",
    image: { src: "/images/history/History 9.webp", alt: "The legacy continues" },
    side: "right",
  },
  {
    year: "The Collection",
    title: "And the Rest Was History",
    text: "Decades of dedication, hundreds of races, and a trophy cabinet that tells the story better than words ever could.",
    image: { src: "/images/history/Trophies.webp", alt: "The trophy collection" },
    side: "left",
  },
];

export function HistorySection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const underlineLeftRef = useRef<HTMLSpanElement>(null);
  const underlineRightRef = useRef<HTMLSpanElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const trunkRef = useRef<HTMLDivElement>(null);
  const trunkGlowRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<(HTMLDivElement | null)[]>([]);
  const branchRefs = useRef<(HTMLDivElement | null)[]>([]);
  const dotRefs = useRef<(HTMLDivElement | null)[]>([]);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const terminalRef = useRef<HTMLDivElement>(null);
  const lockedRef = useRef(false);
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);

  const openLightbox = useCallback((src: string, alt: string) => {
    setLightbox({ src, alt });
    document.body.style.overflow = "hidden";
  }, []);

  const closeLightbox = useCallback(() => {
    setLightbox(null);
    document.body.style.overflow = "";
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && lightbox) closeLightbox();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, closeLightbox]);

  useEffect(() => {
    const section = sectionRef.current;
    const timeline = timelineRef.current;
    if (!section || !timeline) return;

    lockedRef.current = false;
    /* Track which nodes are currently visible */
    const visible = new Array(TIMELINE.length).fill(false);

    const ctx = gsap.context(() => {
      /* ═══════════════════════════════════════════════════════════════
         1. TITLE UNDERLINE
         ═══════════════════════════════════════════════════════════════ */
      const ulTl = gsap.timeline({
        scrollTrigger: {
          trigger: titleRef.current,
          start: "top 80%",
          end: "top 55%",
          scrub: 1,
        },
      });
      ulTl.fromTo(underlineLeftRef.current, { width: "0%" }, { width: "50%", duration: 1, ease: "power2.inOut" }, 0);
      ulTl.fromTo(underlineRightRef.current, { width: "0%" }, { width: "50%", duration: 1, ease: "power2.inOut" }, 0);

      /* ═══════════════════════════════════════════════════════════════
         2. HIDE ALL NODES IMMEDIATELY ON INIT
            Using gsap.set (inline styles) — instant, no CSS conflicts.
         ═══════════════════════════════════════════════════════════════ */
      TIMELINE.forEach((item, i) => {
        const dot = dotRefs.current[i];
        const branch = branchRefs.current[i];
        const card = cardRefs.current[i];
        if (dot) gsap.set(dot, { scale: 0, autoAlpha: 0 });
        if (branch) gsap.set(branch, { scaleX: 0, autoAlpha: 0 });
        if (card) gsap.set(card, { autoAlpha: 0, x: item.side === "left" ? -60 : 60, y: 20 });
      });
      /* Terminal circle starts partially visible */
      if (terminalRef.current) gsap.set(terminalRef.current, { autoAlpha: 0.3 });

      /* ═══════════════════════════════════════════════════════════════
         3. SINGLE RAF-DRIVEN SCROLL HANDLER
            Runs every animation frame via ScrollTrigger. Computes
            trunk height and instantly shows/hides nodes based on
            whether the trunk has reached their dot position.

            - show = gsap.set (instant, 0 frames)
            - hide = gsap.set (instant, 0 frames)
            - No timelines, no play/reverse, no progress() — just
              direct property setting every frame.
            - When locked: trunk stays, everything stays visible.
         ═══════════════════════════════════════════════════════════════ */
      ScrollTrigger.create({
        trigger: timeline,
        start: "top bottom",
        end: "bottom top",
        onUpdate: () => {
          if (!trunkRef.current || !timeline) return;
          if (lockedRef.current) return;

          /* ── Trunk height ── */
          const tlRect = timeline.getBoundingClientRect();
          const viewportY = window.innerHeight * 0.55;
          const depth = viewportY - tlRect.top;
          const h = Math.max(0, Math.min(depth, tlRect.height));
          trunkRef.current.style.height = `${h}px`;
          if (trunkGlowRef.current) trunkGlowRef.current.style.height = `${h}px`;

          /* ── Per-node: show/hide based on trunk position ── */
          TIMELINE.forEach((item, i) => {
            const node = nodeRefs.current[i];
            const dot = dotRefs.current[i];
            const branch = branchRefs.current[i];
            const card = cardRefs.current[i];
            if (!node || !dot) return;

            /* Dot position relative to timeline container top.
               We use the NODE (which is never scaled) to get the
               dot's Y, not the dot itself (which may be scale:0). */
            const nodeRect = node.getBoundingClientRect();
            const dotY = nodeRect.top + 24 - tlRect.top; /* 24px = top-6 (1.5rem) */

            const shouldShow = h >= dotY;

            if (shouldShow && !visible[i]) {
              /* SHOW — instant appear with a tiny staggered tween for polish */
              visible[i] = true;
              if (dot) gsap.to(dot, { scale: 1, autoAlpha: 1, duration: 0.2, ease: "back.out(2)", overwrite: true });
              if (branch) gsap.to(branch, { scaleX: 1, autoAlpha: 1, duration: 0.2, ease: "power2.out", overwrite: true, delay: 0.03 });
              if (card) gsap.to(card, { autoAlpha: 1, x: 0, y: 0, duration: 0.3, ease: "power2.out", overwrite: true, delay: 0.06 });
            } else if (!shouldShow && visible[i]) {
              /* HIDE — smooth transition: card slides out, branch retracts into trunk, dot shrinks */
              visible[i] = false;
              if (card) gsap.to(card, { autoAlpha: 0, x: item.side === "left" ? -60 : 60, y: 20, duration: 0.35, ease: "power2.in", overwrite: true });
              if (branch) gsap.to(branch, { scaleX: 0, autoAlpha: 0, duration: 0.25, ease: "power2.in", overwrite: true, delay: 0.05 });
              if (dot) gsap.to(dot, { scale: 0, autoAlpha: 0, duration: 0.2, ease: "power2.in", overwrite: true, delay: 0.1 });
            }
          });

          /* ── Terminal circle "click" — lock when trunk reaches it ── */
          if (terminalRef.current && terminalRef.current.offsetParent !== null) {
            const termRect = terminalRef.current.getBoundingClientRect();
            const termY = termRect.top + termRect.height / 2 - tlRect.top;

            if (h >= termY) {
              lockedRef.current = true;

              /* Snap trunk exactly to terminal */
              trunkRef.current!.style.height = `${termY}px`;
              if (trunkGlowRef.current) trunkGlowRef.current.style.height = `${termY}px`;

              /* Ensure all nodes fully visible */
              TIMELINE.forEach((item2, j) => {
                const d = dotRefs.current[j];
                const b = branchRefs.current[j];
                const c = cardRefs.current[j];
                if (d) gsap.set(d, { scale: 1, autoAlpha: 1 });
                if (b) gsap.set(b, { scaleX: 1, autoAlpha: 1 });
                if (c) gsap.set(c, { autoAlpha: 1, x: 0, y: 0 });
                visible[j] = true;
              });

              /* Pulse the terminal circle */
              gsap.to(terminalRef.current, { autoAlpha: 1, duration: 0.1 });
              gsap.fromTo(
                terminalRef.current,
                { scale: 1 },
                { scale: 2.5, duration: 0.12, yoyo: true, repeat: 1, ease: "power2.out" }
              );
              gsap.to(terminalRef.current, {
                borderColor: "rgba(230, 0, 18, 1)",
                backgroundColor: "rgba(230, 0, 18, 0.8)",
                boxShadow: "0 0 24px rgba(230, 0, 18, 0.6)",
                duration: 0.25,
              });
            }
          }
        },
      });
    }, section);

    return () => ctx.revert();
  }, []);

  return (
    <>
      <section ref={sectionRef} className="relative bg-racing-black overflow-hidden">
        {/* Film grain overlay */}
        <div className="film-grain absolute inset-0 pointer-events-none" />

        {/* ── Title with animated underline ── */}
        <div className="relative z-10 pt-24 md:pt-32 pb-8 text-center">
          <h2
            ref={titleRef}
            className="relative inline-block font-heading text-5xl md:text-7xl uppercase tracking-[0.12em] text-white"
          >
            History
            {/* Underline — left half grows from left edge to center,
                right half grows from right edge to center */}
            <span className="absolute left-0 bottom-0 w-full h-[3px] pointer-events-none">
              <span
                ref={underlineLeftRef}
                className="absolute left-0 top-0 h-full bg-racing-red"
                style={{ width: 0 }}
              />
              <span
                ref={underlineRightRef}
                className="absolute right-0 top-0 h-full bg-racing-red"
                style={{ width: 0 }}
              />
            </span>
          </h2>
          <p className="mt-4 text-text-secondary max-w-lg mx-auto text-sm md:text-base">
            What racing means to us
          </p>
        </div>

        {/* ── Family-tree timeline ── */}
        <div ref={timelineRef} className="relative z-10 max-w-6xl mx-auto px-4 pb-24 md:pb-32">
          {/* Trunk line — responsive: left-6 on mobile, centered on desktop */}
          <div className="absolute left-6 md:left-1/2 top-0 md:-translate-x-1/2 w-[2px]" style={{ height: "100%" }}>
            {/* Glow layer */}
            <div
              ref={trunkGlowRef}
              className="absolute top-0 left-1/2 -translate-x-1/2 w-[6px] bg-racing-red/20 blur-[3px]"
              style={{ height: 0 }}
            />
            {/* Main line */}
            <div
              ref={trunkRef}
              className="absolute top-0 left-0 w-full bg-racing-red"
              style={{ height: 0 }}
            />
          </div>

          <div className="relative space-y-16 md:space-y-24 pt-12">
            {TIMELINE.map((item, i) => {
              const isLeft = item.side === "left";
              return (
                <div
                  key={i}
                  ref={(el) => { nodeRefs.current[i] = el; }}
                  className={`relative flex items-start gap-6 md:gap-0 ${
                    isLeft ? "md:flex-row" : "md:flex-row-reverse"
                  }`}
                >
                  {/* ── Dot — responsive: left-6 on mobile, centered on desktop ── */}
                  <div className="flex absolute left-6 md:left-1/2 -translate-x-1/2 top-6 z-20 items-center justify-center">
                    <div
                      ref={(el) => { dotRefs.current[i] = el; }}
                      className="w-3 h-3 md:w-4 md:h-4 rounded-full bg-racing-red border-2 md:border-[3px] border-racing-black shadow-[0_0_8px_rgba(230,0,18,0.5)] md:shadow-[0_0_12px_rgba(230,0,18,0.5)]"
                    />
                  </div>

                  {/* ── Branch line (desktop) — grows from trunk outward ── */}
                  <div
                    ref={(el) => { branchRefs.current[i] = el; }}
                    className={`hidden md:block absolute top-[26px] h-[2px] bg-racing-red/50 w-[calc(50%-2rem)] ${
                      isLeft
                        ? "right-1/2 mr-2 origin-right"
                        : "left-1/2 ml-2 origin-left"
                    }`}
                  />

                  {/* ── Card content ── */}
                  <div
                    ref={(el) => { cardRefs.current[i] = el; }}
                    className={`ml-10 md:ml-0 md:w-[calc(50%-3rem)] ${
                      isLeft ? "md:mr-auto md:pr-8" : "md:ml-auto md:pl-8"
                    }`}
                  >
                    {/* Year badge */}
                    <span className="inline-block font-heading text-xs tracking-[0.3em] text-racing-red uppercase mb-2 bg-racing-red/10 px-3 py-1">
                      {item.year}
                    </span>

                    {/* Photo — full width, clean, no stacking */}
                    <div
                      className="group relative aspect-[16/10] overflow-hidden mb-4 cursor-pointer
                                 border border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.5)]
                                 hover:border-white/20 hover:shadow-[0_12px_40px_rgba(230,0,18,0.15)] transition-all duration-500"
                      onClick={() => openLightbox(item.image.src, item.image.alt)}
                    >
                      <Image
                        src={item.image.src}
                        alt={item.image.alt}
                        fill
                        className="object-cover grayscale-[50%] group-hover:grayscale-0 group-hover:scale-105 transition-all duration-700"
                        sizes="(max-width: 768px) 90vw, 45vw"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                      <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-sm rounded-full p-2
                                     opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2
                                     group-hover:translate-y-0">
                        <ZoomIn size={14} className="text-white/80" />
                      </div>
                    </div>

                    {/* Text */}
                    <h3 className="font-heading text-lg md:text-xl uppercase tracking-[0.1em] text-white mb-2">
                      {item.title}
                    </h3>
                    <p className="text-text-secondary text-sm leading-relaxed">
                      {item.text}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Terminal node at bottom — trunk "clicks" into this */}
          <div className="hidden md:flex justify-center mt-12">
            <div
              ref={terminalRef}
              className="w-3 h-3 rounded-full bg-racing-red/30 border-2 border-racing-red/50"
            />
          </div>
        </div>
      </section>

      {/* Fullscreen Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-sm
                     animate-[fadeIn_300ms_ease-out]"
          onClick={closeLightbox}
        >
          <button
            className="absolute top-6 right-6 z-10 bg-white/10 hover:bg-white/20 backdrop-blur-sm
                       rounded-full p-3 transition-colors duration-200"
            onClick={closeLightbox}
          >
            <X size={24} className="text-white" />
          </button>
          <div
            className="relative w-[90vw] h-[80vh] max-w-6xl animate-[scaleIn_300ms_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={lightbox.src}
              alt={lightbox.alt}
              fill
              className="object-contain"
              sizes="90vw"
              priority
            />
          </div>
          <p className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/60 font-heading
                       text-xs tracking-[0.2em] uppercase">
            {lightbox.alt}
          </p>
        </div>
      )}
    </>
  );
}
