"use client";

import { useEffect, useRef, useState } from "react";

export function ScrollVideo() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && videoRef.current) {
          videoRef.current.play().catch(() => {});
        } else if (videoRef.current) {
          videoRef.current.pause();
        }
      },
      { threshold: 0.2 }
    );
    observer.observe(section);

    function onScroll() {
      if (!section) return;
      const rect = section.getBoundingClientRect();
      const windowH = window.innerHeight;
      const sectionH = section.offsetHeight;

      // Progress: 0 when section enters viewport, 1 when it exits
      const rawProgress = (windowH - rect.top) / (windowH + sectionH);
      setProgress(Math.max(0, Math.min(1, rawProgress)));
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  // Compute transforms based on scroll progress
  const rotateX = 12 - progress * 16;       // 12deg → -4deg
  const rotateY = -6 + progress * 8;        // -6deg → 2deg
  const scale = 0.75 + progress * 0.3;      // 0.75 → 1.05
  const translateY = 60 - progress * 80;     // 60px → -20px
  const opacity = progress < 0.1 ? progress * 10 : progress > 0.9 ? (1 - progress) * 10 : 1;
  const glowIntensity = Math.sin(progress * Math.PI) * 0.6;

  return (
    <section
      ref={sectionRef}
      className="relative py-24 md:py-32 overflow-hidden"
    >
      {/* Background texture */}
      <div className="absolute inset-0 bg-surface-900 checkered-bg" />

      {/* Ambient glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[250px] md:w-[600px] md:h-[400px]
                   rounded-full blur-[120px] pointer-events-none transition-opacity duration-100"
        style={{
          background: `radial-gradient(ellipse, rgba(204,0,0,${glowIntensity}) 0%, transparent 70%)`,
        }}
      />

      <div className="relative max-w-5xl mx-auto px-4">
        {/* Section heading */}
        <div className="text-center mb-12 md:mb-16">
          <div className="flex items-center justify-center gap-3 mb-4">
            <span className="h-[1px] w-12 bg-brand-yellow" />
            <span className="font-heading text-xs tracking-[0.4em] text-brand-yellow uppercase">
              On the Track
            </span>
            <span className="h-[1px] w-12 bg-brand-yellow" />
          </div>
          <h2 className="section-heading">
            Built for <span className="text-brand-red">Speed</span>
          </h2>
        </div>

        {/* 3D Video Container */}
        <div
          className="relative mx-auto transition-[opacity] duration-100"
          style={{
            perspective: "1200px",
            opacity,
          }}
        >
          <div
            className="relative transition-transform duration-100 ease-out"
            style={{
              transform: `rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(${scale}) translateY(${translateY}px)`,
              transformStyle: "preserve-3d",
            }}
          >
            {/* Outer frame — racing monitor effect */}
            <div className="relative bg-surface-800 border border-surface-500/50 p-1.5 md:p-2
                           shadow-[0_0_60px_rgba(0,0,0,0.8)]">

              {/* Red accent corners */}
              <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-brand-red" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-brand-red" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-brand-red" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-brand-red" />

              {/* Video */}
              <div className="relative aspect-video overflow-hidden bg-black">
                <video
                  ref={videoRef}
                  muted
                  loop
                  playsInline
                  className="w-full h-full object-cover"
                >
                  <source src="/scroll-video.mp4" type="video/mp4" />
                </video>

                {/* Scanline overlay */}
                <div
                  className="absolute inset-0 pointer-events-none opacity-[0.03]"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(255,255,255,0.1) 1px, rgba(255,255,255,0.1) 2px)",
                  }}
                />
              </div>

              {/* Bottom bar — telemetry style */}
              <div className="flex items-center justify-between px-3 py-1.5 bg-surface-900/80">
                <span className="text-xs font-heading tracking-[0.3em] text-brand-red uppercase">
                  DSR // Live
                </span>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-red animate-pulse" />
                  <span className="text-xs font-heading tracking-[0.2em] text-text-muted uppercase">
                    Race Ready
                  </span>
                </div>
              </div>
            </div>

            {/* Reflection */}
            <div
              className="absolute -bottom-8 left-4 right-4 h-8 bg-gradient-to-b from-brand-red/5 to-transparent
                          blur-sm pointer-events-none"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
