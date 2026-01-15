import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0'
import { corsHeaders } from '../_shared/cors.ts'

interface VerifyPinRequest {
  pin: string
  userId?: string
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. GET INPUT (First 'userId' declaration)
    const { pin, userId }: VerifyPinRequest = await req.json()

    // Validate 6-digit PIN
    if (!pin || typeof pin !== 'string' || pin.length !== 6 || !/^\d{6}$/.test(pin)) {
      return new Response(
        JSON.stringify({ error: 'Invalid PIN format. Must be 6 digits.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Hash the PIN
    const pinHash = await hashPin(pin)

    // Query Profile
    let query = supabaseAdmin
      .from('profiles')
      .select('id, pin_hash')
      .eq('pin_hash', pinHash)

    if (userId) query = query.eq('id', userId)

    const { data: profiles, error: profileError } = await query

    if (profileError) throw profileError

    if (!profiles || profiles.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid PIN' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. GET FOUND USER ID (Renamed to avoid conflict!)
    const foundUserId = profiles[0].id

    // 3. GET EMAIL for this user
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(foundUserId)
    
    if (userError || !userData.user) {
       return new Response(
        JSON.stringify({ error: 'User account not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userEmail = userData.user.email

    // 4. SIGN IN to get a real session
    const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      email: userEmail,
      password: 'temp_password_123'
    })

    if (signInError) {
       console.error('Sign in error:', signInError)
       return new Response(
        JSON.stringify({ error: 'Login failed internally' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 5. RETURN SUCCESS WITH SESSION
    return new Response(
      JSON.stringify({
        success: true,
        userId: foundUserId,
        session: signInData.session,
        message: 'PIN verified successfully'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(pin)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}