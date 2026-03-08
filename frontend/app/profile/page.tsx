import { Navbar, Footer } from "@/components";

export default function ProfilePage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-slate-950 pt-16 pb-24">
        <div className="mx-auto max-w-2xl px-6 py-12">
          <h1 className="text-2xl font-bold text-white">Profile</h1>
          <p className="mt-1 text-slate-400">Manage your account and preferences.</p>
          <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
            <p className="text-slate-400">Profile and account settings will go here. Connect your auth to show user info.</p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
