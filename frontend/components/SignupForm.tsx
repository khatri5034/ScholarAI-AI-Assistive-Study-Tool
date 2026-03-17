"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { AuthProviders } from "./AuthProviders";

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
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);

  // 🔥 GOOGLE SIGNUP
  const handleOAuth = async (provider: string) => {
    setOauthLoading(provider);
    setError("");

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