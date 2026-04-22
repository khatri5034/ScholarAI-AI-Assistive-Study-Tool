/**
 * Sign-up route: same shell as login; `SignupForm` handles terms, password policy, and `?next=`.
 */

import { Suspense } from "react";
import { AuthPageShell, SignupForm } from "@/components";

function SignupFormFallback() {
  return (
    <div className="space-y-4 animate-pulse" aria-busy="true" aria-label="Loading sign-up form">
      <div className="h-12 w-full rounded-lg bg-slate-800/80" />
      <div className="h-px w-full bg-slate-700/50" />
      <div className="h-11 w-full rounded-lg bg-slate-800/80" />
      <div className="h-11 w-full rounded-lg bg-slate-800/80" />
      <div className="h-11 w-full rounded-lg bg-slate-800/80" />
      <div className="h-11 w-full rounded-lg bg-violet-900/40" />
    </div>
  );
}

export default function SignupPage() {
  return (
    <AuthPageShell variant="signup">
      <Suspense fallback={<SignupFormFallback />}>
        <SignupForm />
      </Suspense>
    </AuthPageShell>
  );
}
