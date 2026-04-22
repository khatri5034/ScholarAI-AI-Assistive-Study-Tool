"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/services/firebase";
import { useStudyTopic } from "@/contexts/StudyTopicContext";

const GUEST_REQUIRES_SIGNUP = ["/upload", "/chat", "/planner", "/quiz"] as const;

/**
 * Route gate: signed-in users need a study topic before Chat/Upload/Planner/Quiz.
 * Guests cannot use those routes—redirect to sign up (with return path).
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
  const guestMustSignUp =
    ready &&
    user === null &&
    !!pathname &&
    (GUEST_REQUIRES_SIGNUP as readonly string[]).includes(pathname);

  const loadingMessage = !ready
    ? "Hang on—making sure you’re still signed in."
    : guestMustSignUp
      ? "Sending you to sign up so your stuff stays private."
      : needsTopic
        ? "Head to Home and pick a topic first—I scope everything to that label."
        : "Almost there…";

  useEffect(() => {
    if (!ready) return;
    if (guestMustSignUp && pathname) {
      router.replace(`/signup?next=${encodeURIComponent(pathname)}`);
      return;
    }
    if (needsTopic) router.replace("/#choose-topic");
  }, [ready, guestMustSignUp, pathname, needsTopic, router]);

  if (!ready || guestMustSignUp || needsTopic) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-950 px-6 pt-16 text-slate-400"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-indigo-400"
          aria-hidden
        />
        <p className="max-w-sm text-center text-sm text-slate-300">{loadingMessage}</p>
      </div>
    );
  }

  return <>{children}</>;
}
