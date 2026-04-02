"use client";

/**
 * Home page behavior: marketing for guests; topic picker + hub for signed-in users.
 *
 * Why client component: needs Firebase auth + study-topic context; the App Router home
 * route stays a thin wrapper that renders this component.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/services/firebase";
import { useStudyTopic } from "@/contexts/StudyTopicContext";
import { MarketingLanding } from "./MarketingLanding";
import { TopicFilesButton } from "./TopicFilesModal";

function displayNameFor(user: User): string {
  const name = user.displayName?.trim();
  if (name) return name;
  const email = user.email?.trim();
  if (email) return email.split("@")[0] ?? email;
  return "there";
}

const cardClass =
  "group flex flex-col rounded-2xl border border-slate-700/80 bg-slate-900/60 p-6 shadow-lg transition hover:border-violet-500/40 hover:bg-slate-900/90";

const apiBase = () => process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function deleteTopicOnServer(topic: string, userId: string): Promise<void> {
  const params = new URLSearchParams({ user_id: userId, topic: topic.trim() });
  const res = await fetch(`${apiBase()}/rag/topic?${params.toString()}`, {
    method: "DELETE",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      typeof (data as { detail?: unknown }).detail === "string"
        ? (data as { detail: string }).detail
        : "Could not delete topic on server.";
    throw new Error(msg);
  }
}

export function HomePageClient() {
  const pathname = usePathname();
  const {
    studyTopic,
    setStudyTopic,
    clearStudyTopic,
    removeTopicFromHistory,
    topicHistory,
    authReady,
    topicReady,
  } = useStudyTopic();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [topicDraft, setTopicDraft] = useState("");
  const [topicError, setTopicError] = useState("");
  const [topicDeleteError, setTopicDeleteError] = useState<string | null>(null);
  const [deletingTopic, setDeletingTopic] = useState<string | null>(null);
  const chooseTopicRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (pathname !== "/") return;
    if (window.location.hash !== "#choose-topic") return;
    requestAnimationFrame(() => {
      chooseTopicRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [pathname, user, studyTopic]);

  const ready = authReady && topicReady && user !== undefined;
  const loggedIn = !!user;

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 pt-16 text-slate-400">
        <p className="text-sm">Loading…</p>
      </main>
    );
  }

  if (!loggedIn) {
    return <MarketingLanding />;
  }

  if (!studyTopic) {
    const handleTopicSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      const t = topicDraft.trim();
      if (!t) {
        setTopicError("Enter a course or topic to continue.");
        return;
      }
      setTopicError("");
      setStudyTopic(t);
    };

    const handleDeleteTopic = async (t: string) => {
      const label = t.trim();
      if (!label || !user?.uid) return;
      if (
        !confirm(
          `Delete topic "${label}"?\n\nThis removes all uploaded files and the search index for this topic on the server. This cannot be undone.`
        )
      ) {
        return;
      }
      setTopicDeleteError(null);
      setDeletingTopic(label);
      try {
        await deleteTopicOnServer(label, user.uid);
        removeTopicFromHistory(label);
      } catch (e) {
        setTopicDeleteError(e instanceof Error ? e.message : "Delete failed.");
      } finally {
        setDeletingTopic(null);
      }
    };

    return (
      <main className="min-h-screen bg-slate-950 pt-16 text-white">
        <div ref={chooseTopicRef} id="choose-topic" className="relative border-b border-slate-800">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(129,140,248,0.2),_transparent_55%)]" />
          <div className="relative mx-auto max-w-2xl px-6 py-16 md:py-24">
            <p className="text-sm font-semibold tracking-[0.18em] text-emerald-300/80">
              ScholarAI
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
              Welcome back,{" "}
              <span className="bg-gradient-to-r from-violet-400 to-emerald-300 bg-clip-text text-transparent">
                {displayNameFor(user!)}
              </span>
            </h1>
            <p className="mt-4 text-lg text-slate-300">
              Enter the course or topic you want to learn or study. 
              Get info related chat, planner, and quizzes.
            </p>

            {topicDeleteError && (
              <p className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {topicDeleteError}
              </p>
            )}

            {topicHistory.length > 0 && (
              <div className="mt-10">
                <p className="text-sm font-medium text-slate-400">Recent topics</p>
                <p className="mt-1 text-xs text-slate-500">
                  Pick one you&apos;ve used before, or remove a topic to delete its files from the server.
                </p>
                <ul className="mt-4 flex flex-col gap-2">
                  {topicHistory.map((t) => (
                    <li
                      key={t}
                      className="flex w-full flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-2 sm:max-w-full"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setTopicError("");
                          setStudyTopic(t);
                        }}
                        className="min-w-0 flex-1 rounded-xl border border-slate-600/80 bg-slate-800/60 px-4 py-3 text-left text-sm text-slate-100 transition hover:border-violet-500/50 hover:bg-slate-800"
                      >
                        <span className="line-clamp-2">{t}</span>
                      </button>
                      <button
                        type="button"
                        disabled={deletingTopic === t}
                        onClick={(e) => {
                          e.preventDefault();
                          void handleDeleteTopic(t);
                        }}
                        className="shrink-0 rounded-xl border border-red-500/35 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50 sm:w-28"
                      >
                        {deletingTopic === t ? "…" : "Remove"}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <form onSubmit={handleTopicSubmit} className="mt-10 space-y-4">
              <p className="text-sm font-medium text-slate-400">
                {topicHistory.length > 0 ? "Or enter a new topic" : "New topic"}
              </p>
              <label htmlFor="study-topic" className="block text-sm font-medium text-slate-300">
                Course or topic
              </label>
              <input
                id="study-topic"
                type="text"
                autoComplete="off"
                placeholder="e.g. BIO 201 – Cell Biology, Linear Algebra final, Week 6 readings…"
                value={topicDraft}
                onChange={(e) => {
                  setTopicDraft(e.target.value);
                  setTopicError("");
                }}
                className="w-full rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-3.5 text-white placeholder-slate-500 shadow-inner focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
              />
              {topicError && <p className="text-sm text-red-400">{topicError}</p>}
              <button
                type="submit"
                className="w-full rounded-xl bg-violet-500 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition hover:bg-violet-400 sm:w-auto sm:px-10"
              >
                Continue to your study hub
              </button>
            </form>
          </div>
        </div>
      </main>
    );
  }

  const handleDeleteCurrentTopic = async () => {
    const label = studyTopic?.trim();
    if (!label || !user?.uid) return;
    if (
      !confirm(
        `Delete topic "${label}"?\n\nAll files and the search index for this topic will be removed from the server. You can still pick another topic or create this one again later.`
      )
    ) {
      return;
    }
    setTopicDeleteError(null);
    setDeletingTopic(label);
    try {
      await deleteTopicOnServer(label, user.uid);
      removeTopicFromHistory(label);
      setTopicDraft("");
    } catch (e) {
      setTopicDeleteError(e instanceof Error ? e.message : "Delete failed.");
    } finally {
      setDeletingTopic(null);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 pt-16 text-white">
      <section className="relative border-b border-slate-800">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(99,102,241,0.15),transparent)]" />
        <div className="relative mx-auto max-w-4xl px-6 py-12 md:py-16">
          <p className="text-sm font-medium text-violet-400/90">Your study hub</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Welcome back, {displayNameFor(user!)}
          </h1>
          {topicDeleteError && (
            <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {topicDeleteError}
            </p>
          )}
          <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Current focus</p>
              <p className="mt-1 text-xl font-semibold text-white">{studyTopic}</p>
              <p className="mt-2 max-w-xl text-sm text-slate-400">
                Chat, uploads, planner, and quiz below are all for this topic. Change focus anytime—your progress here
                is for this study session only.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <TopicFilesButton topic={studyTopic} userId={user!.uid} />
              <button
                type="button"
                onClick={() => {
                  clearStudyTopic();
                  setTopicDraft("");
                  setTopicDeleteError(null);
                }}
                className="rounded-xl border border-slate-600 bg-slate-900/80 px-5 py-2.5 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"
              >
                Change topic
              </button>
              <button
                type="button"
                disabled={!!deletingTopic}
                onClick={() => void handleDeleteCurrentTopic()}
                className="rounded-xl border border-red-500/40 bg-red-500/10 px-5 py-2.5 text-sm font-medium text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deletingTopic === studyTopic ? "Deleting…" : "Delete topic"}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-12">
        <h2 className="text-center text-lg font-semibold text-slate-200">
          What do you want to do for{" "}
          <span className="text-violet-300">&quot;{studyTopic}&quot;</span>?
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Link href="/chat" className={cardClass}>
            <span className="text-sm font-semibold text-violet-300">Chat</span>
            <span className="mt-2 text-sm text-slate-400">
              Ask questions grounded in your materials for this topic.
            </span>
            <span className="mt-4 text-xs font-medium text-violet-400 group-hover:text-violet-300">
              Open chat →
            </span>
          </Link>
          <Link href="/upload" className={cardClass}>
            <span className="text-sm font-semibold text-emerald-300/90">Upload</span>
            <span className="mt-2 text-sm text-slate-400">Add PDFs and notes for this course or topic.</span>
            <span className="mt-4 text-xs font-medium text-emerald-400/90 group-hover:text-emerald-300">
              Upload files →
            </span>
          </Link>
          <Link href="/planner" className={cardClass}>
            <span className="text-sm font-semibold text-sky-300/90">Planner</span>
            <span className="mt-2 text-sm text-slate-400">Build a study schedule around this topic.</span>
            <span className="mt-4 text-xs font-medium text-sky-400 group-hover:text-sky-300">
              Open planner →
            </span>
          </Link>
          <Link href="/quiz" className={cardClass}>
            <span className="text-sm font-semibold text-amber-300/90">Quiz</span>
            <span className="mt-2 text-sm text-slate-400">Practice with quizzes tied to your uploads.</span>
            <span className="mt-4 text-xs font-medium text-amber-400/90 group-hover:text-amber-300">
              Start quiz →
            </span>
          </Link>
        </div>
      </section>
    </main>
  );
}
