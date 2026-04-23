"use client";

/**
 * Chat UI: signed-in users call the multi-agent backend (`POST /agents/run`) with
 * Firebase uid + current study topic for RAG-grounded replies when an index exists.
 * Last 25 messages persist in localStorage per signed-in user (guests see sign-in CTAs only).
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/services/firebase";
import { api } from "@/services/api";
import { useStudyTopic } from "@/contexts/StudyTopicContext";
import { ChatMessages } from "@/components/ChatMessages";

type ChatMessage =
  | { role: "user"; content: string }
  | { role: "system"; content: string };

const CHAT_LS_KEY = "scholarai_chat_history";
const CHAT_MAX = 25;

const QUICK_PROMPTS = [
  "Summarize the 5 biggest ideas I should know from my materials.",
  "What should I study first if I only have 2 hours?",
  "Explain one hard concept from my notes in simple terms.",
] as const;

type ChatStored = {
  v: 1;
  userKey: string;
  byTopic: Record<string, ChatMessage[]>;
};

function chatStorageKey(isGuest: boolean, uid: string | undefined): string {
  return isGuest ? "guest" : uid ?? "guest";
}

function topicStorageKey(topic: string | null | undefined): string {
  const t = (topic ?? "").trim().toLowerCase();
  return t || "__no_topic__";
}

function readChatHistory(expectedUserKey: string, topicKey: string): ChatMessage[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CHAT_LS_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<ChatStored> & {
      messages?: ChatMessage[];
    };
    if (data.v !== 1 || data.userKey !== expectedUserKey) {
      return null;
    }
    // Backward-compat: old schema used a single `messages` array.
    if (Array.isArray(data.messages)) {
      return data.messages.slice(-CHAT_MAX);
    }
    const byTopic = data.byTopic;
    if (!byTopic || typeof byTopic !== "object" || !Array.isArray(byTopic[topicKey])) {
      return null;
    }
    return byTopic[topicKey].slice(-CHAT_MAX);
  } catch {
    return null;
  }
}

function writeChatHistory(userKey: string, topicKey: string, messages: ChatMessage[]) {
  if (typeof window === "undefined") return;
  try {
    const previousRaw = localStorage.getItem(CHAT_LS_KEY);
    const previousByTopic: Record<string, ChatMessage[]> = {};
    if (previousRaw) {
      const parsed = JSON.parse(previousRaw) as Partial<ChatStored> & {
        messages?: ChatMessage[];
      };
      if (parsed.v === 1 && parsed.userKey === userKey && parsed.byTopic && typeof parsed.byTopic === "object") {
        for (const [k, v] of Object.entries(parsed.byTopic)) {
          if (Array.isArray(v)) previousByTopic[k] = v.slice(-CHAT_MAX);
        }
      }
    }
    const payload: ChatStored = {
      v: 1,
      userKey,
      byTopic: {
        ...previousByTopic,
        [topicKey]: messages.slice(-CHAT_MAX),
      },
    };
    localStorage.setItem(CHAT_LS_KEY, JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

export function ChatBox() {
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const [uploadSuccessToast, setUploadSuccessToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const { studyTopic, authReady, topicReady } = useStudyTopic();
  const [expanded, setExpanded] = useState(false);

  const isGuest = user === null;
  const authResolved = user !== undefined;

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authResolved || isGuest) return;
    const id = requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [authResolved, isGuest]);

  useEffect(() => {
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useLayoutEffect(() => {
    if (!authResolved) return;
    if (isGuest) {
      setMessages([]);
      return;
    }
    const key = chatStorageKey(false, user?.uid);
    const topicKey = topicStorageKey(studyTopic);
    const stored = readChatHistory(key, topicKey);
    if (stored && stored.length > 0) {
      setMessages(stored);
    } else {
      setMessages([]);
    }
  }, [authResolved, isGuest, user?.uid, studyTopic]);

  useEffect(() => {
    if (!authResolved || isGuest) return;
    const key = chatStorageKey(false, user?.uid);
    const topicKey = topicStorageKey(studyTopic);
    if (messages.length === 0) return;
    writeChatHistory(key, topicKey, messages);
  }, [messages, authResolved, isGuest, user?.uid, studyTopic]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (trimmed === "" || isLoading || !authResolved || isGuest) return;

    const userMessage: ChatMessage = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setError(null);

    if (!studyTopic?.trim()) {
      setMessages((prev) => [
        ...prev,
        {
          role: "system",
          content:
            "Choose a study topic on Home first so we know which materials to search.",
        },
      ]);
      setIsLoading(false);
      return;
    }

    try {
      const data = await api.runAgent({
        message: trimmed,
        userId: user!.uid,
        topic: studyTopic,
        // Study Chat = answer_agent so RAG context is used (see multi_agents.answer_agent).
        mode: "answer",
      });

      const answerText = data.answer?.trim();
      if (answerText) {
        setMessages((prev) => [...prev, { role: "system", content: answerText }]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "system",
            content: "No answer returned. Try again or check that your API key and quota are valid.",
          },
        ]);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "That request died on my side—try again?");
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

  const topicOk = Boolean(studyTopic?.trim());
  const handlePickFiles = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files;
    if (!picked?.length) return;
    const incoming = Array.from(picked);
    e.target.value = "";
    if (isUploadingFiles || !user?.uid || !studyTopic?.trim()) return;
    setIsUploadingFiles(true);
    setError(null);
    try {
      const result = await api.uploadFilesForTopic({
        files: incoming,
        userId: user.uid,
        topic: studyTopic.trim(),
      });
      const names = result.uploaded.length ? result.uploaded.join(", ") : `${incoming.length} file(s)`;
      setUploadSuccessToast(`Uploaded ${names} · Indexed ${result.indexed_chunks} chunks`);
      window.setTimeout(() => {
        setUploadSuccessToast((curr) => (curr ? null : curr));
      }, 2600);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "File upload failed.");
    } finally {
      setIsUploadingFiles(false);
    }
  }, [isUploadingFiles, user?.uid, studyTopic]);

  const copyMessage = useCallback(async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      window.setTimeout(() => setCopiedIndex((c) => (c === index ? null : c)), 1600);
    } catch {
      setError("Clipboard blocked—copy it manually.");
    }
  }, []);

  const editUserMessage = useCallback((content: string, index: number) => {
    setInput(content);
    setMessages((prev) => prev.slice(0, index));
    setError(null);
  }, []);

  const editAssistantIntoInput = useCallback((content: string) => {
    setInput(content);
    setError(null);
  }, []);

  const chatInner = (
    <div
      className={`relative flex flex-col overflow-hidden border border-white/10 bg-gradient-to-b from-slate-900/95 to-slate-950 shadow-2xl shadow-black/40 ring-1 ring-white/5 ${
        expanded ? "rounded-none" : "rounded-2xl transition hover:ring-indigo-500/15"
      }`}
      style={expanded ? { position: "fixed", top: 64, left: 0, right: 0, bottom: 0, zIndex: 9999, backgroundColor: "#020617" } : {}}
    >
      {/* toast */}
      {uploadSuccessToast && (
        <div className="pointer-events-none absolute right-4 top-4 z-20 rounded-lg border border-emerald-400/30 bg-emerald-500/15 px-3 py-2 text-xs font-medium text-emerald-100 shadow-lg shadow-emerald-900/20 backdrop-blur-sm">
          {uploadSuccessToast}
        </div>
      )}

      {/* header */}
      <div className="flex items-center gap-3 border-b border-slate-800/80 bg-slate-900/40 px-6 py-4 backdrop-blur-sm">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/25 text-indigo-300 ring-1 ring-indigo-400/20" aria-hidden>
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-semibold tracking-tight text-white">Chat</h2>
          <p className="text-sm text-slate-400">
            {isGuest
              ? "I don't run without a login—then I only read what you uploaded for each topic."
              : "Whatever topic you picked + whatever you uploaded is what I search."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="ml-auto shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-800/80 text-slate-400 transition hover:border-indigo-500/50 hover:text-indigo-300"
          aria-label={expanded ? "Collapse chat" : "Expand chat"}
          title={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? (
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 3v3a2 2 0 01-2 2H3m18 0h-3a2 2 0 01-2-2V3m0 18v-3a2 2 0 012-2h3M3 16h3a2 2 0 012 2v3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 3h6m0 0v6m0-6l-7 7M9 21H3m0 0v-6m0 6l7-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      </div>

      {/* banners */}
      {isGuest && (
        <div className="border-b border-indigo-500/20 bg-indigo-500/10 px-6 py-3">
          <p className="text-sm text-indigo-100/95">Log in first—after that I stick to your uploads for the active topic.</p>
        </div>
      )}
      {!isGuest && authReady && topicReady && !topicOk && (
        <div className="border-b border-rose-500/20 bg-rose-500/10 px-6 py-3">
          <p className="text-sm text-rose-100/95">
            Pick a study topic on{" "}
            <Link href="/" className="font-semibold underline underline-offset-2">Home</Link>{" "}
            first—I won't guess which class this is.
          </p>
        </div>
      )}

      {/* messages */}
      <div className="min-h-[300px] flex-1 overflow-hidden p-5 sm:p-6">
        <div className="flex h-full flex-col gap-4 rounded-xl border border-slate-800/80 bg-slate-950/35 p-4 ring-1 ring-black/20">
          <div className="flex-1 space-y-3 overflow-y-auto rounded-lg bg-slate-950/50 p-3 sm:p-4 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-slate-900 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-600 hover:[&::-webkit-scrollbar-thumb]:bg-slate-500">
            {!authResolved && <p className="text-sm text-slate-500">Checking if you're signed in…</p>}
            {authResolved && messages.length === 0 && (
              <div className="animate-fade-in-up space-y-4 py-2">
                <p className="text-sm text-slate-400">
                  {isGuest ? (
                    <>Make an account (or log in), upload on Upload, then set the topic on Home—I'm useless until then.</>
                  ) : (
                    <>Ask me something about <span className="font-medium text-slate-200">{studyTopic || "this topic"}</span>, or steal one of the starters below.</>
                  )}
                </p>
                {isGuest && (
                  <div className="flex flex-wrap gap-3 pt-1">
                    <Link href="/login?next=%2Fchat" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-600 bg-slate-800/90 px-5 py-2.5 text-sm font-semibold text-white transition hover:border-slate-500 hover:bg-slate-800">Log in</Link>
                    <Link href="/signup?next=%2Fchat" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-900/30 transition hover:bg-indigo-400">Create account</Link>
                  </div>
                )}
                {!isGuest && topicOk && (
                  <div className="flex flex-col gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Try asking</p>
                    <div className="flex flex-wrap gap-2">
                      {QUICK_PROMPTS.map((q) => (
                        <button key={q} type="button" onClick={() => setInput(q)} className="max-w-full rounded-full border border-indigo-500/35 bg-indigo-500/10 px-3 py-1.5 text-left text-xs font-medium text-indigo-100/95 transition hover:border-indigo-400/50 hover:bg-indigo-500/20">{q}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            <ChatMessages
              messages={messages}
              isLoading={isLoading}
              copiedIndex={copiedIndex}
              onCopy={(text, idx) => void copyMessage(text, idx)}
              onEdit={(content, idx, role) =>
                role === "user" ? editUserMessage(content, idx) : editAssistantIntoInput(content)
              }
              emptyState={null}
            />
          </div>
          {error && <p className="text-xs text-rose-400">{error}</p>}
        </div>
      </div>

      {/* input */}
      <div className="border-t border-slate-800/80 bg-slate-950/30 p-4 backdrop-blur-sm sm:px-6">
        {isGuest ? (
          <p className="text-center text-sm text-slate-500">
            <Link href="/login?next=%2Fchat" className="font-medium text-indigo-400 underline-offset-2 hover:underline">Log in</Link>{" "}or{" "}
            <Link href="/signup?next=%2Fchat" className="font-medium text-indigo-400 underline-offset-2 hover:underline">sign up</Link>{" "}
            to send messages.
          </p>
        ) : (
          <div className="w-full">
            <div className="flex items-center gap-2 rounded-xl border border-slate-700/90 bg-slate-900/80 px-2 py-2 shadow-inner">
              <input ref={fileInputRef} type="file" multiple accept=".pdf,.txt,.doc,.docx,.ppt,.pptx" onChange={handlePickFiles} className="hidden" aria-label="Upload study files in chat" />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={!topicOk || isUploadingFiles}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-600 bg-slate-900/70 text-slate-200 transition hover:border-indigo-400/50 hover:text-indigo-200 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={isUploadingFiles ? "Uploading files" : "Attach files"}
              >
                {isUploadingFiles ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-500 border-t-indigo-300" aria-hidden />
                ) : (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
                    <path d="M21.44 11.05l-8.49 8.49a6 6 0 01-8.49-8.49l9.2-9.2a4 4 0 115.66 5.66l-9.2 9.2a2 2 0 11-2.83-2.83l8.48-8.49" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
              <input
                ref={inputRef}
                type="text"
                placeholder="Ask about your notes…"
                className="min-w-0 flex-1 border-0 bg-transparent px-2 py-2 text-white placeholder-slate-500 transition focus:outline-none"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={!authResolved}
              />
              <button
                type="button"
                onClick={() => void handleSend()}
                disabled={isLoading || !input.trim() || !authResolved || !topicOk}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-900/30 transition hover:from-indigo-400 hover:to-violet-400 disabled:cursor-not-allowed disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-400 disabled:shadow-none"
                aria-label="Send message"
              >
                {isLoading ? "…" : (
                  <svg className="h-4 w-4 rotate-180" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="M4 12l15-7-4.5 7L19 19 4 12z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M14.5 12H8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return chatInner;
}