import { PaycheckDetail } from '@/components/paychecks/paycheck-detail'

interface PaycheckDetailPageProps {
  params: {
    id: string
  }
}

export default function PaycheckDetailPage({ params }: PaycheckDetailPageProps) {
  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <PaycheckDetail paycheckId={params.id} />
    </div>
  )
}
