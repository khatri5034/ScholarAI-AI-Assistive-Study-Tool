"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { doc, getDoc, collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/services/firebase";
import type { AppRole } from "@/lib/userProfile";

type TopicAccessState = {
  effectiveUserId: string | null;
  isProfessorTopicForStudent: boolean;
  canUpload: boolean;
};

function normalizeTopicKey(topic: string | null | undefined): string {
  const raw = (topic ?? "").trim();
  if (!raw) return "";
  let out = "";
  for (const c of raw) {
    if (/[a-zA-Z0-9 _.-]/.test(c)) {
      out += c;
    } else if (c === "/" || c === "\\") {
      out += "_";
    } else {
      out += "_";
    }
  }
  out = out.replace(/^[\s._-]+|[\s._-]+$/g, "");
  out = out.replace(/_+/g, "_");
  return out.toLowerCase();
}

export function useTopicAccess(user: User | null | undefined, studyTopic: string | null): TopicAccessState {
  const [role, setRole] = useState<AppRole>("student");
  const [professorOwnerId, setProfessorOwnerId] = useState<string | null>(null);

  const emailLower = useMemo(() => user?.email?.trim().toLowerCase() ?? "", [user?.email]);
  const topicLower = useMemo(() => studyTopic?.trim().toLowerCase() ?? "", [studyTopic]);
  const topicKey = useMemo(() => normalizeTopicKey(studyTopic), [studyTopic]);

  useEffect(() => {
    if (!user?.uid) {
      setRole("student");
      return;
    }
    let cancelled = false;
    void getDoc(doc(db, "users", user.uid))
      .then((snap) => {
        if (cancelled) return;
        const raw = (snap.data() as { role?: unknown } | undefined)?.role;
        setRole(raw === "professor" ? "professor" : "student");
      })
      .catch(() => {
        if (!cancelled) setRole("student");
      });
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  useEffect(() => {
    if (!emailLower || !topicLower) {
      setProfessorOwnerId(null);
      return;
    }
    let inviteOwner: string | null = null;
    let assignmentOwner: string | null = null;
    const syncOwner = () => setProfessorOwnerId(inviteOwner ?? assignmentOwner ?? null);

    const q = query(
      collection(db, "courseInvitations"),
      where("studentEmailLower", "==", emailLower),
      where("status", "==", "accepted"),
    );
    const unsubInvites = onSnapshot(
      q,
      (snap) => {
        const match = snap.docs
          .map((d) => d.data() as { courseName?: string; professorId?: string })
          .find((d) => {
            if (!d.professorId) return false;
            const courseLower = d.courseName?.trim().toLowerCase() ?? "";
            const courseKey = normalizeTopicKey(d.courseName ?? "");
            return courseLower === topicLower || (topicKey && courseKey === topicKey);
          });
        inviteOwner = match?.professorId ?? null;
        syncOwner();
      },
      () => {
        inviteOwner = null;
        syncOwner();
      },
    );

    // Fallback: resolve ownership from sent assignments for this course/topic.
    const assignmentsQ = query(
      collection(db, "quizAssignments"),
      where("recipientEmailLower", "==", emailLower),
      where("status", "==", "sent"),
    );
    const unsubAssignments = onSnapshot(
      assignmentsQ,
      (snap) => {
        const match = snap.docs
          .map((d) => d.data() as { courseName?: string; professorId?: string })
          .find((d) => {
            if (!d.professorId) return false;
            const courseLower = d.courseName?.trim().toLowerCase() ?? "";
            const courseKey = normalizeTopicKey(d.courseName ?? "");
            return courseLower === topicLower || (topicKey && courseKey === topicKey);
          });
        assignmentOwner = match?.professorId ?? null;
        syncOwner();
      },
      () => {
        assignmentOwner = null;
        syncOwner();
      },
    );
    return () => {
      unsubInvites();
      unsubAssignments();
    };
  }, [emailLower, topicKey, topicLower]);

  const isProfessorTopicForStudent = role === "student" && !!professorOwnerId;
  return {
    effectiveUserId: professorOwnerId ?? user?.uid ?? null,
    isProfessorTopicForStudent,
    canUpload: !isProfessorTopicForStudent,
  };
}
