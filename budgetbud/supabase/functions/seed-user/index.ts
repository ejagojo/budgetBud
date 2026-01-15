import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const email = 'user_070802@budgetbud.local'
    const password = 'temp_password_123'
    const pin = '070802'
    const name = 'Raizel'

    // --- REMOVED THE DELETE LOGIC THAT WAS CRASHING ---

    // 1. CREATE USER VIA ADMIN API (Guarantees Password Works)
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: name }
    })

    if (createError) throw createError

    // 2. CREATE PROFILE WITH PIN MANUALLY
    const encoder = new TextEncoder()
    const data = encoder.encode(pin)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const pinHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: newUser.user.id,
        pin_hash: pinHash,
        display_name: name,
        theme: 'auto'
      })

    if (profileError) throw profileError

    return new Response(JSON.stringify({ success: true, userId: newUser.user.id, message: "User created successfully" }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})