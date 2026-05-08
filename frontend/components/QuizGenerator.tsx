"use client";

import { Fragment, useEffect, useMemo, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import { collection, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { auth } from "@/services/firebase";
import { db } from "@/services/firebase";
import { api } from "@/services/api";
import { useStudyTopic } from "@/contexts/StudyTopicContext";
import { useTopicAccess } from "@/lib/topicAccess";
import {
  LS_FOCUS,
  LS_QUIZ,
  LS_QUIZ_FORMAT,
  LS_QUIZ_TOPIC,
  TOPIC_PURGED_EVENT,
  type TopicPurgedDetail,
} from "@/lib/topicArtifacts";

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

function splitNumberedItems(body: string): string[] {
  const trimmed = body.trim();
  if (!trimmed) return [];
  const matches = [...trimmed.matchAll(/^\d+\.\s/gm)];
  if (matches.length === 0) return [trimmed];
  return matches.map((m, i) => {
    const start = m.index ?? 0;
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? trimmed.length) : trimmed.length;
    return trimmed.slice(start, end).trim();
  });
}

function itemNumber(item: string): number | null {
  const m = item.match(/^(\d+)\.\s/);
  return m ? Number(m[1]) : null;
}

function extractAnswerKeyMap(text: string): Map<number, string> {
  const out = new Map<number, string>();
  const lines = text.split("\n");
  let inKey = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line === "ANSWER KEY" || /^##\s*ANSWER KEY\b/i.test(line)) {
      inKey = true;
      continue;
    }
    if (!inKey) continue;
    if (line === "EXAM" || /^##\s*EXAM\b/i.test(line)) break;
    const m = line.match(/^(\d+)\.\s*(.+)$/);
    if (!m) continue;
    out.set(Number(m[1]), m[2].trim());
  }
  return out;
}

function extractAnswerKeyMapFromRaw(raw: string): Map<number, string> {
  const out = new Map<number, string>();
  const lines = raw.split("\n");
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const m = line.match(/^(\d+)\.\s*(.+)$/);
    if (!m) continue;
    out.set(Number(m[1]), m[2].trim());
  }
  return out;
}

function extractExamItems(text: string): Array<{ number: number; raw: string; choices: string[] }> {
  const examMatch = text.match(/(?:^|\n)(?:##\s*)?EXAM\b([\s\S]*?)(?:\n(?:##\s*)?ANSWER KEY\b|$)/i);
  const examBody = (examMatch?.[1] ?? text).trim();
  return splitNumberedItems(examBody)
    .map((raw) => {
      const number = itemNumber(raw);
      if (number === null) return null;
      const choices = raw
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => /^[A-D][\).:]\s+/.test(line));
      return { number, raw, choices };
    })
    .filter((x): x is { number: number; raw: string; choices: string[] } => x !== null);
}

function normalizeAnswer(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function isAnswerCorrect(studentAnswer: string, keyAnswer: string): boolean {
  const s = normalizeAnswer(studentAnswer);
  const k = normalizeAnswer(keyAnswer);
  if (!s || !k) return false;
  if (s === k) return true;
  const sFirst = s.split(" ")[0] ?? "";
  const kFirst = k.split(" ")[0] ?? "";
  return sFirst === kFirst;
}

function renderSectionWithSeparators(body: string) {
  const trimmed = body.trim();
  if (!trimmed) return null;

  const items = splitNumberedItems(trimmed);
  if (items.length <= 1) {
    return renderBodySegments(body);
  }

  const tightenChoiceSpacing = (text: string) =>
    text
      // Collapse extra blank lines right before option rows like A), A., B), etc.
      .replace(/\n{2,}(?=[A-D][\).:]\s)/g, "\n")
      // Collapse accidental blank lines between consecutive option rows.
      .replace(/([A-D][\).:]\s[^\n]*)\n{2,}(?=[A-D][\).:]\s)/g, "$1\n");

  return (
    <div className="divide-y divide-amber-400/35">
      {items.map((item, i) => (
        <div key={i} className="py-3 first:pt-0 last:pb-0 shadow-[inset_0_1px_0_rgba(251,191,36,0.08)]">
          <div className="whitespace-pre-wrap">{renderBodySegments(tightenChoiceSpacing(item))}</div>
        </div>
      ))}
    </div>
  );
}

type QuizDisplayProps = {
  text: string;
  onExplainQuestion?: (questionNumber: number, questionText: string) => void;
  explainingQuestion?: number | null;
  explanations?: Record<number, string>;
  studentAnswers?: Record<number, string>;
  onStudentAnswerChange?: (questionNumber: number, value: string) => void;
  quizSubmitted?: boolean;
  answerKeyMap?: Map<number, string>;
  revealCorrectness?: boolean;
};

type AssignedQuiz = {
  id: string;
  courseName: string;
  courseId: string;
  professorName: string;
  quizTitle: string;
  quizBody: string;
  quizBodyStudent?: string;
  quizAnswerKey?: string;
  answersPublished?: boolean;
  note: string;
  studentSubmissionAnswers?: Record<string, string>;
  studentSubmissionScore?: number;
};

/** EXAM / ANSWER KEY (plain) or legacy ## headings. */
function QuizDisplay({
  text,
  onExplainQuestion,
  explainingQuestion = null,
  explanations = {},
  studentAnswers = {},
  onStudentAnswerChange,
  quizSubmitted = false,
  answerKeyMap = new Map<number, string>(),
  revealCorrectness = true,
}: QuizDisplayProps) {
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
                {s.title === "EXAM" ? (
                  <div className="divide-y divide-amber-400/35">
                    {splitNumberedItems(s.body).map((item, i) => {
                      const n = itemNumber(item);
                      const canExplain = n !== null && !!onExplainQuestion;
                      const itemLines = item.split("\n");
                      const choiceLines = itemLines
                        .map((line) => line.trim())
                        .filter((line) => /^[A-D][\).:]\s+/.test(line));
                      const stemOnly = itemLines
                        .filter((line) => !/^[A-D][\).:]\s+/.test(line.trim()))
                        .join("\n")
                        .trim();
                      return (
                        <div
                          key={`${s.key}-${i}`}
                          className="py-3 first:pt-0 last:pb-0 shadow-[inset_0_1px_0_rgba(251,191,36,0.08)]"
                        >
                          <div className="whitespace-pre-wrap">{renderBodySegments(stemOnly || item)}</div>
                          {onStudentAnswerChange && n !== null && (
                            <div className="mt-3 rounded-lg border border-slate-700 bg-slate-900/60 p-3">
                              {choiceLines.length > 0 ? (
                                <div className="space-y-2">
                                  {choiceLines.map((choice) => (
                                    <label
                                      key={`${n}-${choice}`}
                                      className="flex items-center gap-2 text-sm text-slate-200"
                                    >
                                      <input
                                        type="radio"
                                        name={`q-${n}`}
                                        disabled={quizSubmitted}
                                        checked={(studentAnswers[n] ?? "") === choice}
                                        onChange={() => onStudentAnswerChange(n, choice)}
                                        className="h-4 w-4 accent-amber-400"
                                      />
                                      <span>{choice}</span>
                                    </label>
                                  ))}
                                </div>
                              ) : (
                                <input
                                  type="text"
                                  value={studentAnswers[n] ?? ""}
                                  onChange={(e) => onStudentAnswerChange(n, e.target.value)}
                                  disabled={quizSubmitted}
                                  placeholder="Type your answer"
                                  className="w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-sm text-white focus:border-amber-500/50 focus:outline-none disabled:opacity-70"
                                />
                              )}
                              {quizSubmitted && revealCorrectness && answerKeyMap.has(n) && (
                                <p
                                  className={`mt-2 text-xs ${
                                    isAnswerCorrect(studentAnswers[n] ?? "", answerKeyMap.get(n) ?? "")
                                      ? "text-emerald-300"
                                      : "text-rose-300"
                                  }`}
                                >
                                  {isAnswerCorrect(studentAnswers[n] ?? "", answerKeyMap.get(n) ?? "")
                                    ? "Correct"
                                    : `Incorrect (Answer: ${answerKeyMap.get(n) ?? "N/A"})`}
                                </p>
                              )}
                            </div>
                          )}
                          {canExplain && (
                            <div className="mt-2">
                              <button
                                type="button"
                                onClick={() => onExplainQuestion!(n, item)}
                                disabled={explainingQuestion === n}
                                className="rounded-md border border-amber-400/35 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-200 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {explainingQuestion === n ? "Explaining…" : "Explain this answer"}
                              </button>
                            </div>
                          )}
                          {n !== null && explanations[n] && (
                            <div className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/8 px-3 py-2 text-sm leading-relaxed text-amber-100/95">
                              {renderBodySegments(explanations[n])}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  renderSectionWithSeparators(s.body)
                )}
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
  const searchParams = useSearchParams();
  const assignedQuizId = searchParams.get("assigned_quiz")?.trim() ?? "";
  const [quizFormat, setQuizFormat] = useState<"mcq" | "short_answer">("mcq");
  const [focus, setFocus] = useState("");
  const [quiz, setQuiz] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [explainingQuestion, setExplainingQuestion] = useState<number | null>(null);
  const [explanations, setExplanations] = useState<Record<number, string>>({});
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [assignedQuizzes, setAssignedQuizzes] = useState<AssignedQuiz[]>([]);
  const [acceptedCourseIds, setAcceptedCourseIds] = useState<string[]>([]);
  const [activeQuizSource, setActiveQuizSource] = useState<"generated" | "assigned" | null>(null);
  const [activeAssignedAnswersPublished, setActiveAssignedAnswersPublished] = useState(false);
  const [activeAssignedQuizId, setActiveAssignedQuizId] = useState<string | null>(null);
  const [activeAssignedAnswerKey, setActiveAssignedAnswerKey] = useState<string>("");
  const [studentAnswers, setStudentAnswers] = useState<Record<number, string>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [submissionSaveState, setSubmissionSaveState] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const [submissionSaveError, setSubmissionSaveError] = useState<string | null>(null);
  const { studyTopic, authReady, topicReady } = useStudyTopic();
  const { effectiveUserId } = useTopicAccess(user, studyTopic);
  const answerKeyMap = useMemo(() => {
    const fromQuizBody = quiz ? extractAnswerKeyMap(quiz) : new Map<number, string>();
    if (fromQuizBody.size > 0) return fromQuizBody;
    if (activeAssignedAnswerKey.trim()) return extractAnswerKeyMapFromRaw(activeAssignedAnswerKey);
    return fromQuizBody;
  }, [activeAssignedAnswerKey, quiz]);
  const examItems = useMemo(() => (quiz ? extractExamItems(quiz) : []), [quiz]);
  const gradableItems = useMemo(
    () => examItems.filter((item) => answerKeyMap.has(item.number)),
    [answerKeyMap, examItems],
  );
  const score = useMemo(() => {
    if (!quizSubmitted) return { correct: 0, total: gradableItems.length };
    const correct = gradableItems.reduce((acc, item) => {
      const student = studentAnswers[item.number] ?? "";
      const key = answerKeyMap.get(item.number) ?? "";
      return acc + (isAnswerCorrect(student, key) ? 1 : 0);
    }, 0);
    return { correct, total: gradableItems.length };
  }, [answerKeyMap, gradableItems, quizSubmitted, studentAnswers]);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => setUser(u));
  }, []);

  useEffect(() => {
    if (!user?.email) {
      setAssignedQuizzes([]);
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
        const next: AssignedQuiz[] = snap.docs.map((doc) => {
          const d = doc.data() as Partial<AssignedQuiz>;
          const studentBody = d.quizBodyStudent ?? d.quizBody ?? "";
          const answerKey = d.quizAnswerKey ?? "";
          const published = !!d.answersPublished;
          const composedBody =
            published && answerKey.trim()
              ? `${studentBody}\n\nANSWER KEY\n${answerKey}`
              : studentBody;
          return {
            id: doc.id,
            courseName: d.courseName ?? "Course",
            courseId: d.courseId ?? "",
            professorName: d.professorName ?? "Professor",
            quizTitle: d.quizTitle ?? "Assigned quiz",
            quizBody: composedBody,
            quizBodyStudent: studentBody,
            quizAnswerKey: answerKey,
            answersPublished: published,
            note: d.note ?? "",
            studentSubmissionAnswers:
              (doc.data() as { studentSubmissionAnswers?: Record<string, string> }).studentSubmissionAnswers ??
              {},
            studentSubmissionScore: (doc.data() as { studentSubmissionScore?: number }).studentSubmissionScore,
          };
        });
        const filtered =
          acceptedCourseIds.length > 0
            ? next.filter((item) => item.courseId && acceptedCourseIds.includes(item.courseId))
            : [];
        setAssignedQuizzes(filtered);
      },
      () => setAssignedQuizzes([]),
    );
    return () => unsub();
  }, [acceptedCourseIds, user?.email]);

  useEffect(() => {
    if (!assignedQuizId) return;
    const target = assignedQuizzes.find((q) => q.id === assignedQuizId);
    if (!target) return;
    const sameAssignedQuizOpen = activeQuizSource === "assigned" && activeAssignedQuizId === target.id;
    setQuiz(target.quizBody);
    setActiveQuizSource("assigned");
    setActiveAssignedAnswersPublished(!!target.answersPublished);
    setActiveAssignedQuizId(target.id);
    setActiveAssignedAnswerKey(target.quizAnswerKey ?? "");
    if (!sameAssignedQuizOpen) {
      const restoredAnswers = Object.fromEntries(
        Object.entries(target.studentSubmissionAnswers ?? {}).map(([k, v]) => [Number(k), v]),
      ) as Record<number, string>;
      setStudentAnswers(restoredAnswers);
      setQuizSubmitted(typeof target.studentSubmissionScore === "number");
      setErr(null);
      setExplanations({});
      setExplainingQuestion(null);
    }
  }, [activeAssignedQuizId, activeQuizSource, assignedQuizId, assignedQuizzes]);

  useEffect(() => {
    if (!user?.email) {
      setAcceptedCourseIds([]);
      return;
    }
    const q = query(
      collection(db, "courseInvitations"),
      where("studentEmailLower", "==", user.email.toLowerCase()),
      where("status", "==", "accepted"),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const ids = snap.docs
          .map((d) => {
            const data = d.data() as { courseId?: string };
            return data.courseId ?? "";
          })
          .filter(Boolean);
        setAcceptedCourseIds(ids);
      },
      () => setAcceptedCourseIds([]),
    );
    return () => unsub();
  }, [user?.email]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const storedFocus = localStorage.getItem(LS_FOCUS);

      if (storedFocus !== null) {
        setFocus(storedFocus);
      }
      const storedFmt = localStorage.getItem(LS_QUIZ_FORMAT);
      if (storedFmt === "mcq" || storedFmt === "short_answer") {
        setQuizFormat(storedFmt);
      }
    } catch {
      /* ignore corrupt storage */
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!topicReady || !studyTopic?.trim()) return;
    try {
      const storedQuiz = localStorage.getItem(LS_QUIZ);
      const storedTopic = (localStorage.getItem(LS_QUIZ_TOPIC) ?? "").trim();
      if (!storedQuiz?.trim()) {
        setQuiz(null);
        return;
      }
      if (storedTopic && storedTopic !== studyTopic.trim()) {
        localStorage.removeItem(LS_QUIZ);
        localStorage.removeItem(LS_QUIZ_TOPIC);
        localStorage.removeItem(LS_FOCUS);
        localStorage.removeItem(LS_QUIZ_FORMAT);
        setQuiz(null);
        setActiveQuizSource(null);
        setActiveAssignedQuizId(null);
        setActiveAssignedAnswerKey("");
        setStudentAnswers({});
        setQuizSubmitted(false);
        setSubmissionSaveState("idle");
        setSubmissionSaveError(null);
        setFocus("");
        setExplanations({});
        setExplainingQuestion(null);
        return;
      }
      if (!storedTopic) {
        localStorage.setItem(LS_QUIZ_TOPIC, studyTopic.trim());
      }
      setQuiz(storedQuiz);
    } catch {
      /* ignore */
    }
  }, [topicReady, studyTopic]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!topicReady || !user?.uid || !studyTopic?.trim()) return;
    const onPurged = (ev: Event) => {
      const ce = ev as CustomEvent<TopicPurgedDetail>;
      const d = ce.detail;
      if (!d) return;
      if (d.uid !== user.uid) return;
      if (d.topic.trim() !== studyTopic.trim()) return;
      try {
        localStorage.removeItem(LS_QUIZ);
        localStorage.removeItem(LS_QUIZ_TOPIC);
        localStorage.removeItem(LS_FOCUS);
        localStorage.removeItem(LS_QUIZ_FORMAT);
      } catch {
        /* ignore */
      }
      setQuiz(null);
      setActiveQuizSource(null);
      setActiveAssignedAnswersPublished(false);
      setActiveAssignedQuizId(null);
      setActiveAssignedAnswerKey("");
      setStudentAnswers({});
      setQuizSubmitted(false);
      setSubmissionSaveState("idle");
      setSubmissionSaveError(null);
      setFocus("");
      setExplanations({});
      setExplainingQuestion(null);
      setErr(null);
      setLoading(false);
    };
    window.addEventListener(TOPIC_PURGED_EVENT, onPurged as EventListener);
    return () => window.removeEventListener(TOPIC_PURGED_EVENT, onPurged as EventListener);
  }, [topicReady, user?.uid, studyTopic]);

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
    setStudentAnswers({});
    setQuizSubmitted(false);
    setSubmissionSaveState("idle");
    setSubmissionSaveError(null);
    setExplanations({});
    setExplainingQuestion(null);
    try {
      const data = await api.runAgent({
        message,
        userId: effectiveUserId ?? user.uid,
        topic: studyTopic!,
        mode: "quiz",
        quiz_format: quizFormat,
      });
      setQuiz(data.answer);
      setActiveQuizSource("generated");
      setActiveAssignedQuizId(null);
      setActiveAssignedAnswerKey("");
      setStudentAnswers({});
      setQuizSubmitted(false);
      setSubmissionSaveState("idle");
      setSubmissionSaveError(null);
      setFocus("");

      try {
        localStorage.setItem(LS_QUIZ, data.answer);
        localStorage.setItem(LS_QUIZ_TOPIC, studyTopic!.trim());
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

  const handleExplainQuestion = async (questionNumber: number, questionText: string) => {
    if (!user || !topicOk || !studyTopic) return;
    if (!quiz?.trim()) return;
    if (explainingQuestion !== null) return;
    setExplainingQuestion(questionNumber);
    setErr(null);
    try {
      const answerMap = extractAnswerKeyMap(quiz);
      const answerLine = answerMap.get(questionNumber) ?? "No explicit answer key line found for this question.";
      const message = [
        `Question ${questionNumber}:`,
        questionText.trim(),
        "",
        `Answer key for question ${questionNumber}: ${answerLine}`,
        "",
        "Explain why this is correct and why alternatives are not (if multiple-choice). Keep it concise.",
      ].join("\n");

      const data = await api.runAgent({
        message,
        userId: effectiveUserId ?? user.uid,
        topic: studyTopic,
        mode: "quiz_explain",
      });

      setExplanations((prev) => ({
        ...prev,
        [questionNumber]: data.answer?.trim() || "No explanation returned.",
      }));
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Could not explain this question.");
    } finally {
      setExplainingQuestion(null);
    }
  };

  const handleSubmitQuiz = async () => {
    setQuizSubmitted(true);
    if (activeQuizSource !== "assigned" || !activeAssignedQuizId || !user?.uid) return;
    setSubmissionSaveState("saving");
    setSubmissionSaveError(null);
    try {
      const submissionAnswers = Object.fromEntries(
        Object.entries(studentAnswers).map(([k, v]) => [String(k), String(v)]),
      );
      await updateDoc(doc(db, "quizAssignments", activeAssignedQuizId), {
        studentSubmissionAnswers: submissionAnswers,
        studentSubmissionScore: score.correct,
        studentSubmissionTotal: examItems.length,
        studentSubmittedBy: user.uid,
        studentSubmittedEmail: user.email ?? "",
        studentSubmittedAt: serverTimestamp(),
      });
      setSubmissionSaveState("saved");
    } catch (e: unknown) {
      const code =
        typeof e === "object" && e !== null && "code" in e ? String((e as { code?: string }).code) : "";
      setSubmissionSaveState("failed");
      setSubmissionSaveError(
        code === "permission-denied"
          ? "Submission was not saved for professor view. Firestore rules denied this update."
          : e instanceof Error
            ? e.message
            : "Submission save failed.",
      );
    }
  };

  return (
    <div className="space-y-8 text-left">
      <div className="animate-fade-in-up">
        <h2 className="font-display text-xl font-semibold tracking-tight text-white">Practice exam</h2>
        <p className="mt-1 text-base leading-relaxed text-slate-400">
          I draft a tighter exam-style sheet from whatever you indexed for this topic—sanity check before the real one.
        </p>
        {topicOk && studyTopic && (
          <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-sm font-medium text-amber-100/95">
            <span className="text-amber-400/80">Scope</span>
            <span className="max-w-[min(100%,28rem)] truncate text-amber-50">{studyTopic}</span>
          </p>
        )}
      </div>

      {assignedQuizzes.length > 0 && (
        <section className="space-y-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/8 p-4">
          <h3 className="font-display text-lg font-semibold text-emerald-100">Assigned by your professor</h3>
          <div className="space-y-2">
            {assignedQuizzes.map((item) => (
              <div key={item.id} className="rounded-xl border border-emerald-500/20 bg-slate-900/70 p-3">
                <p className="text-sm font-semibold text-white">{item.quizTitle}</p>
                <p className="text-xs text-slate-400">
                  {item.courseName} • from {item.professorName}
                </p>
                {item.note && <p className="mt-1 text-xs text-emerald-100/90">{item.note}</p>}
                <button
                  type="button"
                  onClick={() => {
                    setQuiz(item.quizBody);
                    setActiveQuizSource("assigned");
                    setActiveAssignedAnswersPublished(!!item.answersPublished);
                    setActiveAssignedQuizId(item.id);
                    setActiveAssignedAnswerKey(item.quizAnswerKey ?? "");
                    setStudentAnswers({});
                    setQuizSubmitted(false);
                    setSubmissionSaveState("idle");
                    setSubmissionSaveError(null);
                    setErr(null);
                    setExplanations({});
                    setExplainingQuestion(null);
                  }}
                  className="mt-2 rounded-md border border-emerald-500/35 bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-100 transition hover:bg-emerald-500/25"
                >
                  Open assigned quiz
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {signedIn && authReady && topicReady && !topicOk && (
        <p className="text-sm text-rose-300">
          Pick a topic on{" "}
          <Link href="/" className="underline">
            Home
          </Link>
          , upload stuff, then run indexing from Upload—I need chunks first.
        </p>
      )}

      {activeQuizSource !== "assigned" && (
      <>
      <fieldset disabled={loading || !signedIn || !topicOk} className="min-w-0">
        <legend className="text-base font-medium text-slate-300">Question type</legend>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:gap-3">
          <label
            className={`flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-xl border px-4 py-2.5 text-base font-medium transition ${
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
            className={`flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-xl border px-4 py-2.5 text-base font-medium transition ${
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
        <label htmlFor="quiz-focus" className="text-base font-medium text-slate-300">
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
          className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-3 text-base text-white placeholder-slate-500 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50 disabled:opacity-50"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void generate()}
          disabled={loading || !signedIn || !topicOk}
          className="rounded-full bg-amber-500 px-6 py-2.5 text-base font-semibold text-slate-950 shadow-lg shadow-amber-500/20 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
        >
          {loading ? "Generating…" : "Generate quiz"}
        </button>
        {loading && (
          <span className="text-sm text-slate-400" aria-live="polite">
            Writing questions + answer key…
          </span>
        )}
      </div>
      </>
      )}

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
              <h2 className="font-display text-2xl font-semibold tracking-tight text-white">
                {activeQuizSource === "assigned" ? "Professor-assigned quiz" : "Your quiz"}
              </h2>
            </div>
            {activeQuizSource === "assigned" && (
              <button
                type="button"
                onClick={() => {
                  setQuiz(null);
                  setActiveQuizSource(null);
                  setActiveAssignedAnswersPublished(false);
                  setActiveAssignedQuizId(null);
                  setActiveAssignedAnswerKey("");
                  setStudentAnswers({});
                  setQuizSubmitted(false);
                  setSubmissionSaveState("idle");
                  setSubmissionSaveError(null);
                  setErr(null);
                }}
                className="rounded-md border border-slate-600 bg-slate-900/70 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-slate-800"
              >
                Back to quiz generator
              </button>
            )}
          </div>
          <div className="rounded-2xl border border-slate-800/80 bg-slate-950/40 p-6 shadow-inner shadow-black/30 sm:p-8">
            {activeQuizSource === "assigned" && !activeAssignedAnswersPublished && (
              <p className="mb-4 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/90">
                Answer key is not published yet. Explain button will appear after professor publishes answers.
              </p>
            )}
            {quizSubmitted && (
              <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/12 px-3 py-2">
                {gradableItems.length > 0 ? (
                  <p className="text-sm font-semibold text-emerald-100">
                    Submitted successfully. Score: {score.correct}/{score.total}
                  </p>
                ) : (
                  <p className="text-sm font-semibold text-amber-100">
                    Submitted successfully. Score will appear after professor publishes the answer key.
                  </p>
                )}
                {submissionSaveState === "saving" && (
                  <p className="mt-1 text-xs text-slate-300">Saving submission...</p>
                )}
                {submissionSaveState === "saved" && (
                  <p className="mt-1 text-xs text-emerald-200">Saved for professor review.</p>
                )}
                {submissionSaveState === "failed" && submissionSaveError && (
                  <p className="mt-1 text-xs text-rose-300">{submissionSaveError}</p>
                )}
              </div>
            )}
            <QuizDisplay
              text={quiz}
              onExplainQuestion={
                activeQuizSource === "assigned" && !activeAssignedAnswersPublished
                  ? undefined
                  : handleExplainQuestion
              }
              explainingQuestion={explainingQuestion}
              explanations={explanations}
              studentAnswers={studentAnswers}
              onStudentAnswerChange={(questionNumber, value) =>
                setStudentAnswers((prev) => ({
                  ...prev,
                  [questionNumber]: value,
                }))
              }
              quizSubmitted={quizSubmitted}
              answerKeyMap={answerKeyMap}
              revealCorrectness={
                activeQuizSource !== "assigned" || activeAssignedAnswersPublished
              }
            />
            {examItems.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {!quizSubmitted ? (
                  <button
                    type="button"
                    onClick={() => void handleSubmitQuiz()}
                    className="rounded-md border border-emerald-500/35 bg-emerald-500/15 px-3 py-1.5 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/25"
                  >
                    Submit quiz
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setQuizSubmitted(false);
                        setStudentAnswers({});
                        setSubmissionSaveState("idle");
                        setSubmissionSaveError(null);
                      }}
                      className="rounded-md border border-slate-600 bg-slate-800/70 px-3 py-1.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-700"
                    >
                      Retry
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
