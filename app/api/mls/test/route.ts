export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { testRETSConnection } from "@/lib/rets"
import fs from "fs"
import path from "path"

const CONFIG_PATH = path.join(process.cwd(), ".idx-config.json")

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await req.json()
    const config = body || JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"))

    if (!config?.loginUrl || !config?.username || !config?.password) {
      return NextResponse.json({ success: false, message: "Login URL, username and password are required" })
    }

    const result = await testRETSConnection(config)
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e.message || "Test failed" })
  }
}
