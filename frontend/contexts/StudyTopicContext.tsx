"use client";

/**
 * Study topic + history scoped to the signed-in Firebase user.
 *
 * Why React context (not only URL): topic drives uploads, RAG folders, and gating; we
 * want it instantly available everywhere without prop drilling.
 *
 * Why localStorage keyed by uid: survives refresh without a backend “session topic” table
 * for this MVP; clearing on logout is handled when uid becomes null.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/services/firebase";

// Cap history so storage stays small and the UI stays scannable.
const MAX_TOPIC_HISTORY = 20;

type StudyTopicContextValue = {
  studyTopic: string | null;
  setStudyTopic: (topic: string) => void;
  clearStudyTopic: () => void;
  /** Drop a topic from history and clear it as current focus if it matches. */
  removeTopicFromHistory: (topic: string) => void;
  /** Previously used topics (newest first); empty for guests. */
  topicHistory: string[];
  authReady: boolean;
  topicReady: boolean;
};

const StudyTopicContext = createContext<StudyTopicContextValue | null>(null);

function storageKey(uid: string) {
  return `scholarai_study_topic_${uid}`;
}

function historyKey(uid: string) {
  return `scholarai_study_topics_history_${uid}`;
}

function parseHistory(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x): x is string => typeof x === "string")
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function persistHistory(uid: string, list: string[]) {
  try {
    localStorage.setItem(historyKey(uid), JSON.stringify(list.slice(0, MAX_TOPIC_HISTORY)));
  } catch {
    /* ignore */
  }
}

export function StudyTopicProvider({ children }: { children: React.ReactNode }) {
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [studyTopic, setStudyTopicState] = useState<string | null>(null);
  const [topicHistory, setTopicHistory] = useState<string[]>([]);
  const [topicReady, setTopicReady] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUid(u?.uid ?? null);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (uid === undefined) {
      setTopicReady(false);
      return;
    }
    if (!uid) {
      setStudyTopicState(null);
      setTopicHistory([]);
      setTopicReady(true);
      return;
    }
    try {
      const current = localStorage.getItem(storageKey(uid))?.trim() || null;
      setStudyTopicState(current);

      let history = [...new Set(parseHistory(localStorage.getItem(historyKey(uid))))];
      if (current && !history.includes(current)) {
        history = [current, ...history.filter((t) => t !== current)].slice(0, MAX_TOPIC_HISTORY);
        persistHistory(uid, history);
      }
      setTopicHistory(history);
    } catch {
      setStudyTopicState(null);
      setTopicHistory([]);
    }
    setTopicReady(true);
  }, [uid]);

  const setStudyTopic = useCallback(
    (topic: string) => {
      const trimmed = topic.trim();
      if (!trimmed || !uid) return;
      setStudyTopicState(trimmed);
      try {
        localStorage.setItem(storageKey(uid), trimmed);
      } catch {
        /* ignore */
      }
      setTopicHistory((prev) => {
        const next = [trimmed, ...prev.filter((t) => t !== trimmed)].slice(0, MAX_TOPIC_HISTORY);
        persistHistory(uid, next);
        return next;
      });
    },
    [uid]
  );

  const clearStudyTopic = useCallback(() => {
    if (!uid) {
      setStudyTopicState(null);
      return;
    }
    setStudyTopicState(null);
    try {
      localStorage.removeItem(storageKey(uid));
    } catch {
      /* ignore */
    }
  }, [uid]);

  const removeTopicFromHistory = useCallback(
    (topic: string) => {
      const trimmed = topic.trim();
      if (!trimmed || !uid) return;
      setTopicHistory((prev) => {
        const next = prev.filter((t) => t !== trimmed);
        persistHistory(uid, next);
        return next;
      });
      setStudyTopicState((current) => {
        if (current !== trimmed) return current;
        try {
          localStorage.removeItem(storageKey(uid));
        } catch {
          /* ignore */
        }
        return null;
      });
    },
    [uid]
  );

  const authReady = uid !== undefined;

  const value = useMemo(
    () => ({
      studyTopic,
      setStudyTopic,
      clearStudyTopic,
      removeTopicFromHistory,
      topicHistory,
      authReady,
      topicReady,
    }),
    [
      studyTopic,
      setStudyTopic,
      clearStudyTopic,
      removeTopicFromHistory,
      topicHistory,
      authReady,
      topicReady,
    ]
  );

  return (
    <StudyTopicContext.Provider value={value}>{children}</StudyTopicContext.Provider>
  );
}

export function useStudyTopic() {
  const ctx = useContext(StudyTopicContext);
  if (!ctx) {
    throw new Error("useStudyTopic must be used within StudyTopicProvider");
  }
  return ctx;
}
