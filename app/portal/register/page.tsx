import type { Metadata } from "next"
import RegisterClient from "./register-client"

export const metadata: Metadata = {
  title: "Create Account | Client Portal — Catherine Gomez Realtor",
  description: "Register for your free client portal to save properties, receive new-listing alerts, and track your home search.",
}

export default function RegisterPage() {
  return <RegisterClient />
}
