import { PaycheckDetail } from '@/components/paychecks/paycheck-detail'

interface PaycheckDetailPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function PaycheckDetailPage({ params }: PaycheckDetailPageProps) {
  const { id } = await params

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <PaycheckDetail paycheckId={id} />
    </div>
  )
}
