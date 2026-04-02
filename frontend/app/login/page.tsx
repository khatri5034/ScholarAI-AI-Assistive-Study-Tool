/**
 * Dedicated login route with marketing-style hero chrome; keeps / uncluttered for guests vs. signed-in users.
 * Optional `?next=` is a safe internal path used after sign-in (e.g. /upload).
 */

import { Suspense } from "react";
import { LoginForm } from "@/components";

function LoginFormFallback() {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-xl">
      <p className="text-center text-sm text-slate-400">Loading…</p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <>
      <main className="min-h-screen bg-slate-950 pt-16 pb-24">
        <section className="relative overflow-hidden border-b border-slate-800">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_-10%,rgba(99,102,241,0.12),transparent)]" />
          <div className="relative mx-auto max-w-sm px-6 py-10 text-center">
            <p className="mb-2 text-sm font-medium uppercase tracking-wider text-indigo-400">Welcome back</p>
            <h1 className="font-display text-2xl font-bold tracking-tight text-white">Log in</h1>
            <p className="mt-2 text-slate-400">Sign in to your ScholarAI account.</p>
          </div>
        </section>
        <div className="mx-auto max-w-sm px-6 py-12">
          <Suspense fallback={<LoginFormFallback />}>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-xl">
              <LoginForm />
            </div>
          </Suspense>
        </div>
      </main>
    </>
  );
}
