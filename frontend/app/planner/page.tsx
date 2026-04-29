/**
 * Planner surface: requires a topic so future agent output can be labeled and stored consistently.
 */

import { StudyPlanner } from "@/components";
import { TopicGuard } from "@/components/TopicGuard";
import { StudyTopicBanner } from "@/components/StudyTopicBanner";

export default function PlannerPage() {
  return (
    <TopicGuard>
      <main className="min-h-screen bg-slate-950 pt-16 pb-24">
        <section className="relative overflow-hidden border-b border-slate-800">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_-10%,rgba(99,102,241,0.12),transparent)]" />
          <div className="relative mx-auto max-w-5xl px-6 py-12">
            <p className="mb-2 text-sm font-medium uppercase tracking-wider text-indigo-400">
              Study Planner
            </p>
            <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Rough out your term
            </h1>
            <p className="mt-3 max-w-xl text-slate-400">
              I start with a blunt overview + Week 1, then you can ask for deeper weeks when you actually care about
              that unit.
            </p>
          </div>
        </section>
        <div className="mx-auto max-w-5xl px-6 py-12">
          <StudyTopicBanner />
          <StudyPlanner />
        </div>
      </main>
    </TopicGuard>
  );
}
