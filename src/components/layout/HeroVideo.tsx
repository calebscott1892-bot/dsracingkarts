"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

const HEADER_IMAGES = [
  "/images/history/Header.jpg",
  "/images/history/Header 2.jpg",
  "/images/history/header 3.jpg",
  "/images/history/header 4.jpg",
];

export function HeroVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoEnded, setVideoEnded] = useState(false);
  const [contentVisible, setContentVisible] = useState(false);
  const [currentBgIndex, setCurrentBgIndex] = useState(0);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    v.play().catch(() => {
      setVideoEnded(true);
      setContentVisible(true);
    });

    const onEnded = () => {
      setVideoEnded(true);
      setTimeout(() => setContentVisible(true), 400);
    };

    v.addEventListener("ended", onEnded);

    const fallback = setTimeout(() => {
      if (!contentVisible) {
        setVideoEnded(true);
        setContentVisible(true);
      }
    }, 12000);

    return () => {
      v.removeEventListener("ended", onEnded);
      clearTimeout(fallback);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Crossfade background images after video ends
  useEffect(() => {
    if (!videoEnded) return;
    const interval = setInterval(() => {
      setCurrentBgIndex((prev) => (prev + 1) % HEADER_IMAGES.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [videoEnded]);

  return (
    <section className="relative h-screen min-h-[600px] overflow-hidden bg-black" style={{ height: '100dvh' }}>
      {/* Crossfading background photos — revealed after video ends */}
      {HEADER_IMAGES.map((src, i) => (
        <div
          key={src}
          className={`absolute inset-0 transition-opacity duration-[2000ms] ease-in-out ${
            videoEnded && i === currentBgIndex ? "opacity-50" : "opacity-0"
          }`}
        >
          <Image
            src={src}
            alt=""
            fill
            className="object-cover"
            priority={i === 0}
            sizes="100vw"
          />
        </div>
      ))}

      {/* Fallback: chequered pattern while video loads */}
      <div className="absolute inset-0 chequered-bg opacity-20" />

      {/* Site Header Video — plays fully, then fades out to reveal photos */}
      <video
        ref={videoRef}
        muted
        playsInline
        className={`absolute inset-0 w-full h-full object-contain md:object-cover transition-opacity duration-1000 ${
          videoEnded ? "opacity-0" : "opacity-100"
        }`}
      >
        <source src="/videos/Site Header.mp4" type="video/mp4" />
      </video>

      {/* Gradient overlay — intensifies after video ends */}
      <div
        className={`absolute inset-0 transition-all duration-1000 ${
          videoEnded
            ? "bg-gradient-to-b from-black/60 via-black/50 to-racing-black"
            : "bg-gradient-to-b from-black/10 via-transparent to-racing-black/30"
        }`}
      />

      {/* Side racing stripes */}
      <div className="absolute top-0 left-4 md:left-8 w-[3px] h-full bg-gradient-to-b from-racing-red via-racing-red/20 to-transparent z-10" />
      <div className="absolute top-0 left-6 md:left-11 w-[1px] h-3/4 bg-gradient-to-b from-racing-gold/50 to-transparent z-10" />

      {/* Content — renders in AFTER video finishes playing */}
      <div
        className={`relative z-20 flex flex-col items-center justify-center h-full text-center px-4
                    transition-all duration-1000 delay-200 ${
                      contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
                    }`}
      >
        {/* DSR Logo — replaces text heading */}
        <div className="relative w-[260px] h-[100px] md:w-[400px] md:h-[150px] lg:w-[500px] lg:h-[190px] mb-8 drop-shadow-[0_4px_40px_rgba(230,0,18,0.25)]">
          <Image
            src="/images/history/Site Logo (2).png"
            alt="DS Racing Karts"
            fill
            className="object-contain"
            priority
          />
        </div>

        {/* Overline */}
        <div className="flex items-center gap-3 mb-6">
          <span className="h-[1px] w-10 bg-racing-red" />
          <span className="font-heading text-xs tracking-[0.4em] text-racing-red uppercase">
            Sydney&apos;s Go Kart Specialists
          </span>
          <span className="h-[1px] w-10 bg-racing-red" />
        </div>

        <h1 className="font-heading text-3xl md:text-5xl lg:text-6xl uppercase tracking-[0.08em] text-white mb-4">
          Go Kart Parts, Service <span className="text-racing-red">&amp;</span> Racewear
        </h1>

        {/* Tagline */}
        <p className="font-heading text-sm md:text-base tracking-[0.3em] text-racing-silver uppercase mb-10">
          Built for Speed. Engineered to Win.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Link href="/shop" className="btn-primary text-base px-10">
            Shop Parts
          </Link>
          <Link href="/services" className="btn-secondary text-base px-10">
            Our Services
          </Link>
        </div>
      </div>

      {/* Scroll indicator */}
      <div
        className={`absolute bottom-8 left-1/2 -translate-x-1/2 z-20 transition-opacity duration-500 ${
          contentVisible ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="flex flex-col items-center gap-2 animate-bounce">
          <span className="text-xs font-heading tracking-[0.3em] text-text-muted uppercase">Scroll</span>
          <ChevronDown size={20} className="text-racing-red" />
        </div>
      </div>
    </section>
  );
}
