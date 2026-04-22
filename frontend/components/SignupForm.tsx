"use client";

/**
 * Registration: creates Firebase user, display name, and a Firestore `users` doc for
 * future profile/planner features. Terms checkbox satisfies basic compliance UX.
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { getSafeInternalPath } from "@/lib/safeInternalPath";
import {
  passwordEmailConflictMessage,
  passwordMeetsPolicy,
  passwordPolicyErrorMessage,
} from "@/lib/passwordPolicy";

import { AuthProviders, type ProviderType } from "./AuthProviders";
import { AUTH_FIELD, AUTH_LABEL, AUTH_PRIMARY_BTN } from "@/lib/authUi";
import { PasswordRequirements } from "./PasswordRequirements";

import {
  createUserWithEmailAndPassword,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";

import { doc, setDoc } from "firebase/firestore";

import { auth, db } from "@/services/firebase";

export function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = getSafeInternalPath(searchParams.get("next"));
  const uploadIntent = nextPath === "/upload";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<ProviderType | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const handleOAuth = async (provider: ProviderType) => {
    if (provider !== "google") return;
    setOauthLoading("google");
    setError("");

    if (!agreedToTerms) {
      setOauthLoading(null);
      setError("Check the privacy box first—I’m not sneaking past that.");
      return;
    }

    try {
      const googleProvider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      await setDoc(doc(db, "users", user.uid), {
        name: user.displayName,
        email: user.email,
        createdAt: new Date(),
      });

      router.replace(nextPath ?? "/");
    } catch {
      setError("Google sign-in bailed—try again.");
    } finally {
      setOauthLoading(null);
    }
  };

  // 🔥 EMAIL SIGNUP
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) return setError("What should I call you? Name’s empty.");
    if (!email.trim()) return setError("I need an email to stash the account.");
    const policyErr = passwordPolicyErrorMessage(password);
    if (policyErr) return setError(policyErr);
    const emailPwErr = passwordEmailConflictMessage(password, email.trim());
    if (emailPwErr) return setError(emailPwErr);
    if (password !== confirmPassword) return setError("Those passwords don’t match.");
    if (!agreedToTerms) {
      return setError("Tick the privacy checkbox—I’m not skipping that step.");
    }

    setLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      const user = userCredential.user;

      // ✅ Save display name
      await updateProfile(user, {
        displayName: name,
      });

      // ✅ Save user in Firestore
      await setDoc(doc(db, "users", user.uid), {
        name,
        email,
        createdAt: new Date(),
      });

      router.replace(nextPath ?? "/");
    } catch (err: any) {
      if (err.code === "auth/email-already-in-use") {
        setError("That email already has an account—log in instead?");
      } else if (err.code === "auth/weak-password") {
        setError("Firebase says that password is too weak—beef it up.");
      } else {
        setError("Signup failed and I don’t have a prettier reason—try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const loginHref = nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login";

  const passwordOk =
    passwordMeetsPolicy(password) &&
    password === confirmPassword &&
    confirmPassword.length > 0;

  return (
    <div className="space-y-6">
      {uploadIntent && (
        <p className="rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-3 text-sm text-violet-100">
          I only let uploads happen behind an account. Create one, pick a topic on Home, then circle back to Upload—I’ll
          wait.
        </p>
      )}

      <AuthProviders
        variant="signup"
        onProviderClick={handleOAuth}
        loadingProvider={oauthLoading}
      />

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-600/60" />
        </div>
        <p className="relative text-center text-xs font-medium uppercase tracking-wider text-slate-500">
          <span className="bg-slate-900/70 px-3">or email</span>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div
            role="alert"
            className="rounded-lg border border-red-500/35 bg-red-500/10 px-4 py-3 text-sm text-red-200"
          >
            {error}
          </div>
        )}

        <div>
          <label htmlFor="signup-name" className={AUTH_LABEL}>
            Full name
          </label>
          <input
            id="signup-name"
            name="name"
            type="text"
            autoComplete="name"
            placeholder="Alex Johnson"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={AUTH_FIELD}
          />
        </div>

        <div>
          <label htmlFor="signup-email" className={AUTH_LABEL}>
            Email
          </label>
          <input
            id="signup-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@university.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={AUTH_FIELD}
          />
        </div>

        <div>
          <label htmlFor="signup-password" className={AUTH_LABEL}>
            Password
          </label>
          <input
            id="signup-password"
            name="new-password"
            type="password"
            autoComplete="new-password"
            placeholder="Create a strong password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-describedby="signup-password-hint"
            className={AUTH_FIELD}
          />
          <div id="signup-password-hint" className="mt-2">
            <PasswordRequirements password={password} />
          </div>
        </div>

        <div>
          <label htmlFor="signup-confirm" className={AUTH_LABEL}>
            Confirm password
          </label>
          <input
            id="signup-confirm"
            name="confirm-password"
            type="password"
            autoComplete="new-password"
            placeholder="Re-enter password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={AUTH_FIELD}
          />
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-600/60 bg-slate-800/30 p-4 text-left text-sm text-slate-300 transition hover:border-slate-500/80">
          <input
            type="checkbox"
            checked={agreedToTerms}
            onChange={(e) => setAgreedToTerms(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-500 bg-slate-900 text-violet-600 focus:ring-violet-500/50"
          />
          <span>
            I agree to the ScholarAI{" "}
            <Link
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-violet-400 underline-offset-2 hover:text-violet-300 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              Privacy Policy
            </Link>
            .
          </span>
        </label>

        <button
          type="submit"
          disabled={loading || !passwordOk || !name.trim() || !email.trim() || !agreedToTerms}
          className={AUTH_PRIMARY_BTN}
        >
          {loading ? "Creating account…" : "Create account"}
        </button>

        <p className="text-center text-sm text-slate-400">
          Already have an account?{" "}
          <Link href={loginHref} className="font-semibold text-violet-400 transition hover:text-violet-300">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}