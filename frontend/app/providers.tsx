"use client";

/**
 * Client-only providers wrapped around the tree. Root `layout.tsx` is a Server
 * Component, so context must start here—not in `layout` directly.
 */

import { StudyTopicProvider } from "@/contexts/StudyTopicContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return <StudyTopicProvider>{children}</StudyTopicProvider>;
}
