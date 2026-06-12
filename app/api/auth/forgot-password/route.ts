export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/email"

export async function POST(req: Request) {
  const { email } = await req.json()
  if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 })

  const user = await prisma.user.findUnique({ where: { email } })

  // Always return success to prevent email enumeration
  if (!user) return NextResponse.json({ success: true })

  // Expire any existing tokens for this email
  await prisma.passwordResetToken.updateMany({
    where: { email, usedAt: null },
    data: { usedAt: new Date() },
  })

  const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour
  const record = await prisma.passwordResetToken.create({
    data: { email, expiresAt },
  })

  const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${record.token}`

  await sendEmail({
    to: email,
    subject: "Reset your Lofty CRM password",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto">
        <h2 style="color:#1a3a5c">Password Reset</h2>
        <p>Hi ${user.name},</p>
        <p>Someone requested a password reset for your Lofty CRM account. Click the button below to set a new password:</p>
        <a href="${resetUrl}" style="display:inline-block;margin:16px 0;padding:12px 28px;background:#4f6d8f;color:white;border-radius:8px;text-decoration:none;font-weight:bold">
          Reset Password
        </a>
        <p style="color:#666;font-size:13px">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:20px 0"/>
        <p style="color:#999;font-size:12px">Lofty CRM · Catherine Gomez Realtor</p>
      </div>
    `,
  })

  return NextResponse.json({ success: true })
}
