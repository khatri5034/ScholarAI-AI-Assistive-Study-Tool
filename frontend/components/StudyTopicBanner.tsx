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
              userId={uid ?? ""}
              className="flex min-h-11 w-full items-center justify-center rounded-xl border border-violet-400/40 bg-violet-500/15 px-4 py-2.5 text-sm font-medium text-violet-100 transition hover:bg-violet-500/25 sm:min-w-[8.5rem]"
            />
            <Link
              href="/"
              className="flex min-h-11 w-full items-center justify-center rounded-xl border border-slate-600/90 bg-slate-800/60 px-4 py-2.5 text-center text-sm font-medium text-slate-100 transition hover:border-slate-500 hover:bg-slate-800 sm:min-w-[8.5rem]"
            >
              Change topic
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
