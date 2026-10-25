import type { Metadata } from "next"
import RegisterClient from "./register-client"
import { issueFormToken, PORTAL_FORM_SCOPE } from "@/lib/spam-guard"

export const metadata: Metadata = {
  title: "Create Account | Client Portal — Catherine Gomez Realtor",
  description: "Register for your free client portal to save properties, receive new-listing alerts, and track your home search.",
}

// Dinámica para que el token se emita fresco en cada carga y no quede
// congelado en una página estática.
export const dynamic = "force-dynamic"

export default function RegisterPage() {
  return <RegisterClient formToken={issueFormToken(PORTAL_FORM_SCOPE)} />
}
