/**
 * Quiz: uses the same agent pipeline with mode=quiz (RAG + Gemini).
 */

import Link from "next/link";
import { QuizGenerator } from "@/components/QuizGenerator";
import { TopicGuard } from "@/components/TopicGuard";
import { StudyTopicBanner } from "@/components/StudyTopicBanner";

export default function QuizPage() {
  return (
    <TopicGuard>
      <main className="min-h-screen bg-slate-950 pt-16 pb-24">
        <section className="relative overflow-hidden border-b border-slate-800">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_-10%,rgba(245,158,11,0.1),transparent)]" />
          <div className="relative mx-auto max-w-4xl px-6 py-12">
            <p className="mb-2 text-sm font-medium uppercase tracking-wider text-amber-400/90">
              Quiz
            </p>
            <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Drill this topic
            </h1>
            <p className="mt-3 max-w-xl text-slate-400">
              I write questions from what you already indexed. If the quiz feels thin, toss more PDFs on{" "}
              <Link href="/upload" className="font-medium text-amber-200/95 underline-offset-2 hover:text-amber-100 hover:underline">
                Upload
              </Link>{" "}
              and re-run indexing.
            </p>
          </div>
        </section>
        <div className="mx-auto max-w-4xl px-6 py-12">
          <StudyTopicBanner />
          <div className="rounded-2xl border border-slate-800/80 bg-gradient-to-b from-slate-900/70 to-slate-950/90 p-6 shadow-xl shadow-black/25 sm:p-8">
            <QuizGenerator />
          </div>
        </div>
      </main>
    </TopicGuard>
  );
}
