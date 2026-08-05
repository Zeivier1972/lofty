export const dynamic = "force-dynamic"

import type { Metadata } from "next"
import { prisma } from "@/lib/prisma"
import CaptureForm from "./capture-form"

export const metadata: Metadata = {
  title: "Invierte en Miami desde Costa Rica | One Twenty Brickell — Catherine Gomez",
  description:
    "Guía para inversionistas de Costa Rica: cómo invertir en pre-construcción en Miami (One Twenty Brickell), financiamiento para extranjeros, rentabilidad y proceso paso a paso.",
}

const BOOK_URL = "https://www.catherinegomezrealtor.com/book"

export default async function CostaRicaGuidePage() {
  const config = await prisma.aIConfig.findFirst().catch(() => null)
  const phone = config?.realtorPhone || ""
  const waDigits = phone.replace(/\D/g, "")
  const waUrl = waDigits
    ? `https://wa.me/${waDigits}?text=${encodeURIComponent("Hola Catherine, me interesa invertir en Miami desde Costa Rica (One Twenty Brickell).")}`
    : null

  return (
    <main className="min-h-screen bg-white text-gray-900">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#0b1f3a] via-[#12315c] to-[#1e40af] text-white">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:py-24 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <p className="inline-block rounded-full bg-white/10 px-4 py-1.5 text-sm font-semibold tracking-wide">
              🇨🇷 Inversionistas de Costa Rica · 🇺🇸 Miami
            </p>
            <h1 className="mt-5 text-4xl sm:text-5xl font-extrabold leading-tight">
              Invierte en Miami desde Costa Rica
            </h1>
            <p className="mt-3 text-xl text-blue-100 font-semibold">
              One Twenty Brickell — pre-construcción con plan de pagos y financiamiento para extranjeros.
            </p>
            <p className="mt-4 text-blue-100/90 leading-relaxed">
              Protege tu capital en dólares, genera renta y aprovecha la plusvalía de Brickell — el distrito
              financiero de Miami. Yo te acompaño en todo el proceso, en español y de principio a fin.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href="#kit" className="rounded-xl bg-white px-6 py-3.5 font-bold text-[#12315c] hover:bg-blue-50">
                Recibe la información gratis →
              </a>
              <a href={BOOK_URL} className="rounded-xl border border-white/40 px-6 py-3.5 font-bold text-white hover:bg-white/10">
                Agenda una llamada
              </a>
            </div>
          </div>
          <div className="rounded-2xl bg-white p-6 shadow-2xl" id="kit">
            <h2 className="text-2xl font-extrabold text-gray-900">Tu Kit de Inversión</h2>
            <p className="mt-1 text-gray-500">Precios, plan de pagos y financiamiento — directo a tu correo.</p>
            <div className="mt-5"><CaptureForm /></div>
          </div>
        </div>
      </section>

      {/* Trust bar */}
      <section className="border-b bg-gray-50">
        <div className="mx-auto max-w-6xl px-5 py-8 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {[
            ["100%", "En dólares (USD)"],
            ["30–40%", "Enganche para extranjeros"],
            ["Plan de pagos", "Durante construcción"],
            ["Brickell", "Distrito financiero"],
          ].map(([big, small]) => (
            <div key={small}>
              <div className="text-2xl font-extrabold text-[#12315c]">{big}</div>
              <div className="text-sm text-gray-500">{small}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Why Miami */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="text-3xl font-extrabold text-center">¿Por qué invertir en Miami?</h2>
        <div className="mt-10 grid md:grid-cols-3 gap-6">
          {[
            ["💵", "Refugio en dólares", "Tu inversión está en USD, protegida de la volatilidad y la inflación local."],
            ["📈", "Plusvalía comprobada", "Brickell ha tenido una fuerte apreciación año tras año; comprar en pre-construcción maximiza la ganancia."],
            ["🏦", "Renta en un mercado fuerte", "Alta demanda de alquiler de profesionales y ejecutivos en el corazón financiero de Miami."],
            ["🌎", "Puerta de entrada de LatAm", "Ciudad segura, conectada con Costa Rica por vuelos directos y con comunidad latina."],
            ["🔑", "Financiamiento para extranjeros", "No necesitas ser residente: bancos ofrecen préstamos a extranjeros con 30–40% de enganche."],
            ["📝", "Proceso simple y en español", "Yo coordino abogado, banco y desarrollador. Puedes comprar sin viajar."],
          ].map(([icon, title, body]) => (
            <div key={title} className="rounded-2xl border border-gray-100 p-6 shadow-sm">
              <div className="text-3xl">{icon}</div>
              <h3 className="mt-3 text-lg font-bold">{title}</h3>
              <p className="mt-2 text-gray-600 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* One Twenty Brickell */}
      <section className="bg-[#0b1f3a] text-white">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <h2 className="text-3xl font-extrabold">One Twenty Brickell Residences</h2>
          <p className="mt-3 text-blue-100 max-w-2xl">
            Una torre de pre-construcción en el centro de Brickell, diseñada tanto para vivir como para invertir —
            con amenidades de lujo y un plan de pagos cómodo durante la construcción.
          </p>
          <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              ["Ubicación", "Corazón de Brickell, a pasos de bancos, restaurantes y Brickell City Centre."],
              ["Amenidades", "Piscina, gimnasio, espacios de coworking, seguridad 24/7 y más."],
              ["Ideal para rentar", "Alta demanda de inquilinos profesionales en la zona."],
              ["Plan de pagos", "Pagas por etapas durante la construcción — no todo de una vez."],
            ].map(([t, b]) => (
              <div key={t} className="rounded-2xl bg-white/5 p-5 border border-white/10">
                <h3 className="font-bold text-lg">{t}</h3>
                <p className="mt-2 text-blue-100/90 text-sm leading-relaxed">{b}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-sm text-blue-200/70">
            *Precios, disponibilidad y planes de pago sujetos a cambios del desarrollador. Solicita el Kit para los números actuales.
          </p>
        </div>
      </section>

      {/* Process */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="text-3xl font-extrabold text-center">Cómo funciona — paso a paso</h2>
        <div className="mt-10 grid md:grid-cols-4 gap-6">
          {[
            ["1", "Recibe el Kit", "Te envío precios, plan de pagos y opciones de financiamiento."],
            ["2", "Llamada estratégica", "Revisamos tu objetivo, presupuesto y los números reales."],
            ["3", "Reserva tu unidad", "Coordino contrato, abogado y depósito — todo en español."],
            ["4", "Financiamiento y cierre", "Te conecto con bancos para extranjeros y cerramos la inversión."],
          ].map(([n, t, b]) => (
            <div key={n} className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#12315c] text-white font-bold text-lg">{n}</div>
              <h3 className="mt-4 font-bold">{t}</h3>
              <p className="mt-2 text-gray-600 text-sm leading-relaxed">{b}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-gradient-to-br from-[#12315c] to-[#1e40af] text-white">
        <div className="mx-auto max-w-3xl px-5 py-16 text-center">
          <h2 className="text-3xl font-extrabold">Da el primer paso hoy</h2>
          <p className="mt-3 text-blue-100">
            Recibe tu Kit de Inversión de One Twenty Brickell y agenda una llamada con {config?.realtorName || "Catherine"} —
            sin compromiso.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <a href="#kit" className="rounded-xl bg-white px-7 py-4 font-bold text-[#12315c] hover:bg-blue-50">
              Recibir el Kit
            </a>
            <a href={BOOK_URL} className="rounded-xl border border-white/40 px-7 py-4 font-bold hover:bg-white/10">
              Agendar llamada
            </a>
            {waUrl && (
              <a href={waUrl} className="rounded-xl bg-[#25D366] px-7 py-4 font-bold text-white hover:brightness-95">
                WhatsApp
              </a>
            )}
          </div>
        </div>
      </section>

      <footer className="bg-[#0b1f3a] text-blue-200/70 text-center text-sm py-8 px-5">
        {config?.realtorName || "Catherine Gomez"} · Real Estate en Miami{phone ? ` · ${phone}` : ""}
        <div className="mt-1 text-blue-200/50">
          No es una oferta de valores. La información es referencial; sujeta a verificación con el desarrollador.
        </div>
      </footer>
    </main>
  )
}
