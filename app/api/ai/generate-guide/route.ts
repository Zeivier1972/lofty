export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { extractKeyword, generateGuideFromScript } from "@/lib/generate-guide"

export async function POST(req: Request) {
  try {
    const { script } = await req.json()
    if (!script?.trim()) {
      return NextResponse.json({ error: "script is required" }, { status: 400 })
    }

    if (!extractKeyword(script)) {
      return NextResponse.json(
        { error: "No CTA keyword found in script (needs 'Comenta KEYWORD')" },
        { status: 400 }
      )
    }

    const result = await generateGuideFromScript(script)
    if (!result) {
      return NextResponse.json({ error: "Guide generation failed" }, { status: 500 })
    }

    return NextResponse.json(result)
  } catch (e: any) {
    console.error("[generate-guide] Error:", e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
