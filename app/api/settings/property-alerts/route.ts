export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import fs from "fs"
import path from "path"

const CONFIG_FILE = path.join(process.cwd(), ".property-alerts-config.json")

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"))
  } catch {
    return null
  }
}

export async function GET() {
  return NextResponse.json(readConfig() || {})
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const config = await req.json()
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2))
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Failed to save config" }, { status: 500 })
  }
}
