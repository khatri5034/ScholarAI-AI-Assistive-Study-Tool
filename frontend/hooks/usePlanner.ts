"use client";

/**
 * usePlanner — Custom hook for study plan creation and fetching.
 * Calls backend /plan API (Planner Agent).
 */
export function usePlanner() {
  // TODO: create plan, fetch plans, update plan
  return {
    plans: [],
    createPlan: async (_params: { subject: string; deadline?: string }) => ({}),
    isLoading: false,
  };
}
