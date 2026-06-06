export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import fs from "fs"
import path from "path"

const CONFIG_PATH = path.join(process.cwd(), ".integrations-config.json")

function readConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8")) } catch { return {} }
}

export async function GET() {
  return NextResponse.json(readConfig())
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { id, config } = await req.json()
    const existing = readConfig()
    fs.writeFileSync(CONFIG_PATH, JSON.stringify({ ...existing, [id]: config }, null, 2))
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: "Failed to save" }, { status: 500 })
  }
}
