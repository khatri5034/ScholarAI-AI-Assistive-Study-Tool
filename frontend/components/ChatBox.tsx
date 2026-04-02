"use client";

/**
 * Chat UI calling the RAG backend. Topic-aware requests stay aligned with per-topic
 * indexes on the server when the API accepts a `topic` field.
 */

import { useState } from "react";

type ChatMessage = {
  role: "user" | "system";
  content: string;
};

type RetrievedChunk = {
  document_id: string;
  segment_id?: string | null;
  summary?: string | null;
  metadata?: Record<string, unknown> | null;
};

type ChatApiResponse = {
  query: string;
  chunks: RetrievedChunk[];
  answer: string;
};

/**
 * ChatBox — Main chat UI for Q&A with course material (RAG).
 * Connects to backend /api/chat and shows retrieved chunks.
 */
export function ChatBox() {
  const [input, setInput] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chunks, setChunks] = useState<RetrievedChunk[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMessage: ChatMessage = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setError(null);

    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
      const cleanDocumentId = documentId.trim().replace(/\.$/, "") || null;
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: trimmed,
          top_k: 5,
          document_id: cleanDocumentId,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Chat request failed.");
      }

      const data: ChatApiResponse = await res.json();
      setChunks(data.chunks ?? []);

      const answerText = data.answer?.trim();
      if (answerText) {
        setMessages((prev) => [...prev, { role: "system", content: answerText }]);
      } else if (!data.chunks?.length) {
        setMessages((prev) => [
          ...prev,
          {
            role: "system",
            content: "I couldn't find any relevant chunks yet. Try uploading more PDFs or rephrasing.",
          },
        ]);
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong while querying /api/chat.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden transition hover:border-slate-700">
      <div className="flex items-center gap-3 border-b border-slate-800 px-6 py-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400" aria-hidden>
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
        </span>
        <div>
          <h2 className="font-display text-lg font-semibold text-white">Study Chat</h2>
          <p className="text-sm text-slate-400">
            Ask questions about your course material. We&apos;ll retrieve the most relevant chunks from your uploads.
          </p>
        </div>
      </div>
      <div className="min-h-[280px] flex-1 p-6">
        <div className="flex h-full flex-col gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex-1 space-y-3 overflow-y-auto rounded-lg bg-slate-950/40 p-3">
            {messages.length === 0 && (
              <p className="text-sm text-slate-500">
                Start by asking something that appears in your uploaded PDFs, like{" "}
                <span className="text-slate-300">&quot;What are the main topics in Lecture 3?&quot;</span>
              </p>
            )}
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                  m.role === "user"
                    ? "ml-auto bg-indigo-500/80 text-white"
                    : "mr-auto bg-slate-800 text-slate-100"
                }`}
              >
                {m.content}
              </div>
            ))}
          </div>
          {chunks.length > 0 && (
            <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/60 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Retrieved Chunks (preview)
              </p>
              <ul className="space-y-2 max-h-48 overflow-y-auto text-xs text-slate-300">
                {chunks.map((c, i) => (
                  <li key={`${c.document_id}-${c.segment_id}-${i}`} className="rounded-md bg-slate-900/80 p-2">
                    <p className="line-clamp-3">{c.summary}</p>
                    <p className="mt-1 text-[10px] text-slate-500">
                      doc {c.document_id.slice(0, 8)}… • segment {c.segment_id ?? "?"} • page{" "}
                      {typeof c.metadata?.page_index === "number" ? c.metadata.page_index : "?"}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {error && <p className="text-xs text-rose-400">{error}</p>}
        </div>
      </div>
      <div className="border-t border-slate-800 p-4">
        <div className="mb-3 flex gap-3">
          <input
            type="text"
            placeholder="Optional document ID filter (paste from upload)"
            className="flex-1 rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
            value={documentId}
            onChange={(e) => setDocumentId(e.target.value)}
          />
        </div>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Ask a question about your notes..."
            className="flex-1 rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-3 text-white placeholder-slate-500 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="rounded-xl bg-indigo-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:bg-slate-700"
          >
            {isLoading ? "Searching…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
