"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { auth, db } from "@/services/firebase";

type StudentMessage = {
  id: string;
  studentName: string;
  studentEmail: string;
  courseName: string;
  message: string;
};

export function ProfessorInbox() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [messages, setMessages] = useState<StudentMessage[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => setUser(u ?? null));
  }, []);

  useEffect(() => {
    if (!user?.uid) {
      setMessages([]);
      return;
    }
    const q = query(collection(db, "studentMessages"), where("professorId", "==", user.uid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setError(null);
        const next: StudentMessage[] = snap.docs.map((d) => {
          const data = d.data() as Partial<StudentMessage>;
          return {
            id: d.id,
            studentName: data.studentName ?? "Student",
            studentEmail: data.studentEmail ?? "",
            courseName: data.courseName ?? "Course",
            message: data.message ?? "",
          };
        });
        setMessages(next);
      },
      (err) => {
        const code =
          typeof err === "object" && err !== null && "code" in err
            ? String((err as { code: string }).code)
            : "unknown";
        setMessages([]);
        setError(
          code === "permission-denied"
            ? "Cannot read student messages: Firestore rules are blocking access."
            : `Cannot load student messages (${code}).`,
        );
      },
    );
    return () => unsub();
  }, [user?.uid]);

  if (user === undefined) return <p className="text-sm text-slate-400">Loading inbox...</p>;
  if (!user) return <p className="text-sm text-slate-300">Please sign in to view inbox.</p>;

  return (
    <section className="rounded-2xl border border-slate-700/60 bg-slate-900/50 p-5">
      <h2 className="font-display text-xl font-semibold text-white">Student Messages</h2>
      {error && (
        <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}
      {messages.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">No student messages yet.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {messages.map((m) => (
            <div key={m.id} className="rounded-xl border border-slate-700 bg-slate-950/50 px-3 py-2">
              <p className="text-sm font-semibold text-white">{m.studentName}</p>
              <p className="text-xs text-slate-400">
                {m.studentEmail} • {m.courseName}
              </p>
              <p className="mt-1 text-sm text-slate-200">{m.message || "No message text."}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
