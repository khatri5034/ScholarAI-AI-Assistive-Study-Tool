"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type Student = {
  name: string;
  score: number;
  weak: string;
  weakAreas: string[];
  suggestedNextTopic: string;
};

const courseName = "Machine Learning";
const topicsStudied = [
  "Linear Regression",
  "Gradient Descent",
  "Trees",
  "Attention Mechanism",
  "Model Evaluation",
];

const students: Student[] = [
  {
    name: "John",
    score: 60,
    weak: "Gradient Descent",
    weakAreas: ["Gradient Descent", "Learning Rate Tuning"],
    suggestedNextTopic: "Optimization Strategies",
  },
  {
    name: "Alice",
    score: 90,
    weak: "None",
    weakAreas: [],
    suggestedNextTopic: "Transformer Fine-Tuning",
  },
  {
    name: "Bob",
    score: 70,
    weak: "Trees",
    weakAreas: ["Decision Trees", "Overfitting Control"],
    suggestedNextTopic: "Ensemble Methods",
  },
  {
    name: "Maya",
    score: 66,
    weak: "Attention Mechanism",
    weakAreas: ["Self-Attention", "Q/K/V Intuition"],
    suggestedNextTopic: "Transformer Architecture Basics",
  },
];

const classWeakAreas = ["Gradient Descent", "Attention Mechanism", "Trees"];

function statusFor(score: number): "Strong" | "Needs Review" {
  return score >= 80 ? "Strong" : "Needs Review";
}

export function ProfessorDashboard() {
  const [selectedName, setSelectedName] = useState(students[0]?.name ?? "");
  const [generatedPlan, setGeneratedPlan] = useState<string>("");
  const selected = useMemo(
    () => students.find((s) => s.name === selectedName) ?? students[0] ?? null,
    [selectedName],
  );

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-6 shadow-xl shadow-black/20">
        <h2 className="font-display text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Professor Dashboard
        </h2>
        <p className="mt-2 text-slate-400">Monitor student progress and identify learning gaps</p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-3">
          <p className="text-sm text-indigo-100/95">
            Upload files to have access to student insights and stronger topic-level analysis.
          </p>
          <Link
            href="/upload"
            className="inline-flex items-center justify-center rounded-lg border border-indigo-400/40 bg-indigo-500/20 px-3 py-2 text-xs font-semibold text-indigo-100 transition hover:bg-indigo-500/30"
          >
            Upload files
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/45 p-5 shadow-lg shadow-black/20">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Course</p>
          <p className="mt-2 text-xl font-semibold text-white">{courseName}</p>
        </div>
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/45 p-5 shadow-lg shadow-black/20">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total students</p>
          <p className="mt-2 text-xl font-semibold text-white">{students.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/45 p-5 shadow-lg shadow-black/20">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Topics being studied</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {topicsStudied.map((topic) => (
              <span
                key={topic}
                className="rounded-full border border-indigo-500/35 bg-indigo-500/10 px-2.5 py-1 text-xs font-medium text-indigo-100"
              >
                {topic}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.7fr,1fr]">
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/45 p-5 shadow-lg shadow-black/20">
          <h3 className="font-display text-lg font-semibold text-white">Students</h3>
          <div className="mt-4 space-y-2">
            {students.map((student) => {
              const status = statusFor(student.score);
              const selectedRow = selected?.name === student.name;
              return (
                <button
                  key={student.name}
                  type="button"
                  onClick={() => setSelectedName(student.name)}
                  className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                    selectedRow
                      ? "border-violet-400/45 bg-violet-500/10"
                      : "border-slate-700/80 bg-slate-900/65 hover:border-slate-600"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-white">{student.name}</p>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        status === "Strong"
                          ? "border border-emerald-500/35 bg-emerald-500/15 text-emerald-200"
                          : "border border-amber-500/35 bg-amber-500/15 text-amber-200"
                      }`}
                    >
                      {status}
                    </span>
                  </div>
                  <div className="mt-2 grid gap-1 text-sm text-slate-300 sm:grid-cols-2">
                    <p>Quiz score: {student.score}%</p>
                    <p>Weak topic: {student.weak}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-rose-500/35 bg-rose-500/10 p-5 shadow-lg shadow-rose-900/20">
            <h3 className="font-display text-lg font-semibold text-rose-100">Class Weak Areas</h3>
            <ul className="mt-3 space-y-2 text-sm text-rose-100/95">
              {classWeakAreas.map((topic) => (
                <li key={topic} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-300" aria-hidden />
                  {topic}
                </li>
              ))}
            </ul>
          </div>

          {selected && (
            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/45 p-5 shadow-lg shadow-black/20">
              <h3 className="font-display text-lg font-semibold text-white">Student Detail</h3>
              <div className="mt-3 space-y-2 text-sm text-slate-300">
                <p>
                  <span className="text-slate-400">Name:</span> {selected.name}
                </p>
                <p>
                  <span className="text-slate-400">Score:</span> {selected.score}%
                </p>
                <p>
                  <span className="text-slate-400">Weak areas:</span>{" "}
                  {selected.weakAreas.length ? selected.weakAreas.join(", ") : "None"}
                </p>
                <p>
                  <span className="text-slate-400">Suggested next topic:</span> {selected.suggestedNextTopic}
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setGeneratedPlan(
                    [
                      `DETAILED PLAN FOR ${selected.name.toUpperCase()}`,
                      "",
                      "1. Focus priority",
                      `Target weak areas: ${selected.weakAreas.length ? selected.weakAreas.join(", ") : "Keep advancing current strong areas"}.`,
                      "",
                      "2. 3-session plan",
                      "Session 1: Concept review + guided examples (45-60 min).",
                      "Session 2: Practice quiz on weak areas + error analysis (45-60 min).",
                      "Session 3: Mixed application questions + confidence check (45-60 min).",
                      "",
                      "3. Instructor action",
                      `Assign follow-up topic: ${selected.suggestedNextTopic}.`,
                    ].join("\n"),
                  )
                }
                className="mt-4 inline-flex items-center justify-center rounded-lg border border-emerald-500/35 bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/25"
              >
                Generate detailed plan for {selected.name}
              </button>
              {generatedPlan && (
                <div className="mt-4 rounded-xl border border-emerald-500/25 bg-emerald-500/8 px-3 py-3 text-sm whitespace-pre-wrap leading-relaxed text-emerald-100/95">
                  {generatedPlan}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <p className="rounded-xl border border-slate-800/80 bg-slate-900/35 px-4 py-3 text-xs text-slate-400">
        In a full system, this data would be generated from student quiz results and interactions.
      </p>
    </div>
  );
}
