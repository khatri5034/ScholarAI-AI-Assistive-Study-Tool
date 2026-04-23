import { ProfessorDashboard } from "@/components/ProfessorDashboard";

export default function ProfessorPage() {
  return (
    <main className="min-h-screen bg-slate-950 pt-16 pb-24">
      <section className="relative overflow-hidden border-b border-slate-800">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_-10%,rgba(99,102,241,0.12),transparent)]" />
        <div className="relative mx-auto max-w-5xl px-6 py-12">
          <p className="mb-2 text-sm font-medium uppercase tracking-wider text-indigo-400">
            Faculty View
          </p>
          <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Professor Dashboard
          </h1>
          <p className="mt-3 max-w-2xl text-slate-400">
            Monitor student progress and identify learning gaps.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-6 py-12">
        <ProfessorDashboard />
      </div>
    </main>
  );
}
