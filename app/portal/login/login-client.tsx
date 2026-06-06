"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Building2, Mail, Key, ArrowRight, Loader2 } from "lucide-react"

interface Props {
  prefillToken?: string
  error?: string
}

export default function PortalLoginClient({ prefillToken, error }: Props) {
  const router = useRouter()
  const [mode, setMode] = useState<"magic" | "email">("magic")
  const [token, setToken] = useState(prefillToken || "")
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [errorMsg, setErrorMsg] = useState(error || "")

  // Auto-submit if token prefilled (magic link click)
  useEffect(() => {
    if (prefillToken) {
      handleTokenLogin(prefillToken)
    }
  }, [prefillToken])

  async function handleTokenLogin(t: string) {
    setLoading(true)
    setErrorMsg("")
    try {
      const res = await fetch("/api/portal/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: t }),
      })
      if (res.ok) {
        router.push("/portal/dashboard")
      } else {
        const data = await res.json()
        setErrorMsg(data.error || "Invalid or expired link")
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleEmailRequest(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErrorMsg("")
    try {
      const res = await fetch("/api/portal/request-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      if (res.ok) {
        setEmailSent(true)
      } else {
        const data = await res.json()
        setErrorMsg(data.error || "No account found with that email")
      }
    } finally {
      setLoading(false)
    }
  }

  if (loading && prefillToken) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-lofty-900 to-lofty-700 flex items-center justify-center">
        <div className="text-center text-white">
          <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4" />
          <p className="text-lg font-medium">Signing you in…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-lofty-950 to-lofty-700 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-lg mb-4">
            <Building2 className="w-8 h-8 text-lofty-600" />
          </div>
          <h1 className="text-2xl font-bold text-white">Client Portal</h1>
          <p className="text-lofty-300 text-sm mt-1">Track your real estate journey</p>
          <p className="text-lofty-300 text-xs mt-0.5">Rastrea tu proceso de bienes raíces</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {emailSent ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Check your email!</h2>
              <p className="text-gray-500 text-sm">
                We sent a login link to <strong>{email}</strong>. Click the link in the email to access your portal.
              </p>
              <p className="text-gray-400 text-xs mt-2">
                Revisa tu correo electrónico para el enlace de acceso.
              </p>
              <button
                onClick={() => { setEmailSent(false); setEmail("") }}
                className="mt-6 text-sm text-lofty-600 hover:text-lofty-700 font-medium"
              >
                Try a different email
              </button>
            </div>
          ) : (
            <>
              {errorMsg && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {errorMsg}
                </div>
              )}

              {/* Tab switcher */}
              <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-6">
                <button
                  onClick={() => setMode("email")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                    mode === "email" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <Mail className="w-4 h-4" /> Email Link
                </button>
                <button
                  onClick={() => setMode("magic")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                    mode === "magic" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <Key className="w-4 h-4" /> Access Code
                </button>
              </div>

              {mode === "email" ? (
                <form onSubmit={handleEmailRequest} className="space-y-4">
                  <div>
                    <label className="text-sm font-semibold text-gray-700 mb-1.5 block">
                      Email Address / Correo Electrónico
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-lofty-500 transition-colors"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading || !email}
                    className="w-full flex items-center justify-center gap-2 py-3.5 bg-lofty-600 text-white rounded-xl font-semibold hover:bg-lofty-700 transition-colors disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                    Send My Login Link
                  </button>
                </form>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-semibold text-gray-700 mb-1.5 block">
                      Access Code / Código de Acceso
                    </label>
                    <input
                      type="text"
                      value={token}
                      onChange={e => setToken(e.target.value)}
                      placeholder="Paste your access code here..."
                      className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-lofty-500 transition-colors"
                    />
                    <p className="text-xs text-gray-400 mt-1.5">
                      Your access code was sent to you by your agent.
                    </p>
                  </div>
                  <button
                    onClick={() => handleTokenLogin(token)}
                    disabled={loading || !token}
                    className="w-full flex items-center justify-center gap-2 py-3.5 bg-lofty-600 text-white rounded-xl font-semibold hover:bg-lofty-700 transition-colors disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                    Access My Portal
                  </button>
                </div>
              )}

              <p className="text-center text-xs text-gray-400 mt-6">
                Your portal is provided by your real estate agent. Contact them if you need help.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
