"use client";

/**
 * Planner shell: structured UI now, backend agent later. Separated from Chat so study
 * scheduling can evolve without entangling RAG message threads.
 */
export function StudyPlanner() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 transition hover:border-slate-700">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400" aria-hidden>
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </span>
          <div>
            <h2 className="font-display text-lg font-semibold text-white">Generate a plan</h2>
            <p className="text-sm text-slate-400">Describe your subjects and deadlines. Backend /plan will connect here.</p>
          </div>
        </div>
        <div className="mt-6">
          <label htmlFor="planner-input" className="sr-only">What do you want to plan?</label>
          <textarea
            id="planner-input"
            placeholder="e.g. CS 101 final in 2 weeks, 5 chapters to cover..."
            rows={3}
            className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-3 text-white placeholder-slate-500 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
          />
          <button
            type="button"
            className="mt-4 rounded-full bg-indigo-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:bg-indigo-400"
          >
            Generate plan
          </button>
        </div>
      </div>
      <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-6">
        <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-indigo-400/90">Your schedule</h3>
        <p className="mt-4 text-center text-slate-500">Your generated plan will appear here after you connect the backend.</p>
      </div>
    </div>
  );
}
