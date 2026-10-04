/**
 * The 1200x630 card Facebook, Instagram, WhatsApp and X show when this page's
 * link is posted — which is how most people will first see the ad.
 *
 * Composed here rather than pointing at one of the renderings because every
 * rendering is either portrait or 1.5:1, and a social card is 1.91:1 — any of
 * them would be cropped badly, and none of them carry the price. The split
 * layout also lets the photo keep its own proportions: hero-brickell.jpg is
 * 1692x1920 (0.88) and the photo panel is 540x630 (0.86), so it fills its half
 * with almost nothing lost.
 */

import { ImageResponse } from "next/og"
import { readFileSync } from "fs"
import { join } from "path"

export const runtime = "nodejs"
export const alt =
  "House of Wellness Brickell, Miami — estudios desde $419,900 USD, con spa, gimnasio, yoga y piscina en la azotea"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

// Read once per server process, not per request.
let heroDataUri: string | null | undefined

function hero(): string | null {
  if (heroDataUri !== undefined) return heroDataUri
  try {
    const buf = readFileSync(join(process.cwd(), "public", "house-of-wellness", "hero-brickell.jpg"))
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
      <div style={{ display: "flex", width: "100%", height: "100%", background: "#0C0B0A" }}>
        {/* Text panel */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            width: 660,
            height: "100%",
            padding: "0 56px",
          }}
        >
          <div style={{ display: "flex", fontSize: 21, letterSpacing: 5, color: "#C5A572", fontWeight: 600 }}>
            BRICKELL · MIAMI
          </div>

          <div style={{ display: "flex", marginTop: 22, fontSize: 68, color: "#FFFFFF", lineHeight: 1.05 }}>
            House of
          </div>
          <div style={{ display: "flex", fontSize: 68, color: "#FFFFFF", fontWeight: 700, lineHeight: 1.05 }}>
            Wellness
          </div>

          <div style={{ display: "flex", width: 92, height: 4, background: "#C5A572", margin: "26px 0" }} />

          <div style={{ display: "flex", fontSize: 25, color: "rgba(255,255,255,.72)", lineHeight: 1.4 }}>
            Spa · Gimnasio · Yoga · Piscina en la azotea
          </div>

          <div style={{ display: "flex", flexDirection: "column", marginTop: 32 }}>
            <div style={{ display: "flex", fontSize: 22, color: "#C5A572" }}>Estudios desde</div>
            <div style={{ display: "flex", alignItems: "baseline", marginTop: 4 }}>
              <div style={{ display: "flex", fontSize: 52, color: "#FFFFFF", fontWeight: 700 }}>$419,900</div>
              <div style={{ display: "flex", fontSize: 22, color: "#C5A572", marginLeft: 10 }}>USD</div>
            </div>
          </div>

          <div style={{ display: "flex", marginTop: 10, fontSize: 21, color: "#C5A572" }}>
            10% al contrato — desde $41,990 USD
          </div>
        </div>

        {/* Photo panel — a clean split, no overlay: a partial fade just muddies
            the left of the photo and still leaves a seam where it ends. */}
        <div style={{ display: "flex", width: 540, height: "100%" }}>
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" width={540} height={630} style={{ objectFit: "cover" }} />
          ) : (
            <div style={{ display: "flex", width: "100%", height: "100%", background: "#17150F" }} />
          )}
        </div>
      </div>
    ),
    size,
  )
}
