/**
 * The 1200x630 card Facebook, Instagram, WhatsApp and X show when this page's
 * link is posted — which is how most people will first see the Meta ad.
 *
 * The sunset exterior is 2000x1125 (1.78), close enough to the card's 1.91
 * that a full-bleed cover loses only a sliver top and bottom. The text sits on
 * a left-hand green fade so the building on the right stays clean.
 */

import { ImageResponse } from "next/og"
import { readFileSync } from "fs"
import { join } from "path"

export const runtime = "nodejs"
export const alt =
  "Parkside Residences at Brickell, Miami — estudios desde $490,000 USD, 187 residencias amuebladas frente a Simpson Park"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

// Read once per server process, not per request.
let heroDataUri: string | null | undefined

function hero(): string | null {
  if (heroDataUri !== undefined) return heroDataUri
  try {
    const buf = readFileSync(join(process.cwd(), "public", "parkside", "fachada-atardecer.jpg"))
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
      <div style={{ display: "flex", position: "relative", width: "100%", height: "100%", background: "#1E2B23" }}>
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
            background: "linear-gradient(to right, rgba(30,43,35,.96) 0%, rgba(30,43,35,.82) 38%, rgba(30,43,35,0) 66%)",
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
          <div style={{ display: "flex", fontSize: 21, letterSpacing: 5, color: "#D9C7A0", fontWeight: 600 }}>
            BRICKELL · MIAMI
          </div>
          <div style={{ display: "flex", marginTop: 24, fontSize: 84, color: "#FFFFFF", letterSpacing: 4, lineHeight: 1 }}>
            PARKSIDE
          </div>
          <div style={{ display: "flex", marginTop: 12, fontSize: 24, letterSpacing: 6, color: "rgba(255,255,255,.8)" }}>
            RESIDENCES AT BRICKELL
          </div>
          <div style={{ display: "flex", width: 92, height: 4, background: "#B59A6A", margin: "30px 0" }} />
          <div style={{ display: "flex", fontSize: 28, color: "rgba(255,255,255,.85)", lineHeight: 1.35 }}>
            187 residencias amuebladas frente a Simpson Park
          </div>
          <div style={{ display: "flex", marginTop: 18, fontSize: 22, color: "#D9C7A0" }}>
            Estudios desde $490,000 USD · 20% al contrato
          </div>
        </div>
      </div>
    ),
    size,
  )
}
