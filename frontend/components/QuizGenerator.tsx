"use client";

import { Fragment, useEffect, useMemo, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/services/firebase";
import { api } from "@/services/api";
import { useStudyTopic } from "@/contexts/StudyTopicContext";

const LS_QUIZ = "last_quiz";
const LS_FOCUS = "quiz_focus";
const LS_QUIZ_FORMAT = "quiz_format";

/** Turns legacy **term** in bodies into styled text (no raw asterisks). */
function renderBodySegments(body: string) {
  const parts = body.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        const m = /^\*\*([^*]+)\*\*$/.exec(part);
        if (m) {
          return (
            <strong key={i} className="font-semibold text-amber-100/95">
              {m[1]}
            </strong>
          );
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </>
  );
}

/** EXAM / ANSWER KEY (plain) or legacy ## headings. */
function QuizDisplay({ text }: { text: string }) {
  const sections = useMemo(() => {
    const trimmed = text.trim();
    if (!trimmed) return [];
    const parts = trimmed.split(/\n(?=(?:##\s|^EXAM\s*$|^ANSWER KEY\s*$))/m);
    return parts.map((block, i) => {
      const lines = block.trim().split("\n");
      const first = (lines[0] ?? "").trim();
      if (first.startsWith("## ")) {
        const title = first.replace(/^##\s+/, "").trim();
        const body = lines.slice(1).join("\n").trim();
        return { type: "section" as const, key: i, title, body };
      }
      if (first === "EXAM" || first === "ANSWER KEY") {
        const body = lines.slice(1).join("\n").trim();
        return { type: "section" as const, key: i, title: first, body };
      }
      return { type: "block" as const, key: i, body: block.trim() };
    });
  }, [text]);

  if (sections.length === 0) return null;

  return (
    <div className="space-y-8">
      {sections.map((s) =>
        s.type === "section" ? (
          <section
            key={s.key}
            className="rounded-xl border border-slate-700/60 bg-slate-950/40 p-5 shadow-inner shadow-black/20"
          >
            <h3 className="border-b border-slate-700/80 pb-3 font-display text-lg font-semibold tracking-tight text-amber-300/95">
              {s.title}
            </h3>
            {s.body ? (
              <div className="mt-4 whitespace-pre-wrap font-sans text-[15px] leading-relaxed text-slate-200">
                {renderBodySegments(s.body)}
              </div>
            ) : null}
          </section>
        ) : (
          <div
            key={s.key}
            className="whitespace-pre-wrap font-sans text-[15px] leading-relaxed text-slate-200"
          >
            {renderBodySegments(s.body)}
          </div>
        ),
      )}
    </div>
  );
}

export function QuizGenerator() {
  const [quizFormat, setQuizFormat] = useState<"mcq" | "short_answer">("mcq");
  const [focus, setFocus] = useState("");
  const [quiz, setQuiz] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const { studyTopic, authReady, topicReady } = useStudyTopic();

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => setUser(u));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const storedQuiz = localStorage.getItem(LS_QUIZ);
      const storedFocus = localStorage.getItem(LS_FOCUS);

      if (storedFocus !== null) {
        setFocus(storedFocus);
      }
      const storedFmt = localStorage.getItem(LS_QUIZ_FORMAT);
      if (storedFmt === "mcq" || storedFmt === "short_answer") {
        setQuizFormat(storedFmt);
      }
      if (storedQuiz?.trim()) {
        setQuiz(storedQuiz);
      }
    } catch {
      /* ignore corrupt storage */
    }
  }, []);

  const topicOk = Boolean(studyTopic?.trim());
  const signedIn = user !== null && user !== undefined;

  const generate = async () => {
    const message =
      focus.trim() ||
      `Generate a practice quiz for my current study topic: ${studyTopic || "course"}.`;
    if (loading || !user || !topicOk) return;
    setLoading(true);
    setErr(null);
    setQuiz(null);
    try {
      const data = await api.runAgent({
        message,
        userId: user.uid,
        topic: studyTopic!,
        mode: "quiz",
        quiz_format: quizFormat,
      });
      setQuiz(data.answer);
      setFocus("");

      try {
        localStorage.setItem(LS_QUIZ, data.answer);
        localStorage.removeItem(LS_FOCUS);
        localStorage.setItem(LS_QUIZ_FORMAT, quizFormat);
      } catch {
        /* quota / private mode */
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Quiz generation blew up—try again?");
    } finally {
      setLoading(false);
    }
  };

  const handleFocusKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter" || e.shiftKey) return;
    if (loading || !signedIn || !topicOk) return;
    e.preventDefault();
    void generate();
  };

  return (
    <div className="space-y-8 text-left">
      <div className="animate-fade-in-up">
        <h2 className="font-display text-lg font-semibold tracking-tight text-white">Practice exam</h2>
        <p className="mt-1 text-sm leading-relaxed text-slate-400">
          I draft a tighter exam-style sheet from whatever you indexed for this topic—sanity check before the real one.
        </p>
        {topicOk && studyTopic && (
          <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-100/95">
            <span className="text-amber-400/80">Scope</span>
            <span className="max-w-[min(100%,28rem)] truncate text-amber-50">{studyTopic}</span>
          </p>
        )}
      </div>

      {signedIn && authReady && topicReady && !topicOk && (
        <p className="text-sm text-rose-300">
          Pick a topic on{" "}
          <Link href="/" className="underline">
            Home
          </Link>
          , upload stuff, then run indexing from Upload—I need chunks first.
        </p>
      )}

      <fieldset disabled={loading || !signedIn || !topicOk} className="min-w-0">
        <legend className="text-sm font-medium text-slate-300">Question type</legend>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:gap-3">
          <label
            className={`flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-xl border px-4 py-2.5 text-sm font-medium transition ${
              quizFormat === "mcq"
                ? "border-amber-500/60 bg-amber-500/15 text-white ring-1 ring-amber-500/30"
                : "border-slate-700 bg-slate-900/50 text-slate-300 hover:border-slate-600"
            }`}
          >
            <input
              type="radio"
              name="quiz-format"
              value="mcq"
              checked={quizFormat === "mcq"}
              onChange={() => setQuizFormat("mcq")}
              className="sr-only"
            />
            Multiple choice
          </label>
          <label
            className={`flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-xl border px-4 py-2.5 text-sm font-medium transition ${
              quizFormat === "short_answer"
                ? "border-amber-500/60 bg-amber-500/15 text-white ring-1 ring-amber-500/30"
                : "border-slate-700 bg-slate-900/50 text-slate-300 hover:border-slate-600"
            }`}
          >
            <input
              type="radio"
              name="quiz-format"
              value="short_answer"
              checked={quizFormat === "short_answer"}
              onChange={() => setQuizFormat("short_answer")}
              className="sr-only"
            />
            Short answer
          </label>
        </div>
      </fieldset>

      <div>
        <label htmlFor="quiz-focus" className="text-sm font-medium text-slate-300">
          Focus (optional)
        </label>
        <p className="mt-0.5 text-xs text-slate-500">
          Optional: steer me (e.g. &quot;Week 11 transformers&quot;). Blank = broad mix. Enter generates · Shift+Enter
          is a newline.
        </p>
        <textarea
          id="quiz-focus"
          rows={2}
          value={focus}
          onChange={(e) => setFocus(e.target.value)}
          onKeyDown={handleFocusKeyDown}
          disabled={!signedIn || !topicOk || loading}
          placeholder="Leave empty if you want me to roam across everything indexed."
          className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-3 text-white placeholder-slate-500 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50 disabled:opacity-50"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void generate()}
          disabled={loading || !signedIn || !topicOk}
          className="rounded-full bg-amber-500 px-6 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-500/20 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
        >
          {loading ? "Generating…" : "Generate quiz"}
        </button>
        {loading && (
          <span className="text-sm text-slate-400" aria-live="polite">
            Writing questions + answer key…
          </span>
        )}
      </div>

      {loading && (
        <div
          className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/80"
          role="status"
          aria-busy="true"
          aria-label="Generating quiz"
        >
          <div className="h-1 w-full overflow-hidden bg-slate-800">
            <div className="h-full w-1/2 animate-shimmer bg-gradient-to-r from-transparent via-amber-500/70 to-transparent" />
          </div>
          <div className="space-y-3 p-6">
            <div className="h-4 w-3/4 max-w-md animate-pulse rounded bg-slate-700/80" />
            <div className="h-4 w-full max-w-lg animate-pulse rounded bg-slate-800/80" />
            <div className="h-4 w-5/6 max-w-md animate-pulse rounded bg-slate-800/80" />
            <div className="h-4 w-2/3 max-w-sm animate-pulse rounded bg-slate-800/60" />
          </div>
        </div>
      )}

      {err && <p className="text-sm text-rose-400">{err}</p>}

      {quiz && !loading && (
        <div className="animate-fade-in-up space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-2 border-b border-slate-800/80 pb-3">
            <div>
              <h2 className="font-display text-xl font-semibold tracking-tight text-white">Your quiz</h2>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-800/80 bg-slate-950/40 p-6 shadow-inner shadow-black/30 sm:p-8">
            <QuizDisplay text={quiz} />
          </div>
        </div>
      )}
    </div>
  );
}
