"use client";

import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/services/firebase";

export type AppRole = "student" | "professor";

type UserProfileDoc = {
  role?: AppRole;
};

function normalizeRole(value: unknown): AppRole {
  return value === "professor" ? "professor" : "student";
}

export async function getUserRole(uid: string): Promise<AppRole> {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) return "student";
    const data = snap.data() as UserProfileDoc;
    return normalizeRole(data.role);
  } catch {
    // If Firestore rules block reads, keep app usable with safe default role.
    return "student";
  }
}

export async function upsertUserProfile(params: {
  uid: string;
  name: string | null;
  email: string | null;
  role: AppRole;
}): Promise<void> {
  const { uid, name, email, role } = params;
  await setDoc(
    doc(db, "users", uid),
    {
      name: name ?? "",
      email: email ?? "",
      role,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true },
  );
}
