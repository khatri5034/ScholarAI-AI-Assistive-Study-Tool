"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/services/firebase";
import { getUserRole, type AppRole } from "@/lib/userProfile";
import { StudentInbox } from "@/components/StudentInbox";
import { ProfessorInbox } from "@/components/ProfessorInbox";

export default function InboxPage() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [role, setRole] = useState<AppRole>("student");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser ?? null);
      if (!nextUser) {
        setRole("student");
        return;
      }
      void getUserRole(nextUser.uid)
        .then((nextRole) => setRole(nextRole))
        .catch(() => setRole("student"));
    });
    return () => unsub();
  }, []);

  const professorView = !!user && role === "professor";

  return (
    <main className="min-h-screen bg-slate-950 pt-16 pb-24">
      <section className="relative overflow-hidden border-b border-slate-800">
        <div className="relative mx-auto max-w-5xl px-6 py-10">
          <p className="text-sm font-medium text-indigo-400/90">
            {professorView ? "Professor Inbox" : "Student Inbox"}
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-white">
            {professorView ? "Student Messages" : "Invitations & Messages"}
          </h1>
          <p className="mt-2 text-slate-400">
            {professorView
              ? "See messages from students here."
              : "See professor invitations and course quizzes here, independent of your current topic."}
          </p>
        </div>
      </section>
      <div className="mx-auto max-w-5xl px-6 py-8">
        {professorView ? <ProfessorInbox /> : <StudentInbox />}
      </div>
    </main>
  );
}
