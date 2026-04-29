"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import { collection, doc, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { auth, db } from "@/services/firebase";
import { useStudyTopic } from "@/contexts/StudyTopicContext";

type Invitation = {
  id: string;
  courseId: string;
  courseName: string;
  professorName: string;
  status: "pending" | "accepted";
};

type Assignment = {
  id: string;
  courseName: string;
  professorName: string;
  professorId?: string;
  quizTitle: string;
  note: string;
  studentOpened?: boolean;
};

function normalizeTopicKey(topic: string): string {
  return topic.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function ownerMapKey(email: string): string {
  return `scholarai_topic_professor_owner_${email.toLowerCase()}`;
}

function writeOwnerMap(
  email: string,
  rows: Array<{ courseName?: string; professorId?: string }>,
) {
  try {
    const out: Record<string, string> = {};
    rows.forEach((row) => {
      const key = normalizeTopicKey(row.courseName ?? "");
      if (key && row.professorId) out[key] = row.professorId;
    });
    localStorage.setItem(ownerMapKey(email), JSON.stringify(out));
  } catch {
    /* ignore */
  }
}

function upsertOwnerForTopic(email: string, courseName: string, professorId?: string) {
  if (!email || !courseName || !professorId) return;
  try {
    const key = ownerMapKey(email);
    const current = JSON.parse(localStorage.getItem(key) ?? "{}") as Record<string, string>;
    current[normalizeTopicKey(courseName)] = professorId;
    localStorage.setItem(key, JSON.stringify(current));
  } catch {
    /* ignore */
  }
}

function openedAssignmentsKey(email: string): string {
  return `scholarai_opened_quiz_assignments_${email.toLowerCase()}`;
}

function readOpenedAssignments(email: string): Set<string> {
  try {
    const raw = localStorage.getItem(openedAssignmentsKey(email));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

function writeOpenedAssignments(email: string, ids: Set<string>) {
  try {
    localStorage.setItem(openedAssignmentsKey(email), JSON.stringify(Array.from(ids)));
  } catch {
    /* ignore */
  }
}

export function StudentInbox() {
  const router = useRouter();
  const { setStudyTopic } = useStudyTopic();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loadingInviteId, setLoadingInviteId] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => setUser(u ?? null));
  }, []);

  useEffect(() => {
    if (!user?.email) {
      setInvites([]);
      return;
    }
    const q = query(
      collection(db, "courseInvitations"),
      where("studentEmailLower", "==", user.email.toLowerCase()),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setInviteError(null);
        const inviteRows = snap.docs.map(
          (d) => d.data() as Partial<Invitation> & { professorId?: string; courseName?: string },
        );
        const next: Invitation[] = inviteRows.map((data, idx) => {
          const id = snap.docs[idx]?.id ?? "";
          return {
            id,
            courseId: data.courseId ?? "",
            courseName: data.courseName ?? "Course",
            professorName: data.professorName ?? "Professor",
            status: data.status === "accepted" ? "accepted" : "pending",
          };
        });
        writeOwnerMap(
          user.email!,
          inviteRows.map((r) => ({ courseName: r.courseName, professorId: r.professorId })),
        );
        setInvites(next);
      },
      (err) => {
        const code =
          typeof err === "object" && err !== null && "code" in err
            ? String((err as { code: string }).code)
            : "unknown";
        setInvites([]);
        setInviteError(
          code === "permission-denied"
            ? "Cannot read invitations: Firestore rules are blocking access."
            : `Cannot load invitations (${code}).`,
        );
      },
    );
    return () => unsub();
  }, [user?.email]);

  useEffect(() => {
    if (!user?.email) {
      setAssignments([]);
      return;
    }
    const q = query(
      collection(db, "quizAssignments"),
      where("recipientEmailLower", "==", user.email.toLowerCase()),
      where("status", "==", "sent"),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setAssignmentError(null);
        const assignmentRows = snap.docs.map(
          (d) => d.data() as Partial<Assignment> & { professorId?: string; courseName?: string },
        );
        const next: Assignment[] = assignmentRows.map((data, idx) => {
          const id = snap.docs[idx]?.id ?? "";
          return {
            id,
            courseName: data.courseName ?? "Course",
            professorName: data.professorName ?? "Professor",
            professorId: data.professorId,
            quizTitle: data.quizTitle ?? "Assigned quiz",
            note: data.note ?? "",
            studentOpened: !!data.studentOpened,
          };
        });
        writeOwnerMap(
          user.email!,
          assignmentRows.map((r) => ({ courseName: r.courseName, professorId: r.professorId })),
        );
        const openedSet = readOpenedAssignments(user.email!);
        const merged = next.map((item) => ({
          ...item,
          studentOpened: item.studentOpened || openedSet.has(item.id),
        }));
        setAssignments(merged);
      },
      (err) => {
        const code =
          typeof err === "object" && err !== null && "code" in err
            ? String((err as { code: string }).code)
            : "unknown";
        setAssignments([]);
        setAssignmentError(
          code === "permission-denied"
            ? "Cannot read professor messages/quizzes: Firestore rules are blocking access."
            : `Cannot load professor messages/quizzes (${code}).`,
        );
      },
    );
    return () => unsub();
  }, [user?.email]);

  const acceptInvitation = async (invite: Invitation) => {
    if (invite.status === "accepted") return;
    setLoadingInviteId(invite.id);
    try {
      await updateDoc(doc(db, "courseInvitations", invite.id), {
        status: "accepted",
        acceptedAt: new Date(),
        acceptedBy: user?.uid ?? null,
      });
    } finally {
      setLoadingInviteId(null);
    }
  };

  const openAssignedQuiz = async (assignment: Assignment) => {
    if (user?.email) {
      upsertOwnerForTopic(user.email, assignment.courseName, assignment.professorId);
      const opened = readOpenedAssignments(user.email);
      opened.add(assignment.id);
      writeOpenedAssignments(user.email, opened);
      setAssignments((prev) =>
        prev.map((item) => (item.id === assignment.id ? { ...item, studentOpened: true } : item)),
      );
    }
    try {
      await updateDoc(doc(db, "quizAssignments", assignment.id), {
        studentOpened: true,
        studentOpenedAt: new Date(),
      });
    } catch {
      // Non-blocking; still route student to quiz.
    }
    setStudyTopic(assignment.courseName);
    router.push(`/quiz?assigned_quiz=${encodeURIComponent(assignment.id)}`);
  };

  const markAllAssignmentsRead = async () => {
    if (!assignments.length) return;
    if (user?.email) {
      const opened = readOpenedAssignments(user.email);
      assignments.forEach((item) => opened.add(item.id));
      writeOpenedAssignments(user.email, opened);
      setAssignments((prev) => prev.map((item) => ({ ...item, studentOpened: true })));
    }
    await Promise.all(
      assignments
        .filter((item) => !item.studentOpened)
        .map((item) =>
          updateDoc(doc(db, "quizAssignments", item.id), {
            studentOpened: true,
            studentOpenedAt: new Date(),
          }),
        ),
    );
  };

  if (user === undefined) {
    return <p className="text-sm text-slate-400">Loading inbox...</p>;
  }

  if (!user) {
    return <p className="text-sm text-slate-300">Please sign in to view inbox.</p>;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-indigo-500/25 bg-indigo-500/8 p-5">
        <h2 className="font-display text-xl font-semibold text-white">Course Invitations</h2>
        {inviteError && (
          <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {inviteError}
          </p>
        )}
        {invites.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">No invitations yet.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {invites.map((invite) => (
              <div
                key={invite.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-indigo-500/20 bg-slate-900/60 px-3 py-2"
              >
                <p className="text-sm text-slate-200">
                  {invite.courseName} <span className="text-slate-400">from {invite.professorName}</span>
                </p>
                {invite.status === "accepted" ? (
                  <span className="rounded-md border border-emerald-500/35 bg-emerald-500/15 px-2 py-1 text-xs text-emerald-200">
                    Accepted
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => void acceptInvitation(invite)}
                    disabled={loadingInviteId === invite.id}
                    className="rounded-md border border-indigo-400/35 bg-indigo-500/20 px-2.5 py-1 text-xs font-semibold text-indigo-100 transition hover:bg-indigo-500/30 disabled:opacity-60"
                  >
                    {loadingInviteId === invite.id ? "Accepting..." : "Accept"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-amber-500/25 bg-amber-500/8 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-xl font-semibold text-white">Professor Messages & Quizzes</h2>
          <button
            type="button"
            onClick={() => void markAllAssignmentsRead()}
            className="rounded-md border border-amber-500/35 bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-100 transition hover:bg-amber-500/25"
          >
            Mark all as read
          </button>
        </div>
        {assignmentError && (
          <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {assignmentError}
          </p>
        )}
        {assignments.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">No quizzes/messages yet.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {assignments.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-amber-500/20 bg-slate-900/60 px-3 py-2"
              >
                <p className="text-sm font-semibold text-white">
                  {item.quizTitle}
                  {!item.studentOpened && (
                    <span className="ml-2 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      NEW
                    </span>
                  )}
                </p>
                <p className="text-xs text-slate-400">
                  {item.courseName} • from {item.professorName}
                </p>
                {item.note ? <p className="mt-1 text-xs text-amber-100/90">{item.note}</p> : null}
                <button
                  type="button"
                  onClick={() => void openAssignedQuiz(item)}
                  className="mt-2 rounded-md border border-amber-500/35 bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-100 transition hover:bg-amber-500/25"
                >
                  Open this quiz
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
