"use client";

/**
 * Planner: overview + Week 1, then week-by-week. Includes follow-up chat (plan_chat)
 * grounded in RAG + the current plan excerpt.
 */

import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/services/firebase";
import { api } from "@/services/api";
import { useStudyTopic } from "@/contexts/StudyTopicContext";
import { ChatMessages } from "@/components/ChatMessages";
import { LS_PLANNER, TOPIC_PURGED_EVENT, type TopicPurgedDetail } from "@/lib/topicArtifacts";
import { useTopicAccess } from "@/lib/topicAccess";

const MAX_WEEKS = 24;
const MAX_PLAN_EXCERPT = 12_000;
const MAX_CHAT_STORE = 20;

/** Short starters—tap fills the question box (user edits / sends). */
const PLAN_QA_STARTERS = [
  "What should I do first in Week 1?",
  "Explain one tricky term from my notes in simple terms.",
  "How should I split time between new topics and review?",
] as const;

export type PlanChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type PlannerStored = {
  v: 1;
  uid: string;
  topic: string;
  plan: string | null;
  nextWeekToGenerate: number | null;
  planCadence?: "day" | "week" | "phase";
  input: string;
  planChatMessages: PlanChatMessage[];
};

type PlanCadence = "day" | "week" | "phase";

function inferCadence(text: string): PlanCadence {
  const s = (text || "").toLowerCase();
  if (/\bday(s)?\b/.test(s)) return "day";
  if (/\bweek(s)?\b/.test(s)) return "week";
  if (/\bphase(s)?\b/.test(s)) return "phase";
  return "week";
}

function cadenceLabel(c: PlanCadence): string {
  if (c === "day") return "Day";
  if (c === "phase") return "Phase";
  return "Week";
}

function loadPlannerState(uid: string, topic: string): PlannerStored | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LS_PLANNER);
    if (!raw) return null;
    const d = JSON.parse(raw) as PlannerStored;
    if (d.v !== 1 || d.uid !== uid || d.topic.trim() !== topic.trim()) return null;
    const out: PlannerStored = {
      v: 1,
      uid: d.uid,
      topic: d.topic,
      plan: d.plan,
      nextWeekToGenerate: d.nextWeekToGenerate,
      input: typeof d.input === "string" ? d.input : "",
      planChatMessages: Array.isArray(d.planChatMessages) ? d.planChatMessages : [],
    };
    return out;
  } catch {
    return null;
  }
}

function savePlannerState(payload: Omit<PlannerStored, "v">) {
  if (typeof window === "undefined") return;
  try {
    const data: PlannerStored = { v: 1, ...payload };
    localStorage.setItem(LS_PLANNER, JSON.stringify(data));
  } catch {
    /* quota / private mode */
  }
}

function agentFailureMessage(detail?: string | null): string {
  const base =
    "I didn’t get a usable answer back—empty reply, safety block, or the API flaked. Peek at your Gemini key in backend `.env`, shorten the focus box, and hit try again. Planner shoves more of your notes into the prompt than chat does, so it’s usually the first thing to time out.";
  const d = detail?.trim();
  if (!d) return base;
  return `${base}\n\nExtra detail: ${d}`;
}

/** Renders plan text; `**term**` becomes real bold (matches planner prompt rules). */
function renderPlanWithBold(text: string): ReactNode {
  if (!text) return null;
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        const m = /^\*\*([^*]+)\*\*$/.exec(part);
        if (m) {
          return (
            <strong key={i} className="font-semibold text-white">
              {m[1]}
            </strong>
          );
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </>
  );
}

function renderPlanWithSeparators(
  text: string,
  options?: {
    onExplainBlock?: (blockText: string, blockIndex: number) => void;
    onAskFollowUp?: (blockText: string, blockIndex: number) => void;
    onFollowUpInputChange?: (blockIndex: number, value: string) => void;
    onSendFollowUp?: (blockText: string, blockIndex: number) => void;
    explainingBlockIndex?: number | null;
    blockExplanations?: Record<number, string>;
    explanationMinimizedByBlock?: Record<number, boolean>;
    followUpOpenByBlock?: Record<number, boolean>;
    followUpInputByBlock?: Record<number, string>;
    followUpReplyByBlock?: Record<number, string>;
    followUpLoadingIndex?: number | null;
  },
): ReactNode {
  const blocks = text
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);

  if (blocks.length <= 1) return renderPlanWithBold(text);
  const onExplainBlock = options?.onExplainBlock;
  const onAskFollowUp = options?.onAskFollowUp;
  const onFollowUpInputChange = options?.onFollowUpInputChange;
  const onSendFollowUp = options?.onSendFollowUp;
  const explainingBlockIndex = options?.explainingBlockIndex ?? null;
  const blockExplanations = options?.blockExplanations ?? {};
  const explanationMinimizedByBlock = options?.explanationMinimizedByBlock ?? {};
  const followUpOpenByBlock = options?.followUpOpenByBlock ?? {};
  const followUpInputByBlock = options?.followUpInputByBlock ?? {};
  const followUpReplyByBlock = options?.followUpReplyByBlock ?? {};
  const followUpLoadingIndex = options?.followUpLoadingIndex ?? null;
  const looksLikeSectionHeader = (value: string) =>
    /^[A-Z0-9][A-Z0-9 \-—:()]+$/.test(value.trim());

  const isExplanationEligibleBlock = (value: string) => {
    if (looksLikeSectionHeader(value)) return false;
    const upper = value.toUpperCase();
    const blocked = [
      "SELF-CHECK",
      "SELF CHECK",
      "SELF-TEST",
      "SELF TEST",
      "PRACTICE",
      "REFLECTION",
      "CHECKPOINT",
      "QUIZ YOURSELF",
      "TRY THIS",
      "SEND ME THE NEXT UNIT",
      "GENERATE WEEK",
      "GENERATE DAY",
      "IN THE SAME STYLE",
      "FROM THE APP",
    ];
    if (blocked.some((k) => upper.includes(k))) return false;
    return true;
  };

  const isDetailedGuideBlock = (blockIndex: number) => {
    let activeHeader: string | null = null;
    for (let i = 0; i <= blockIndex; i += 1) {
      const b = blocks[i]?.trim() ?? "";
      if (!b || b === "---") continue;
      if (looksLikeSectionHeader(b)) {
        activeHeader = b;
      }
    }
    if (!activeHeader) return false;
    return /DETAILED STUDY GUIDE/i.test(activeHeader);
  };

  return (
    <div className="divide-y divide-indigo-400/25">
      {blocks.map((block, idx) => (
        <div key={idx} className="py-3 first:pt-0 last:pb-0">
          {block === "---" ? (
            <div className="py-1">
              <div className="flex items-center gap-3">
                <span className="h-px flex-1 bg-indigo-400/35" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-indigo-300/80">
                  Next generated section
                </span>
                <span className="h-px flex-1 bg-indigo-400/35" />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="whitespace-pre-wrap">{renderPlanWithBold(block)}</div>
              {(onExplainBlock || onAskFollowUp) && isDetailedGuideBlock(idx) && isExplanationEligibleBlock(block) && (
                <div className="flex flex-wrap gap-2">
                  {onExplainBlock && (
                    <button
                      type="button"
                      onClick={() => onExplainBlock(block, idx)}
                      disabled={explainingBlockIndex === idx}
                      className="rounded-md border border-indigo-400/35 bg-indigo-500/10 px-2.5 py-1 text-xs font-medium text-indigo-100 transition hover:bg-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {explainingBlockIndex === idx
                        ? "Explaining…"
                        : blockExplanations[idx]
                          ? explanationMinimizedByBlock[idx]
                            ? "Show explanation"
                            : "Hide explanation"
                          : "Explain more"}
                    </button>
                  )}
                  {onAskFollowUp && (
                    <button
                      type="button"
                      onClick={() => onAskFollowUp(block, idx)}
                      className="rounded-md border border-teal-500/30 bg-teal-500/10 px-2.5 py-1 text-xs font-medium text-teal-100 transition hover:bg-teal-500/20"
                    >
                      {followUpOpenByBlock[idx] ? "Hide follow-up" : "Ask follow-up"}
                    </button>
                  )}
                </div>
              )}
              {blockExplanations[idx] && !explanationMinimizedByBlock[idx] && (
                <div className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-sm leading-relaxed text-indigo-100/95">
                  {renderPlanWithBold(blockExplanations[idx] ?? "")}
                </div>
              )}
              {followUpOpenByBlock[idx] && (
                <div className="rounded-lg border border-teal-500/25 bg-teal-950/20 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-teal-300/90">Block follow-up chat</p>
                  <div className="mt-2 flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-900/90 px-2 py-2">
                    <input
                      type="text"
                      value={followUpInputByBlock[idx] ?? ""}
                      onChange={(e) => onFollowUpInputChange?.(idx, e.target.value)}
                      placeholder="Ask about this block..."
                      className="min-w-0 flex-1 border-0 bg-transparent px-2 py-1.5 text-sm text-white placeholder:text-slate-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => onSendFollowUp?.(block, idx)}
                      disabled={!followUpInputByBlock[idx]?.trim() || followUpLoadingIndex === idx}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-cyan-500 text-white shadow-md shadow-teal-900/30 transition hover:from-teal-400 hover:to-cyan-400 disabled:cursor-not-allowed disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-400 disabled:shadow-none"
                      aria-label="Send block follow-up"
                      title="Send"
                    >
                      {followUpLoadingIndex === idx ? (
                        "…"
                      ) : (
                        <svg className="h-4 w-4 rotate-180" viewBox="0 0 24 24" fill="none" aria-hidden>
                          <path
                            d="M4 12l15-7-4.5 7L19 19 4 12z"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path d="M14.5 12H8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                        </svg>
                      )}
                    </button>
                  </div>
                  {followUpReplyByBlock[idx] && (
                    <div className="mt-3 rounded-md border border-teal-500/20 bg-teal-500/10 px-3 py-2 text-sm text-teal-50/95">
                      {renderPlanWithBold(followUpReplyByBlock[idx] ?? "")}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function buildPlanChatPayload(
  question: string,
  studyTopic: string,
  plan: string,
): string {
  const excerpt =
    plan.length > MAX_PLAN_EXCERPT
      ? `${plan.slice(0, MAX_PLAN_EXCERPT)}\n\n[… plan truncated for the model …]`
      : plan;
  return [
    question.trim(),
    "",
    "---",
    `Topic: ${studyTopic}`,
    "",
    "Study plan excerpt (answer in relation to this and the course materials):",
    excerpt,
  ].join("\n");
}

export function StudyPlanner() {
  const [input, setInput] = useState("");
  const [plan, setPlan] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [nextWeekToGenerate, setNextWeekToGenerate] = useState<number | null>(null);
  const [planCadence, setPlanCadence] = useState<PlanCadence>("week");
  const [planChatMessages, setPlanChatMessages] = useState<PlanChatMessage[]>([]);
  const [planChatInput, setPlanChatInput] = useState("");
  const [planChatLoading, setPlanChatLoading] = useState(false);
  const [planExplainLoadingIndex, setPlanExplainLoadingIndex] = useState<number | null>(null);
  const [planExplainByBlock, setPlanExplainByBlock] = useState<Record<number, string>>({});
  const [planExplainMinimizedByBlock, setPlanExplainMinimizedByBlock] = useState<Record<number, boolean>>({});
  const [planFollowUpOpenByBlock, setPlanFollowUpOpenByBlock] = useState<Record<number, boolean>>({});
  const [planFollowUpInputByBlock, setPlanFollowUpInputByBlock] = useState<Record<number, string>>({});
  const [planFollowUpReplyByBlock, setPlanFollowUpReplyByBlock] = useState<Record<number, string>>({});
  const [planFollowUpLoadingIndex, setPlanFollowUpLoadingIndex] = useState<number | null>(null);
  const inFlightRef = useRef(false);
  const { studyTopic, authReady, topicReady } = useStudyTopic();
  const { effectiveUserId } = useTopicAccess(user, studyTopic);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authReady || !topicReady || !user?.uid || !studyTopic?.trim()) return;
    const s = loadPlannerState(user.uid, studyTopic);
    if (!s) return;
    setPlan(s.plan);
    setNextWeekToGenerate(s.nextWeekToGenerate);
    setPlanCadence(s.planCadence ?? "week");
    setInput(s.input);
    setPlanChatMessages(Array.isArray(s.planChatMessages) ? s.planChatMessages : []);
  }, [authReady, topicReady, user?.uid, studyTopic]);

  useEffect(() => {
    if (!authReady || !topicReady || !user?.uid || !studyTopic?.trim()) return;
    const onPurged = (ev: Event) => {
      const ce = ev as CustomEvent<TopicPurgedDetail>;
      const d = ce.detail;
      if (!d) return;
      if (d.uid !== user.uid) return;
      if (d.topic.trim() !== studyTopic.trim()) return;
      inFlightRef.current = false;
      setLoading(false);
      setPlanChatLoading(false);
      setPlanExplainLoadingIndex(null);
      setPlanFollowUpLoadingIndex(null);
      setErr(null);
      setPlan(null);
      setNextWeekToGenerate(null);
      setPlanCadence("week");
      setInput("");
      setPlanChatMessages([]);
      setPlanChatInput("");
      setPlanExplainByBlock({});
      setPlanExplainMinimizedByBlock({});
      setPlanFollowUpOpenByBlock({});
      setPlanFollowUpInputByBlock({});
      setPlanFollowUpReplyByBlock({});
    };
    window.addEventListener(TOPIC_PURGED_EVENT, onPurged as EventListener);
    return () => window.removeEventListener(TOPIC_PURGED_EVENT, onPurged as EventListener);
  }, [authReady, topicReady, user?.uid, studyTopic]);

  const topicOk = Boolean(studyTopic?.trim());
  const signedIn = user !== null && user !== undefined;

  const persist = useCallback(
    (
      overrides?: Partial<
        Pick<PlannerStored, "plan" | "nextWeekToGenerate" | "planCadence" | "input" | "planChatMessages">
      >,
    ) => {
      if (!user?.uid || !studyTopic?.trim()) return;
      savePlannerState({
        uid: user.uid,
        topic: studyTopic,
        plan: overrides?.plan ?? plan,
        nextWeekToGenerate: overrides?.nextWeekToGenerate ?? nextWeekToGenerate,
        planCadence: overrides?.planCadence ?? planCadence,
        input: overrides?.input ?? input.trim(),
        planChatMessages: (overrides?.planChatMessages ?? planChatMessages).slice(-MAX_CHAT_STORE),
      });
    },
    [user?.uid, studyTopic, plan, nextWeekToGenerate, planCadence, input, planChatMessages],
  );

  const runInitialPlan = useCallback(async () => {
    const q =
      input.trim() ||
      `Create a study plan for my topic "${studyTopic ?? ""}" with spaced review before exams.`;
    if (inFlightRef.current || !user || !topicOk) return;
    inFlightRef.current = true;
    setLoading(true);
    setErr(null);
    setPlan(null);
    setNextWeekToGenerate(null);
    setPlanCadence(inferCadence(q));
    setPlanExplainByBlock({});
    setPlanExplainMinimizedByBlock({});
    setPlanFollowUpOpenByBlock({});
    setPlanFollowUpInputByBlock({});
    setPlanFollowUpReplyByBlock({});
    setPlanExplainLoadingIndex(null);
    setPlanChatMessages([]);
    try {
      const data = await api.runAgent({
        message: q,
        userId: effectiveUserId ?? user.uid,
        topic: studyTopic!,
        mode: "planner",
      });
      if (data.error) {
        setErr(agentFailureMessage(data.error_detail));
        return;
      }
      if (!data.answer?.trim()) {
        setErr(agentFailureMessage(data.error_detail));
        return;
      }
      const detectedCadence = inferCadence(`${q}\n${data.answer}`);
      setPlan(data.answer);
      setNextWeekToGenerate(2);
      setPlanCadence(detectedCadence);
      savePlannerState({
        uid: user.uid,
        topic: studyTopic!,
        plan: data.answer,
        nextWeekToGenerate: 2,
        planCadence: detectedCadence,
        input: input.trim(),
        planChatMessages: [],
      });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to generate plan.");
    } finally {
      setLoading(false);
      inFlightRef.current = false;
    }
  }, [input, studyTopic, topicOk, user]);

  const runWeekDetail = useCallback(
    async (weekNum: number) => {
      if (inFlightRef.current || !user || !topicOk) return;
      if (weekNum < 2 || weekNum > MAX_WEEKS) return;
      inFlightRef.current = true;
      setLoading(true);
      setErr(null);
      try {
        const focus = input.trim();
        const unit = cadenceLabel(planCadence);
        const message = [
          `Generate the detailed study guide for ${unit} ${weekNum} only.`,
          `Course / topic: "${studyTopic}".`,
          focus ? `Student focus / constraints: ${focus}` : "Use the syllabus and materials to infer what belongs in this week.",
          `Provide full explanations, deeper understanding, practice prompts, and how this ${unit.toLowerCase()} builds on earlier ${unit.toLowerCase()}s (briefly).`,
        ].join("\n");

        const data = await api.runAgent({
          message,
          userId: effectiveUserId ?? user.uid,
          topic: studyTopic!,
          mode: "planner_week",
        });
        if (data.error) {
          setErr(agentFailureMessage(data.error_detail));
          return;
        }
        const block = data.answer?.trim();
        const next = weekNum < MAX_WEEKS ? weekNum + 1 : null;
        if (!block) {
          setErr(agentFailureMessage(data.error_detail));
          return;
        }
        setPlan((prev) => {
          const merged = prev ? `${prev}\n\n---\n\n${block}` : block;
          savePlannerState({
            uid: user!.uid,
            topic: studyTopic!,
            plan: merged,
            nextWeekToGenerate: next,
            planCadence,
            input: input.trim(),
            planChatMessages,
          });
          return merged;
        });
        setNextWeekToGenerate(next);
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : "Failed to generate week.");
      } finally {
        setLoading(false);
        inFlightRef.current = false;
      }
    },
    [input, studyTopic, topicOk, user, planChatMessages, planCadence],
  );

  const sendPlanChat = useCallback(async () => {
    const q = planChatInput.trim();
    if (!q || !user || !topicOk || !plan?.trim() || planChatLoading) return;
    setPlanChatLoading(true);
    setPlanChatInput("");
    const userMsg: PlanChatMessage = { role: "user", content: q };
    setPlanChatMessages((prev) => [...prev, userMsg]);
    try {
      const payload = buildPlanChatPayload(q, studyTopic!, plan);
      const data = await api.runAgent({
        message: payload,
        userId: effectiveUserId ?? user.uid,
        topic: studyTopic!,
        mode: "plan_chat",
      });
      if (data.error) {
        setPlanChatMessages((prev) => prev.slice(0, -1));
        setPlanChatInput(q);
        setErr(agentFailureMessage(data.error_detail));
        return;
      }
      const reply = data.answer?.trim() || "No response.";
      const assistantMsg: PlanChatMessage = { role: "assistant", content: reply };
      setPlanChatMessages((prev) => {
        const next = [...prev, assistantMsg].slice(-MAX_CHAT_STORE);
        savePlannerState({
          uid: user.uid,
          topic: studyTopic!,
          plan,
          nextWeekToGenerate,
          planCadence,
          input: input.trim(),
          planChatMessages: next,
        });
        return next;
      });
    } catch (e: unknown) {
      setPlanChatMessages((prev) => prev.slice(0, -1));
      setPlanChatInput(q);
      setErr(e instanceof Error ? e.message : "Chat failed.");
    } finally {
      setPlanChatLoading(false);
    }
  }, [
    planChatInput,
    user,
    topicOk,
    plan,
    planChatLoading,
    studyTopic,
    nextWeekToGenerate,
    planCadence,
    input,
  ]);

  const clearPlanChat = useCallback(() => {
    setPlanChatMessages([]);
    if (user?.uid && studyTopic?.trim() && plan) {
      savePlannerState({
        uid: user.uid,
        topic: studyTopic,
        plan,
        nextWeekToGenerate,
        planCadence,
        input: input.trim(),
        planChatMessages: [],
      });
    }
  }, [user?.uid, studyTopic, plan, nextWeekToGenerate, planCadence, input]);

  const explainPlanBlock = useCallback(
    async (blockText: string, blockIndex: number) => {
      if (!user || !topicOk || !plan?.trim() || !studyTopic?.trim()) return;
      if (planExplainByBlock[blockIndex]) {
        setPlanExplainMinimizedByBlock((prev) => ({ ...prev, [blockIndex]: !prev[blockIndex] }));
        return;
      }
      if (planExplainLoadingIndex !== null) return;
      setErr(null);
      setPlanExplainLoadingIndex(blockIndex);
      try {
        const question = [
          "Explain this plan section in more depth.",
          "Keep it practical and student-friendly.",
          "",
          "PLAN SECTION:",
          blockText.trim(),
          "",
          "Include: deeper concept explanation, why it matters, and one concrete study action.",
        ].join("\n");
        const payload = buildPlanChatPayload(question, studyTopic, plan);
        const data = await api.runAgent({
          message: payload,
          userId: effectiveUserId ?? user.uid,
          topic: studyTopic,
          mode: "plan_chat",
        });
        setPlanExplainByBlock((prev) => ({
          ...prev,
          [blockIndex]: data.answer?.trim() || "No explanation returned.",
        }));
        setPlanExplainMinimizedByBlock((prev) => ({ ...prev, [blockIndex]: false }));
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : "Could not generate explanation.");
      } finally {
        setPlanExplainLoadingIndex(null);
      }
    },
    [user, topicOk, plan, studyTopic, planExplainLoadingIndex, planExplainByBlock],
  );

  const askFollowUpForBlock = useCallback((blockText: string, blockIndex: number) => {
    setPlanFollowUpOpenByBlock((prev) => {
      const currentlyOpen = !!prev[blockIndex];
      if (currentlyOpen) {
        return { ...prev, [blockIndex]: false };
      }
      return { ...prev, [blockIndex]: true };
    });
    if (planFollowUpOpenByBlock[blockIndex]) return;
    const excerpt = blockText.trim().slice(0, 600);
    const followUp = [
      "Follow-up on this plan section:",
      excerpt,
      "",
      "Can you explain this in simpler terms and give one concrete example?",
    ].join("\n");
    setPlanFollowUpInputByBlock((prev) => ({ ...prev, [blockIndex]: prev[blockIndex] || followUp }));
  }, [planFollowUpOpenByBlock]);

  const sendFollowUpForBlock = useCallback(
    async (_blockText: string, blockIndex: number) => {
      const q = (planFollowUpInputByBlock[blockIndex] ?? "").trim();
      if (!q || !user || !topicOk || !plan?.trim() || !studyTopic?.trim()) return;
      if (planFollowUpLoadingIndex !== null) return;
      setErr(null);
      setPlanFollowUpLoadingIndex(blockIndex);
      try {
        const payload = buildPlanChatPayload(q, studyTopic, plan);
        const data = await api.runAgent({
          message: payload,
          userId: effectiveUserId ?? user.uid,
          topic: studyTopic,
          mode: "plan_chat",
        });
        setPlanFollowUpReplyByBlock((prev) => ({
          ...prev,
          [blockIndex]: data.answer?.trim() || "No follow-up response returned.",
        }));
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : "Could not send follow-up.");
      } finally {
        setPlanFollowUpLoadingIndex(null);
      }
    },
    [planFollowUpInputByBlock, user, topicOk, plan, studyTopic, planFollowUpLoadingIndex],
  );

  const handlePlannerKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter" || e.shiftKey) return;
    if (loading || !signedIn || !topicOk) return;
    e.preventDefault();
    void runInitialPlan();
  };

  const handlePlanChatKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" || e.shiftKey) return;
    if (planChatLoading || !plan?.trim()) return;
    e.preventDefault();
    void sendPlanChat();
  };

  const canAddWeek = nextWeekToGenerate !== null && nextWeekToGenerate <= MAX_WEEKS;
  const unitLabel = cadenceLabel(planCadence);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-800/80 bg-gradient-to-b from-slate-900/70 to-slate-950/90 p-6 shadow-xl shadow-black/20 transition hover:border-slate-700/90">
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400"
            aria-hidden
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </span>
          <div>
            <h2 className="font-display text-xl font-semibold tracking-tight text-white">Study plan</h2>
            <p className="text-base text-slate-400">
              I generate the overview + {unitLabel} 1 first; you can peel off more {unitLabel.toLowerCase()}s when you want. Nitpick the plan down in{" "}
              <span className="text-slate-200">Plan Q&A</span>.
            </p>
          </div>
        </div>
        {signedIn && authReady && topicReady && !topicOk && (
          <p className="mt-4 text-sm text-rose-300">
            Set a topic on{" "}
            <Link href="/" className="underline">
              Home
            </Link>{" "}
            first—I’m not guessing the class name for you.
          </p>
        )}
        <div className="mt-6">
          <label htmlFor="planner-input" className="text-base font-medium text-slate-300">
            Your goals &amp; focus (optional)
          </label>
          <p className="mt-0.5 text-xs text-slate-500">Optional—I read it every time you hit generate.</p>
          <textarea
            id="planner-input"
            placeholder="e.g. Final exam in 2 weeks — cover chapters 1–8 with spaced review…"
            rows={3}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handlePlannerKeyDown}
            onBlur={() => {
              if (!user?.uid || !studyTopic?.trim() || !plan) return;
              persist();
            }}
            disabled={!signedIn || !topicOk || loading}
            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-3 text-white placeholder-slate-500 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => void runInitialPlan()}
            disabled={loading || !signedIn || !topicOk}
            className="mt-4 rounded-full bg-indigo-500 px-6 py-2.5 text-base font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:bg-slate-700"
          >
            {loading && !plan ? "Generating…" : `Generate overview + ${unitLabel} 1`}
          </button>
          {err && <p className="mt-3 text-sm text-rose-400">{err}</p>}
        </div>
      </div>

      {plan && canAddWeek && nextWeekToGenerate !== null && (
        <div className="rounded-2xl border border-indigo-500/35 bg-gradient-to-br from-indigo-950/50 to-slate-950/80 px-6 py-5 shadow-lg shadow-indigo-950/30">
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-300/95">Next step</p>
          <p className="mt-2 text-base text-slate-300">
            Full detail for <span className="font-semibold text-white">{unitLabel} {nextWeekToGenerate}</span> only.
          </p>
          <button
            type="button"
            onClick={() => void runWeekDetail(nextWeekToGenerate)}
            disabled={loading || !signedIn || !topicOk}
            className="mt-4 rounded-full border border-indigo-400/50 bg-indigo-500/15 px-6 py-2.5 text-base font-semibold text-indigo-100 transition hover:bg-indigo-500/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading && plan
              ? `Generating ${unitLabel} ${nextWeekToGenerate}…`
              : `Generate ${unitLabel} ${nextWeekToGenerate} — full detail`}
          </button>
        </div>
      )}

      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/35 p-6 shadow-inner shadow-black/20">
        <h3 className="font-display text-base font-semibold uppercase tracking-wider text-indigo-400/90">Your plan</h3>
        {plan ? (
          <div className="mt-4 text-base leading-relaxed text-slate-200">
            {renderPlanWithSeparators(plan, {
              onExplainBlock: explainPlanBlock,
              onAskFollowUp: askFollowUpForBlock,
              onFollowUpInputChange: (blockIndex, value) =>
                setPlanFollowUpInputByBlock((prev) => ({ ...prev, [blockIndex]: value })),
              onSendFollowUp: sendFollowUpForBlock,
              explainingBlockIndex: planExplainLoadingIndex,
              blockExplanations: planExplainByBlock,
              explanationMinimizedByBlock: planExplainMinimizedByBlock,
              followUpOpenByBlock: planFollowUpOpenByBlock,
              followUpInputByBlock: planFollowUpInputByBlock,
              followUpReplyByBlock: planFollowUpReplyByBlock,
              followUpLoadingIndex: planFollowUpLoadingIndex,
            })}
          </div>
        ) : (
          <p className="mt-4 text-center text-slate-500">Hit generate and I’ll park the plan here.</p>
        )}
      </div>

      {plan && (
        <div className="rounded-2xl border border-teal-900/40 bg-gradient-to-b from-slate-900/60 to-slate-950/90 p-6 shadow-lg shadow-black/25">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-teal-400/95">
                Plan Q&A
              </h3>
              <p className="mt-1 text-xs text-slate-500">I pull from your topic, notes, and whatever plan text is above.</p>
            </div>
            {planChatMessages.length > 0 && (
              <button
                type="button"
                onClick={clearPlanChat}
                className="text-xs font-medium text-slate-500 underline-offset-2 hover:text-slate-300 hover:underline"
              >
                Clear chat
              </button>
            )}
          </div>
          <ChatMessages
            messages={planChatMessages.map((m) => ({
              role: m.role === "assistant" ? "assistant" : "user",
              content: m.content,
            }))}
            isLoading={planChatLoading}
            userBubbleClass="bg-teal-600/85 text-white shadow-teal-950/40"
            aiBubbleClass="border border-slate-700 bg-slate-800/90 text-slate-100"
            emptyState={
              <p className="py-6 text-center text-sm text-slate-600">
                Nothing here yet—ask something blunt.
              </p>
            }
          />

          {planChatMessages.length === 0 && (
            <div className="mt-4 rounded-xl border border-dashed border-teal-600/25 bg-teal-950/20 px-3 py-3 sm:px-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-teal-400/90">Starter ideas</p>
              <p className="mt-1 text-xs text-slate-500">Tap one to paste into the box—you still have to hit Send.</p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                {PLAN_QA_STARTERS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setPlanChatInput(q)}
                    disabled={planChatLoading || !signedIn || !topicOk}
                    className="w-full rounded-lg border border-teal-500/30 bg-teal-500/10 px-3 py-2 text-left text-xs font-medium leading-snug text-teal-100/95 transition hover:border-teal-400/45 hover:bg-teal-500/18 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:max-w-[min(100%,20rem)]"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 rounded-xl border-2 border-teal-500/35 bg-slate-950/70 p-4 shadow-inner shadow-black/20 ring-1 ring-teal-500/15">
            <label htmlFor="plan-chat-input" className="text-sm font-semibold text-teal-100/95">
              Your question
            </label>
            <div className="mt-2 flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-900 px-2 py-2 shadow-inner">
              <input
                id="plan-chat-input"
                type="text"
                value={planChatInput}
                onChange={(e) => setPlanChatInput(e.target.value)}
                onKeyDown={handlePlanChatKeyDown}
                disabled={planChatLoading || !signedIn || !topicOk}
                placeholder="Type your question…"
                className="min-w-0 flex-1 border-0 bg-transparent px-2 py-1.5 text-sm text-white placeholder:text-slate-600 focus:outline-none disabled:opacity-50"
                aria-describedby="plan-chat-input-hint"
              />
              <button
                type="button"
                onClick={() => void sendPlanChat()}
                disabled={planChatLoading || !planChatInput.trim() || !signedIn || !topicOk}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-cyan-500 text-white shadow-md shadow-teal-900/30 transition hover:from-teal-400 hover:to-cyan-400 disabled:cursor-not-allowed disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-400 disabled:shadow-none"
                aria-label="Send follow-up question"
                title="Send"
              >
                {planChatLoading ? (
                  "…"
                ) : (
                  <svg className="h-4 w-4 rotate-180" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="M4 12l15-7-4.5 7L19 19 4 12z"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path d="M14.5 12H8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                )}
              </button>
            </div>
            <p id="plan-chat-input-hint" className="sr-only">
              Sends your question about the plan text above to the same backend as chat.
            </p>
          </div>
        </div>
      )}

      {plan && canAddWeek && nextWeekToGenerate !== null && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => void runWeekDetail(nextWeekToGenerate)}
            disabled={loading || !signedIn || !topicOk}
            className="rounded-full border border-indigo-400/50 bg-indigo-500/15 px-7 py-3 text-base font-semibold text-indigo-100 transition hover:bg-indigo-500/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? `Generating ${unitLabel} ${nextWeekToGenerate}…`
              : `Generate next ${unitLabel} (${unitLabel} ${nextWeekToGenerate})`}
          </button>
        </div>
      )}
    </div>
  );
}
