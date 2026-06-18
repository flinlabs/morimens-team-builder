export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Simple dev-only guard
  if (process.env.NODE_ENV === 'production') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-500">Admin not available in production.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <nav className="border-b border-gray-800 px-6 py-3 flex items-center gap-6">
        <span className="font-bold text-amber-400">Morimens Admin</span>
        <a href="/admin" className="text-sm text-gray-400 hover:text-white">
          Dashboard
        </a>
        <a href="/admin/annotations" className="text-sm text-gray-400 hover:text-white">
          Annotations
        </a>
        <a href="/admin/sync" className="text-sm text-gray-400 hover:text-white">
          Sync Report
        </a>
      </nav>
      <main className="p-6">{children}</main>
    </div>
  )
}