import type { Metadata } from "next"
import PhoneRepairClient from "./client"

export const metadata: Metadata = { title: "Corregir teléfonos de Colombia | CASAi", robots: { index: false } }

export default function PhoneRepairPage() {
  return <PhoneRepairClient />
}
