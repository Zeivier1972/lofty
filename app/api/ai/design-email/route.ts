export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import Anthropic from "@anthropic-ai/sdk"

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "" })

// Aria's email designer. Given a plain-language brief ("un email para mi evento
// de inversión en Bogotá, 24-25 sep, con botón para registrarse en Eventbrite:
// <link>"), returns a polished, mobile-responsive email — subject + inline-styled
// HTML BODY ONLY. The campaign sender wraps it in the branded header (hero + agent
// card) and footer/unsubscribe via lib/email.wrapEmail, so the body must NOT
// include <html>/<head>/<body>, a hero image, or a footer.

const BRAND = { navy: "#1B1F3B", gold: "#C9A84C", blue: "#2563eb" }

function systemPrompt(language: string) {
  const lang = language === "en" ? "English" : "Spanish (Latin American, warm and professional)"
  return `Eres Aria, la diseñadora de emails de Catherine Gómez Realtor (bienes raíces en Miami; audiencia bilingüe, principalmente Latinoamérica).

Diseñas el CUERPO de un email de marketing que se insertará dentro de un contenedor de marca de 600px de ancho. El encabezado (imagen hero + tarjeta de la agente) y el pie de página con enlace para cancelar suscripción se agregan automáticamente — NO los incluyas.

Reglas del HTML (compatibilidad con clientes de correo):
- Devuelve SOLO el contenido del cuerpo: párrafos, encabezados, listas, un botón CTA, e imágenes solo si se piden. NADA de <html>, <head>, <body>, hero, ni footer.
- Usa estilos EN LÍNEA (inline) en cada etiqueta. Nada de <style> ni clases.
- Ancho máximo 600px; imágenes con style="max-width:100%;border-radius:8px".
- Colores de marca: azul marino ${BRAND.navy}, dorado ${BRAND.gold}. Botón CTA: fondo ${BRAND.navy} o ${BRAND.gold}, texto blanco, padding 14px 28px, border-radius 8px, font-weight bold, display inline-block, text-decoration none.
- Personaliza con {first_name} donde tenga sentido.
- Si el brief incluye un enlace (Eventbrite, agenda, etc.), úsalo en el botón CTA.
- Escribe en ${lang}. Tono cálido, claro, orientado a la acción. Sin relleno.
- Estructura: saludo → gancho → 2-4 secciones con beneficios/detalles → CTA destacado → cierre.

Formato de salida EXACTO (sin ningún otro texto, sin comillas de código):
SUBJECT: <la línea de asunto, llamativa, con emoji si ayuda>
---BODY---
<el HTML del cuerpo>`
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { prompt, language, currentBody } = await req.json()
    if (!prompt || !String(prompt).trim()) {
      return NextResponse.json({ error: "prompt required" }, { status: 400 })
    }

    const userParts = [`Brief: ${String(prompt).trim()}`]
    if (currentBody && String(currentBody).trim()) {
      userParts.push(`\nMejora/ajusta a partir de este borrador existente (mantén lo bueno):\n${String(currentBody).slice(0, 4000)}`)
    }

    const response = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 2600,
      system: systemPrompt(language === "en" ? "en" : "es"),
      messages: [{ role: "user", content: userParts.join("\n") }],
    })

    const raw = response.content[0]?.type === "text" ? response.content[0].text.trim() : ""
    const idx = raw.indexOf("---BODY---")
    let subject = ""
    let body = ""
    if (idx !== -1) {
      subject = raw.slice(0, idx).replace(/^SUBJECT:\s*/i, "").trim()
      body = raw.slice(idx + "---BODY---".length).trim()
    } else {
      // Fallback: no delimiter — treat whole thing as body, derive a subject.
      body = raw.replace(/^SUBJECT:.*$/im, "").trim()
      subject = (raw.match(/^SUBJECT:\s*(.+)$/im)?.[1] || "").trim()
    }
    // Strip accidental code fences.
    body = body.replace(/^```[a-z]*\s*/i, "").replace(/\s*```$/i, "").trim()

    if (!body) return NextResponse.json({ error: "No se pudo generar el email. Intenta de nuevo." }, { status: 502 })

    return NextResponse.json({ subject, body })
  } catch (e: any) {
    console.error("[AI design-email]", e?.message || e)
    return NextResponse.json({ error: e?.message || "Error al diseñar el email" }, { status: 500 })
  }
}
