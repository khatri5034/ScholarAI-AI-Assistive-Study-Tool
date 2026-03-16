"use client"

import { useEffect, useState } from "react"
import { auth } from "@/services/firebase"
import { onAuthStateChanged, User } from "firebase/auth"
import { useRouter } from "next/navigation"

export default function ProfilePage() {

  const [user, setUser] = useState<User | null>(null)
  const router = useRouter()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {

      if (!firebaseUser) {
        router.push("/login")
      } else {
        setUser(firebaseUser)
      }

    })

    return () => unsubscribe()
  }, [])

  return (
    <main className="min-h-screen bg-slate-950 pt-16 pb-24">

      <section className="relative overflow-hidden border-b border-slate-800">
        <div className="mx-auto max-w-2xl px-6 py-12">

          <p className="text-indigo-400 text-sm">Account</p>

          <h1 className="text-3xl font-bold text-white">
            Profile
          </h1>

          {user && (
            <p className="text-slate-400 mt-2">
              Logged in as {user.email}
            </p>
          )}

        </div>
      </section>

    </main>
  )
}