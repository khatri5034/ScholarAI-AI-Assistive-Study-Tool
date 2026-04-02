"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/services/firebase";
import { useStudyTopic } from "@/contexts/StudyTopicContext";

/**
 * Route gate: signed-in users need a study topic before Chat/Upload/Planner/Quiz.
 * Upload requires an account (per-user document folders); guests are sent to sign up.
 */
export function TopicGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { studyTopic, authReady, topicReady } = useStudyTopic();
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u ?? null));
    return () => unsub();
  }, []);

  const ready = authReady && topicReady && user !== undefined;
  const needsTopic = !!user && !studyTopic;
  const guestOnUpload = ready && user === null && pathname === "/upload";

  useEffect(() => {
    if (!ready) return;
    if (guestOnUpload) {
      router.replace("/signup?next=%2Fupload");
      return;
    }
    if (needsTopic) router.replace("/#choose-topic");
  }, [ready, guestOnUpload, needsTopic, router]);

  if (!ready || guestOnUpload || needsTopic) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 pt-16 text-slate-400">
        <p className="text-sm">Loading…</p>
      </div>
    );
  }

  return <>{children}</>;
}
