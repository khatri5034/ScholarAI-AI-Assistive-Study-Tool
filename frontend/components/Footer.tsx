export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-slate-800 bg-slate-950 px-6 py-8">
      <div className="mx-auto max-w-6xl">
        <p className="text-center text-sm text-slate-400">
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
