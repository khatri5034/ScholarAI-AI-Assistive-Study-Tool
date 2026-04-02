/**
 * Quiz placeholder: same topic context as other study tools until quiz generation API exists.
 */

import Link from "next/link";
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
              Practice for your topic
            </h1>
            <p className="mt-3 max-w-xl text-slate-400">
              Generate and take quizzes from your uploaded materials. Wire this page to your backend when quiz
              generation is ready.
            </p>
          </div>
        </section>
        <div className="mx-auto max-w-4xl px-6 py-12">
          <StudyTopicBanner />
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-8 text-center">
            <p className="text-slate-300">
              Quiz generation for your current study topic will appear here. Upload documents in{" "}
              <Link href="/upload" className="text-violet-400 hover:text-violet-300">
                Upload
              </Link>{" "}
              first, then connect your API to surface questions.
            </p>
          </div>
        </div>
      </main>
    </TopicGuard>
  );
}
