/**
 * Root layout: fonts + global shell (Navbar/Footer) and client Providers for auth/topic.
 * Keeps metadata and static chrome in the server tree; interactive state lives below Providers.
 */

import type { Metadata } from "next";
import { Outfit, Orbitron } from "next/font/google";
import { Navbar, Footer } from "@/components";
import { Providers } from "./providers";
import "../styles/globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

const orbitron = Orbitron({
  subsets: ["latin"],
  variable: "--font-orbitron",
});

export const metadata: Metadata = {
  title: "ScholarAI — Agentic Study Assistant",
  description: "AI-powered study assistant with RAG, planning, and quiz generation",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${outfit.variable} ${orbitron.variable}`}>
      <body className="min-h-screen bg-slate-950 font-sans text-slate-100 antialiased">
        <Providers>
          <Navbar />
          {children}
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
