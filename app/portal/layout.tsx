import type { Metadata } from "next"
import { inter as interFont } from "@/app/fonts"
import "../globals.css"

const inter = interFont

export const metadata: Metadata = {
  title: "Client Portal | Casai",
  description: "Your real estate journey, all in one place",
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
      </body>
    </html>
  )
}
