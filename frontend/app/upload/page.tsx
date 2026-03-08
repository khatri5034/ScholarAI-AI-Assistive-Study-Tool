import { Navbar, Footer } from "@/components";

export default function UploadPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-slate-950 pt-16 pb-24">
        <div className="mx-auto max-w-2xl px-6 py-12">
          <h1 className="text-2xl font-bold text-white">Upload documents</h1>
          <p className="mt-1 text-slate-400">
            Add PDFs, notes, or slides so ScholarAI can answer questions and plan your study.
          </p>
          <div className="mt-8 rounded-2xl border border-dashed border-slate-700 bg-slate-900/50 p-12 text-center">
            <p className="text-slate-400">Upload UI coming soon. Connect your backend /api/upload.</p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
