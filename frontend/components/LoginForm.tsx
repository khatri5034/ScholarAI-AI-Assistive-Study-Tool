"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthProviders } from "./AuthProviders";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);

  const handleOAuth = async (provider: string) => {
    setOauthLoading(provider);
    setError("");
    try {
      // TODO: wire to NextAuth signIn(provider) or your backend OAuth
      await new Promise((r) => setTimeout(r, 600));
      setError(`Connect ${provider} OAuth in your backend (e.g. NextAuth providers).`);
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
      // TODO: replace with your auth API (e.g. NextAuth signIn, or POST /api/auth/login)
      await new Promise((r) => setTimeout(r, 800));
      setError("Connect your backend auth to enable login.");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <AuthProviders variant="login" onProviderClick={handleOAuth} loadingProvider={oauthLoading} />

      <div className="relative">
        <div className="absolute inset-0 flex items-center" aria-hidden>
          <div className="w-full border-t border-slate-700" />
        </div>
        <p className="relative text-center text-xs font-medium text-slate-500">
          <span className="bg-slate-900/50 px-2">or continue with email</span>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}
      <div>
        <label htmlFor="login-email" className="mb-1.5 block text-sm font-medium text-slate-300">
          Email
        </label>
        <input
          id="login-email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-3 text-white placeholder-slate-500 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
        />
      </div>
      <div>
        <label htmlFor="login-password" className="mb-1.5 block text-sm font-medium text-slate-300">
          Password
        </label>
        <input
          id="login-password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-3 text-white placeholder-slate-500 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-indigo-500 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:bg-indigo-400 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? "Signing in…" : "Log in"}
      </button>
      <p className="text-center text-sm text-slate-400">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="font-medium text-indigo-400 hover:text-indigo-300">
          Sign up
        </Link>
      </p>
      </form>
    </div>
  );
}
