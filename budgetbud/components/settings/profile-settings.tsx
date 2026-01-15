'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

const profileSchema = z.object({
  displayName: z.string().max(50, 'Display name must be less than 50 characters').optional(),
})

type ProfileFormData = z.infer<typeof profileSchema>

export function ProfileSettings() {
  const [loading, setLoading] = useState(false)
  const [initialData, setInitialData] = useState<{ displayName?: string }>({})
  const supabase = createClient()

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      displayName: '',
    },
  })

  // Load current profile data
  useEffect(() => {
    const loadProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', user.id)
        .single()

      if (!error && data) {
        // Type assertion for the query result
        const displayName = (data as any).display_name || ''
        setInitialData({ displayName })
        form.reset({ displayName })
      }
    }

    loadProfile()
  }, [supabase, form])

  const handleSubmit = async (data: ProfileFormData) => {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { error } = await (supabase as any)
        .from('profiles')
        .update({
          display_name: data.displayName || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)

      if (error) throw error

      toast.success('Profile updated successfully')
      setInitialData(data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update profile')
    } finally {
      setLoading(false)
    }
  }

  const hasChanges = JSON.stringify(form.getValues()) !== JSON.stringify(initialData)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>
          Update your personal information and display preferences.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="displayName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Display Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter your display name"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={loading || !hasChanges}
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
