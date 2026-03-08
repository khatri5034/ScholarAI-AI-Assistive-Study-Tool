"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthProviders } from "./AuthProviders";

export function SignupForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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
    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }
    if (!email.trim()) {
      setError("Please enter your email.");
      return;
    }
    if (!password) {
      setError("Please enter a password.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      // TODO: replace with your auth API (e.g. POST /api/auth/signup)
      await new Promise((r) => setTimeout(r, 800));
      setError("Connect your backend auth to enable sign up.");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <AuthProviders variant="signup" onProviderClick={handleOAuth} loadingProvider={oauthLoading} />

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
        <label htmlFor="signup-name" className="mb-1.5 block text-sm font-medium text-slate-300">
          Name
        </label>
        <input
          id="signup-name"
          type="text"
          autoComplete="name"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-3 text-white placeholder-slate-500 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
        />
      </div>
      <div>
        <label htmlFor="signup-email" className="mb-1.5 block text-sm font-medium text-slate-300">
          Email
        </label>
        <input
          id="signup-email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-3 text-white placeholder-slate-500 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
        />
      </div>
      <div>
        <label htmlFor="signup-password" className="mb-1.5 block text-sm font-medium text-slate-300">
          Password
        </label>
        <input
          id="signup-password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-3 text-white placeholder-slate-500 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
        />
      </div>
      <div>
        <label htmlFor="signup-confirm" className="mb-1.5 block text-sm font-medium text-slate-300">
          Confirm password
        </label>
        <input
          id="signup-confirm"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-3 text-white placeholder-slate-500 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-indigo-500 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Creating account…" : "Sign up"}
      </button>
      <p className="text-center text-sm text-slate-400">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-indigo-400 hover:text-indigo-300">
          Log in
        </Link>
      </p>
      </form>
    </div>
  );
}
