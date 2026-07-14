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
    const { phone, password } = await req.json();
    if (!phone || !password) {
      return Response.json({ error: 'Phone and password required' }, { status: 400, headers: corsHeaders });
    }

    const adminPhone = Deno.env.get('ADMIN_PHONE') || '';
    const adminPassword = Deno.env.get('ADMIN_PASSWORD') || '';

    if (!adminPhone || !adminPassword) {
      return Response.json({ error: 'Admin not configured' }, { status: 500, headers: corsHeaders });
    }

    if (phone !== adminPhone || password !== adminPassword) {
      return Response.json({ error: 'بيانات الدخول غير صحيحة' }, { status: 401, headers: corsHeaders });
    }

    const sessionId = crypto.randomUUID();
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
    const signature = await sha256Hex(`${sessionId}:${phone}:${expiresAt}:${adminPassword}`);

    return Response.json({
      session_id: sessionId,
      expires_at: expiresAt,
      signature,
      user: { name: 'المدرس', phone }
    }, { headers: corsHeaders });

  } catch (err) {
    return Response.json({ error: err.message }, { status: 400, headers: corsHeaders });
  }
});