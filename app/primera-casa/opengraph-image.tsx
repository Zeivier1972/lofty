/**
 * The 1200x630 card Facebook, Instagram, WhatsApp and X show when the
 * /primera-casa link is posted or used in an ad.
 */

import { ImageResponse } from "next/og"

export const runtime = "nodejs"
export const alt =
  "Calculadora gratis en español: ¿cuánta casa puedes comprar en Florida? Precio, pago mensual y entrada para compradores de primera vez"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #064E3B 0%, #065F46 55%, #047857 100%)",
          padding: "64px 72px",
          color: "#FFFFFF",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", width: 700 }}>
          <div style={{ display: "flex", fontSize: 22, letterSpacing: 4, color: "#A7F3D0", fontWeight: 600 }}>
            PRIMERA CASA · FLORIDA
          </div>
          <div style={{ display: "flex", marginTop: 22, fontSize: 68, fontWeight: 700, lineHeight: 1.08 }}>
            ¿Cuánta casa puedes comprar?
          </div>
          <div style={{ display: "flex", marginTop: 22, fontSize: 30, color: "rgba(255,255,255,.88)", lineHeight: 1.3 }}>
            Descúbrelo en 2 minutos: precio, pago mensual y cuánto necesitas de entrada.
          </div>
          <div style={{ display: "flex", marginTop: 34, fontSize: 24, color: "#A7F3D0" }}>
            Gratis · En español · Catherine Gomez Realtor
          </div>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            width: 330,
            background: "rgba(255,255,255,.1)",
            borderRadius: 28,
            padding: 34,
            alignSelf: "center",
          }}
        >
          <div style={{ display: "flex", fontSize: 22, color: "#A7F3D0" }}>Tu rango estimado</div>
          <div style={{ display: "flex", marginTop: 10, fontSize: 46, fontWeight: 700 }}>$___,___</div>
          <div style={{ display: "flex", height: 2, background: "rgba(255,255,255,.25)", margin: "22px 0" }} />
          <div style={{ display: "flex", fontSize: 22, color: "#A7F3D0" }}>Pago mensual</div>
          <div style={{ display: "flex", marginTop: 8, fontSize: 34, fontWeight: 700 }}>$_,___ / mes</div>
        </div>
      </div>
    ),
    size,
  )
}
