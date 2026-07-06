"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Handshake, Loader2 } from "lucide-react"

export default function PartnerLoginClient({ prefillToken, error: initialError }: {
  prefillToken?: string
  error?: string
}) {
  const router = useRouter()
  const [token, setToken] = useState(prefillToken || "")
  const [loading, setLoading] = useState(!!prefillToken)
  const [error, setError] = useState(initialError || "")

  async function login(t: string) {
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/partner/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: t }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Login failed")
      router.push("/partner")
      router.refresh()
    } catch (e: any) {
      setError(e.message)
      setLoading(false)
    }
  }

  // Auto-login when arriving from the email link
  useEffect(() => {
    if (prefillToken) login(prefillToken)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1628] to-[#1a2f50] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 text-center space-y-5">
        <div className="w-14 h-14 bg-lofty-50 rounded-2xl flex items-center justify-center mx-auto">
          <Handshake className="w-7 h-7 text-lofty-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Partner Portal</h1>
          <p className="text-sm text-gray-500 mt-1">Access the leads referred to you</p>
        </div>

        {loading ? (
          <div className="py-6">
            <Loader2 className="w-6 h-6 animate-spin text-lofty-600 mx-auto" />
            <p className="text-sm text-gray-400 mt-3">Signing you in...</p>
          </div>
        ) : (
          <>
            {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
            <input
              value={token}
              onChange={e => setToken(e.target.value)}
              placeholder="Paste your access code"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-lofty-500"
            />
            <button
              onClick={() => token.trim() && login(token.trim())}
              disabled={!token.trim()}
              className="w-full py-2.5 bg-lofty-600 text-white rounded-xl hover:bg-lofty-700 disabled:opacity-50 font-semibold text-sm"
            >
              Sign in
            </button>
            <p className="text-xs text-gray-400">Use the access link from your referral email. Lost it? Ask your referring agent to resend it.</p>
          </>
        )}
      </div>
    </div>
  )
}
