import { Navbar, Footer, StudyPlanner } from "@/components";

export default function PlannerPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-slate-950 pt-16 pb-24">
        <div className="mx-auto max-w-4xl px-6 py-12">
          <h1 className="text-2xl font-bold text-white">Study Planner</h1>
          <p className="mt-1 text-slate-400">Generate and manage your study schedule.</p>
          <div className="mt-8">
            <StudyPlanner />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
