'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, DollarSign } from 'lucide-react'
import { createPaycheck } from '@/lib/actions/paychecks'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

const paycheckSchema = z.object({
  amount: z.number().min(0.01, 'Amount must be greater than 0').max(100000, 'Amount seems too high'),
  date: z.string().refine((date) => {
    const d = new Date(date)
    return d <= new Date()
  }, 'Date cannot be in the future'),
  frequency: z.enum(['weekly', 'bi-weekly', 'monthly', 'quarterly']),
  description: z.string().max(500, 'Description must be less than 500 characters').optional(),
})

type PaycheckFormData = z.infer<typeof paycheckSchema>

interface PaycheckFormProps {
  onSuccess?: () => void
}

export function PaycheckForm({ onSuccess }: PaycheckFormProps) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const form = useForm<PaycheckFormData>({
    resolver: zodResolver(paycheckSchema),
    defaultValues: {
      amount: 0,
      date: new Date().toISOString().split('T')[0], // Today's date
      frequency: 'bi-weekly',
      description: '',
    },
  })

  const handleSubmit = async (data: PaycheckFormData) => {
    try {
      setLoading(true)
      const result = await createPaycheck(data)

      toast.success('Paycheck created successfully!')
      form.reset()

      if (onSuccess) {
        onSuccess()
      } else {
        router.push('/paychecks')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create paycheck')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="w-5 h-5" />
          Add Paycheck
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        placeholder="0.00"
                        className="pl-10 text-lg"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pay Date</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      {...field}
                      max={new Date().toISOString().split('T')[0]} // Can't be future date
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="frequency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Frequency</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select frequency" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="bi-weekly">Bi-weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="e.g., Regular bi-weekly paycheck"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={loading}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="flex-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Paycheck'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
