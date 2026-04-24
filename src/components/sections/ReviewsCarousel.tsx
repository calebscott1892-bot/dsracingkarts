"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Star, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";

export interface ReviewItem {
  id: string;
  author_name: string;
  text: string;
  platform: string;
  rating: number;
}

const AUTO_INTERVAL = 9000;
const GOOGLE_REVIEW_URL =
  "https://www.google.com/search?sca_esv=2003d76d2b4e6dc0&rlz=1CDGOYI_enAU682AU682&hl=en-GB&sxsrf=ANbL-n6p03TZXBuX6LvxVqTH_VlW8_2-iw:1776661489453&q=ds+racing+karts+reviews&uds=ALYpb_ki1KN3s-C1tVGz67MlZjc7As9wJt86ZWz5464yZZXvLH9C9718Q-8x00XwZEMgO2sKYHSM2Btvjfe5X0NJeIhHukU6sak3ZuqVRYPJY330YdxUApKE76VO18DUI3y5xwXKqLDhgvMkO1i7I33Q5U5jQrUeXYuEGYSVsZpKzI5MWSYosOPWWQwAipsdGxdIxFtz0a_CfmDZzDQ6IdPrpuVN4wYMmAGsWnjSplAT4i0cRtVA6euQzXCstypQqNxGjlSxmz9WsUhvkgCOdCwTWi8mngs_xIYuSHc6UMhVNvGx7eXFnNtXrMmeyX1OI9Vc4Od1H3Wmh16Rcviyvw1LKoou6W7f_U95r2Wbef7dpx0ZsfTT2MSoZN7oYANT-MFKw08-6lVXJLGz8gSFDvsGldx8zOl4GVGmJZgde_kqPU8Il51ICVsmwMEb4bQ3u1c6uUpt4flC2s18fdGMNIZQ31TgiOxVhLGRDVVBTkBfpB4RM0cgp2Mp-htFhzz_eeZeXWD5bBfxc25nBHfkDLEKFGTfJcloeA&si=AL3DRZEsmMGCryMMFSHJ3StBhOdZ2-6yYkXd_doETEE1OR-qOWOQB6tzQtl59egWMlkRUO6klK__O41FewRXZEvGlkXhydsAfgr_B0ZXjX3HaDJsRE7qURCAxyC5rwYaYjUZGXUM5Idq&sa=X&ved=2ahUKEwi959vn0_uTAxVbrlYBHXHJNwYQk8gLegUIogEQAQ&ictx=1&biw=393&bih=653&dpr=3";

/* ── Single full-width progress bar ── */
function ProgressBar({ slideKey, duration }: { slideKey: string; duration: number }) {
  return (
    <div className="relative h-[2px] w-full overflow-hidden bg-white/[0.06] rounded-full">
      <div
        key={slideKey}
        className="absolute left-0 top-0 h-full rounded-full"
        style={{
          animation: `reviewProgress ${duration}ms linear forwards`,
          background: "linear-gradient(90deg, #e60012 0%, #ff4d5e 80%, #e60012 100%)",
          boxShadow: "0 0 6px rgba(230,0,18,0.8)",
        }}
      />
    </div>
  );
}

/* ── Decorative: checkered flag SVG ── */
function CheckeredFlag({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none" aria-hidden="true">
      {Array.from({ length: 6 }, (_, row) =>
        Array.from({ length: 6 }, (_, col) =>
          (row + col) % 2 === 0 ? (
            <rect key={`${row}-${col}`} x={col * 8} y={row * 8} width="8" height="8" fill="currentColor" />
          ) : null,
        ),
      )}
    </svg>
  );
}

/* ── Star row ── */
function Stars({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: count }).map((_, i) => (
        <Star key={i} size={15} className="fill-racing-gold text-racing-gold" strokeWidth={0} />
      ))}
    </div>
  );
}

export function ReviewsCarousel({ reviews }: { reviews: ReviewItem[] }) {
  if (reviews.length === 0) {
    return null;
  }

  const [current, setCurrent]   = useState(0);
  const [prevIdx, setPrevIdx]   = useState<number | null>(null);
  const [dir, setDir]           = useState<"next" | "prev">("next");
  const [animating, setAnimating] = useState(false);
  const [timerKey, setTimerKey] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasMultipleReviews = reviews.length > 1;

  const go = useCallback(
    (nextIdx: number, direction: "next" | "prev") => {
      if (!hasMultipleReviews || animating || nextIdx === current) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      setDir(direction);
      setPrevIdx(current);
      setAnimating(true);
      setCurrent(nextIdx);
      setTimerKey((k) => k + 1);
    },
    [animating, current, hasMultipleReviews],
  );

  const goNext = useCallback(() => go((current + 1) % reviews.length, "next"), [go, current, reviews.length]);
  const goPrev = useCallback(() => go((current - 1 + reviews.length) % reviews.length, "prev"), [go, current, reviews.length]);

  /* Auto-advance */
  useEffect(() => {
    if (!hasMultipleReviews) return;
    timerRef.current = setTimeout(goNext, AUTO_INTERVAL);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [timerKey, goNext, hasMultipleReviews]);

  /* Clear prevIdx after transition */
  useEffect(() => {
    if (!animating) return;
    const t = setTimeout(() => { setPrevIdx(null); setAnimating(false); }, 450);
    return () => clearTimeout(t);
  }, [animating]);

  const review = reviews[current] ?? reviews[0];
  const enterFrom = dir === "next" ? "60px" : "-60px";
  const exitTo    = dir === "next" ? "-60px" : "60px";

  return (
    <section id="reviews" className="relative overflow-hidden bg-[#0a0a0a]">
      {/* Carbon fibre backdrop */}
      <div className="absolute inset-0 carbon-fiber opacity-60" />

      {/* Top accent line */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-racing-red to-transparent" />

      {/* Watermark quote marks */}
      <div className="absolute left-6 top-8 text-[140px] leading-none select-none pointer-events-none font-heading text-white/[0.022]" aria-hidden="true">&ldquo;</div>
      <div className="absolute right-6 bottom-4 text-[140px] leading-none select-none pointer-events-none font-heading text-white/[0.022]" aria-hidden="true">&rdquo;</div>

      {/* Decorative chequered corners */}
      <CheckeredFlag className="absolute top-0 left-0 w-14 h-14 text-white/[0.04] pointer-events-none" />
      <CheckeredFlag className="absolute top-0 right-0 w-14 h-14 text-white/[0.04] pointer-events-none rotate-90" />

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-16 md:py-24">

        {/* Section label */}
        <div className="flex items-center gap-4 mb-6 justify-center">
          <span className="h-[1px] w-10 bg-racing-red" />
          <span className="font-heading text-xs tracking-[0.4em] text-racing-red uppercase">From the Pit Wall</span>
          <span className="h-[1px] w-10 bg-racing-red" />
        </div>

        <h2 className="section-heading text-center mb-14">
          What Racers <span className="text-racing-red">Say</span>
        </h2>

        {/* Review card area */}
        <div className="relative min-h-[320px] sm:min-h-[280px] md:min-h-[220px]">
          {/* Outgoing */}
          {prevIdx !== null && (
            <div
              key={`out-${prevIdx}`}
              className="absolute inset-0"
              style={{
                animation: `reviewExit 0.45s ease-in forwards`,
                "--exit-to": exitTo,
              } as React.CSSProperties}
            >
              <ReviewCard review={reviews[prevIdx]} />
            </div>
          )}
          {/* Incoming */}
          <div
            key={`in-${current}`}
            className="absolute inset-0"
            style={{
              animation: animating ? `reviewEnter 0.45s ease-out forwards` : undefined,
              "--enter-from": enterFrom,
            } as React.CSSProperties}
          >
            <ReviewCard review={review} />
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-10 sm:mt-12 mb-6 sm:mb-8 px-1">
          <ProgressBar slideKey={`${current}-${timerKey}`} duration={AUTO_INTERVAL} />
        </div>

        {/* Controls row */}
        <div className="flex items-center justify-between gap-4">

          {/* Prev */}
          <button
            onClick={goPrev}
            aria-label="Previous review"
            disabled={!hasMultipleReviews}
            className="flex items-center gap-2 px-4 py-2.5 border border-white/10 bg-white/5
                       hover:bg-white/10 hover:border-white/20 text-white/60 hover:text-white
                       transition-all group shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={18} strokeWidth={2} className="group-hover:-translate-x-0.5 transition-transform" />
            <span className="text-xs uppercase tracking-[0.15em] hidden sm:inline font-heading">Prev</span>
          </button>

          {/* Dot indicators */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-center">
            {reviews.map((r, i) => (
              <button
                key={r.id}
                onClick={() => go(i, i > current ? "next" : "prev")}
                aria-label={`View review from ${r.author_name}`}
                disabled={!hasMultipleReviews}
                className="p-1"
              >
                <div
                  className="rounded-full transition-all duration-300"
                  style={{
                    width: i === current ? "20px" : "6px",
                    height: "6px",
                    background: i === current ? "#e60012" : "rgba(255,255,255,0.2)",
                    boxShadow: i === current ? "0 0 8px rgba(230,0,18,0.6)" : "none",
                  }}
                />
              </button>
            ))}
          </div>

          {/* Next */}
          <button
            onClick={goNext}
            aria-label="Next review"
            disabled={!hasMultipleReviews}
            className="flex items-center gap-2 px-4 py-2.5 border border-white/10 bg-white/5
                       hover:bg-white/10 hover:border-white/20 text-white/60 hover:text-white
                       transition-all group shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className="text-xs uppercase tracking-[0.15em] hidden sm:inline font-heading">Next</span>
            <ChevronRight size={18} strokeWidth={2} className="group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>

        {/* Google review CTA */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <p className="text-white/30 text-xs italic tracking-wide text-center" style={{ fontFamily: "var(--font-heading), system-ui, sans-serif" }}>
            Had an experience you&apos;d like to share?
          </p>
          <a
            href={GOOGLE_REVIEW_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="group/g flex items-center gap-2.5 border border-white/10 bg-white/[0.03]
                       px-4 py-2 transition-all duration-300
                       hover:border-white/25 hover:bg-white/[0.07]
                       hover:shadow-[0_0_20px_rgba(255,255,255,0.06)]"
            aria-label="Leave a Google review for DS Racing Karts"
          >
            {/* Google G icon */}
            <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0 transition-all duration-300 group-hover/g:drop-shadow-[0_0_4px_rgba(255,255,255,0.5)]" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span
              className="text-xs uppercase tracking-[0.2em] text-white/40 transition-colors duration-300 group-hover/g:text-white/80"
              style={{ fontFamily: "var(--font-heading), system-ui, sans-serif" }}
            >
              Leave a Review
            </span>
            <ExternalLink size={11} className="text-white/20 group-hover/g:text-white/50 transition-colors duration-300" />
          </a>
        </div>
      </div>

      {/* Bottom accent line */}
      <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-racing-red to-transparent" />

      <style jsx global>{`
        @keyframes reviewEnter {
          from { opacity: 0; transform: translateX(var(--enter-from, 60px)); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes reviewExit {
          from { opacity: 1; transform: translateX(0); }
          to   { opacity: 0; transform: translateX(var(--exit-to, -60px)); }
        }
        @keyframes reviewProgress {
          from { width: 0%; }
          to   { width: 100%; }
        }
      `}</style>
    </section>
  );
}

/* ── Individual review card ── */
function ReviewCard({ review }: { review: ReviewItem }) {
  return (
    <div className="w-full h-full flex flex-col items-center text-center px-2 md:px-10">
      {/* Stars */}
      <div className="mb-7">
        <Stars count={review.rating} />
      </div>

      {/* Quote text */}
      <p className="text-white/80 text-sm sm:text-base md:text-lg leading-[1.75] sm:leading-[1.85] italic mb-7 sm:mb-9 max-w-2xl px-1">
        &ldquo;{review.text}&rdquo;
      </p>

      {/* Reviewer name — pit board style */}
      <div className="inline-flex items-center gap-3 sm:gap-4 max-w-full">
        <span className="h-[1px] w-6 sm:w-8 bg-racing-red/40 shrink-0" />
        <div className="flex items-center gap-2 sm:gap-2.5 border border-white/10 bg-white/[0.04] px-3 sm:px-5 py-2 min-w-0">
          <CheckeredFlag className="w-3 h-3 text-white/25 shrink-0" />
          <span
            className="text-[10px] sm:text-xs uppercase tracking-[0.2em] sm:tracking-[0.28em] text-white/60 truncate"
            style={{ fontFamily: "var(--font-heading), system-ui, sans-serif" }}
          >
            {review.author_name}
          </span>
        </div>
        <span className="h-[1px] w-6 sm:w-8 bg-racing-red/40 shrink-0" />
      </div>
    </div>
  );
}
