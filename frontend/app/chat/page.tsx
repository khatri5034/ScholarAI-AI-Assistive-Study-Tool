/**
 * RAG chat for the active study topic. TopicGuard + banner keep UX aligned with per-topic indexes on the server.
 */

import { ChatBox } from "@/components";
import { TopicGuard } from "@/components/TopicGuard";
import { StudyTopicBanner } from "@/components/StudyTopicBanner";

export default function ChatPage() {
  return (
    <TopicGuard>
      <main className="min-h-screen bg-slate-950 pt-16 pb-24">
        <section className="relative overflow-hidden border-b border-slate-800">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_-10%,rgba(99,102,241,0.12),transparent)]" />
          <div className="relative mx-auto max-w-4xl px-6 py-12">
            <p className="mb-2 text-sm font-medium uppercase tracking-wider text-indigo-400">
              Study Chat
            </p>
            <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Ask about your material
            </h1>
            <p className="mt-3 max-w-xl text-slate-400">
              Signed-in users with uploads get answers grounded in their materials. The public demo shows how chat works—
              it does not use your documents until you sign up and upload files.
            </p>
          </div>
        </section>
        <div className="mx-auto max-w-4xl px-6 py-12">
          <StudyTopicBanner />
          <ChatBox />
        </div>
      </main>
    </TopicGuard>
  );
}
