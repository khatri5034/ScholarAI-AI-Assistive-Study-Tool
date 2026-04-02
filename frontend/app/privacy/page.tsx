/**
 * Legal placeholder linked from signup; replace copy before production. Static page = no client JS.
 */

import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-slate-950 pt-24 pb-16 text-white">
      <div className="mx-auto max-w-2xl px-6">
        <p className="text-sm font-medium text-violet-400/90">ScholarAI</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="mt-6 text-slate-400">
          This is a placeholder page. Replace with your real Privacy Policy before launch.
          Describe what data you collect (e.g. account email, uploaded documents), how you use
          it, and how users can contact you or delete their data.
        </p>
        <p className="mt-8">
          <Link href="/signup" className="text-violet-400 hover:text-violet-300">
            ← Back to sign up
          </Link>
        </p>
      </div>
    </main>
  );
}
