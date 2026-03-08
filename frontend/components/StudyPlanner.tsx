"use client";

/**
 * StudyPlanner — UI for creating and viewing study plans.
 * Uses Planner Agent via backend /plan API.
 */
export function StudyPlanner() {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
      <h2 className="text-lg font-semibold text-white">Study Planner</h2>
      <p className="text-sm text-slate-400">Generate and manage your study schedule.</p>
    </div>
  );
}
