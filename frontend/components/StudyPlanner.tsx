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

const MAX_WEEKS = 24;
const MAX_PLAN_EXCERPT = 12_000;
const MAX_CHAT_STORE = 20;

const LS_PLANNER = "scholarai_planner_state";

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
  input: string;
  planChatMessages: PlanChatMessage[];
};

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
  const [planChatMessages, setPlanChatMessages] = useState<PlanChatMessage[]>([]);
  const [planChatInput, setPlanChatInput] = useState("");
  const [planChatLoading, setPlanChatLoading] = useState(false);
  const inFlightRef = useRef(false);
  const { studyTopic, authReady, topicReady } = useStudyTopic();

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
    setInput(s.input);
    setPlanChatMessages(Array.isArray(s.planChatMessages) ? s.planChatMessages : []);
  }, [authReady, topicReady, user?.uid, studyTopic]);

  const topicOk = Boolean(studyTopic?.trim());
  const signedIn = user !== null && user !== undefined;

  const persist = useCallback(
    (overrides?: Partial<Pick<PlannerStored, "plan" | "nextWeekToGenerate" | "input" | "planChatMessages">>) => {
      if (!user?.uid || !studyTopic?.trim()) return;
      savePlannerState({
        uid: user.uid,
        topic: studyTopic,
        plan: overrides?.plan ?? plan,
        nextWeekToGenerate: overrides?.nextWeekToGenerate ?? nextWeekToGenerate,
        input: overrides?.input ?? input.trim(),
        planChatMessages: (overrides?.planChatMessages ?? planChatMessages).slice(-MAX_CHAT_STORE),
      });
    },
    [user?.uid, studyTopic, plan, nextWeekToGenerate, input, planChatMessages],
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
    setPlanChatMessages([]);
    try {
      const data = await api.runAgent({
        message: q,
        userId: user.uid,
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
      setPlan(data.answer);
      setNextWeekToGenerate(2);
      savePlannerState({
        uid: user.uid,
        topic: studyTopic!,
        plan: data.answer,
        nextWeekToGenerate: 2,
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
        const message = [
          `Generate the detailed study guide for Week ${weekNum} only.`,
          `Course / topic: "${studyTopic}".`,
          focus ? `Student focus / constraints: ${focus}` : "Use the syllabus and materials to infer what belongs in this week.",
          "Provide full explanations, deeper understanding, practice prompts, and how this week builds on earlier weeks (briefly).",
        ].join("\n");

        const data = await api.runAgent({
          message,
          userId: user.uid,
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
    [input, studyTopic, topicOk, user, planChatMessages],
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
        userId: user.uid,
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
        input: input.trim(),
        planChatMessages: [],
      });
    }
  }, [user?.uid, studyTopic, plan, nextWeekToGenerate, input]);

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
            <h2 className="font-display text-lg font-semibold tracking-tight text-white">Study plan</h2>
            <p className="text-sm text-slate-400">
              I generate the overview + Week 1 first; you can peel off more weeks when you want. Nitpick the plan down in{" "}
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
          <label htmlFor="planner-input" className="text-sm font-medium text-slate-300">
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
            className="mt-4 rounded-full bg-indigo-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:bg-slate-700"
          >
            {loading && !plan ? "Generating…" : "Generate overview + Week 1"}
          </button>
          {err && <p className="mt-3 text-sm text-rose-400">{err}</p>}
        </div>
      </div>

      {plan && canAddWeek && nextWeekToGenerate !== null && (
        <div className="rounded-2xl border border-indigo-500/35 bg-gradient-to-br from-indigo-950/50 to-slate-950/80 px-6 py-5 shadow-lg shadow-indigo-950/30">
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-300/95">Next step</p>
          <p className="mt-2 text-sm text-slate-300">
            Full detail for <span className="font-semibold text-white">Week {nextWeekToGenerate}</span> only.
          </p>
          <button
            type="button"
            onClick={() => void runWeekDetail(nextWeekToGenerate)}
            disabled={loading || !signedIn || !topicOk}
            className="mt-4 rounded-full border border-indigo-400/50 bg-indigo-500/15 px-6 py-2.5 text-sm font-semibold text-indigo-100 transition hover:bg-indigo-500/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading && plan ? `Generating Week ${nextWeekToGenerate}…` : `Generate Week ${nextWeekToGenerate} — full detail`}
          </button>
        </div>
      )}

      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/35 p-6 shadow-inner shadow-black/20">
        <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-indigo-400/90">Your plan</h3>
        {plan ? (
          <div className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-200">
            {renderPlanWithBold(plan)}
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
            <div className="mt-2 flex flex-wrap gap-2">
              <input
                id="plan-chat-input"
                type="text"
                value={planChatInput}
                onChange={(e) => setPlanChatInput(e.target.value)}
                onKeyDown={handlePlanChatKeyDown}
                disabled={planChatLoading || !signedIn || !topicOk}
                placeholder="Type your question…"
                className="min-w-0 flex-1 rounded-xl border border-slate-600 bg-slate-900 px-4 py-3 text-sm text-white shadow-inner placeholder:text-slate-600 focus:border-teal-400/60 focus:outline-none focus:ring-2 focus:ring-teal-500/30 disabled:opacity-50"
                aria-describedby="plan-chat-input-hint"
              />
              <button
                type="button"
                onClick={() => void sendPlanChat()}
                disabled={planChatLoading || !planChatInput.trim() || !signedIn || !topicOk}
                className="rounded-xl bg-teal-600 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-teal-900/30 transition hover:bg-teal-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:shadow-none"
              >
                Send
              </button>
            </div>
            <p id="plan-chat-input-hint" className="sr-only">
              Sends your question about the plan text above to the same backend as chat.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
