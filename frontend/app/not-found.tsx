import Link from "next/link";

export default function NotFound() {
  return (
    <>
      <main className="min-h-screen bg-slate-950 pt-16 pb-24">
        <div className="mx-auto max-w-2xl px-6 py-24 text-center">
          <p className="mb-2 text-sm font-medium uppercase tracking-wider text-indigo-400">Error 404</p>
          <h1 className="font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Page not found
          </h1>
          <p className="mt-4 text-slate-400">
            The page you’re looking for doesn’t exist or has been moved.
          </p>
          <Link
            href="/"
            className="mt-8 inline-block rounded-full bg-indigo-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:bg-indigo-400"
          >
            Back to home
          </Link>
        </div>
      </main>
    </>
  );
}
