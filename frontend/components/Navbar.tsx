"use client";

/**
 * Global navigation. Chat / Upload / Planner / Quiz appear only when signed in—guests
 * use Home + auth links; direct URLs to gated routes still hit TopicGuard → signup.
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { onAuthStateChanged, User } from "firebase/auth";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { auth } from "@/services/firebase";
import { db } from "@/services/firebase";
import { useStudyTopic } from "@/contexts/StudyTopicContext";
import { AppRole, getUserRole } from "@/lib/userProfile";

type NavItem = { href: string; label: string; requiresTopic: boolean };

const navItems: NavItem[] = [
  { href: "/inbox", label: "Inbox", requiresTopic: false },
  { href: "/chat", label: "Chat", requiresTopic: true },
  { href: "/upload", label: "Upload", requiresTopic: true },
  { href: "/planner", label: "Planner", requiresTopic: true },
  { href: "/quiz", label: "Quiz", requiresTopic: true },
];

function openedAssignmentsKey(email: string): string {
  return `scholarai_opened_quiz_assignments_${email.toLowerCase()}`;
}

function readOpenedAssignments(email: string): Set<string> {
  try {
    const raw = localStorage.getItem(openedAssignmentsKey(email));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

function UserAvatar({ user }: { user: User | null }) {
  const photo = user?.photoURL;
  if (photo) {
    return (
      <Image
        src={photo}
        alt=""
        width={36}
        height={36}
        className="h-9 w-9 shrink-0 rounded-full object-cover ring-2 ring-violet-500/40"
      />
    );
  }
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500/30 to-emerald-500/20 ring-2 ring-violet-500/40 transition hover:ring-violet-400/60">
      <svg
        className="h-5 w-5 text-slate-200"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.75}
          d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
        />
      </svg>
    </span>
  );
}

export function Navbar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole>("student");
  const [inboxUnread, setInboxUnread] = useState(0);
  const { studyTopic } = useStudyTopic();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      if (!nextUser) {
        setRole("student");
        return;
      }
      void getUserRole(nextUser.uid)
        .then((nextRole) => setRole(nextRole))
        .catch(() => setRole("student"));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!user?.email) {
      setInboxUnread(0);
      return;
    }
    if (role === "professor") {
      const q = query(
        collection(db, "studentMessages"),
        where("professorId", "==", user.uid),
        where("status", "==", "unread"),
      );
      const unsub = onSnapshot(
        q,
        (snap) => setInboxUnread(snap.size),
        () => setInboxUnread(0),
      );
      return () => unsub();
    }

    const lower = user.email.toLowerCase();
    const invitesQ = query(
      collection(db, "courseInvitations"),
      where("studentEmailLower", "==", lower),
      where("status", "==", "pending"),
    );
    const assignmentsQ = query(
      collection(db, "quizAssignments"),
      where("recipientEmailLower", "==", lower),
      where("status", "==", "sent"),
    );
    let inviteCount = 0;
    let assignmentCount = 0;
    const sync = () => setInboxUnread(inviteCount + assignmentCount);
    const unsubInvites = onSnapshot(invitesQ, (snap) => {
      inviteCount = snap.size;
      sync();
    });
    const unsubAssignments = onSnapshot(assignmentsQ, (snap) => {
      const opened = readOpenedAssignments(user.email!);
      assignmentCount = snap.docs.filter((d) => {
        const data = d.data() as { studentOpened?: boolean };
        return !data.studentOpened && !opened.has(d.id);
      }).length;
      sync();
    });
    return () => {
      unsubInvites();
      unsubAssignments();
    };
  }, [role, user?.email, user?.uid]);

  const isLoggedIn = !!user;
  const needTopic = isLoggedIn && role !== "professor" && !studyTopic;

  const linkClass =
    "rounded-lg px-2 py-1.5 text-sm font-medium text-slate-300 transition hover:bg-slate-800/80 hover:text-white";

  const navLinkActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  };
  const mobileLinkClass =
    "block rounded-xl border border-transparent px-3 py-2.5 text-sm font-medium text-slate-200 transition hover:border-slate-600 hover:bg-slate-800/90";

  return (
    <header className="fixed top-0 left-0 right-0 z-50 w-full border-b border-slate-800/80 bg-slate-950/85 backdrop-blur-xl">
      <nav className="flex h-16 w-full items-center justify-between px-4 sm:px-6 lg:px-10">
        <Link
          href="/"
          className="flex items-center gap-2.5"
          onClick={() => setMenuOpen(false)}
        >
          <span className="flex rounded-xl bg-slate-900/90 p-1.5 ring-1 ring-white/10">
            <Image
              src="/scholarai-logo.png"
              alt=""
              width={44}
              height={44}
              className="h-8 w-auto object-contain"
              priority
            />
          </span>
          <span className="text-lg font-semibold tracking-tight text-white">ScholarAI</span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          <Link
            href="/"
            className={`${linkClass}${navLinkActive("/") ? " bg-violet-500/10 text-white ring-1 ring-violet-500/25" : ""}`}
          >
            Home
          </Link>
          {isLoggedIn &&
            navItems.map((item) => {
              const gatedOff = needTopic && item.requiresTopic;
              const href = gatedOff ? "/#choose-topic" : item.href;
              const active = !gatedOff && navLinkActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={href}
                  className={`${linkClass}${gatedOff ? " text-slate-500 hover:text-slate-400" : ""}${active ? " bg-violet-500/10 text-white ring-1 ring-violet-500/25" : ""}`}
                  title={gatedOff ? "Choose a topic on Home first" : undefined}
                >
                  {item.label}
                  {item.href === "/inbox" && inboxUnread > 0 && (
                    <span className="ml-1 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      {inboxUnread}
                    </span>
                  )}
                </Link>
              );
            })}
          <div className="ml-4 flex items-center border-l border-slate-700/80 pl-4">
            {isLoggedIn ? (
              <Link
                href="/profile"
                className="flex items-center gap-2 rounded-lg p-1 pr-2 text-sm font-medium text-slate-300 transition hover:bg-slate-800/80 hover:text-white"
                aria-label="Account and profile"
              >
                <UserAvatar user={user} />
                <span className="hidden lg:inline">Profile</span>
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-full px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-slate-800/80"
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="rounded-full bg-violet-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition hover:bg-violet-400"
                >
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 bg-slate-900/80 text-slate-200 transition hover:border-slate-600 hover:bg-slate-800 md:hidden"
          aria-expanded={menuOpen}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
        >
          <span className="sr-only">Menu</span>
          {menuOpen ? (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </nav>

      {menuOpen && (
        <div className="w-full border-t border-slate-800 bg-slate-950/95 backdrop-blur-xl md:hidden">
          <div className="w-full space-y-1 px-4 py-4 sm:px-6 lg:px-10">
            <Link
              href="/"
              className={`${mobileLinkClass}${pathname === "/" ? " border-violet-500/30 bg-violet-500/10 text-white" : ""}`}
              onClick={() => setMenuOpen(false)}
            >
              Home
            </Link>
            {isLoggedIn &&
              navItems.map((item) => {
                const gatedOff = needTopic && item.requiresTopic;
                const href = gatedOff ? "/#choose-topic" : item.href;
                const active = !gatedOff && navLinkActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={href}
                    className={`${mobileLinkClass}${gatedOff ? " text-slate-500" : ""}${active ? " border-violet-500/30 bg-violet-500/10 text-white" : ""}`}
                    title={gatedOff ? "Choose a topic on Home first" : undefined}
                    onClick={() => setMenuOpen(false)}
                  >
                    {item.label}
                    {item.href === "/inbox" && inboxUnread > 0 && (
                      <span className="ml-2 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        {inboxUnread}
                      </span>
                    )}
                  </Link>
                );
              })}
            <div className="my-3 border-t border-slate-800 pt-3">
              {isLoggedIn ? (
                <Link
                  href="/profile"
                  className={`${mobileLinkClass} flex items-center gap-3`}
                  onClick={() => setMenuOpen(false)}
                >
                  <UserAvatar user={user} />
                  Profile &amp; account
                </Link>
              ) : (
                <div className="flex flex-col gap-2 px-1">
                  <Link
                    href="/login"
                    className="rounded-xl border border-slate-600 bg-slate-900/70 px-3 py-2.5 text-center text-sm font-semibold text-slate-100"
                    onClick={() => setMenuOpen(false)}
                  >
                    Log in
                  </Link>
                  <Link
                    href="/signup"
                    className="rounded-xl bg-violet-500 px-3 py-2.5 text-center text-sm font-semibold text-white shadow-lg shadow-violet-500/20"
                    onClick={() => setMenuOpen(false)}
                  >
                    Sign up
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
