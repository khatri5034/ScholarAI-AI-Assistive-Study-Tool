"use client";

/**
 * Placeholder hook: ChatBox currently talks to RAG directly. When you unify on one API,
 * move message state and streaming here so pages stay thin.
 */
export function useChat() {
  // TODO: connect to backend chat API, manage messages & loading
  return {
    messages: [],
    sendMessage: async (_message: string) => {},
    isLoading: false,
  };
}
