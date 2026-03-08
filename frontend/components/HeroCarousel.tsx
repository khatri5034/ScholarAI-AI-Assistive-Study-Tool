"use client";

import Image from "next/image";

const carouselImages = [
  "/carousel-computer.png",
  "/carousel-brain-lightbulb.png",
  "/carousel-books.png",
  "/carousel-grad.png",
];

const SLIDE_WIDTH_REM = 10;
const GAP_REM = 1.5;
const ITEM_STEP_REM = SLIDE_WIDTH_REM + GAP_REM;
const MARQUEE_DURATION_S = 10;

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
  const setWidth = carouselImages.length * ITEM_STEP_REM - GAP_REM;

  return (
    <section className="relative min-h-[28rem] overflow-hidden border-b border-slate-800 py-10 md:min-h-[32rem]">
      {/* Full-width background: left end to right end of page */}
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
      {/* Content (title + carousel) */}
      <div className="relative z-10 mx-auto max-w-5xl px-4">
        <p className="mb-8 text-center text-lg font-medium tracking-wide text-violet-400/90 sm:text-xl">
          Knowledge begins from here
        </p>
        <div className="relative min-w-0 overflow-hidden rounded-2xl bg-slate-900/80 p-4 sm:p-6">
          <div className="relative min-w-0 overflow-hidden">
            <div
              className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 rounded-l-xl bg-gradient-to-r from-slate-800/90 to-transparent"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 rounded-r-xl bg-gradient-to-l from-slate-800/90 to-transparent"
              aria-hidden
            />
            <div className="flex items-center justify-center py-8 sm:py-10">
              <div
                className="flex items-center overflow-hidden"
                style={{
                  width: "100%",
                  maxWidth: `${ITEM_STEP_REM * 3}rem`,
                  maskImage: "linear-gradient(to right, transparent 0%, black 30%, black 70%, transparent 100%)",
                  WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 30%, black 70%, transparent 100%)",
                }}
              >
                <div
                  className="flex items-center"
                  style={{
                    gap: `${GAP_REM}rem`,
                    animation: `hero-marquee ${MARQUEE_DURATION_S}s linear infinite`,
                  }}
                >
                  {[...carouselImages, ...carouselImages].map((src, i) => (
                    <SlideItem key={i} src={src} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <style
        dangerouslySetInnerHTML={{
          __html: `@keyframes hero-marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-${setWidth}rem); } }`,
        }}
      />
    </section>
  );
}
