/**
 * The 1200x630 card Facebook, Instagram, WhatsApp and X show when this page's
 * link is posted — which is how most people will first see the Meta ad.
 *
 * The aerial with the "domus" crown is 2000x1125 (1.78), close to the card's
 * 1.91. The text sits on a left-hand charcoal fade; the crown sits right of centre.
 */

import { ImageResponse } from "next/og"
import { readFileSync } from "fs"
import { join } from "path"

export const runtime = "nodejs"
export const alt =
  "Domus Brickell Center, Miami — FLATS amueblados desde $532,900 USD, torre de 35 pisos con servicio de hotel en Brickell"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

// Read once per server process, not per request.
let heroDataUri: string | null | undefined

function hero(): string | null {
  if (heroDataUri !== undefined) return heroDataUri
  try {
    const buf = readFileSync(join(process.cwd(), "public", "domus", "aerea-bahia.jpg"))
    heroDataUri = `data:image/jpeg;base64,${buf.toString("base64")}`
  } catch {
    heroDataUri = null
  }
  return heroDataUri
}

export default async function Image() {
  const photo = hero()

  return new ImageResponse(
    (
      <div style={{ display: "flex", position: "relative", width: "100%", height: "100%", background: "#17191C" }}>
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt=""
            width={1200}
            height={630}
            style={{ position: "absolute", top: 0, left: 0, width: 1200, height: 630, objectFit: "cover" }}
          />
        )}
        <div
          style={{
            display: "flex",
            position: "absolute",
            top: 0,
            left: 0,
            width: 1200,
            height: 630,
            background: "linear-gradient(to right, rgba(23,25,28,.96) 0%, rgba(23,25,28,.82) 38%, rgba(23,25,28,0) 66%)",
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            position: "relative",
            width: 640,
            height: "100%",
            padding: "0 64px",
          }}
        >
          <div style={{ display: "flex", fontSize: 21, letterSpacing: 5, color: "#E2CB9C", fontWeight: 600 }}>
            BRICKELL · MIAMI
          </div>
          <div style={{ display: "flex", marginTop: 24, fontSize: 84, color: "#FFFFFF", letterSpacing: 4, lineHeight: 1 }}>
            domus
          </div>
          <div style={{ display: "flex", marginTop: 12, fontSize: 24, letterSpacing: 6, color: "rgba(255,255,255,.8)" }}>
            BRICKELL CENTER
          </div>
          <div style={{ display: "flex", width: 92, height: 4, background: "#A9844C", margin: "30px 0" }} />
          <div style={{ display: "flex", fontSize: 28, color: "rgba(255,255,255,.85)", lineHeight: 1.35 }}>
            579 FLATS amueblados con servicio de hotel en Brickell
          </div>
          <div style={{ display: "flex", marginTop: 18, fontSize: 22, color: "#E2CB9C" }}>
            Estudios desde $532,900 USD · 10% al contrato
          </div>
        </div>
      </div>
    ),
    size,
  )
}
