import { Navbar, Footer } from "@/components";

export default function LoginPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-violet-50 pt-16 pb-24">
        <div className="mx-auto max-w-sm px-6 py-12">
          <h1 className="text-2xl font-bold text-slate-800">Log in</h1>
          <p className="mt-1 text-slate-600">Sign in to your ScholarAI account.</p>
          <div className="mt-8 rounded-2xl border border-violet-200 bg-white p-6 shadow-sm">
            <p className="text-slate-600">Login form will go here. Connect your auth (e.g. NextAuth, Clerk).</p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
