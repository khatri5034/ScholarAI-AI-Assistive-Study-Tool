"use client";

/**
 * Chat UI: signed-in users call the multi-agent backend (`POST /agents/run`) with
 * Firebase uid + current study topic for RAG-grounded replies when an index exists.
 * Last 10 messages persist in localStorage per signed-in user (guests see sign-in CTAs only).
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
const CHAT_MAX = 10;

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
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const { studyTopic, authReady, topicReady } = useStudyTopic();

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

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900/95 to-slate-950 shadow-2xl shadow-black/40 ring-1 ring-white/5 transition hover:ring-indigo-500/15">
      <div className="flex items-center gap-3 border-b border-slate-800/80 bg-slate-900/40 px-6 py-4 backdrop-blur-sm">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/25 text-indigo-300 ring-1 ring-indigo-400/20"
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
          <h2 className="font-display text-lg font-semibold tracking-tight text-white">Chat</h2>
          <p className="text-sm text-slate-400">
            {isGuest
              ? "I don’t run without a login—then I only read what you uploaded for each topic."
              : "Whatever topic you picked + whatever you uploaded is what I search."}
          </p>
        </div>
      </div>

      {isGuest && (
        <div className="border-b border-indigo-500/20 bg-indigo-500/10 px-6 py-3">
          <p className="text-sm text-indigo-100/95">
            Log in first—after that I stick to your uploads for the active topic.
          </p>
        </div>
      )}

      {!isGuest && authReady && topicReady && !topicOk && (
        <div className="border-b border-rose-500/20 bg-rose-500/10 px-6 py-3">
          <p className="text-sm text-rose-100/95">
            Pick a study topic on{" "}
            <Link href="/" className="font-semibold underline underline-offset-2">
              Home
            </Link>{" "}
            first—I won’t guess which class this is.
          </p>
        </div>
      )}

      <div className="min-h-[300px] flex-1 p-5 sm:p-6">
        <div className="flex h-full flex-col gap-4 rounded-xl border border-slate-800/80 bg-slate-950/35 p-4 ring-1 ring-black/20">
          <div className="flex-1 space-y-3 overflow-y-auto rounded-lg bg-slate-950/50 p-3 sm:p-4">
            {!authResolved && <p className="text-sm text-slate-500">Checking if you’re signed in…</p>}
            {authResolved && messages.length === 0 && (
              <div className="animate-fade-in-up space-y-4 py-2">
                <p className="text-sm text-slate-400">
                  {isGuest ? (
                    <>Make an account (or log in), upload on Upload, then set the topic on Home—I’m useless until then.</>
                  ) : (
                    <>
                      Ask me something about{" "}
                      <span className="font-medium text-slate-200">{studyTopic || "this topic"}</span>, or steal one of
                      the starters below.
                    </>
                  )}
                </p>
                {isGuest && (
                  <div className="flex flex-wrap gap-3 pt-1">
                    <Link
                      href="/login?next=%2Fchat"
                      className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-600 bg-slate-800/90 px-5 py-2.5 text-sm font-semibold text-white transition hover:border-slate-500 hover:bg-slate-800"
                    >
                      Log in
                    </Link>
                    <Link
                      href="/signup?next=%2Fchat"
                      className="inline-flex min-h-11 items-center justify-center rounded-xl bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-900/30 transition hover:bg-indigo-400"
                    >
                      Create account
                    </Link>
                  </div>
                )}
                {!isGuest && topicOk && (
                  <div className="flex flex-col gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Try asking</p>
                    <div className="flex flex-wrap gap-2">
                      {QUICK_PROMPTS.map((q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => setInput(q)}
                          className="max-w-full rounded-full border border-indigo-500/35 bg-indigo-500/10 px-3 py-1.5 text-left text-xs font-medium text-indigo-100/95 transition hover:border-indigo-400/50 hover:bg-indigo-500/20"
                        >
                          {q}
                        </button>
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
                role === "user"
                  ? editUserMessage(content, idx)
                  : editAssistantIntoInput(content)
              }
              emptyState={
                <div className="animate-fade-in-up space-y-4 py-2">
                  <p className="text-sm text-slate-400">
                    {isGuest ? (
                      <>Make an account (or log in), upload on Upload, then set the topic on Home—I'm useless until then.</>
                    ) : (
                      <>
                        Ask me something about{" "}
                        <span className="font-medium text-slate-200">{studyTopic || "this topic"}</span>, or steal one of
                        the starters below.
                      </>
                    )}
                  </p>
                  {isGuest && (
                    <div className="flex flex-wrap gap-3 pt-1">
                      <Link href="/login?next=%2Fchat" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-600 bg-slate-800/90 px-5 py-2.5 text-sm font-semibold text-white transition hover:border-slate-500 hover:bg-slate-800">
                        Log in
                      </Link>
                      <Link href="/signup?next=%2Fchat" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-900/30 transition hover:bg-indigo-400">
                        Create account
                      </Link>
                    </div>
                  )}
                  {!isGuest && topicOk && (
                    <div className="flex flex-col gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Try asking</p>
                      <div className="flex flex-wrap gap-2">
                        {QUICK_PROMPTS.map((q) => (
                          <button
                            key={q}
                            type="button"
                            onClick={() => setInput(q)}
                            className="max-w-full rounded-full border border-indigo-500/35 bg-indigo-500/10 px-3 py-1.5 text-left text-xs font-medium text-indigo-100/95 transition hover:border-indigo-400/50 hover:bg-indigo-500/20"
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              }
            />
          </div>
          {error && <p className="text-xs text-rose-400">{error}</p>}
        </div>
      </div>
      <div className="border-t border-slate-800/80 bg-slate-950/30 p-4 backdrop-blur-sm sm:px-6">
        {isGuest ? (
          <p className="text-center text-sm text-slate-500">
            <Link href="/login?next=%2Fchat" className="font-medium text-indigo-400 underline-offset-2 hover:underline">
              Log in
            </Link>{" "}
            or{" "}
            <Link
              href="/signup?next=%2Fchat"
              className="font-medium text-indigo-400 underline-offset-2 hover:underline"
            >
              sign up
            </Link>{" "}
            to send messages.
          </p>
        ) : (
          <div className="flex flex-wrap gap-3">
            <input
              ref={inputRef}
              type="text"
              placeholder="Ask about your notes…"
              className="min-w-0 flex-1 rounded-xl border border-slate-700/90 bg-slate-900/80 px-4 py-3 text-white shadow-inner placeholder-slate-500 transition focus:border-indigo-500/55 focus:outline-none focus:ring-2 focus:ring-indigo-500/25"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={!authResolved}
            />
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={isLoading || !input.trim() || !authResolved || !topicOk}
              className="rounded-xl bg-indigo-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-900/30 transition hover:bg-indigo-400 hover:shadow-indigo-800/35 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:shadow-none"
            >
              {isLoading ? "…" : "Send"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}