const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

async function sha1Hex(input) {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-1', bytes);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const cloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME') || '';
    const apiKey = Deno.env.get('CLOUDINARY_API_KEY') || '';
    const apiSecret = Deno.env.get('CLOUDINARY_API_SECRET') || '';

    if (!cloudName || !apiKey || !apiSecret) {
      return Response.json({ error: 'Cloudinary not configured' }, { status: 500, headers: corsHeaders });
    }

    const url = new URL(req.url);
    const folder = url.searchParams.get('folder') || 'uploads';
    const timestamp = Math.floor(Date.now() / 1000);
    const params = { folder, timestamp: String(timestamp) };
    const sortedKeys = Object.keys(params).sort();
    const sigStr = sortedKeys.map(k => `${k}=${params[k]}`).join('&') + apiSecret;
    const signature = await sha1Hex(sigStr);

    return Response.json({
      signature,
      timestamp,
      api_key: apiKey,
      cloud_name: cloudName,
      folder,
    }, { headers: corsHeaders });

  } catch (err) {
    return Response.json({ error: err.message }, { status: 400, headers: corsHeaders });
  }
});