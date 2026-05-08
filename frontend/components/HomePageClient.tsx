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
import { collection, doc, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { db } from "@/services/firebase";
import { useStudyTopic } from "@/contexts/StudyTopicContext";
import { AppRole, getUserRole } from "@/lib/userProfile";
import { MarketingLanding } from "./MarketingLanding";
import { ProfessorDashboard } from "./ProfessorDashboard";
import { TopicFilesButton } from "./TopicFilesModal";
import { getBackendBaseUrl } from "@/services/api";

function displayNameFor(user: User): string {
  const name = user.displayName?.trim();
  if (name) return name;
  const email = user.email?.trim();
  if (email) return email.split("@")[0] ?? email;
  return "there";
}

function PendingInvitesPanel({
  invites,
  inviteActionId,
  onAccept,
}: {
  invites: CourseInvitation[];
  inviteActionId: string | null;
  onAccept: (invite: CourseInvitation) => void;
}) {
  if (invites.length === 0) return null;
  return (
    <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-4">
      <p className="text-sm font-semibold text-indigo-100">Professor course invitations</p>
      <div className="mt-3 space-y-2">
        {invites.map((invite) => (
          <div
            key={invite.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-indigo-500/25 bg-slate-900/50 px-3 py-2"
          >
            <p className="text-sm text-slate-200">
              {invite.courseName} <span className="text-slate-400">from {invite.professorName}</span>
            </p>
            <button
              type="button"
              onClick={() => onAccept(invite)}
              disabled={inviteActionId === invite.id}
              className="rounded-md border border-indigo-400/35 bg-indigo-500/20 px-2.5 py-1 text-xs font-semibold text-indigo-100 transition hover:bg-indigo-500/30 disabled:opacity-60"
            >
              {inviteActionId === invite.id ? "Accepting..." : "Accept invitation"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Hub tiles: left accent + lift on hover (common “app card” pattern). */
const hubCard =
  "group relative flex flex-col overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-900/55 p-6 shadow-lg shadow-black/30 transition duration-300 hover:-translate-y-1 hover:border-slate-600/90 hover:bg-slate-900/90 hover:shadow-2xl hover:shadow-violet-950/40 border-l-4";

type CourseInvitation = {
  id: string;
  courseName: string;
  professorName: string;
  status: "pending" | "accepted";
};

async function deleteTopicOnServer(topic: string, userId: string): Promise<void> {
  const params = new URLSearchParams({ user_id: userId, topic: topic.trim() });
  const res = await fetch(`${getBackendBaseUrl()}/rag/topic?${params.toString()}`, {
    method: "DELETE",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 404) {
      // Topic already absent on server; treat as deleted for UX consistency.
      return;
    }
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
  const [role, setRole] = useState<AppRole>("student");
  const [topicDraft, setTopicDraft] = useState("");
  const [topicError, setTopicError] = useState("");
  const [topicDeleteError, setTopicDeleteError] = useState<string | null>(null);
  const [deletingTopic, setDeletingTopic] = useState<string | null>(null);
  const [selectedRecentTopic, setSelectedRecentTopic] = useState("");
  const [pendingInvites, setPendingInvites] = useState<CourseInvitation[]>([]);
  const [inviteActionId, setInviteActionId] = useState<string | null>(null);
  const chooseTopicRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user?.uid) {
      setRole("student");
      return;
    }
    void getUserRole(user.uid)
      .then((nextRole) => setRole(nextRole))
      .catch(() => setRole("student"));
  }, [user?.uid]);

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

  useEffect(() => {
    if (!topicHistory.length) {
      setSelectedRecentTopic("");
      return;
    }
    setSelectedRecentTopic((prev) => (prev && topicHistory.includes(prev) ? prev : topicHistory[0] ?? ""));
  }, [topicHistory]);

  useEffect(() => {
    if (!user?.email) {
      setPendingInvites([]);
      return;
    }
    const q = query(
      collection(db, "courseInvitations"),
      where("studentEmailLower", "==", user.email.toLowerCase()),
      where("status", "==", "pending"),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const next: CourseInvitation[] = snap.docs.map((d) => {
          const data = d.data() as {
            courseName?: string;
            professorName?: string;
            status?: "pending" | "accepted";
          };
          return {
            id: d.id,
            courseName: data.courseName ?? "Course",
            professorName: data.professorName ?? "Professor",
            status: data.status ?? "pending",
          };
        });
        setPendingInvites(next);
      },
      () => setPendingInvites([]),
    );
    return () => unsub();
  }, [user?.email]);

  const acceptInvitation = async (invite: CourseInvitation) => {
    if (!user?.uid) return;
    setInviteActionId(invite.id);
    try {
      await updateDoc(doc(db, "courseInvitations", invite.id), {
        status: "accepted",
        acceptedAt: new Date(),
        acceptedBy: user.uid,
      });
      if (!studyTopic) {
        setStudyTopic(invite.courseName);
      }
    } finally {
      setInviteActionId(null);
    }
  };

  if (!ready) {
    return (
      <main
        className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-950 px-6 pt-16 text-slate-400"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-indigo-400"
          aria-hidden
        />
        <p className="text-center text-sm text-slate-300">Hang on—checking if you’re still signed in.</p>
      </main>
    );
  }

  if (!loggedIn) {
    return <MarketingLanding />;
  }

  if (role === "professor") {
    return (
      <main className="min-h-screen bg-slate-950 pt-16 pb-24">
        <section className="relative overflow-hidden border-b border-slate-800">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_-10%,rgba(99,102,241,0.12),transparent)]" />
          <div className="relative mx-auto max-w-5xl px-6 py-12">
            <p className="mb-2 text-sm font-medium uppercase tracking-wider text-indigo-400">Faculty View</p>
            <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Welcome back, Professor {displayNameFor(user!)}
            </h1>
            <p className="mt-3 max-w-2xl text-slate-400">
              Manage courses, invitations, and quizzes from your dashboard.
            </p>
          </div>
        </section>
        <div className="mx-auto max-w-5xl px-6 py-12">
          <ProfessorDashboard />
        </div>
      </main>
    );
  }

  if (!studyTopic) {
    const handleTopicSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      const t = topicDraft.trim();
      if (!t) {
        setTopicError("Type a course or unit name—I need something to label this bucket.");
        return;
      }
      setTopicError("");
      setStudyTopic(t);
    };

    const handleDeleteTopic = async (t: string) => {
      if (role === "student") {
        setTopicDeleteError("Students cannot delete topic data from the server.");
        return;
      }
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
              I use one label per “pile” of uploads—name it once, then chat, planner, and quiz all read from that pile.
            </p>

            {topicDeleteError && (
              <p className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {topicDeleteError}
              </p>
            )}

            <div className="mt-8">
              <PendingInvitesPanel
                invites={pendingInvites}
                inviteActionId={inviteActionId}
                onAccept={(invite) => void acceptInvitation(invite)}
              />
            </div>

            {topicHistory.length > 0 && (
              <div className="mt-10">
                <p className="text-sm font-medium text-slate-400">Recent topics</p>
                <p className="mt-1 text-xs text-slate-500">
                  Pick one to jump back in, or remove it if you want me to wipe that topic’s files off the server.
                </p>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-2">
                  <label htmlFor="recent-topics" className="sr-only">
                    Recent topics
                  </label>
                  <select
                    id="recent-topics"
                    value={selectedRecentTopic}
                    onChange={(e) => setSelectedRecentTopic(e.target.value)}
                    className="min-w-0 flex-1 rounded-xl border border-slate-600/80 bg-slate-800/60 px-4 py-3 text-sm text-slate-100 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/40"
                  >
                    {topicHistory.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!selectedRecentTopic}
                    onClick={() => {
                      if (!selectedRecentTopic) return;
                      setTopicError("");
                      setStudyTopic(selectedRecentTopic);
                    }}
                    className="rounded-xl border border-violet-500/35 bg-violet-500/10 px-4 py-3 text-sm font-medium text-violet-200 transition hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-50 sm:w-28"
                  >
                    Open
                  </button>
                  <button
                    type="button"
                    disabled={!selectedRecentTopic || deletingTopic === selectedRecentTopic || role === "student"}
                    onClick={(e) => {
                      e.preventDefault();
                      if (!selectedRecentTopic) return;
                      void handleDeleteTopic(selectedRecentTopic);
                    }}
                    className="rounded-xl border border-red-500/35 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50 sm:w-28"
                    title={role === "student" ? "Students cannot delete server topics" : undefined}
                  >
                    {deletingTopic === selectedRecentTopic ? "…" : "Remove"}
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleTopicSubmit} className="mt-10 space-y-4">
              <p className="text-sm font-medium text-slate-100">Enter a new topic/course</p>
              <input
                id="study-topic"
                type="text"
                autoComplete="off"
                placeholder="e.g. Cell Biology"
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
                Continue to the hub
              </button>
            </form>
          </div>
        </div>
      </main>
    );
  }

  const handleDeleteCurrentTopic = async () => {
    if (role === "student") {
      setTopicDeleteError("Students cannot delete topic data from the server.");
      return;
    }
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
          <p className="text-sm font-medium text-violet-400/90">Your hub</p>
          <h1 className="mt-2 bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-4xl">
            Welcome back, {displayNameFor(user!)}
          </h1>
          {topicDeleteError && (
            <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {topicDeleteError}
            </p>
          )}
          <div className="mt-6 space-y-6">
            <PendingInvitesPanel
              invites={pendingInvites}
              inviteActionId={inviteActionId}
              onAccept={(invite) => void acceptInvitation(invite)}
            />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Current focus</p>
              <p className="mt-1 text-xl font-semibold text-white">{studyTopic}</p>
            </div>

            <div className="rounded-2xl border border-slate-700/90 bg-slate-900/60 p-4 shadow-inner shadow-black/20 sm:p-5">
              <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
                <div className="space-y-2">
                  <p className="text-xs font-medium text-slate-500">Files</p>
                  <TopicFilesButton
                    topic={studyTopic}
                    userId={user!.uid}
                    className="flex min-h-11 w-full items-center justify-center rounded-xl border border-violet-500/40 bg-violet-500/15 px-4 py-2.5 text-sm font-medium text-violet-100 transition hover:border-violet-400/55 hover:bg-violet-500/25"
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-slate-500">Topic</p>
                  <button
                    type="button"
                    onClick={() => {
                      clearStudyTopic();
                      setTopicDraft("");
                      setTopicDeleteError(null);
                    }}
                    className="flex min-h-11 w-full items-center justify-center rounded-xl border border-slate-600 bg-slate-800/80 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:border-slate-500 hover:bg-slate-800"
                  >
                    Change topic
                  </button>
                </div>
              </div>

              <div className="mt-5 border-t border-slate-800 pt-4">
                <button
                  type="button"
                  disabled={!!deletingTopic || role === "student"}
                  onClick={() => void handleDeleteCurrentTopic()}
                  className="flex min-h-11 w-full max-w-md items-center justify-center rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-2.5 text-sm font-medium text-red-200 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                  title={role === "student" ? "Students cannot delete server topics" : undefined}
                >
                  {deletingTopic === studyTopic ? "Deleting…" : "Delete topic (server)"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-12">
        <h2 className="text-center text-lg font-semibold text-slate-200">
          What are we doing for{" "}
          <span className="text-violet-300">&quot;{studyTopic}&quot;</span>?
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Link href="/chat" className={`${hubCard} border-l-violet-500`}>
            <span className="text-xs font-semibold uppercase tracking-wider text-violet-400/90">Learn</span>
            <span className="mt-1 font-display text-lg font-semibold text-white">Chat</span>
            <span className="mt-2 text-sm leading-relaxed text-slate-400">
              Ask however you talk—I answer from what you uploaded under this topic.
            </span>
            <span className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-violet-300 transition group-hover:gap-2">
              Open chat <span aria-hidden>→</span>
            </span>
          </Link>
          <Link href="/upload" className={`${hubCard} border-l-emerald-500`}>
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400/90">Materials</span>
            <span className="mt-1 font-display text-lg font-semibold text-white">Upload</span>
            <span className="mt-2 text-sm leading-relaxed text-slate-400">
              Drop syllabi, slides, whatever—so chat and quizzes aren’t making things up.
            </span>
            <span className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-emerald-300 transition group-hover:gap-2">
              Upload files <span aria-hidden>→</span>
            </span>
          </Link>
          <Link href="/planner" className={`${hubCard} border-l-sky-500`}>
            <span className="text-xs font-semibold uppercase tracking-wider text-sky-400/90">Structure</span>
            <span className="mt-1 font-display text-lg font-semibold text-white">Planner</span>
            <span className="mt-2 text-sm leading-relaxed text-slate-400">
              I try to turn the reading pile into weeks you can actually execute.
            </span>
            <span className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-sky-300 transition group-hover:gap-2">
              Open planner <span aria-hidden>→</span>
            </span>
          </Link>
          <Link href="/quiz" className={`${hubCard} border-l-amber-500`}>
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-400/90">Practice</span>
            <span className="mt-1 font-display text-lg font-semibold text-white">Quiz</span>
            <span className="mt-2 text-sm leading-relaxed text-slate-400">
              Exam-ish questions from your files—not random trivia off the web.
            </span>
            <span className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-amber-300 transition group-hover:gap-2">
              Start quiz <span aria-hidden>→</span>
            </span>
          </Link>
        </div>
      </section>
    </main>
  );
}
