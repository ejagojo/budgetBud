'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Shield, Lock } from 'lucide-react'

const changePinSchema = z.object({
  currentPin: z.string().min(6, 'PIN must be 6 digits').max(6, 'PIN must be 6 digits'),
  newPin: z.string().min(6, 'PIN must be 6 digits').max(6, 'PIN must be 6 digits'),
  confirmPin: z.string().min(6, 'PIN must be 6 digits').max(6, 'PIN must be 6 digits'),
}).refine((data) => data.newPin === data.confirmPin, {
  message: "New PINs don't match",
  path: ["confirmPin"],
}).refine((data) => data.currentPin !== data.newPin, {
  message: "New PIN must be different from current PIN",
  path: ["newPin"],
})

type ChangePinFormData = z.infer<typeof changePinSchema>

export function SecuritySettings() {
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const form = useForm<ChangePinFormData>({
    resolver: zodResolver(changePinSchema),
    defaultValues: {
      currentPin: '',
      newPin: '',
      confirmPin: '',
    },
  })

  const handleSubmit = async (data: ChangePinFormData) => {
    try {
      setLoading(true)

      // Get current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !session) {
        throw new Error('Not authenticated')
      }

      // Call the change-pin edge function
      const { data: result, error } = await supabase.functions.invoke('change-pin', {
        body: {
          oldPin: data.currentPin,
          newPin: data.newPin
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      })

      if (error) throw error

      if (result.success) {
        toast.success('PIN changed successfully')
        form.reset()
      } else {
        toast.error(result.error || 'Failed to change PIN')
      }
    } catch (err) {
      console.error('PIN change error:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to change PIN')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Security
        </CardTitle>
        <CardDescription>
          Manage your account security and authentication settings.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Lock className="w-4 h-4" />
              Change PIN
            </h3>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="currentPin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current PIN</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          inputMode="numeric"
                          maxLength={6}
                          placeholder="Enter current PIN"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="newPin"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>New PIN</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            inputMode="numeric"
                            maxLength={6}
                            placeholder="New PIN"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="confirmPin"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm New PIN</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            inputMode="numeric"
                            maxLength={6}
                            placeholder="Confirm PIN"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end">
                  <Button
                    type="submit"
                    disabled={loading}
                  >
                    {loading ? 'Changing...' : 'Change PIN'}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
