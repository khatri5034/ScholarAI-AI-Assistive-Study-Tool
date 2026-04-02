"use client";

/**
 * Repeats the current topic on feature pages so users remember what scope Chat/Upload
 * use; includes Files + link back to Home to change topic.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/services/firebase";
import { useStudyTopic } from "@/contexts/StudyTopicContext";
import { TopicFilesButton } from "./TopicFilesModal";

export function StudyTopicBanner() {
  const { studyTopic } = useStudyTopic();
  const [uid, setUid] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUid(u?.uid ?? null));
    return () => unsub();
  }, []);

  if (!studyTopic) return null;

  return (
    <div className="mx-auto mb-6 flex max-w-4xl flex-wrap items-center justify-between gap-3 rounded-xl border border-violet-500/25 bg-violet-500/10 px-4 py-3 text-sm text-slate-200">
      <p className="min-w-0 flex-1">
        <span className="text-slate-400">Topic: </span>
        <span className="font-medium text-white">{studyTopic}</span>
      </p>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <TopicFilesButton
          topic={studyTopic}
          userId={uid ?? ""}
          className="rounded-lg border border-violet-400/30 bg-violet-500/20 px-3 py-1.5 text-xs font-semibold text-violet-100 transition hover:bg-violet-500/30"
        />
        <Link
          href="/"
          className="font-medium text-violet-300 underline-offset-2 hover:text-violet-200 hover:underline"
        >
          Change topic on Home
        </Link>
      </div>
    </div>
  );
}
