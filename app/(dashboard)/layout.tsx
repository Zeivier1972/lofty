import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import Sidebar from "@/components/layout/sidebar"
import Header from "@/components/layout/header"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect("/login")

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header user={session.user ?? { name: null, email: null, image: null }} />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
