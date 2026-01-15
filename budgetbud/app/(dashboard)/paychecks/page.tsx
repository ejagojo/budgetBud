import { PaycheckList } from '@/components/paychecks/paycheck-list'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import Link from 'next/link'

export default function PaychecksPage() {
  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-2">Paychecks</h1>
          <p className="text-muted-foreground">
            Track your income and see how it's allocated across categories.
          </p>
        </div>
        <Link href="/paychecks/create">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Add Paycheck
          </Button>
        </Link>
      </div>

      <PaycheckList />
    </div>
  )
}
