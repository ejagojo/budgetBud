import { useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

export function usePinAuth() {
  const [isLoading, setIsLoading] = useState(false) // <--- Variable is setIsLoading
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const signInAnonymously = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const { data, error } = await supabase.auth.signInAnonymously()
      if (error) throw error
      return { success: true, user: data.user }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Anonymous sign-in failed'
      setError(msg)
      return { success: false, error: msg }
    } finally {
      setIsLoading(false)
    }
  }

  const verifyPin = async (pin: string) => {
    setIsLoading(true) // <--- FIXED: Was likely setLoading(true)
    setError(null)

    try {
      // 1. Ensure we have a session (anonymous or otherwise)
      const { data: { session } } = await supabase.auth.getSession()
      
      // If no session, try to sign in anonymously first
      if (!session) {
        const { error: authError } = await supabase.auth.signInAnonymously()
        if (authError) throw authError
      }

      // 2. Call the Edge Function
      const { data, error } = await supabase.functions.invoke('verify-pin', {
        body: { pin } // Sending the 6-digit PIN
      })

      if (error) throw error

      if (data && data.success && data.session) {
        // Set the session for the authenticated user
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token
        })

        if (sessionError) {
          console.error('Session set error:', sessionError)
          throw sessionError
        }

        toast.success('Login successful')
        router.push('/dashboard')
        return { success: true }
      } else {
        const msg = data?.error || 'Invalid PIN'
        setError(msg)
        toast.error(msg)
        return { success: false, error: msg }
      }
    } catch (err) {
      console.error('Verify error:', err)
      const msg = 'Failed to verify PIN. Check your connection.'
      setError(msg)
      toast.error(msg)
      return { success: false, error: msg }
    } finally {
      setIsLoading(false) // <--- FIXED
    }
  }

  const signOut = async () => {
    setIsLoading(true)
    try {
      await supabase.auth.signOut()
      router.push('/login')
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  return {
    signInAnonymously,
    verifyPin,
    signOut,
    isLoading,
    error
  }
}