"use client";

/**
 * Chat UI: signed-in users can call the backend; guests get an explicit “demo” path so
 * we never imply answers come from their (non-existent) uploads.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/services/firebase";

type ChatMessage =
  | { role: "user"; content: string }
  | { role: "system"; content: string; demoCta?: boolean };

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

const DEMO_REPLY_INTRO =
  "This is a demo reply only—it is not grounded in your course materials because you are not signed in and we have no documents from you.";

const DEMO_REPLY_BODY =
  "To get answers drawn from your own PDFs and notes, create an account, upload your files, pick a study topic, and ask again. ScholarAI will retrieve relevant chunks from what you uploaded.";

export function ChatBox() {
  const [input, setInput] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chunks, setChunks] = useState<RetrievedChunk[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null | undefined>(undefined);

  const isGuest = user === null;
  const authResolved = user !== undefined;

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading || !authResolved) return;

    const userMessage: ChatMessage = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setError(null);

    if (isGuest) {
      await new Promise((r) => setTimeout(r, 450));
      setChunks([]);
      setMessages((prev) => [
        ...prev,
        {
          role: "system",
          content: `${DEMO_REPLY_INTRO}\n\n${DEMO_REPLY_BODY}`,
          demoCta: true,
        },
      ]);
      setIsLoading(false);
      return;
    }

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
        throw new Error(
          typeof (data as { detail?: string }).detail === "string"
            ? (data as { detail: string }).detail
            : "Chat request failed."
        );
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
            content:
              "I couldn't find any relevant chunks yet. Try uploading more PDFs from the Upload page or rephrasing your question.",
          },
        ]);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong while querying the chat API.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50 transition hover:border-slate-700">
      <div className="flex items-center gap-3 border-b border-slate-800 px-6 py-4">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400"
          aria-hidden
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold text-white">Study Chat</h2>
          <p className="text-sm text-slate-400">
            {isGuest
              ? "Demo mode — replies are examples and are not tied to your materials."
              : "Ask questions about your course material. We retrieve relevant chunks from your uploads when the chat API is connected."}
          </p>
        </div>
      </div>

      {isGuest && (
        <div className="border-b border-amber-500/20 bg-amber-500/10 px-6 py-3">
          <p className="text-sm text-amber-100/95">
            You&apos;re trying the chat without an account. Answers here are{" "}
            <span className="font-semibold text-amber-50">not grounded</span> in your documents.
          </p>
        </div>
      )}

      <div className="min-h-[280px] flex-1 p-6">
        <div className="flex h-full flex-col gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex-1 space-y-3 overflow-y-auto rounded-lg bg-slate-950/40 p-3">
            {!authResolved && (
              <p className="text-sm text-slate-500">Checking session…</p>
            )}
            {authResolved && messages.length === 0 && (
              <p className="text-sm text-slate-500">
                {isGuest ? (
                  <>
                    Ask anything to see how chat feels. For real answers from{" "}
                    <span className="text-slate-300">your</span> files, sign up and upload documents first.
                  </>
                ) : (
                  <>
                    Ask something that might appear in your uploaded PDFs, like{" "}
                    <span className="text-slate-300">&quot;What are the main topics in Lecture 3?&quot;</span>
                  </>
                )}
              </p>
            )}
            {messages.map((m, idx) => (
              <div key={idx} className={m.role === "user" ? "flex justify-end" : "flex flex-col items-start"}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-indigo-500/80 text-white"
                      : "bg-slate-800 text-slate-100"
                  }`}
                >
                  {m.content}
                </div>
                {m.role === "system" && m.demoCta && (
                  <div className="mt-2 max-w-[85%]">
                    <Link
                      href="/signup?next=%2Fupload"
                      className="inline-flex items-center rounded-full bg-violet-500 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-violet-500/25 transition hover:bg-violet-400"
                    >
                      Sign up &amp; upload documents
                    </Link>
                  </div>
                )}
              </div>
            ))}
          </div>
          {!isGuest && chunks.length > 0 && (
            <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/60 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Retrieved Chunks (preview)
              </p>
              <ul className="max-h-48 space-y-2 overflow-y-auto text-xs text-slate-300">
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
        {!isGuest && (
          <div className="mb-3 flex gap-3">
            <input
              type="text"
              placeholder="Optional document ID filter (paste from upload)"
              className="flex-1 rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
              value={documentId}
              onChange={(e) => setDocumentId(e.target.value)}
            />
          </div>
        )}
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            placeholder={isGuest ? "Try a sample question…" : "Ask a question about your notes…"}
            className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-3 text-white placeholder-slate-500 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!authResolved}
          />
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={isLoading || !input.trim() || !authResolved}
            className="rounded-xl bg-indigo-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:bg-slate-700"
          >
            {isLoading ? "…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
