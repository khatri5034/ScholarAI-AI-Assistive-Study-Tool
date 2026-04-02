"use client";

/**
 * Long-form landing for visitors: kept separate from `HomePageClient` because Server
 * Components cannot import client hooks, and this block is entirely static marketing + carousel.
 */

import Link from "next/link";
import { HeroCarousel } from "./HeroCarousel";

export function MarketingLanding() {
  return (
    <main className="min-h-screen bg-slate-950 pt-16 text-white">
      <section className="relative border-b border-slate-800">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(129,140,248,0.3),_transparent_60%),radial-gradient(circle_at_bottom_left,_rgba(16,185,129,0.2),_transparent_55%)]" />
        <div className="relative mx-auto flex max-w-6xl flex-col gap-10 px-6 py-16 md:flex-row md:items-center md:py-20">
          <div className="max-w-xl space-y-6">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300/80">
              ScholarAI • Built for students
            </p>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
              Study smarter with{" "}
              <span className="bg-gradient-to-r from-violet-400 via-emerald-300 to-violet-300 bg-clip-text text-transparent">
                your own materials
              </span>
            </h1>
            <p className="text-base text-slate-300 md:text-lg">
              Upload PDFs and notes → ask questions → get grounded answers in seconds.
            </p>
            <div className="flex flex-wrap gap-4 pt-2">
              <Link
                href="/upload"
                className="rounded-full bg-violet-500 px-7 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/30 transition hover:bg-violet-400"
              >
                Upload &amp; Start
              </Link>
              <Link
                href="/chat"
                className="rounded-full border border-slate-700 bg-slate-900/70 px-7 py-3 text-sm font-semibold text-slate-100 transition hover:border-slate-500 hover:bg-slate-900"
              >
                Try Demo Chat
              </Link>
            </div>
            <p className="text-xs text-slate-400 sm:text-sm">
              Built for students. Built for accuracy.
            </p>
          </div>

          <div className="flex flex-1 justify-center md:justify-end">
            <div className="relative w-full max-w-md">
              <div className="absolute -inset-1 rounded-3xl bg-gradient-to-tr from-violet-500/40 via-emerald-400/25 to-sky-500/20 blur-2xl" />
              <div className="relative overflow-hidden rounded-3xl border border-slate-700/80 bg-slate-950/80 p-6 shadow-2xl backdrop-blur-xl">
                <div className="space-y-4">
                  <div className="rounded-2xl bg-slate-900/70 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Study Session
                    </p>
                    <p className="mt-2 text-sm text-slate-100">
                      “Summarize the key ideas from Lecture 5 for tomorrow&apos;s quiz.”
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-900/70 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300/80">
                      ScholarAI
                    </p>
                    <p className="mt-2 text-xs text-slate-200">
                      ScholarAI scans your uploaded Lecture 5 notes and returns a short, grounded summary with
                      the most testable points.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[10px] text-slate-300">
                    <span className="rounded-full bg-slate-900 px-3 py-1">Upload PDFs</span>
                    <span className="rounded-full bg-slate-900 px-3 py-1">Ask natural questions</span>
                    <span className="rounded-full bg-slate-900 px-3 py-1">Get grounded answers</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-800 bg-slate-950 py-12">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center text-2xl font-bold sm:text-3xl">How it works</h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-sm text-slate-400 sm:text-base">
            A simple flow anyone can understand in seconds.
          </p>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Step 1</p>
              <h3 className="mt-2 text-sm font-semibold text-slate-100">Upload your materials</h3>
              <p className="mt-2 text-xs text-slate-400">
                Drop in PDFs, slides, and notes from your courses.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Step 2</p>
              <h3 className="mt-2 text-sm font-semibold text-slate-100">Ask questions naturally</h3>
              <p className="mt-2 text-xs text-slate-400">
                Type like you speak—no prompts or setup required.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Step 3</p>
              <h3 className="mt-2 text-sm font-semibold text-slate-100">Get answers, plan, quizzes</h3>
              <p className="mt-2 text-xs text-slate-400">
                See grounded answers plus a study plan and instant practice.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-800 bg-slate-950 py-16">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center text-2xl font-bold sm:text-3xl">
            Everything you need to actually study
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
              <h3 className="text-sm font-semibold text-slate-100">Ask anything from your notes</h3>
              <p className="mt-2 text-xs text-slate-400">
                Every answer comes from the materials you&apos;ve uploaded—not the open web.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
              <h3 className="text-sm font-semibold text-slate-100">Grounded answers you can trust</h3>
              <p className="mt-2 text-xs text-slate-400">
                ScholarAI cites where it looked, so you can double‑check every response.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
              <h3 className="text-sm font-semibold text-slate-100">Study plan from your deadlines</h3>
              <p className="mt-2 text-xs text-slate-400">
                Enter exam dates and get a realistic plan broken into sessions.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
              <h3 className="text-sm font-semibold text-slate-100">Instant quizzes for practice</h3>
              <p className="mt-2 text-xs text-slate-400">
                Generate practice questions from your documents to test understanding quickly.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-800 bg-slate-950 py-16">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center text-2xl font-bold sm:text-3xl">
            See what studying with ScholarAI feels like
          </h2>
          <div className="mx-auto mt-8 max-w-2xl space-y-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
            <div className="flex gap-3">
              <div className="mt-1 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/90 text-sm font-semibold text-slate-950">
                U
              </div>
              <div className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm text-slate-100">
                I&apos;m confused about Lecture 5 on neural networks. What should I focus on for the exam?
              </div>
            </div>
            <div className="flex gap-3">
              <div className="mt-1 flex h-7 w-7 items-center justify-center rounded-full bg-violet-500/90 text-sm font-semibold text-slate-50">
                AI
              </div>
              <div className="space-y-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm text-slate-100">
                <p>
                  Focus on the definitions of perceptrons, activation functions, and how forward and backward passes
                  work. Pay special attention to the example in Section 3 where gradient descent is applied to a
                  two‑layer network.
                </p>
                <p className="text-[11px] text-slate-400">
                  I can also create a short quiz from this lecture if you want to check your understanding.
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1 text-[10px] text-slate-400">
                  <span className="rounded-full bg-slate-950/80 px-2.5 py-1">Sources used:</span>
                  <span className="rounded-full bg-slate-950/80 px-2.5 py-1">
                    Lecture 5 – Neural Networks.pdf
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-800 bg-slate-950 py-12">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-2xl font-bold sm:text-3xl">More than “just another chatbot”</h2>
          <ul className="mx-auto mt-4 max-w-xl list-disc space-y-2 text-left text-sm text-slate-300 sm:text-base">
            <li>Stays on your course material instead of guessing from the internet.</li>
            <li>Cites what it used so you can verify every answer.</li>
            <li>Helps you organize studying—not just give one‑off replies.</li>
          </ul>
        </div>
      </section>

      <section className="border-b border-slate-800 bg-slate-950/80 py-8">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-6 text-sm text-slate-200 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Trust &amp; Safety</p>
          <div className="flex flex-wrap gap-3 text-xs text-slate-300">
            <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1">Your files are private</span>
            <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1">
              You control what you upload
            </span>
            <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1">Delete anytime</span>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-800 bg-slate-950">
        <HeroCarousel />
      </section>

      <section className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 py-16">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-2xl font-bold sm:text-3xl">Ready to study faster?</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-300 sm:text-base">
            Upload your first document and let ScholarAI turn it into clear answers, structured plans, and quick
            quizzes.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              href="/upload"
              className="inline-flex items-center justify-center rounded-full bg-violet-500 px-10 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/30 transition hover:bg-violet-400"
            >
              Upload your first document
            </Link>
            <Link
              href="/chat"
              className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-900/80 px-8 py-3 text-sm font-semibold text-slate-100 transition hover:border-slate-500 hover:bg-slate-900"
            >
              Try demo
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
