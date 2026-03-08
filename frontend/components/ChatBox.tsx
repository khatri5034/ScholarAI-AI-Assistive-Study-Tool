"use client";

/**
 * ChatBox — Main chat UI for Q&A with course material (RAG).
 * Connects to backend /chat API.
 */
export function ChatBox() {
  return (
    <div className="flex flex-col rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden transition hover:border-slate-700">
      <div className="flex items-center gap-3 border-b border-slate-800 px-6 py-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400" aria-hidden>
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </span>
        <div>
          <h2 className="font-display text-lg font-semibold text-white">Study Chat</h2>
          <p className="text-sm text-slate-400">Ask questions about your course material. Backend /chat will connect here.</p>
        </div>
      </div>
      <div className="min-h-[280px] flex-1 p-6">
        <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-800/30 p-8 text-center">
          <p className="text-slate-500">Messages will appear here. Connect your backend to start chatting.</p>
        </div>
      </div>
      <div className="border-t border-slate-800 p-4">
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Ask a question about your notes..."
            className="flex-1 rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-3 text-white placeholder-slate-500 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
          />
          <button
            type="button"
            className="rounded-xl bg-indigo-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
