/**
 * Login route: split brand + form shell (`AuthPageShell`) and `LoginForm` (Suspense for `useSearchParams`).
 */

import { Suspense } from "react";
import { AuthPageShell, LoginForm } from "@/components";

function LoginFormFallback() {
  return (
    <div className="space-y-4 animate-pulse" aria-busy="true" aria-label="Loading sign-in form">
      <div className="h-12 w-full rounded-lg bg-slate-800/80" />
      <div className="h-px w-full bg-slate-700/50" />
      <div className="h-11 w-full rounded-lg bg-slate-800/80" />
      <div className="h-11 w-full rounded-lg bg-slate-800/80" />
      <div className="h-11 w-full rounded-lg bg-violet-900/40" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <AuthPageShell variant="login">
      <Suspense fallback={<LoginFormFallback />}>
        <LoginForm />
      </Suspense>
    </AuthPageShell>
  );
}
