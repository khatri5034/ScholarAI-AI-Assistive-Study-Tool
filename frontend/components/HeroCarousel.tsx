"use client";

import { useRef, useEffect } from "react";
import Image from "next/image";

const carouselImages = [
  "/carousel-computer.png",
  "/carousel-brain-lightbulb.png",
  "/carousel-books.png",
  "/carousel-grad.png",
];

const SLIDE_WIDTH_REM = 10;
const GAP_REM = 1.5;
const MARQUEE_DURATION_S = 10;
const COPIES = 6;

function SlideItem({ src }: { src: string }) {
  return (
    <div
      className="flex flex-shrink-0 items-center justify-center"
      style={{ width: `${SLIDE_WIDTH_REM}rem` }}
    >
      <div className="relative flex aspect-square w-full max-w-[6rem] items-center justify-center overflow-hidden rounded-2xl bg-slate-800/80 shadow-inner sm:max-w-[7rem]">
        <Image
          src={src}
          alt=""
          width={112}
          height={112}
          className="h-full w-full object-contain"
        />
      </div>
    </div>
  );
}

export function HeroCarousel() {
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
        <p
          className="font-display mb-2 text-center text-lg font-medium tracking-wide sm:text-xl"
          style={{
            backgroundImage: "linear-gradient(90deg, #6366f1 0%, #818cf8 40%, #6366f1 70%, #4f46e5 100%)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          Knowledge begins from here
        </p>

        <div className="relative w-full min-w-0 overflow-hidden rounded-2xl bg-slate-1000/80 py-6 sm:py-8">
          <div className="relative min-w-0 overflow-hidden">
            <div className="flex items-center py-4 sm:py-6">
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
                    gap: `${GAP_REM}rem`,
                    willChange: "transform",
                    backfaceVisibility: "hidden",
                  }}
                >
                  {Array.from({ length: COPIES }, () => carouselImages).flat().map((src, i) => (
                    <SlideItem key={i} src={src} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}