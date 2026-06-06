"use client"

import {
  CheckCircle2, Clock, Circle, Home, FileText, Search,
  Key, DollarSign, Handshake, ClipboardList, Star,
} from "lucide-react"
import { cn, formatCurrency } from "@/lib/utils"

interface Milestone {
  id: string
  name: string
  status: string
  dueDate: string | null
  completedDate: string | null
  notes: string | null
  order: number
}

interface Transaction {
  id: string
  title: string
  address: string
  type: string
  status: string
  salePrice: number | null
  listPrice: number | null
  closeDate: string | null
  contractDate: string | null
  milestones: Milestone[]
}

interface Props {
  transaction: Transaction | null
  contact: { firstName: string; status: string }
}

const BUYER_JOURNEY = [
  { key: "pre_approval", label: "Pre-Approval", labelEs: "Pre-aprobación", icon: FileText, desc: "Get pre-approved with a lender to know your budget.", descEs: "Obtenga la pre-aprobación de un prestamista para conocer su presupuesto." },
  { key: "home_search", label: "Home Search", labelEs: "Búsqueda de Casa", icon: Search, desc: "Tour homes that match your criteria and wishlist.", descEs: "Visite casas que coincidan con sus criterios y lista de deseos." },
  { key: "offer", label: "Making an Offer", labelEs: "Haciendo una Oferta", icon: Handshake, desc: "Submit a competitive offer on your dream home.", descEs: "Presente una oferta competitiva en la casa de sus sueños." },
  { key: "contract", label: "Under Contract", labelEs: "Bajo Contrato", icon: ClipboardList, desc: "Offer accepted! Now the due diligence process begins.", descEs: "¡Oferta aceptada! Ahora comienza el proceso de diligencia debida." },
  { key: "inspection", label: "Inspection", labelEs: "Inspección", icon: Search, desc: "Professional inspection to identify any issues with the home.", descEs: "Inspección profesional para identificar cualquier problema con la casa." },
  { key: "appraisal", label: "Appraisal", labelEs: "Tasación", icon: DollarSign, desc: "Lender orders an appraisal to confirm the home's value.", descEs: "El prestamista ordena una tasación para confirmar el valor de la casa." },
  { key: "clear_to_close", label: "Clear to Close", labelEs: "Listo para Cerrar", icon: CheckCircle2, desc: "Lender gives final approval. Almost there!", descEs: "El prestamista da la aprobación final. ¡Ya casi!" },
  { key: "closing", label: "Closing Day!", labelEs: "¡Día de Cierre!", icon: Key, desc: "Sign the papers, get the keys, and welcome home!", descEs: "¡Firme los papeles, obtenga las llaves y bienvenido a casa!" },
]

const SELLER_JOURNEY = [
  { key: "listing_prep", label: "Listing Prep", labelEs: "Preparación", icon: Home, desc: "Prepare your home for listing: staging, photos, pricing.", descEs: "Prepare su casa para listarla: decoración, fotos, precio." },
  { key: "active_listing", label: "Active Listing", labelEs: "Listado Activo", icon: Star, desc: "Your home is live on MLS and showing to buyers.", descEs: "Su casa está en el MLS y mostrándose a compradores." },
  { key: "offers", label: "Reviewing Offers", labelEs: "Revisando Ofertas", icon: FileText, desc: "Reviewing and negotiating offers from interested buyers.", descEs: "Revisando y negociando ofertas de compradores interesados." },
  { key: "contract", label: "Under Contract", labelEs: "Bajo Contrato", icon: ClipboardList, desc: "Accepted an offer! Buyer due diligence period begins.", descEs: "¡Oferta aceptada! Comienza el período de diligencia debida del comprador." },
  { key: "inspection", label: "Inspection", labelEs: "Inspección", icon: Search, desc: "Buyer's inspector reviews the property.", descEs: "El inspector del comprador revisa la propiedad." },
  { key: "appraisal", label: "Appraisal", labelEs: "Tasación", icon: DollarSign, desc: "Home appraised to confirm value for buyer's lender.", descEs: "La casa es tasada para confirmar el valor para el prestamista del comprador." },
  { key: "clear_to_close", label: "Clear to Close", labelEs: "Listo para Cerrar", icon: CheckCircle2, desc: "Financing confirmed. Preparing for closing.", descEs: "Financiamiento confirmado. Preparando el cierre." },
  { key: "closing", label: "Closing Day!", labelEs: "¡Día de Cierre!", icon: DollarSign, desc: "Sign the papers and receive your proceeds!", descEs: "¡Firme los papeles y reciba su dinero!" },
]

export default function PortalTimelineClient({ transaction, contact }: Props) {
  const isBuyer = !transaction || transaction.type === "BUYER"
  const journey = isBuyer ? BUYER_JOURNEY : SELLER_JOURNEY

  // Map transaction status to a journey step
  const STATUS_MAP: Record<string, number> = {
    ACTIVE_LISTING: isBuyer ? 1 : 1,
    UNDER_CONTRACT: 3,
    INSPECTION: 4,
    APPRAISAL: 5,
    CLEAR_TO_CLOSE: 6,
    CLOSED: 7,
  }
  const currentStep = transaction ? (STATUS_MAP[transaction.status] || 0) : 0

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Your Journey</h1>
        <p className="text-gray-500 text-sm mt-1">Tu Camino — Step-by-step progress tracker</p>
      </div>

      {transaction && (
        <div className="bg-white rounded-2xl border p-5 mb-8 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Active Transaction</div>
              <h2 className="font-bold text-gray-900 text-lg">{transaction.address}</h2>
              <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                <span className="text-lofty-600 font-bold text-base">
                  {formatCurrency(transaction.salePrice || transaction.listPrice || 0)}
                </span>
                <span>·</span>
                <span>{transaction.type} transaction</span>
              </div>
            </div>
            {transaction.closeDate && (
              <div className="text-right">
                <div className="text-xs text-gray-400">Expected Close</div>
                <div className="font-bold text-gray-900">
                  {new Date(transaction.closeDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Journey timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-6 top-6 bottom-0 w-0.5 bg-gray-200" />

        <div className="space-y-1">
          {journey.map((step, idx) => {
            const isCompleted = idx < currentStep
            const isCurrent = idx === currentStep
            const isPending = idx > currentStep

            return (
              <div key={step.key} className={cn(
                "relative flex gap-4 pb-6",
                isCurrent && "z-10"
              )}>
                {/* Icon */}
                <div className={cn(
                  "relative z-10 w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm border-2",
                  isCompleted ? "bg-green-500 border-green-500 text-white" :
                  isCurrent ? "bg-lofty-600 border-lofty-600 text-white ring-4 ring-lofty-200" :
                  "bg-white border-gray-200 text-gray-400"
                )}>
                  {isCompleted
                    ? <CheckCircle2 className="w-6 h-6" />
                    : isCurrent
                    ? <step.icon className="w-6 h-6" />
                    : <step.icon className="w-5 h-5 opacity-50" />}
                </div>

                {/* Content */}
                <div className={cn(
                  "flex-1 bg-white rounded-2xl border p-4 shadow-sm",
                  isCurrent && "border-lofty-300 shadow-lofty-100 shadow-md"
                )}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className={cn(
                          "font-bold",
                          isCompleted ? "text-green-700" :
                          isCurrent ? "text-lofty-700 text-base" : "text-gray-500"
                        )}>
                          {step.label}
                        </h3>
                        <span className="text-gray-400 text-sm">/ {step.labelEs}</span>
                        {isCurrent && (
                          <span className="text-xs bg-lofty-100 text-lofty-700 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Current Step
                          </span>
                        )}
                        {isCompleted && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">
                            ✓ Completed
                          </span>
                        )}
                      </div>
                      <p className={cn(
                        "text-sm mt-1",
                        isCurrent ? "text-gray-700" : "text-gray-400"
                      )}>
                        {step.desc}
                      </p>
                      {(isCurrent || isCompleted) && (
                        <p className="text-xs text-gray-400 mt-0.5 italic">{step.descEs}</p>
                      )}
                    </div>
                    <span className={cn(
                      "text-xs font-bold ml-3 flex-shrink-0",
                      isCompleted ? "text-green-600" :
                      isCurrent ? "text-lofty-600" : "text-gray-300"
                    )}>
                      {idx + 1}/{journey.length}
                    </span>
                  </div>

                  {/* Milestone details for current transaction */}
                  {transaction && isCurrent && (
                    <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
                      {transaction.milestones
                        .filter(m => m.status !== "COMPLETED")
                        .slice(0, 3)
                        .map(m => (
                          <div key={m.id} className="flex items-center gap-2 text-xs">
                            <Circle className="w-3 h-3 text-lofty-400 flex-shrink-0" />
                            <span className="text-gray-700">{m.name}</span>
                            {m.dueDate && (
                              <span className="ml-auto text-gray-400">
                                Due {new Date(m.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                              </span>
                            )}
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* No transaction state */}
      {!transaction && (
        <div className="mt-6 bg-lofty-50 border border-lofty-200 rounded-2xl p-6 text-center">
          <Home className="w-12 h-12 text-lofty-400 mx-auto mb-3" />
          <h3 className="font-semibold text-lofty-800 mb-1">Your journey starts here!</h3>
          <p className="text-sm text-lofty-600">
            Once your agent creates your transaction, your full step-by-step progress will appear here.
          </p>
          <p className="text-xs text-lofty-500 mt-1">
            Una vez que su agente cree su transacción, aquí aparecerá su progreso detallado.
          </p>
        </div>
      )}
    </div>
  )
}
