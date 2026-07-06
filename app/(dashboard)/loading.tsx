// Instant skeleton shown while dashboard pages fetch data — makes navigation
// feel responsive instead of hanging on the previous page.
export default function DashboardLoading() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-48 bg-gray-200 rounded-lg" />
          <div className="h-4 w-64 bg-gray-100 rounded" />
        </div>
        <div className="h-9 w-28 bg-gray-200 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 bg-white border border-gray-100 rounded-2xl p-5 space-y-3">
            <div className="h-4 w-24 bg-gray-100 rounded" />
            <div className="h-7 w-16 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-72 bg-white border border-gray-100 rounded-2xl" />
        <div className="h-72 bg-white border border-gray-100 rounded-2xl" />
      </div>
    </div>
  )
}
