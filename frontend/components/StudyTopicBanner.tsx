"use client";

/**
 * Repeats the current topic on feature pages so users remember what scope Chat/Upload
 * use; includes Files + link back to Home to change topic.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { auth, db } from "@/services/firebase";
import { useStudyTopic } from "@/contexts/StudyTopicContext";
import { TopicFilesButton } from "./TopicFilesModal";

export function StudyTopicBanner() {
  const { studyTopic } = useStudyTopic();
  const [user, setUser] = useState<User | null>(null);
  const [sharedProfessorId, setSharedProfessorId] = useState<string | null>(null);

  const normalizeTopicKey = (topic: string) =>
    topic.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u ?? null);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user?.email || !studyTopic?.trim()) {
      setSharedProfessorId(null);
      return;
    }
    const topicLower = studyTopic.trim().toLowerCase();
    let inviteOwner: string | null = null;
    let assignmentOwner: string | null = null;
    const sync = () => setSharedProfessorId(inviteOwner ?? assignmentOwner ?? null);

    // Deterministic fallback from local cache populated by inbox/assignments.
    try {
      const raw = localStorage.getItem(`scholarai_topic_professor_owner_${user.email.toLowerCase()}`);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, string>;
        const cached = parsed?.[normalizeTopicKey(studyTopic)];
        if (cached) setSharedProfessorId(cached);
      }
    } catch {
      /* ignore */
    }

    const invitesQ = query(
      collection(db, "courseInvitations"),
      where("studentEmailLower", "==", user.email.toLowerCase()),
    );
    const unsubInvites = onSnapshot(
      invitesQ,
      (snap) => {
        const rows = snap.docs.map((d) => d.data() as { courseName?: string; professorId?: string });
        const exact = rows.find((r) => r.courseName?.trim().toLowerCase() === topicLower && !!r.professorId);
        inviteOwner = exact?.professorId ?? rows.find((r) => !!r.professorId)?.professorId ?? null;
        sync();
      },
      () => {
        // keep any cached/shared owner instead of clearing
      },
    );

    const assignmentsQ = query(
      collection(db, "quizAssignments"),
      where("recipientEmailLower", "==", user.email.toLowerCase()),
      where("status", "==", "sent"),
    );
    const unsubAssignments = onSnapshot(
      assignmentsQ,
      (snap) => {
        const rows = snap.docs.map((d) => d.data() as { courseName?: string; professorId?: string });
        const exact = rows.find((r) => r.courseName?.trim().toLowerCase() === topicLower && !!r.professorId);
        assignmentOwner = exact?.professorId ?? rows.find((r) => !!r.professorId)?.professorId ?? null;
        sync();
      },
      () => {
        // keep any cached/shared owner instead of clearing
      },
    );

    return () => {
      unsubInvites();
      unsubAssignments();
    };
  }, [studyTopic, user?.email]);

  if (!studyTopic) return null;
  let cachedOwnerId: string | null = null;
  if (typeof window !== "undefined" && user?.email && studyTopic?.trim()) {
    try {
      const raw = localStorage.getItem(`scholarai_topic_professor_owner_${user.email.toLowerCase()}`);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, string>;
        cachedOwnerId = parsed?.[normalizeTopicKey(studyTopic)] ?? null;
      }
    } catch {
      /* ignore */
    }
  }
  const filesOwnerId = sharedProfessorId ?? cachedOwnerId ?? user?.uid ?? "";
  const studentOnSharedCourse = !!filesOwnerId && filesOwnerId !== user?.uid;

  return (
    <div className="mx-auto mb-8 max-w-4xl rounded-2xl border border-white/10 bg-slate-900/50 px-4 py-4 text-sm text-slate-200 shadow-lg shadow-black/20 backdrop-blur-md sm:px-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <p className="min-w-0 flex-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Topic I’m using</span>
          <span className="mt-0.5 block truncate font-semibold text-white">{studyTopic}</span>
        </p>
        <div className="flex shrink-0 flex-col gap-3 border-t border-white/10 pt-4 sm:border-t-0 sm:border-l sm:pl-6 sm:pt-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:gap-3">
            <TopicFilesButton
              topic={studyTopic}
              userId={filesOwnerId}
              canDelete={!studentOnSharedCourse}
              className="flex min-h-11 w-full items-center justify-center rounded-xl border border-violet-400/40 bg-violet-500/15 px-4 py-2.5 text-sm font-medium text-violet-100 transition hover:bg-violet-500/25 sm:min-w-[8.5rem]"
            />
            <Link
              href="/"
              className="flex min-h-11 w-full items-center justify-center rounded-xl border border-slate-600/90 bg-slate-800/60 px-4 py-2.5 text-center text-sm font-medium text-slate-100 transition hover:border-slate-500 hover:bg-slate-800 sm:min-w-[8.5rem]"
            >
              Change topic
            </Link>
          </div>
          {studentOnSharedCourse && (
            <p className="text-xs text-indigo-200/90">
              You are viewing professor-shared course files for this topic.
            </p>
          )}
          <p className="text-[11px] text-slate-400/90">
            Debug files owner: {filesOwnerId || "(none)"} | student uid: {user?.uid || "(none)"} | shared professor:{" "}
            {sharedProfessorId || "(none)"} | cached owner: {cachedOwnerId || "(none)"}
          </p>
        </div>
      </div>
    </div>
  );
}
