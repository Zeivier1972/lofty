export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import fs from "fs"
import path from "path"

const CONFIG_PATH = path.join(process.cwd(), ".idx-config.json")

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"))
  } catch {
    return null
  }
}

export async function GET() {
  return NextResponse.json(readConfig())
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const idxConfig = await req.json()
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(idxConfig, null, 2))
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error("IDX settings error:", e)
    return NextResponse.json({ error: "Failed to save IDX settings" }, { status: 500 })
  }
}
