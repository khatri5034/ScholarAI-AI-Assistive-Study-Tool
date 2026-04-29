/**
 * Client-only artifacts keyed by signed-in user + study topic (chat, planner, quiz).
 * Centralized so topic delete can wipe everything consistently.
 */

export const TOPIC_PURGED_EVENT = "scholarai:topic-purged";

export type TopicPurgedDetail = { uid: string; topic: string };

export const CHAT_LS_KEY = "scholarai_chat_history";
export const LS_PLANNER = "scholarai_planner_state";
export const LS_QUIZ = "last_quiz";
export const LS_QUIZ_TOPIC = "last_quiz_topic";
export const LS_FOCUS = "quiz_focus";
export const LS_QUIZ_FORMAT = "quiz_format";

/** Mirrors topic keys used in chat localStorage. */
export function topicStorageKey(topic: string | null | undefined): string {
  const t = (topic ?? "").trim().toLowerCase();
  return t || "__no_topic__";
}

type ChatStoredV1 = {
  v: 1;
  userKey: string;
  byTopic: Record<string, unknown[]>;
};

/**
 * Remove persisted chat/planner/quiz data for `topic` for the given Firebase uid.
 * Also dispatches `TOPIC_PURGED_EVENT` so open tabs/components can reset in-memory UI.
 */
export function purgeLocalTopicArtifacts(uid: string, topic: string) {
  const trimmed = topic.trim();
  if (!trimmed || typeof window === "undefined") return;
  const topicKey = topicStorageKey(trimmed);

  // Chat history (per-topic buckets)
  try {
    const rawChat = localStorage.getItem(CHAT_LS_KEY);
    if (rawChat) {
      const parsed = JSON.parse(rawChat) as Partial<ChatStoredV1> & { messages?: unknown[] };
      if (parsed.v === 1 && parsed.userKey && parsed.byTopic && typeof parsed.byTopic === "object") {
        const nextByTopic = { ...parsed.byTopic };
        delete nextByTopic[topicKey];
        if (Object.keys(nextByTopic).length === 0) {
          localStorage.removeItem(CHAT_LS_KEY);
        } else {
          const nextPayload: ChatStoredV1 = {
            v: 1,
            userKey: parsed.userKey,
            byTopic: nextByTopic,
          };
          localStorage.setItem(CHAT_LS_KEY, JSON.stringify(nextPayload));
        }
      }
    }
  } catch {
    /* ignore corrupt storage */
  }

  // Planner local state (single-object store; only clear if it matches this topic)
  try {
    const rawPlanner = localStorage.getItem(LS_PLANNER);
    if (rawPlanner) {
      const d = JSON.parse(rawPlanner) as { topic?: unknown; uid?: unknown };
      const storedTopic = typeof d.topic === "string" ? d.topic.trim() : "";
      const storedUid = typeof d.uid === "string" ? d.uid.trim() : "";
      if (storedUid === uid && storedTopic === trimmed) {
        localStorage.removeItem(LS_PLANNER);
      }
    }
  } catch {
    /* ignore */
  }

  // Quiz cache is mostly global; clear when it was generated for this topic (or legacy heuristics).
  try {
    const storedQuizTopic = (localStorage.getItem(LS_QUIZ_TOPIC) ?? "").trim();
    const currentTopic = (localStorage.getItem(`scholarai_study_topic_${uid}`) ?? "").trim();
    const shouldClearQuiz =
      storedQuizTopic === trimmed ||
      (!storedQuizTopic && currentTopic === trimmed);
    if (shouldClearQuiz) {
      localStorage.removeItem(LS_QUIZ);
      localStorage.removeItem(LS_QUIZ_TOPIC);
      localStorage.removeItem(LS_FOCUS);
      localStorage.removeItem(LS_QUIZ_FORMAT);
    }
  } catch {
    /* ignore */
  }

  window.dispatchEvent(new CustomEvent<TopicPurgedDetail>(TOPIC_PURGED_EVENT, { detail: { uid, topic: trimmed } }));
}
