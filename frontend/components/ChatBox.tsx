"use client";

/**
 * ChatBox — Main chat UI for Q&A with course material (RAG).
 * Connects to backend /chat API.
 */
export function ChatBox() {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
      <h2 className="text-lg font-semibold text-white">Study Chat</h2>
      <p className="text-sm text-slate-400">Ask questions about your course material.</p>
      {/* Chat messages & input will go here */}
    </div>
  );
}
