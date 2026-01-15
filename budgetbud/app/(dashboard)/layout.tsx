import { Navigation } from '@/components/layout/navigation'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="pb-16 md:pb-0 md:pl-64">
        {children}
      </main>
    </div>
  )
}

