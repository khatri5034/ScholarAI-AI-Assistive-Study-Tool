"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { AuthProviders, type ProviderType } from "./AuthProviders";

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

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<ProviderType | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // 🔥 GOOGLE SIGNUP
  const handleOAuth = async (provider: ProviderType) => {
    setOauthLoading(provider);
    setError("");

    if (!agreedToTerms) {
      setOauthLoading(null);
      setError("Please agree to the Terms of Service and Privacy Policy to continue.");
      return;
    }

    try {
      if (provider === "google") {
        const googleProvider = new GoogleAuthProvider();

        const result = await signInWithPopup(auth, googleProvider);

        const user = result.user;

        // ✅ Save user in Firestore
        await setDoc(doc(db, "users", user.uid), {
          name: user.displayName,
          email: user.email,
          createdAt: new Date(),
        });

        router.push("/profile");
      }
    } catch (err: any) {
      setError("Google sign-in failed");
    } finally {
      setOauthLoading(null);
    }
  };

  // 🔥 EMAIL SIGNUP
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) return setError("Enter your name");
    if (!email.trim()) return setError("Enter your email");
    if (!password) return setError("Enter password");
    if (password.length < 8) return setError("Password must be 8+ chars");
    if (password !== confirmPassword) return setError("Passwords do not match");
    if (!agreedToTerms) {
      return setError(
        "Please agree to the Terms of Service and Privacy Policy to create an account."
      );
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

      router.push("/profile");
    } catch (err: any) {
      if (err.code === "auth/email-already-in-use") {
        setError("Email already in use");
      } else {
        setError("Signup failed");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">

      <AuthProviders
        variant="signup"
        onProviderClick={handleOAuth}
        loadingProvider={oauthLoading}
      />

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-700" />
        </div>
        <p className="relative text-center text-xs text-slate-500">
          <span className="bg-slate-900 px-2">
            or continue with email
          </span>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {error && (
          <div className="text-red-400 text-sm">{error}</div>
        )}

        <input
          type="text"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full p-3 bg-slate-800 rounded"
        />

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full p-3 bg-slate-800 rounded"
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-3 bg-slate-800 rounded"
        />

        <input
          type="password"
          placeholder="Confirm Password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full p-3 bg-slate-800 rounded"
        />

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-700/80 bg-slate-800/40 p-4 text-left text-sm text-slate-300 transition hover:border-slate-600">
          <input
            type="checkbox"
            checked={agreedToTerms}
            onChange={(e) => setAgreedToTerms(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-indigo-500/50"
          />
          <span>
            By checking this box, I agree to the ScholarAI{" "}
            <Link
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-indigo-400 underline-offset-2 hover:text-indigo-300 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-indigo-400 underline-offset-2 hover:text-indigo-300 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              Privacy Policy
            </Link>
            .
          </span>
        </label>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-indigo-500 p-3 rounded text-white"
        >
          {loading ? "Creating..." : "Sign up"}
        </button>

        <p className="text-center text-sm text-slate-400">
          Already have account?{" "}
          <Link href="/login" className="text-indigo-400">
            Login
          </Link>
        </p>

      </form>
    </div>
  );
}