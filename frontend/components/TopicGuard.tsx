"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/services/firebase";
import { useStudyTopic } from "@/contexts/StudyTopicContext";

/**
 * Guests can open feature routes. Signed-in users must pick a study topic on Home first.
 */
export function TopicGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { studyTopic, authReady, topicReady } = useStudyTopic();
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u ?? null));
    return () => unsub();
  }, []);

  const ready = authReady && topicReady && user !== undefined;
  const needsTopic = !!user && !studyTopic;

  useEffect(() => {
    if (!ready) return;
    if (needsTopic) router.replace("/#choose-topic");
  }, [ready, needsTopic, router]);

  if (!ready || needsTopic) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 pt-16 text-slate-400">
        <p className="text-sm">Loading…</p>
      </div>
    );
  }

  return <>{children}</>;
}
