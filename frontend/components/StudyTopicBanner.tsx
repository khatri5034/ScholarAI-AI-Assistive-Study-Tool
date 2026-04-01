"use client";

import Link from "next/link";
import { useStudyTopic } from "@/contexts/StudyTopicContext";
import { TopicFilesButton } from "./TopicFilesModal";

/** Shows current study topic on feature pages (signed-in users with a topic). */
export function StudyTopicBanner() {
  const { studyTopic } = useStudyTopic();
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
