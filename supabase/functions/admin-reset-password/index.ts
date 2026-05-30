import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Create Supabase client with the Auth context of the user making the request
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: { headers: { Authorization: req.headers.get('Authorization')! } },
      }
    );

    // 2. Get the user making the request
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) throw new Error('Non autorisé.');

    // 3. Verify that the caller is an Admin or Superuser
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('system_role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) throw new Error('Profil introuvable.');

    // Alternatively, verify user_residences if we want to scope it to specific residences
    // But for simplicity, we'll check if they are manager/admin/superuser.
    // For extreme security, we check if they are superuser, or if they have an admin/manager role somewhere.
    let isAuthorized = profile.system_role === 'superuser';
    if (!isAuthorized) {
      const { data: roles } = await supabaseClient
        .from('user_residences')
        .select('role')
        .eq('user_id', user.id)
        .in('role', ['admin', 'manager']);
      
      if (roles && roles.length > 0) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      throw new Error("Vous n'avez pas les droits pour effectuer cette action.");
    }

    // 4. Parse request body
    const { targetUserId, newPassword } = await req.json();

    if (!targetUserId || !newPassword || newPassword.length < 6) {
      throw new Error('Paramètres invalides. Le mot de passe doit faire au moins 6 caractères.');
    }

    // 5. Initialize Supabase Admin client using the SERVICE_ROLE_KEY to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 6. Update user's password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      targetUserId,
      { password: newPassword }
    );

    if (updateError) throw updateError;

    // 7. Force the user to change their password on next login
    const { error: forceChangeError } = await supabaseAdmin
      .from('profiles')
      .update({ force_password_change: true })
      .eq('id', targetUserId);

    if (forceChangeError) throw forceChangeError;

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
