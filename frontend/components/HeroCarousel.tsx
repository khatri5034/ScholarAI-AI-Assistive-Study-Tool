"use client";

import { useState, useEffect, useRef } from "react";

const slides = [
  (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-20 sm:size-24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
    </svg>
  ),
  (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-20 sm:size-24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0V12a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 12V5.25" />
    </svg>
  ),
  (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-20 sm:size-24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" />
    </svg>
  ),
  (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-20 sm:size-24">
      <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
    </svg>
  ),
  (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-20 sm:size-24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.905 59.905 0 0 1 12 3.493a59.902 59.902 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5" />
    </svg>
  ),
  (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-20 sm:size-24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
    </svg>
  ),
  (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-20 sm:size-24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    </svg>
  ),
];

const AUTO_ADVANCE_MS = 3500;
const SLIDE_DURATION_MS = 500;

export function HeroCarousel() {
  const [index, setIndex] = useState(0);
  const [noTransition, setNoTransition] = useState(false);
  const count = slides.length;
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => i + 1);
    }, AUTO_ADVANCE_MS);
    return () => clearInterval(id);
  }, []);

  // When we land on the cloned first slide (index === count), jump back to 0 without animation
  useEffect(() => {
    if (index !== count) return;
    const t = setTimeout(() => {
      setNoTransition(true);
      setIndex(0);
    }, SLIDE_DURATION_MS);
    return () => clearTimeout(t);
  }, [index, count]);

  useEffect(() => {
    if (!noTransition) return;
    const raf = requestAnimationFrame(() => setNoTransition(false));
    return () => cancelAnimationFrame(raf);
  }, [noTransition]);

  const displayIndex = index > count ? 0 : index;
  const visibleIndex = displayIndex % count;

  return (
    <section className="border-b border-slate-800 bg-slate-900/40 py-10">
      <div className="mx-auto max-w-4xl px-4">
        <p className="mb-8 text-center text-lg font-medium tracking-wide text-emerald-400/90 sm:text-xl">
          Knowledge begins from here
        </p>
        <div className="relative overflow-hidden rounded-2xl bg-slate-800/40">
          <div
            ref={trackRef}
            className="flex"
            style={{
              transform: `translateX(-${displayIndex * 100}%)`,
              transition: noTransition ? "none" : `transform ${SLIDE_DURATION_MS}ms ease-out`,
            }}
          >
            {slides.map((icon, i) => (
              <div
                key={i}
                className="flex min-w-full flex-shrink-0 items-center justify-center py-10 sm:py-12"
                style={{ width: "100%" }}
              >
                <div className="flex size-28 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400/90 shadow-inner sm:size-36">
                  {icon}
                </div>
              </div>
            ))}
            {/* Clone first slide for seamless loop */}
            <div
              className="flex min-w-full flex-shrink-0 items-center justify-center py-10 sm:py-12"
              style={{ width: "100%" }}
            >
              <div className="flex size-28 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400/90 shadow-inner sm:size-36">
                {slides[0]}
              </div>
            </div>
          </div>
        </div>
        {/* Minimal dot indicators */}
        <div className="mt-5 flex justify-center gap-1.5" aria-hidden>
          {slides.map((_, i) => (
            <span
              key={i}
              className={`block h-1.5 w-1.5 rounded-full transition-all duration-300 ${i === visibleIndex ? "bg-emerald-500/80 scale-125" : "bg-slate-600/60"}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
