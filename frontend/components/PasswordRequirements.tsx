"use client";

import { getPasswordRules } from "@/lib/passwordPolicy";

type PasswordRequirementsProps = {
  password: string;
  /** When false, rules show as neutral hints (signup before typing). */
  showProgress?: boolean;
};

export function PasswordRequirements({
  password,
  showProgress = true,
}: PasswordRequirementsProps) {
  const rules = getPasswordRules(password);

  return (
    <div className="rounded-lg border border-slate-600/50 bg-slate-950/40 px-3 py-2.5">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        Password requirements
      </p>
      <ul className="mt-2 space-y-1.5 text-xs" aria-live="polite">
        {rules.map((r) => {
          const met = r.met;
          const dim = showProgress && password.length === 0;
          return (
            <li
              key={r.key}
              className={
                dim
                  ? "text-slate-500"
                  : met
                    ? "text-emerald-400/95"
                    : "text-slate-400"
              }
            >
              <span className="mr-1.5 inline-block w-3.5 text-center" aria-hidden>
                {dim ? "·" : met ? "✓" : "○"}
              </span>
              {r.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
