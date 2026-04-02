"use client";

/**
 * Visual credibility on the landing page: infinite marquee of brand images. Client-only
 * because it uses layout measurements + animation timing.
 */

import { useRef, useEffect } from "react";
import Image from "next/image";

const carouselImages = [
  "/carousel-computer.png",
  "/carousel-brain-lightbulb.png",
  "/carousel-books.png",
  "/carousel-grad.png",
];

const GAP_REM_DEFAULT = 1.5;
const GAP_REM_COMPACT = 1;
const MARQUEE_DURATION_S = 10;
const COPIES = 6;

function SlideItem({ src, compact }: { src: string; compact?: boolean }) {
  const slideWidthRem = compact ? 5.5 : 10;
  return (
    <div
      className="flex flex-shrink-0 items-center justify-center"
      style={{ width: `${slideWidthRem}rem` }}
    >
      <div
        className={`relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl bg-slate-800/80 shadow-inner ${
          compact ? "max-w-[3.25rem] rounded-lg sm:max-w-[3.5rem]" : "max-w-[6rem] rounded-2xl sm:max-w-[7rem]"
        }`}
      >
        <Image
          src={src}
          alt=""
          width={compact ? 64 : 112}
          height={compact ? 64 : 112}
          className="h-full w-full object-contain"
        />
      </div>
    </div>
  );
}

type HeroCarouselProps = {
  /** Shorter strip for embedding under the hero headline (e.g. marketing top section). */
  compact?: boolean;
};

export function HeroCarousel({ compact = false }: HeroCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(0);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const durationMs = MARQUEE_DURATION_S * 1000;
    const count = carouselImages.length;

    let rafMeasure = requestAnimationFrame(() => {
      const firstItem = track.children[0] as HTMLElement;
      const secondSetFirstItem = track.children[count] as HTMLElement;

      if (!firstItem || !secondSetFirstItem) return;

      // Exact DOM measurement — no floating point rem math
      const setWidthPx = secondSetFirstItem.offsetLeft - firstItem.offsetLeft;

      if (setWidthPx <= 0) return;

      const speedPxPerMs = setWidthPx / durationMs;

      const tick = (now: number) => {
        const prev = lastTimeRef.current;
        lastTimeRef.current = now;
        const delta = prev ? Math.min(now - prev, 32) : 0;

        offsetRef.current += speedPxPerMs * delta;

        if (offsetRef.current >= setWidthPx) {
          offsetRef.current -= setWidthPx;
        }

        track.style.transform = `translate3d(${-offsetRef.current}px, 0, 0)`;
        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
    });

    const handleVisibility = () => {
      lastTimeRef.current = 0;
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelAnimationFrame(rafMeasure);
      cancelAnimationFrame(rafRef.current);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  const gapRem = compact ? GAP_REM_COMPACT : GAP_REM_DEFAULT;

  const tagline = (
    <p
      className={`font-display text-center font-medium tracking-wide ${
        compact
          ? "mb-2 text-[11px] text-slate-400 sm:text-xs"
          : "mb-2 text-sm text-slate-100 sm:text-base"
      }`}
      style={
        compact
          ? undefined
          : {
              backgroundImage:
                "linear-gradient(90deg, #6366f1 0%, #22c55e 40%, #8b5cf6 70%, #38bdf8 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }
      }
    >
      Upload PDFs · Ask questions · Generate quizzes · Build plans
    </p>
  );

  const track = (
    <div
      className={`relative w-full min-w-0 overflow-hidden border border-slate-700/60 ${
        compact
          ? "rounded-lg bg-slate-900/60 py-2 sm:py-2.5"
          : "rounded-2xl bg-slate-950/40 py-6 sm:py-8"
      }`}
    >
      <div className="relative min-w-0 overflow-hidden">
        <div className={`flex items-center ${compact ? "py-1" : "py-4 sm:py-6"}`}>
          <div
            className="flex w-full min-w-0 items-center overflow-hidden"
            style={{
              maskImage: "linear-gradient(to right, transparent 0%, black 40%, black 60%, transparent 100%)",
              WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 40%, black 60%, transparent 100%)",
            }}
          >
            <div
              ref={trackRef}
              className="flex items-center"
              style={{
                gap: `${gapRem}rem`,
                willChange: "transform",
                backfaceVisibility: "hidden",
              }}
            >
              {Array.from({ length: COPIES }, () => carouselImages)
                .flat()
                .map((src, i) => (
                  <SlideItem key={i} src={src} compact={compact} />
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (compact) {
    return (
      <div className="w-full">
        {tagline}
        {track}
      </div>
    );
  }

  return (
    <section className="relative min-h-[16rem] overflow-hidden border-b border-slate-800 py-6 md:min-h-[18rem]">
      <div className="absolute inset-0 z-0">
        <Image
          src="/hero-background-network.png"
          alt=""
          fill
          className="object-cover object-center"
          sizes="100vw"
          priority
        />
        <div className="absolute inset-0 bg-slate-950/55" aria-hidden />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-4">
        {tagline}
        {track}
      </div>
    </section>
  );
}