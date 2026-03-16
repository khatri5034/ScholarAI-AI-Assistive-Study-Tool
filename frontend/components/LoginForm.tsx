"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthProviders } from "./AuthProviders";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/services/firebase";
import { useRouter } from "next/navigation";

export function LoginForm() {

  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);

  const handleOAuth = async (provider: string) => {
    setOauthLoading(provider);
    setError("");

    try {
      // OAuth not connected yet
      setError(`Connect ${provider} OAuth in Firebase later.`);
    } finally {
      setOauthLoading(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setError("");

    if (!email.trim()) {
      setError("Please enter your email.");
      return;
    }

    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setLoading(true);

    try {

      // 🔹 Firebase login
      await signInWithEmailAndPassword(auth, email, password);

      // 🔹 Redirect to profile page
      router.push("/profile");

    } catch (err: any) {

      setError(err.message || "Login failed.");

    } finally {

      setLoading(false);

    }
  };

  return (
    <div className="space-y-6">

      <AuthProviders
        variant="login"
        onProviderClick={handleOAuth}
        loadingProvider={oauthLoading}
      />

      {/* divider */}

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-700" />
        </div>

        <p className="relative text-center text-xs font-medium text-slate-500">
          <span className="bg-slate-900/50 px-2">
            or continue with email
          </span>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Email */}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-300">
            Email
          </label>

          <input
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-3 text-white placeholder-slate-500 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
          />
        </div>

        {/* Password */}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-300">
            Password
          </label>

          <input
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-3 text-white placeholder-slate-500 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
          />
        </div>

        {/* Login button */}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-indigo-500 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:bg-indigo-400 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? "Signing in…" : "Log in"}
        </button>

        <p className="text-center text-sm text-slate-400">
          Don't have an account?{" "}
          <Link
            href="/signup"
            className="font-medium text-indigo-400 hover:text-indigo-300"
          >
            Sign up
          </Link>
        </p>

      </form>

    </div>
  );
}