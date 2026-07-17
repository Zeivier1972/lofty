export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { extractKeyword, generateGuideFromScript } from "@/lib/generate-guide"

export async function POST(req: Request) {
  try {
    const { script, keyword, overwrite } = await req.json()
    if (!script?.trim()) {
      return NextResponse.json({ error: "script is required" }, { status: 400 })
    }

    // Accept an explicit keyword (external-content flow) OR pull one from the
    // script's "Comenta KEYWORD" CTA.
    const kw = (typeof keyword === "string" && keyword.trim()) ? keyword : extractKeyword(script)
    if (!kw) {
      return NextResponse.json(
        { error: "Falta la palabra clave. Escríbela en el campo, o incluye 'Comenta PALABRA' en el texto." },
        { status: 400 }
      )
    }

    const result = await generateGuideFromScript(script, { keyword: kw, overwrite: overwrite === true })
    if (!result) {
      return NextResponse.json({ error: "Guide generation failed" }, { status: 500 })
    }

    return NextResponse.json(result)
  } catch (e: any) {
    console.error("[generate-guide] Error:", e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
