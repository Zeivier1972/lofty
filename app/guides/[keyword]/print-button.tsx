"use client"

export function PrintButton() {
  return (
    <div className="guide-print-btn">
      <button onClick={() => window.print()}>Descargar / Imprimir como PDF</button>
    </div>
  )
}
