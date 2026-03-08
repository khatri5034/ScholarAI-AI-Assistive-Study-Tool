"use client";

/**
 * useChat — Custom hook for chat state and API calls to backend /chat.
 * Manages messages, loading, and streaming (if supported).
 */
export function useChat() {
  // TODO: connect to backend chat API, manage messages & loading
  return {
    messages: [],
    sendMessage: async (_message: string) => {},
    isLoading: false,
  };
}
