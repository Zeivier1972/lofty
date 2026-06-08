import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"

const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n)

export default async function PublicCMAPage({ params }: { params: { token: string } }) {
  const report = await prisma.cMAReport.findFirst({
    where: { shareToken: params.token, isPublic: true },
  })

  if (!report) return notFound()

  // Track view
  if (!report.viewedAt) {
    await prisma.cMAReport.update({ where: { id: report.id }, data: { viewedAt: new Date() } })
  }

  const comps = JSON.parse(report.comps || "[]")
  let config: any = null
  try { config = await prisma.websiteConfig.findFirst() } catch {}
  const agentName = config?.agentName || "Catherine Gomez"
  const agentTitle = config?.agentTitle || "Real Estate Specialist"

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Header */}
      <div className="bg-gradient-to-r from-lofty-900 to-lofty-700 text-white py-10 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">L</span>
            </div>
            <div>
              <p className="font-bold">{agentName}</p>
              <p className="text-lofty-200 text-sm">{agentTitle}</p>
            </div>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold mb-1">{report.title}</h1>
          <p className="text-lofty-200 text-sm">{report.address}</p>
          <p className="text-lofty-300 text-xs mt-1">Análisis preparado el {new Date(report.createdAt).toLocaleDateString("es-US", { year: "numeric", month: "long", day: "numeric" })}</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        {/* Subject property */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-bold text-gray-900 text-lg mb-4">Propiedad Evaluada</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            {report.bedrooms && (
              <div className="text-center p-3 bg-lofty-50 rounded-xl">
                <p className="text-2xl font-bold text-lofty-700">{report.bedrooms}</p>
                <p className="text-xs text-gray-500">Recámaras</p>
              </div>
            )}
            {report.bathrooms && (
              <div className="text-center p-3 bg-lofty-50 rounded-xl">
                <p className="text-2xl font-bold text-lofty-700">{report.bathrooms}</p>
                <p className="text-xs text-gray-500">Baños</p>
              </div>
            )}
            {report.sqft && (
              <div className="text-center p-3 bg-lofty-50 rounded-xl">
                <p className="text-2xl font-bold text-lofty-700">{report.sqft.toLocaleString()}</p>
                <p className="text-xs text-gray-500">Sqft</p>
              </div>
            )}
            {report.yearBuilt && (
              <div className="text-center p-3 bg-lofty-50 rounded-xl">
                <p className="text-2xl font-bold text-lofty-700">{report.yearBuilt}</p>
                <p className="text-xs text-gray-500">Año construido</p>
              </div>
            )}
          </div>
          {report.notes && (
            <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{report.notes}</p>
          )}
        </div>

        {/* Comparable Sales */}
        {comps.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="font-bold text-gray-900 text-lg mb-4">Ventas Comparables</h2>
            <div className="space-y-3">
              {comps.map((comp: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{comp.address}</p>
                    <p className="text-xs text-gray-500">{comp.beds} rec · {comp.baths} baños · {comp.sqft?.toLocaleString()} sqft</p>
                    {comp.soldDate && <p className="text-xs text-gray-400">Vendida: {new Date(comp.soldDate).toLocaleDateString("es")}</p>}
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900">{comp.soldPrice ? fmt(comp.soldPrice) : "—"}</p>
                    {comp.soldPrice && comp.sqft && (
                      <p className="text-xs text-gray-400">${Math.round(comp.soldPrice / comp.sqft)}/sqft</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Estimated Value */}
        {report.estimatedValue && (
          <div className="bg-gradient-to-br from-lofty-600 to-lofty-800 text-white rounded-2xl p-8 text-center shadow-lg">
            <p className="text-lofty-200 text-sm font-medium uppercase tracking-wider mb-2">Valor Estimado de Mercado</p>
            <p className="text-5xl font-bold mb-3">{fmt(report.estimatedValue)}</p>
            {report.estimatedMin && report.estimatedMax && (
              <p className="text-lofty-200 text-sm">Rango: {fmt(report.estimatedMin)} — {fmt(report.estimatedMax)}</p>
            )}
            <p className="text-lofty-300 text-xs mt-4">
              Este análisis es una estimación basada en ventas recientes de propiedades comparables. El valor real puede variar según condición específica y el mercado actual.
            </p>
          </div>
        )}

        {/* CTA */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center">
          <p className="text-lg font-bold text-gray-900 mb-2">¿Listo para el siguiente paso?</p>
          <p className="text-sm text-gray-500 mb-4">{agentName} está disponible para hablar sobre tu propiedad y crear una estrategia de venta personalizada.</p>
          <a href="/book" className="inline-block bg-lofty-600 hover:bg-lofty-700 text-white font-medium px-6 py-3 rounded-xl transition-colors">
            Agendar Consulta Gratuita
          </a>
        </div>

        <p className="text-center text-xs text-gray-400">© {new Date().getFullYear()} {agentName} · Este reporte es confidencial</p>
      </div>
    </div>
  )
}
