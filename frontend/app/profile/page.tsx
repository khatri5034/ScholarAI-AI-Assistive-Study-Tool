export default function ProfilePage() {
  return (
    <>
      <main className="min-h-screen bg-slate-950 pt-16 pb-24">
        <section className="relative overflow-hidden border-b border-slate-800">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_-10%,rgba(99,102,241,0.12),transparent)]" />
          <div className="relative mx-auto max-w-2xl px-6 py-12">
            <p className="mb-2 text-sm font-medium uppercase tracking-wider text-indigo-400">Account</p>
            <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Profile
            </h1>
            <p className="mt-3 text-slate-400">Manage your account and preferences.</p>
          </div>
        </section>
        <div className="mx-auto max-w-2xl px-6 py-12">
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 transition hover:border-slate-700">
              <h2 className="font-display text-lg font-semibold text-white">Profile & settings</h2>
              <p className="mt-2 text-sm text-slate-400">Profile and account settings will go here. Connect your auth to show user info.</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-6">
              <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-indigo-400/90">Preferences</h3>
              <p className="mt-3 text-sm text-slate-500">Theme, notifications, and other options will appear here.</p>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
