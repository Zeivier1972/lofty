export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

// Diagnostic: lists every social-bot campaign and whether it will actually
// deliver a PDF when its keyword is used. A keyword delivers if the campaign
// has a pdfUrl OR a matching LeadMagnet guide. Open in the browser while logged
// in: {APP_URL}/api/admin/campaign-check
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [fb, ig, magnets] = await Promise.all([
    prisma.facebookBotCampaign.findMany({ select: { keyword: true, keywords: true, name: true, pdfUrl: true, isActive: true, leads: true } }).catch(() => []),
    prisma.instagramBotCampaign.findMany({ select: { keyword: true, keywords: true, name: true, pdfUrl: true, isActive: true, leads: true } }).catch(() => []),
    prisma.leadMagnet.findMany({ select: { keyword: true, guideUrl: true } }).catch(() => []),
  ])
  const magnetByKw = new Map((magnets as any[]).map(m => [String(m.keyword).toUpperCase(), m.guideUrl]))

  const rows = [
    ...(fb as any[]).map(c => ({ platform: "Facebook", ...c })),
    ...(ig as any[]).map(c => ({ platform: "Instagram", ...c })),
  ].map(c => {
    const kw = String(c.keyword || "").toUpperCase()
    const hasMagnet = !!magnetByKw.get(kw)
    const hasPdf = !!(c.pdfUrl && String(c.pdfUrl).trim())
    const willDeliver = hasMagnet || hasPdf
    return { ...c, kw, hasMagnet, hasPdf, willDeliver }
  })

  const esc = (s: any) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  const problems = rows.filter(r => r.isActive && !r.willDeliver)
  const inactive = rows.filter(r => !r.isActive)

  const rowHtml = rows.map(r => {
    const status = !r.isActive
      ? '<span style="color:#9ca3af">Inactiva</span>'
      : r.willDeliver
        ? '<span style="color:#059669;font-weight:700">✓ Entrega PDF</span>'
        : '<span style="color:#dc2626;font-weight:700">✗ SIN PDF — no entrega nada</span>'
    return `<tr>
      <td>${esc(r.platform)}</td>
      <td style="font-family:monospace;font-weight:700">${esc(r.kw)}</td>
      <td>${esc(r.name || "")}</td>
      <td>${status}</td>
      <td style="color:#6b7280">${r.leads ?? 0}</td>
    </tr>`
  }).join("")

  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <style>body{font-family:Arial,sans-serif;max-width:760px;margin:0 auto;padding:24px;color:#111}
  h1{font-size:20px} table{width:100%;border-collapse:collapse;margin-top:12px}
  th,td{text-align:left;padding:8px 10px;border-bottom:1px solid #eee;font-size:14px}
  th{background:#f9fafb;color:#6b7280;font-size:12px;text-transform:uppercase}
  .box{border-radius:10px;padding:12px 16px;margin:12px 0}
  .bad{background:#fef2f2;border:1px solid #fecaca;color:#991b1b}
  .ok{background:#ecfdf5;border:1px solid #a7f3d0;color:#065f46}</style></head><body>
  <h1>Revisión de campañas — palabra clave → PDF</h1>
  <p style="color:#6b7280">Una campaña entrega el PDF si tiene un PDF adjunto o una guía con esa palabra clave.</p>
  ${problems.length
    ? `<div class="box bad"><strong>⚠️ ${problems.length} campaña(s) activa(s) NO entregan PDF</strong> — su palabra clave no hará nada: ${problems.map(p => esc(p.kw)).join(", ")}. Adjúntales un PDF en la pantalla de Campañas.</div>`
    : `<div class="box ok"><strong>✓ Todas las campañas activas entregan su PDF.</strong></div>`}
  <table><thead><tr><th>Plataforma</th><th>Palabra clave</th><th>Nombre</th><th>Estado</th><th>Leads</th></tr></thead>
  <tbody>${rowHtml || '<tr><td colspan="5" style="color:#9ca3af">No hay campañas todavía.</td></tr>'}</tbody></table>
  ${inactive.length ? `<p style="color:#9ca3af;font-size:13px;margin-top:12px">${inactive.length} campaña(s) inactiva(s) no se disparan aunque tengan PDF.</p>` : ""}
  </body></html>`

  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } })
}
