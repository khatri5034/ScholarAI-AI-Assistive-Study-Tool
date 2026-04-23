"use client";

/**
 * Split auth layout (brand panel + form card) used by login and signup—matches common SaaS patterns.
 */

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { AUTH_CARD } from "@/lib/authUi";

type AuthPageShellProps = {
  variant: "login" | "signup";
  children: ReactNode;
};

export function AuthPageShell({ variant, children }: AuthPageShellProps) {
  const isLogin = variant === "login";

  return (
    <main className="min-h-screen bg-slate-950 pt-16 text-white lg:flex lg:min-h-screen lg:pt-16">
      <aside className="relative hidden min-h-0 overflow-x-hidden overflow-y-auto lg:flex lg:w-[44%] lg:max-w-xl lg:flex-col lg:justify-between lg:border-r lg:border-white/5 lg:px-12 lg:py-14 xl:px-16">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_80%_at_20%_-10%,rgba(139,92,246,0.35),transparent),radial-gradient(ellipse_70%_60%_at_100%_100%,rgba(16,185,129,0.12),transparent)]"
          aria-hidden
        />
        <div className="relative">
          <Link href="/" className="inline-flex items-center gap-3 rounded-xl outline-none ring-violet-400/50 focus-visible:ring-2">
            <span className="flex rounded-xl bg-white/5 p-2 ring-1 ring-white/10">
              <Image src="/scholarai-logo.png" alt="" width={40} height={40} className="h-9 w-auto object-contain" />
            </span>
            <span className="font-display text-lg font-semibold tracking-tight">ScholarAI</span>
          </Link>
          <h2 className="mt-12 font-display text-3xl font-bold leading-tight tracking-tight text-white xl:text-4xl">
            {isLogin ? "Good to see you again." : "I built this around my own PDFs—same idea for you."}
          </h2>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-400">
            {isLogin
              ? "I keep chat, planner, and quizzes on whatever topic you pick, using the files you uploaded. Log in and you’re back in."
              : "I wired it so answers come from what you upload, not random web pages. You’ll need a free account—that’s how I keep your stuff scoped to you."}
          </p>
          <ul className="mt-8 space-y-3 text-sm text-slate-300">
            <li className="flex gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-xs font-bold text-violet-300">
                1
              </span>
              <span>I pull from your uploads when the index exists—no “trust me bro” from the whole internet.</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-300">
                2
              </span>
              <span>Planner and quizzes stay on that same topic so nothing drifts sideways.</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-500/20 text-xs font-bold text-sky-300">
                3
              </span>
              <span>I kept the UI boring on purpose: pick a topic, upload, go.</span>
            </li>
          </ul>
        </div>
        <p className="relative text-xs text-slate-500">
          <Link href="/privacy" className="text-slate-400 underline-offset-2 hover:text-slate-300 hover:underline">
            Privacy
          </Link>
          <span className="mx-2 text-slate-600">·</span>
          <Link href="/" className="text-slate-400 underline-offset-2 hover:text-slate-300 hover:underline">
            Back to home
          </Link>
        </p>
      </aside>

      <div className="flex flex-1 flex-col justify-center px-4 py-10 sm:px-6 sm:py-12 lg:px-12 lg:py-16 xl:px-20">
        <div className="mx-auto w-full max-w-lg min-w-0 sm:max-w-xl">
          <div className="mb-8 lg:hidden">
            <Link href="/" className="inline-flex items-center gap-2.5">
              <Image src="/scholarai-logo.png" alt="" width={36} height={36} className="h-8 w-auto object-contain" />
              <span className="font-display text-lg font-semibold">ScholarAI</span>
            </Link>
          </div>

          <div className={AUTH_CARD}>
            <h1 className="break-words font-display text-2xl font-bold leading-snug tracking-tight text-white sm:text-3xl sm:leading-snug">
              {isLogin ? "Log in" : "Sign up"}
            </h1>
            <p className="mt-3 max-w-prose text-sm leading-relaxed text-slate-400">
              {isLogin
                ? "Google or email + password—whatever you used last time."
                : "Google or email works. After this you’ll pick a topic on Home and start uploading."}
            </p>
            <div className="mt-8 sm:mt-9">{children}</div>
          </div>
        </div>
      </div>
    </main>
  );
}
