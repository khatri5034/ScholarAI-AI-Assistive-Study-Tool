/**
 * Site-wide footer (Server Component): static links only, no client state needed.
 */

import Link from "next/link";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-slate-800 bg-slate-950 px-6 py-8">
      <div className="mx-auto max-w-6xl">
        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-slate-400">
          <Link href="/privacy" className="hover:text-indigo-400">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-indigo-400">
            Terms
          </Link>
          <Link href="/contact" className="hover:text-indigo-400">
            Contact
          </Link>
        </nav>
        <p className="mt-6 text-center text-sm text-slate-400">
          © {year} ScholarAI. All rights reserved.
        </p>
        <p className="mt-2 text-center text-sm text-slate-500">
          Founded by <span className="font-medium text-slate-400">Kiran Khatri</span> and{" "}
          <span className="font-medium text-slate-400">Keith Tang</span>.
        </p>
      </div>
    </footer>
  );
}
