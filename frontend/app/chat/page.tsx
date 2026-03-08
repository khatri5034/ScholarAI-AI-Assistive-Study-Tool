import { Navbar, Footer, ChatBox } from "@/components";

export default function ChatPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-slate-950 pt-16 pb-24">
        <div className="mx-auto max-w-4xl px-6 py-12">
          <h1 className="text-2xl font-bold text-white">Study Chat</h1>
          <p className="mt-1 text-slate-400">Ask questions about your course material.</p>
          <div className="mt-8">
            <ChatBox />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
