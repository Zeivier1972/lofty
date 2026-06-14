import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import DashboardShell from "@/components/layout/dashboard-shell"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect("/login")

  return (
    <DashboardShell user={session.user ?? { name: null, email: null, image: null }}>
      {children}
    </DashboardShell>
  )
}
