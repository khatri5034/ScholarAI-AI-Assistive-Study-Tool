"use client";

/**
 * Placeholder for planner API wiring: StudyPlanner is still mostly static UI until /plan
 * is connected; this hook will own loading and plan list state when you hook it up.
 */
export function usePlanner() {
  // TODO: create plan, fetch plans, update plan
  return {
    plans: [],
    createPlan: async (_params: { subject: string; deadline?: string }) => ({}),
    isLoading: false,
  };
}
