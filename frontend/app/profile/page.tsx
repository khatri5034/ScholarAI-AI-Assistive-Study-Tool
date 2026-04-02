"use client";

/**
 * Account settings in one place (navbar stays clean). Firebase handles auth; verifyBeforeUpdateEmail
 * avoids silent email swaps. Collapsible security panels reduce accidental exposure of sensitive fields.
 */

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { auth } from "@/services/firebase";
import {
  onAuthStateChanged,
  User,
  signOut,
  updateProfile,
  updatePassword,
  reload,
  EmailAuthProvider,
  reauthenticateWithCredential,
  verifyBeforeUpdateEmail,
} from "firebase/auth";
import { useRouter } from "next/navigation";

const inputClass =
  "w-full rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-3 text-white placeholder-slate-500 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/50";

function displayNameFor(user: User | null): string {
  if (!user) return "";
  const name = user.displayName?.trim();
  if (name) return name;
  const email = user.email?.trim();
  if (email) return email.split("@")[0] ?? email;
  return "Account";
}

function hasEmailPassword(user: User | null): boolean {
  if (!user) return false;
  return user.providerData.some((p) => p.providerId === "password");
}

function ProfileAvatarLarge({ user }: { user: User | null }) {
  const photo = user?.photoURL;
  if (photo) {
    return (
      <Image
        src={photo}
        alt=""
        width={96}
        height={96}
        className="h-24 w-24 rounded-full object-cover ring-2 ring-violet-500/40"
      />
    );
  }
  return (
    <span className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-violet-500/25 to-emerald-500/15 ring-2 ring-violet-500/40">
      <svg
        className="h-14 w-14 text-slate-200"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
        />
      </svg>
    </span>
  );
}

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();

  const [nameValue, setNameValue] = useState("");
  const [nameSaving, setNameSaving] = useState(false);

  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);

  const [logoutLoading, setLogoutLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(
    null
  );

  /** Which security form is open after user clicks an action (null = collapsed). */
  const [securityPanel, setSecurityPanel] = useState<null | "email" | "password">(null);

  const closeSecurityPanel = () => {
    setSecurityPanel(null);
    setEmailPassword("");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) {
        router.push("/login");
      } else {
        setUser(firebaseUser);
        setNameValue(firebaseUser.displayName ?? "");
        setNewEmail(firebaseUser.email ?? "");
      }
    });
    return () => unsubscribe();
  }, [router]);

  const showMsg = (type: "ok" | "err", text: string) => {
    setMessage({ type, text });
  };

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const trimmed = nameValue.trim();
    setNameSaving(true);
    setMessage(null);
    try {
      await updateProfile(user, { displayName: trimmed || null });
      await reload(user);
      if (auth.currentUser) setUser(auth.currentUser);
      showMsg("ok", "Name updated.");
    } catch (err: unknown) {
      showMsg("err", err instanceof Error ? err.message : "Could not update name.");
    } finally {
      setNameSaving(false);
    }
  };

  const reauthWithPassword = async (password: string) => {
    if (!user?.email) throw new Error("No email on account.");
    const cred = EmailAuthProvider.credential(user.email, password);
    await reauthenticateWithCredential(user, cred);
  };

  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email) return;
    const next = newEmail.trim();
    if (!next || next === user.email) {
      showMsg("err", "Enter a new email address.");
      return;
    }
    setEmailSaving(true);
    setMessage(null);
    try {
      await reauthWithPassword(emailPassword);
      await verifyBeforeUpdateEmail(user, next);
      await reload(user);
      if (auth.currentUser) {
        setUser(auth.currentUser);
        setNewEmail(auth.currentUser.email ?? "");
      }
      setEmailPassword("");
      setSecurityPanel(null);
      showMsg(
        "ok",
        "Verification email sent. Please check your inbox to confirm the change."
      );
    } catch (err: unknown) {
      showMsg(
        "err",
        err instanceof Error ? err.message : "Could not update email. Check your password."
      );
    } finally {
      setEmailSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 8) {
      showMsg("err", "New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      showMsg("err", "New passwords do not match.");
      return;
    }
    setPasswordSaving(true);
    setMessage(null);
    try {
      await reauthWithPassword(currentPassword);
      if (!user) return;
      await updatePassword(user, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSecurityPanel(null);
      showMsg("ok", "Password updated.");
    } catch (err: unknown) {
      showMsg(
        "err",
        err instanceof Error ? err.message : "Could not update password."
      );
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleLogout = async () => {
    setLogoutLoading(true);
    setMessage(null);
    try {
      await signOut(auth);
      router.push("/");
    } catch (err: unknown) {
      showMsg("err", err instanceof Error ? err.message : "Could not sign out.");
    } finally {
      setLogoutLoading(false);
    }
  };

  const passwordUser = hasEmailPassword(user);

  return (
    <main className="min-h-screen bg-slate-950 pt-16 pb-24 text-white">
      <section className="relative overflow-hidden border-b border-slate-800">
        <div className="mx-auto max-w-2xl px-6 py-10">
          <p className="text-sm font-medium text-violet-400/90">Account</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Profile</h1>
          {user && (
            <p className="mt-2 text-slate-400">
              Signed in as{" "}
              <span className="font-medium text-slate-200">
                {displayNameFor(user)}
              </span>
            </p>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-2xl space-y-8 px-6 py-10">
        {message && (
          <div
            className={
              message.type === "ok"
                ? "rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300"
                : "rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400"
            }
          >
            {message.text}
          </div>
        )}

        {user && (
          <>
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
              <ProfileAvatarLarge user={user} />
              <div className="text-center sm:text-left">
                <p className="text-lg font-semibold text-white">
                  {displayNameFor(user)}
                </p>
                {user.email && (
                  <p className="text-sm text-slate-500">{user.email}</p>
                )}
              </div>
            </div>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                Display name
              </h2>
              <form onSubmit={handleSaveName} className="mt-4 space-y-4">
                <div>
                  <label
                    htmlFor="profile-name"
                    className="mb-1.5 block text-sm font-medium text-slate-300"
                  >
                    Name
                  </label>
                  <input
                    id="profile-name"
                    type="text"
                    autoComplete="name"
                    value={nameValue}
                    onChange={(e) => setNameValue(e.target.value)}
                    className={inputClass}
                    placeholder="Your name"
                  />
                </div>
                <button
                  type="submit"
                  disabled={nameSaving}
                  className="rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {nameSaving ? "Saving…" : "Save name"}
                </button>
              </form>
            </section>

            {passwordUser && user.email && (
              <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                  Security
                </h2>
                <p className="mt-2 text-sm text-slate-400">
                  Current email:{" "}
                  <span className="font-medium text-slate-300">{user.email}</span>
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Choose an option below. You&apos;ll be asked for your current password to
                  confirm.
                </p>

                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => {
                      setMessage(null);
                      if (securityPanel === "password") {
                        setCurrentPassword("");
                        setNewPassword("");
                        setConfirmPassword("");
                      }
                      const openingEmail = securityPanel !== "email";
                      setSecurityPanel((p) => (p === "email" ? null : "email"));
                      if (openingEmail) setNewEmail("");
                    }}
                    className={`flex-1 rounded-xl border px-4 py-3 text-left text-sm font-semibold transition ${
                      securityPanel === "email"
                        ? "border-violet-500/60 bg-violet-500/15 text-white"
                        : "border-slate-600 bg-slate-800/60 text-slate-200 hover:border-slate-500 hover:bg-slate-800"
                    }`}
                  >
                    Change email
                    <span className="mt-0.5 block text-xs font-normal text-slate-400">
                      Update the address you use to sign in
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMessage(null);
                      setSecurityPanel((p) => (p === "password" ? null : "password"));
                      if (securityPanel === "email") {
                        setEmailPassword("");
                      }
                    }}
                    className={`flex-1 rounded-xl border px-4 py-3 text-left text-sm font-semibold transition ${
                      securityPanel === "password"
                        ? "border-violet-500/60 bg-violet-500/15 text-white"
                        : "border-slate-600 bg-slate-800/60 text-slate-200 hover:border-slate-500 hover:bg-slate-800"
                    }`}
                  >
                    Change password
                    <span className="mt-0.5 block text-xs font-normal text-slate-400">
                      Set a new password for this account
                    </span>
                  </button>
                </div>

                {securityPanel === "email" && (
                  <div className="mt-6 rounded-xl border border-slate-700/80 bg-slate-950/50 p-4">
                    <p className="text-sm font-medium text-slate-200">
                      Change your email
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Enter your new email and current password. We&apos;ll send a
                      verification link to the new address.
                    </p>
                    <form onSubmit={handleUpdateEmail} className="mt-4 space-y-4">
                      <div>
                        <label
                          htmlFor="profile-new-email"
                          className="mb-1.5 block text-sm font-medium text-slate-300"
                        >
                          New email
                        </label>
                        <input
                          id="profile-new-email"
                          type="email"
                          autoComplete="email"
                          value={newEmail}
                          onChange={(e) => setNewEmail(e.target.value)}
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="profile-email-password"
                          className="mb-1.5 block text-sm font-medium text-slate-300"
                        >
                          Current password
                        </label>
                        <input
                          id="profile-email-password"
                          type="password"
                          autoComplete="current-password"
                          value={emailPassword}
                          onChange={(e) => setEmailPassword(e.target.value)}
                          className={inputClass}
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="submit"
                          disabled={emailSaving}
                          className="rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {emailSaving ? "Sending…" : "Send verification email"}
                        </button>
                        <button
                          type="button"
                          onClick={closeSecurityPanel}
                          className="rounded-xl border border-slate-600 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-800"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {securityPanel === "password" && (
                  <div className="mt-6 rounded-xl border border-slate-700/80 bg-slate-950/50 p-4">
                    <p className="text-sm font-medium text-slate-200">
                      Change your password
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Enter your current password, then your new password twice.
                    </p>
                    <form onSubmit={handleChangePassword} className="mt-4 space-y-4">
                      <div>
                        <label
                          htmlFor="profile-current-pw"
                          className="mb-1.5 block text-sm font-medium text-slate-300"
                        >
                          Current password
                        </label>
                        <input
                          id="profile-current-pw"
                          type="password"
                          autoComplete="current-password"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="profile-new-pw"
                          className="mb-1.5 block text-sm font-medium text-slate-300"
                        >
                          New password
                        </label>
                        <input
                          id="profile-new-pw"
                          type="password"
                          autoComplete="new-password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className={inputClass}
                          placeholder="At least 8 characters"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="profile-confirm-pw"
                          className="mb-1.5 block text-sm font-medium text-slate-300"
                        >
                          Confirm new password
                        </label>
                        <input
                          id="profile-confirm-pw"
                          type="password"
                          autoComplete="new-password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className={inputClass}
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="submit"
                          disabled={passwordSaving}
                          className="rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {passwordSaving ? "Updating…" : "Update password"}
                        </button>
                        <button
                          type="button"
                          onClick={closeSecurityPanel}
                          className="rounded-xl border border-slate-600 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-800"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </section>
            )}

            {!passwordUser && (
              <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                  Email &amp; password
                </h2>
                <p className="mt-2 text-sm text-slate-400">
                  You signed in with a social provider. To change email or password, manage
                  your account in that provider&apos;s settings, or add a password sign-in
                  method in Firebase.
                </p>
              </section>
            )}

            <section className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-red-400/90">
                Session
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                Sign out on this device. You can sign in again anytime.
              </p>
              <button
                type="button"
                onClick={handleLogout}
                disabled={logoutLoading}
                className="mt-4 w-full rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {logoutLoading ? "Signing out…" : "Log out"}
              </button>
            </section>

            <p className="text-center text-sm text-slate-500">
              <Link href="/" className="text-violet-400 hover:text-violet-300">
                ← Back to home
              </Link>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
