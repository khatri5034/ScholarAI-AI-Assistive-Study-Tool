"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/chat", label: "Chat" },
  { href: "/planner", label: "Planner" },
  { href: "/upload", label: "Upload" },
];

function ProfileIcon() {
  return (
    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-700 text-slate-300 ring-2 ring-indigo-500/50 transition hover:bg-slate-600 hover:text-white">
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    </span>
  );
}

export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const isLoggedIn = false; // TODO: connect to auth — when true, shows Profile; when false, shows Log in / Sign up

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
      <nav className="flex h-16 w-full items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo + ScholarAI — left corner of page */}
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 transition hover:opacity-90"
          onClick={() => setMenuOpen(false)}
        >
          <span className="flex rounded-lg bg-slate-900/90 p-1.5 ring-1 ring-white/10">
            <Image
              src="/scholarai-logo.png"
              alt=""
              width={44}
              height={44}
              className="h-8 w-auto object-contain sm:h-9"
              priority
            />
          </span>
          <span className="font-display text-lg font-semibold tracking-wide text-white">ScholarAI</span>
        </Link>

        {/* Search — desktop only, true middle of page */}
        <div className="hidden flex-1 justify-center px-6 md:flex">
          <label htmlFor="nav-search" className="sr-only">Search</label>
          <div className="relative w-full max-w-xl">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-500" aria-hidden>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              id="nav-search"
              type="search"
              placeholder="Search documents, notes..."
              className="w-full rounded-lg border border-slate-600/80 bg-slate-800/80 py-2 pl-9 pr-4 text-sm text-white placeholder-slate-500 transition focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
              aria-label="Search"
            />
          </div>
        </div>

        {/* Nav items — right corner of page */}
        <div className="flex shrink-0 items-center gap-2 md:gap-4 lg:gap-6">
          {/* Desktop: nav links + Sign up / Login or Profile */}
          <div className="hidden items-center gap-4 md:flex lg:gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-base font-medium text-slate-300 transition hover:text-white whitespace-nowrap"
              >
                {link.label}
              </Link>
            ))}
            {isLoggedIn ? (
              <Link href="/profile" aria-label="Profile">
                <ProfileIcon />
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-lg bg-indigo-200 px-4 py-2 text-base font-medium text-indigo-900 transition hover:bg-indigo-300"
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="rounded-full bg-indigo-200 px-4 py-2 text-base font-semibold text-indigo-900 transition hover:bg-indigo-300"
                >
                  Sign up
                </Link>
              </>
            )}
          </div>
          {/* Mobile: profile or hamburger only (Sign up/Login in menu) */}
          {isLoggedIn && (
            <Link href="/profile" className="md:hidden" aria-label="Profile" onClick={() => setMenuOpen(false)}>
              <ProfileIcon />
            </Link>
          )}
          <button
            type="button"
            className="flex h-11 w-11 flex-col items-center justify-center gap-1.5 rounded-xl border border-slate-600/50 bg-slate-800/50 text-white transition hover:border-indigo-500/50 hover:bg-slate-800 md:hidden"
            onClick={() => setMenuOpen((o) => !o)}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-controls="mobile-menu"
          >
            <span className={`block h-0.5 w-5 rounded-full bg-current transition-all duration-200 ${menuOpen ? "translate-y-2 rotate-45" : ""}`} />
            <span className={`block h-0.5 w-5 rounded-full bg-current transition-all duration-200 ${menuOpen ? "scale-x-0 opacity-0" : "scale-x-100 opacity-100"}`} />
            <span className={`block h-0.5 w-5 rounded-full bg-current transition-all duration-200 ${menuOpen ? "-translate-y-2 -rotate-45" : ""}`} />
          </button>
        </div>
      </nav>

      {/* Mobile menu (dropdown when hamburger is open) */}
      <div
        id="mobile-menu"
        className={`overflow-hidden border-t border-white/10 bg-slate-950 transition-all duration-200 ease-out md:hidden ${menuOpen ? "max-h-[28rem] opacity-100" : "max-h-0 opacity-0"}`}
        aria-hidden={!menuOpen}
      >
        {/* Search bar — mobile */}
        <div className="border-b border-white/10 px-4 py-3">
          <label htmlFor="mobile-nav-search" className="sr-only">Search</label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-500" aria-hidden>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              id="mobile-nav-search"
              type="search"
              placeholder="Search documents, notes..."
              className="w-full rounded-lg border border-slate-600/80 bg-slate-800/80 py-2.5 pl-9 pr-4 text-sm text-white placeholder-slate-500 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
              aria-label="Search"
            />
          </div>
        </div>
        <ul className="flex flex-col gap-1 px-6 py-4">
          {navLinks.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="block rounded-lg px-4 py-3 text-base font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </Link>
            </li>
          ))}
          {isLoggedIn ? (
            <li>
              <Link
                href="/profile"
                className="block rounded-lg px-4 py-3 text-base font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
                onClick={() => setMenuOpen(false)}
              >
                Profile
              </Link>
            </li>
          ) : (
            <>
              <li>
                <Link
                  href="/login"
                  className="block rounded-lg bg-indigo-200 px-4 py-3 text-base font-medium text-indigo-900 transition hover:bg-indigo-300"
                  onClick={() => setMenuOpen(false)}
                >
                  Log in
                </Link>
              </li>
              <li>
                <Link
                  href="/signup"
                  className="block rounded-lg bg-indigo-200 px-4 py-3 text-base font-semibold text-indigo-900 transition hover:bg-indigo-300"
                  onClick={() => setMenuOpen(false)}
                >
                  Sign up
                </Link>
              </li>
            </>
          )}
        </ul>
      </div>
    </header>
  );
}
