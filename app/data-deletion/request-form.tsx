"use client"

import { useState } from "react"

type State = "idle" | "sending" | "done" | "error"

export default function RequestForm() {
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [handle, setHandle] = useState("")
  const [note, setNote] = useState("")
  const [state, setState] = useState<State>("idle")
  const [code, setCode] = useState("")
  const [error, setError] = useState("")

  const hasIdentifier = Boolean(email.trim() || phone.trim() || handle.trim())

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!hasIdentifier) {
      setError("Indica al menos un correo, teléfono o usuario de Instagram para poder encontrar tus datos.")
      return
    }
    setState("sending")
    setError("")
    try {
      const res = await fetch("/api/data-deletion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          phone: phone.trim(),
          handle: handle.trim(),
          note: note.trim(),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "No pudimos registrar tu solicitud.")
      }
      setCode(data.confirmationCode || "")
      setState("done")
    } catch (err: any) {
      setError(
        err?.message ||
          "No pudimos registrar tu solicitud. Escríbenos a info@catherinegomezrealtor.com y la procesamos manualmente.",
      )
      setState("error")
    }
  }

  if (state === "done") {
    return (
      <div
        role="status"
        className="rounded-lg border-2 border-green-600 bg-green-50 p-6"
      >
        <h3 className="font-semibold text-green-900 mb-2">
          Solicitud recibida ✓
        </h3>
        <p className="text-green-900 text-sm leading-relaxed mb-3">
          Hemos registrado tu solicitud de eliminación. La procesaremos dentro de los 30
          días y dejaremos de enviarte mensajes de inmediato.
        </p>
        {code && (
          <p className="text-sm text-green-900">
            Tu código de confirmación:{" "}
            <code className="font-mono font-semibold bg-white px-2 py-1 rounded border border-green-300">
              {code}
            </code>
            <br />
            <span className="text-xs text-green-800">
              Guárdalo. Si necesitas consultar el estado, menciónalo al escribirnos.
            </span>
          </p>
        )}
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-gray-200 p-6 space-y-4">
      <div>
        <label htmlFor="dd-email" className="block text-sm font-medium text-gray-900 mb-1">
          Correo electrónico
        </label>
        <input
          id="dd-email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          autoComplete="email"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
          placeholder="tucorreo@ejemplo.com"
        />
      </div>

      <div>
        <label htmlFor="dd-phone" className="block text-sm font-medium text-gray-900 mb-1">
          Teléfono
        </label>
        <input
          id="dd-phone"
          type="tel"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          autoComplete="tel"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
          placeholder="(786) 000-0000"
        />
      </div>

      <div>
        <label htmlFor="dd-handle" className="block text-sm font-medium text-gray-900 mb-1">
          Usuario de Instagram o nombre en Facebook
        </label>
        <input
          id="dd-handle"
          type="text"
          value={handle}
          onChange={e => setHandle(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
          placeholder="@usuario"
        />
      </div>

      <p className="text-xs text-gray-500 leading-relaxed">
        Completa al menos uno de los tres campos anteriores — lo usamos únicamente para
        localizar tus datos y eliminarlos.
      </p>

      <div>
        <label htmlFor="dd-note" className="block text-sm font-medium text-gray-900 mb-1">
          Comentario <span className="font-normal text-gray-500">(opcional)</span>
        </label>
        <textarea
          id="dd-note"
          value={note}
          onChange={e => setNote(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
          placeholder="¿Algo que debamos saber?"
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={state === "sending"}
        className="w-full rounded-md bg-gray-900 px-4 py-3 font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {state === "sending" ? "Enviando…" : "Solicitar eliminación de mis datos"}
      </button>
    </form>
  )
}
