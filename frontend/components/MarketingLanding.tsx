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
        <div className="relative mx-auto flex max-w-6xl flex-col px-6 py-12 md:py-16">
          <div className="mb-8 w-full md:mb-10">
            <HeroCarousel compact />
          </div>
          <div className="flex flex-col gap-10 md:flex-row md:items-center">
            <div className="max-w-xl space-y-6">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300/80">
              ScholarAI • side project, student brain
            </p>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
              I got tired of generic AI answers, so I wired this to{" "}
              <span className="bg-gradient-to-r from-violet-400 via-emerald-300 to-violet-300 bg-clip-text text-transparent">
                your own PDFs
              </span>
            </h1>
            <p className="text-base text-slate-300 md:text-lg">
              Upload → ask messy questions → I answer from what you actually uploaded, not random blogs.
            </p>
            <p className="text-sm text-slate-400">
              You need a free account for chat, planner, and quiz—I didn’t ship anonymous mode for those.
            </p>
            <div className="flex flex-wrap gap-4 pt-2">
              <Link
                href="/signup?next=%2Fupload"
                className="rounded-full bg-violet-500 px-7 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/30 transition hover:bg-violet-400"
              >
                Create free account
              </Link>
              <Link
                href="/login?next=%2F"
                className="rounded-full border border-slate-700 bg-slate-900/70 px-7 py-3 text-sm font-semibold text-slate-100 transition hover:border-slate-500 hover:bg-slate-900"
              >
                Log in
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
                      I scan the Lecture 5 PDF you uploaded and spit back a short summary with the stuff professors
                      love to put on exams.
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
        </div>
      </section>

      <section className="border-b border-slate-800 bg-slate-950 py-12">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center text-2xl font-bold sm:text-3xl">How it works</h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-sm text-slate-400 sm:text-base">
            Three steps—no workshop required.
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
            What I actually use it for
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
              <h3 className="text-sm font-semibold text-slate-100">Ask anything from your notes</h3>
              <p className="mt-2 text-xs text-slate-400">
                If it isn&apos;t in your uploads, I don&apos;t pretend it is—I&apos;ll say I&apos;m guessing.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
              <h3 className="text-sm font-semibold text-slate-100">Show your work (kinda)</h3>
              <p className="mt-2 text-xs text-slate-400">
                I surface which chunks I read so you can skim the PDF and verify me.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
              <h3 className="text-sm font-semibold text-slate-100">Messy-term planner</h3>
              <p className="mt-2 text-xs text-slate-400">
                Tell me how chaotic the next few weeks are—I try to break it into weeks you can survive.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
              <h3 className="text-sm font-semibold text-slate-100">Instant quizzes for practice</h3>
              <p className="mt-2 text-xs text-slate-400">
                I spit out practice questions from the same files so you aren&apos;t studying the wrong deck.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-800 bg-slate-950 py-16">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center text-2xl font-bold sm:text-3xl">
            Fake transcript so you get the vibe
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
                  Want a tiny quiz from the same PDF? I can draft one if you ask.
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
          <h2 className="text-2xl font-bold sm:text-3xl">Why I bothered building it</h2>
          <ul className="mx-auto mt-4 max-w-xl list-disc space-y-2 text-left text-sm text-slate-300 sm:text-base">
            <li>I stay inside whatever you uploaded instead of inventing facts from Reddit.</li>
            <li>I show which file chunks I leaned on so you can call me out if I drift.</li>
            <li>Planner + quiz live on the same topic label—so the workflow doesn’t fall apart midterm week.</li>
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

      <section className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 py-16">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-2xl font-bold sm:text-3xl">Want in?</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-300 sm:text-base">
            Upload one messy PDF and see if the answers feel closer to office hours than a random chatbot.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              href="/signup?next=%2Fupload"
              className="inline-flex items-center justify-center rounded-full bg-violet-500 px-10 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/30 transition hover:bg-violet-400"
            >
              Create free account
            </Link>
            <Link
              href="/login?next=%2F"
              className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-900/80 px-8 py-3 text-sm font-semibold text-slate-100 transition hover:border-slate-500 hover:bg-slate-900"
            >
              Log in
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
