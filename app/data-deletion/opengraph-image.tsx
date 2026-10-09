/**
 * The 1200x630 card shown when this link is posted or when Meta's reviewer
 * previews it. Text only on purpose — there is no photo that belongs on a
 * privacy-rights page, and pointing at a stock image would misrepresent it.
 */

import { ImageResponse } from "next/og"

export const runtime = "nodejs"
export const alt =
  "Catherine Gomez Realtor — solicita la eliminación de tus datos personales"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          backgroundColor: "#0C0B0A",
          padding: "0 90px",
          fontFamily: "Georgia, serif",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 20,
            letterSpacing: 7,
            textTransform: "uppercase",
            color: "#C5A572",
          }}
        >
          Catherine Gomez Realtor
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 30,
            fontSize: 76,
            lineHeight: 1.1,
            color: "#FAF8F4",
          }}
        >
          Eliminación de datos
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 12,
            fontSize: 44,
            lineHeight: 1.1,
            color: "#8A857C",
          }}
        >
          Data Deletion Request
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 40,
            width: 120,
            height: 3,
            backgroundColor: "#C5A572",
          }}
        />
        <div
          style={{
            display: "flex",
            marginTop: 36,
            fontSize: 27,
            lineHeight: 1.45,
            color: "#CFCAC1",
          }}
        >
          Pide que eliminemos tus datos personales y tu historial de Messenger e Instagram.
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 14,
            fontSize: 23,
            color: "#8A857C",
          }}
        >
          Procesamos toda solicitud en 30 días · Miami, Florida
        </div>
      </div>
    ),
    size,
  )
}
