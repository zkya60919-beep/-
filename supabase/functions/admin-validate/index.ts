async function sha256Hex(input) {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });

  try {
    const { session_id, expires_at, signature } = await req.json();
    if (!session_id || !expires_at || !signature) {
      return Response.json({ valid: false }, { status: 401, headers: corsHeaders });
    }

    if (Date.now() > expires_at) {
      return Response.json({ valid: false, error: 'انتهت الجلسة' }, { status: 401, headers: corsHeaders });
    }

    const adminPassword = Deno.env.get('ADMIN_PASSWORD') || '';
    const adminPhone = Deno.env.get('ADMIN_PHONE') || '';
    const expectedSig = await sha256Hex(`${session_id}:${adminPhone}:${expires_at}:${adminPassword}`);

    if (signature !== expectedSig) {
      return Response.json({ valid: false }, { status: 401, headers: corsHeaders });
    }

    return Response.json({ valid: true, user: { phone: adminPhone } }, { headers: corsHeaders });

  } catch (err) {
    return Response.json({ valid: false, error: err.message }, { status: 400, headers: corsHeaders });
  }
});