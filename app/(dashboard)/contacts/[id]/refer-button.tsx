"use client"

import { useEffect, useState } from "react"
import { Handshake, X, Loader2, CheckCircle2 } from "lucide-react"

interface Partner { id: string; name: string; brokerage: string | null; isActive: boolean }

export default function ReferButton({ contactId, contactName }: { contactId: string; contactName: string }) {
  const [open, setOpen] = useState(false)
  const [partners, setPartners] = useState<Partner[]>([])
  const [partnerId, setPartnerId] = useState("")
  const [note, setNote] = useState("")
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    fetch("/api/referral-partners")
      .then(r => r.json())
      .then(d => {
        const active = Array.isArray(d) ? d.filter((p: Partner) => p.isActive) : []
        setPartners(active)
        if (active.length === 1) setPartnerId(active[0].id)
      })
      .catch(() => {})
  }, [open])

  async function send() {
    if (!partnerId) return
    setSending(true)
    try {
      const res = await fetch("/api/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId, partnerId, note: note || undefined }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      const partner = partners.find(p => p.id === partnerId)
      setDone(`Lead sent to ${partner?.name || "partner"}${data.emailSent || data.smsSent ? " — they've been notified" : ""}. Track it in Referrals.`)
      setNote("")
    } catch (e: any) {
      setDone(null)
      alert(e.message || "Could not send referral")
    } finally { setSending(false) }
  }

  return (
    <>
      <button
        onClick={() => { setOpen(true); setDone(null) }}
        className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-600 hover:text-lofty-700 hover:border-lofty-300 rounded-lg text-xs font-medium transition-colors"
        title="Refer this lead to a partner realtor"
      >
        <Handshake className="w-3.5 h-3.5" /> Refer to Partner
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Handshake className="w-4 h-4 text-lofty-600" /> Refer {contactName}
              </h3>
              <button onClick={() => setOpen(false)} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            {done ? (
              <div className="text-center py-4 space-y-3">
                <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto" />
                <p className="text-sm text-gray-700">{done}</p>
                <button onClick={() => setOpen(false)} className="px-4 py-2 bg-lofty-600 text-white rounded-lg text-sm font-medium">Done</button>
              </div>
            ) : partners.length === 0 ? (
              <div className="text-center py-4 space-y-3">
                <p className="text-sm text-gray-500">No referral partners yet.</p>
                <a href="/referrals" className="inline-block px-4 py-2 bg-lofty-600 text-white rounded-lg text-sm font-medium">Add a partner first</a>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  <select value={partnerId} onChange={e => setPartnerId(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                    <option value="">Select partner...</option>
                    {partners.map(p => (
                      <option key={p.id} value={p.id}>{p.name}{p.brokerage ? ` — ${p.brokerage}` : ""}</option>
                    ))}
                  </select>
                  <textarea value={note} onChange={e => setNote(e.target.value)} rows={3}
                    placeholder="Note for the partner (lead context, what they're looking for...)"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  <p className="text-xs text-gray-400">The partner gets an email/SMS with the lead&apos;s contact info and preferences. The referral is tracked in the Referrals page.</p>
                </div>
                <button onClick={send} disabled={sending || !partnerId}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-lofty-600 text-white rounded-xl hover:bg-lofty-700 disabled:opacity-50 font-semibold text-sm">
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Handshake className="w-4 h-4" />}
                  Send referral
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
