"use client"

import { FileText, Download, CheckCircle2, Clock, AlertCircle, FolderOpen } from "lucide-react"
import { cn } from "@/lib/utils"

interface Document {
  id: string
  name: string
  url: string
  fileType: string | null
  fileSize: number | null
  uploadedAt: string
}

interface Milestone {
  id: string
  name: string
  status: string
  dueDate: string | null
  notes: string | null
}

interface Transaction {
  address: string
  type: string
  status: string
  documents: Document[]
  milestones: Milestone[]
}

function formatSize(bytes: number | null) {
  if (!bytes) return ""
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

const PENDING_DOCS_BY_STAGE: Record<string, string[]> = {
  UNDER_CONTRACT: ["Purchase Agreement", "Earnest Money Receipt", "Disclosure Forms"],
  INSPECTION: ["Inspection Report", "Repair Request / Counter", "Inspection Response"],
  APPRAISAL: ["Appraisal Report", "Lender Conditions"],
  CLEAR_TO_CLOSE: ["Closing Disclosure (CD)", "Final Walkthrough Notes", "Wire Instructions"],
  CLOSED: ["Settlement Statement (HUD-1 / ALTA)", "Deed", "Title Insurance Policy"],
}

export default function PortalDocumentsClient({ transaction }: { transaction: Transaction | null }) {
  const pendingDocs = transaction ? (PENDING_DOCS_BY_STAGE[transaction.status] || []) : []
  const uploadedDocNames = new Set(transaction?.documents.map(d => d.name) || [])

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
        <p className="text-gray-500 text-sm mt-0.5">Documentos — Your transaction documents and records</p>
      </div>

      {!transaction ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
            <FolderOpen className="w-10 h-10 text-gray-400" />
          </div>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">No documents yet</h3>
          <p className="text-gray-500 text-sm mb-1">Documents will appear here once your transaction starts.</p>
          <p className="text-gray-400 text-xs">Los documentos aparecerán aquí una vez que comience su transacción.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* What to expect */}
          {pendingDocs.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <h3 className="font-semibold text-amber-800">Documents Expected at This Stage</h3>
              </div>
              <div className="space-y-2">
                {pendingDocs.map(doc => (
                  <div key={doc} className="flex items-center gap-2.5">
                    <div className={cn(
                      "w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0",
                      uploadedDocNames.has(doc) ? "bg-green-500" : "bg-amber-200"
                    )}>
                      {uploadedDocNames.has(doc)
                        ? <CheckCircle2 className="w-3 h-3 text-white" />
                        : <Clock className="w-3 h-3 text-amber-600" />}
                    </div>
                    <span className={cn("text-sm", uploadedDocNames.has(doc) ? "line-through text-gray-400" : "text-amber-800")}>
                      {doc}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Uploaded documents */}
          <div className="bg-white rounded-2xl border p-5 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-4">
              Uploaded Documents ({transaction.documents.length})
            </h3>
            {transaction.documents.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No documents uploaded yet.</p>
                <p className="text-xs text-gray-400 mt-1">Your agent will upload documents as your transaction progresses.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {transaction.documents.map(doc => (
                  <div key={doc.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors border">
                    <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                      <FileText className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-gray-900 truncate">{doc.name}</div>
                      <div className="text-xs text-gray-500">
                        {doc.fileType && <span className="uppercase mr-2">{doc.fileType}</span>}
                        {doc.fileSize && <span>{formatSize(doc.fileSize)} · </span>}
                        Uploaded {new Date(doc.uploadedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </div>
                    </div>
                    {doc.url && (
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-lofty-600 text-white rounded-lg text-xs font-medium hover:bg-lofty-700 flex-shrink-0"
                      >
                        <Download className="w-3.5 h-3.5" /> Download
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Milestone action items */}
          <div className="bg-white rounded-2xl border p-5 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-4">Action Items</h3>
            <div className="space-y-2">
              {transaction.milestones
                .filter(m => m.status === "PENDING" || m.status === "IN_PROGRESS")
                .map(m => (
                  <div key={m.id} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50">
                    <div className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                      m.status === "IN_PROGRESS" ? "bg-blue-100" : "bg-gray-200"
                    )}>
                      {m.status === "IN_PROGRESS"
                        ? <Clock className="w-3.5 h-3.5 text-blue-600" />
                        : <div className="w-2 h-2 rounded-full bg-gray-400" />}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-gray-900">{m.name}</div>
                      {m.notes && <div className="text-xs text-gray-500 mt-0.5">{m.notes}</div>}
                      {m.dueDate && (
                        <div className="text-xs text-amber-600 mt-0.5 font-medium">
                          Due: {new Date(m.dueDate).toLocaleDateString("en-US", { month: "long", day: "numeric" })}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              {transaction.milestones.filter(m => m.status !== "COMPLETED").length === 0 && (
                <div className="flex items-center gap-2 p-3 bg-green-50 rounded-xl text-green-700 text-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  All action items complete! Great work.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
