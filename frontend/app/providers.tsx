"use client";

import { StudyTopicProvider } from "@/contexts/StudyTopicContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return <StudyTopicProvider>{children}</StudyTopicProvider>;
}
