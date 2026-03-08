import Link from "next/link";
import { Navbar, Footer, HeroCarousel } from "@/components";

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-slate-950 pt-16">
        {/* Carousel — right under navbar */}
        <HeroCarousel />

        {/* Hero */}
        <section className="relative overflow-hidden border-b border-slate-800">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(16,185,129,0.15),transparent)]" />
          <div className="relative mx-auto max-w-6xl px-6 py-24 sm:py-32">
            <p className="mb-4 text-sm font-medium uppercase tracking-wider text-emerald-400">
              Agentic Study Assistant
            </p>
            <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl">
              Study smarter with AI that knows your material.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-slate-400">
              Upload your notes and PDFs. Get instant answers, personalized study plans,
              and quizzes—powered by RAG and built for how you learn.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                href="/upload"
                className="rounded-full bg-emerald-500 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400"
              >
                Get started
              </Link>
              <Link
                href="/chat"
                className="rounded-full border border-slate-600 bg-slate-800/50 px-6 py-3 text-base font-semibold text-white transition hover:border-slate-500 hover:bg-slate-800"
              >
                Try chat
              </Link>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="text-center text-2xl font-bold text-white sm:text-3xl">
            Built for serious students
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-center text-slate-400">
            One place to upload, question, and plan—with AI that stays on your content.
          </p>
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: "RAG-powered chat",
                description:
                  "Ask questions in plain English. Answers are grounded in your uploaded PDFs and notes—no hallucination, no guessing.",
                icon: "💬",
              },
              {
                title: "Study planner",
                description:
                  "Generate a realistic schedule by subject and deadline. Break topics into sessions that fit your calendar.",
                icon: "📅",
              },
              {
                title: "Upload & embed",
                description:
                  "Drop in slides, PDFs, and notes. We chunk and embed them so the AI can retrieve exactly what matters.",
                icon: "📁",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 transition hover:border-slate-700 hover:bg-slate-900/80"
              >
                <span className="text-2xl" aria-hidden>{f.icon}</span>
                <h3 className="mt-4 text-lg font-semibold text-white">{f.title}</h3>
                <p className="mt-2 text-sm text-slate-400">{f.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA strip */}
        <section className="border-t border-slate-800 bg-slate-900/30 py-16">
          <div className="mx-auto max-w-6xl px-6 text-center">
            <h2 className="text-2xl font-bold text-white">
              Ready to study with AI?
            </h2>
            <p className="mt-2 text-slate-400">
              Upload your first document and start asking questions in minutes.
            </p>
            <Link
              href="/upload"
              className="mt-6 inline-block rounded-full bg-emerald-500 px-8 py-3 font-semibold text-white transition hover:bg-emerald-400"
            >
              Upload documents
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
