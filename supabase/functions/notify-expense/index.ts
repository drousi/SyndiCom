// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

console.log('Hello from notify-expense!')

serve(async (req) => {
  try {
    // Le trigger envoie le payload dans le body
    const payload = await req.json()
    console.log('Received payload:', payload)

    const record = payload.record // La nouvelle dépense (ou modifiée)
    
    // On ne notifie pas si la dépense est supprimée
    if (record.deleted) {
      console.log('Expense is deleted, skipping notification.')
      return new Response('Deleted, skipped', { status: 200 })
    }

    // On ne notifie que si le statut est "paid"
    if (record.status !== 'paid') {
      console.log('Expense is not paid, skipping notification.')
      return new Response('Not paid, skipped', { status: 200 })
    }

    // Initialize Supabase Client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const supabase = createClient(supabaseUrl!, supabaseKey!)

    // 1. Récupérer tous les résidents de la résidence concernée
    // Pour notifier les résidents ET les admins
    const { data: users, error: usersError } = await supabase
      .from('user_residences')
      .select('user_id')
      .eq('residence_id', record.residence_id)

    if (usersError || !users) {
      console.error('Error fetching users:', usersError)
      return new Response('Error fetching users', { status: 500 })
    }

    const userIds = users.map(u => u.user_id)
    if (userIds.length === 0) {
      return new Response('No users found in this residence', { status: 200 })
    }

    // 2. Récupérer les Push Tokens valides de ces utilisateurs
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('push_token')
      .in('id', userIds)
      .not('push_token', 'is', null)

    if (profilesError || !profiles) {
      console.error('Error fetching profiles:', profilesError)
      return new Response('Error fetching profiles', { status: 500 })
    }

    const pushTokens = profiles.map(p => p.push_token).filter(t => t && t.startsWith('ExponentPushToken'))
    
    if (pushTokens.length === 0) {
      console.log('No push tokens found for users.')
      return new Response('No push tokens', { status: 200 })
    }

    console.log(`Sending notification to ${pushTokens.length} devices...`)

    // 3. Préparer le message
    const message = {
      to: pushTokens,
      sound: 'notify_1.wav',
      title: 'Nouvelle Dépense Validée 🛠️',
      body: `${record.description || record.type} d'un montant de ${record.amount} a été ajoutée.`,
      data: { expenseId: record.id, residenceId: record.residence_id },
    }

    // 4. Appeler l'API Expo Push
    const expoResponse = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    })

    const expoData = await expoResponse.json()
    console.log('Expo response:', expoData)

    return new Response(JSON.stringify({ success: true, data: expoData }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Unhandled error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
