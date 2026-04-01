"use client";

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

const MAX_TOPIC_HISTORY = 20;

type StudyTopicContextValue = {
  studyTopic: string | null;
  setStudyTopic: (topic: string) => void;
  clearStudyTopic: () => void;
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

  const authReady = uid !== undefined;

  const value = useMemo(
    () => ({
      studyTopic,
      setStudyTopic,
      clearStudyTopic,
      topicHistory,
      authReady,
      topicReady,
    }),
    [studyTopic, setStudyTopic, clearStudyTopic, topicHistory, authReady, topicReady]
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
