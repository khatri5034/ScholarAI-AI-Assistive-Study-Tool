"use client";

/**
 * Email/password + Google sign-in. Firebase Auth keeps accounts out of our backend for
 * this MVP; after login we send users to Home (topic picker / hub), not the login screen.
 */

import { useState } from "react";
import Link from "next/link";
import { AuthProviders, type ProviderType } from "./AuthProviders";
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "@/services/firebase";
import { useRouter, useSearchParams } from "next/navigation";

import { getSafeInternalPath } from "@/lib/safeInternalPath";
import { AUTH_FIELD, AUTH_LABEL, AUTH_PRIMARY_BTN } from "@/lib/authUi";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = getSafeInternalPath(searchParams.get("next"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<ProviderType | null>(null);

  const handleOAuth = async (provider: ProviderType) => {
    if (provider !== "google") return;
    setOauthLoading("google");
    setError("");

    try {
      const googleProvider = new GoogleAuthProvider();
      await signInWithPopup(auth, googleProvider);
      router.replace(nextPath ?? "/");
    } catch {
      setError("Google flaked—try again in a sec.");
    } finally {
      setOauthLoading(null);
    }
  };

  // 🔹 EMAIL LOGIN
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setError("");

    if (!email.trim()) {
      setError("I need your email.");
      return;
    }

    if (!password) {
      setError("I need your password too.");
      return;
    }

    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);

      router.replace(nextPath ?? "/");
    } catch (err: any) {
      // 🔥 Clean error messages
      if (err.code === "auth/user-not-found") {
        setError("No account on that email—maybe sign up?");
      } else if (err.code === "auth/wrong-password") {
        setError("Password doesn’t match—double-check caps lock.");
      } else if (err.code === "auth/invalid-email") {
        setError("That email string looks broken.");
      } else {
        setError("Login failed—try again or use Google.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <AuthProviders variant="login" onProviderClick={handleOAuth} loadingProvider={oauthLoading} />

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
          <label htmlFor="login-email" className={AUTH_LABEL}>
            Email
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            placeholder="you@university.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={AUTH_FIELD}
          />
        </div>

        <div>
          <label htmlFor="login-password" className={AUTH_LABEL}>
            Password
          </label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={AUTH_FIELD}
          />
        </div>

        <button type="submit" disabled={loading} className={AUTH_PRIMARY_BTN}>
          {loading ? "Signing in…" : "Sign in"}
        </button>

        <p className="text-center text-sm text-slate-400">
          No account?{" "}
          <Link
            href={nextPath ? `/signup?next=${encodeURIComponent(nextPath)}` : "/signup"}
            className="font-semibold text-violet-400 transition hover:text-violet-300"
          >
            Create one
          </Link>
        </p>
      </form>
    </div>
  );
}
