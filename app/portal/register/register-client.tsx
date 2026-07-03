"use client"

import { useState } from "react"
import Link from "next/link"
import { Building2, Mail, User, Phone, ArrowRight, Loader2, CheckCircle } from "lucide-react"

export default function RegisterClient() {
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/portal/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, email, phone }),
      })
      if (res.ok) {
        setDone(true)
      } else {
        const data = await res.json()
        setError(data.error || "Registration failed. Please try again.")
      }
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1f35] to-[#1a3a5c] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/site" className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-lg mb-4">
            <Building2 className="w-8 h-8 text-[#1a3a5c]" />
          </Link>
          <h1 className="text-2xl font-bold text-white">Create Your Account</h1>
          <p className="text-blue-300 text-sm mt-1">Crea tu cuenta del portal de cliente</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {done ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">¡Listo! Check your email</h2>
              <p className="text-gray-500 text-sm mb-1">
                We sent a login link to <strong>{email}</strong>.
              </p>
              <p className="text-gray-400 text-xs">
                Click the link in the email to access your portal. Check your spam folder if you don't see it.
              </p>
              <Link href="/portal/login"
                className="inline-block mt-6 text-sm text-[#1a3a5c] font-semibold hover:underline">
                Back to Sign In →
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-bold text-gray-900 mb-1">Get Portal Access</h2>
              <p className="text-gray-500 text-sm mb-6">
                Save properties, get new-listing alerts, and track your home search — all in one place.
              </p>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-semibold text-gray-700 mb-1.5 block">
                      First Name <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        required
                        value={firstName}
                        onChange={e => setFirstName(e.target.value)}
                        placeholder="Ana"
                        className="w-full border-2 border-gray-200 rounded-xl pl-9 pr-3 py-3 text-sm focus:outline-none focus:border-[#1a3a5c] transition-colors"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-700 mb-1.5 block">
                      Last Name
                    </label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={e => setLastName(e.target.value)}
                      placeholder="García"
                      className="w-full border-2 border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-[#1a3a5c] transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-700 mb-1.5 block">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="ana@example.com"
                      className="w-full border-2 border-gray-200 rounded-xl pl-9 pr-3 py-3 text-sm focus:outline-none focus:border-[#1a3a5c] transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-700 mb-1.5 block">
                    Phone <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="+1 (305) 000-0000"
                      className="w-full border-2 border-gray-200 rounded-xl pl-9 pr-3 py-3 text-sm focus:outline-none focus:border-[#1a3a5c] transition-colors"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !firstName || !email}
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#1a3a5c] text-white rounded-xl font-bold text-sm hover:bg-[#c9a84c] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                  Create My Account / Crear Mi Cuenta
                </button>
              </form>

              <p className="text-center text-sm text-gray-500 mt-6">
                Already have an account?{" "}
                <Link href="/portal/login" className="text-[#1a3a5c] font-semibold hover:underline">
                  Sign In →
                </Link>
              </p>

              <p className="text-center text-xs text-gray-400 mt-3">
                By registering you agree to receive property alerts and communications from Catherine Gomez Realtor.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
