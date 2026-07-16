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

    const reqUrl = new URL(req.url);

    // Delivery signature mode: ?public_id=...
    if (reqUrl.searchParams.has('public_id')) {
      const publicId = reqUrl.searchParams.get('public_id') || '';
      const resourceType = reqUrl.searchParams.get('resource_type') || 'raw';
      const type = reqUrl.searchParams.get('type') || 'upload';
      const version = reqUrl.searchParams.get('version') || '';
      const format = reqUrl.searchParams.get('format') || 'pdf';

      const versionPart = version ? `v${version}/` : '';
      const hasExt = /\.\w+$/.test(publicId);
      const baseUrl = hasExt
        ? `https://res.cloudinary.com/${cloudName}/${resourceType}/${type}/${versionPart}${publicId}`
        : `https://res.cloudinary.com/${cloudName}/${resourceType}/${type}/${versionPart}${publicId}.${format}`;

      // Cloudinary delivery signature: SHA-1(public_id + "?" + api_secret)
      const rawId = hasExt ? publicId.replace(/\.[^.]+$/, '') : publicId;
      const deliverySig = await sha1Hex(rawId + '?' + apiSecret);
      const signedUrl = baseUrl + '?sig=' + deliverySig;

      return Response.json({
        signed_url: signedUrl,
        signature: deliverySig,
        public_id: publicId,
        resource_type: resourceType,
        type,
      }, { headers: corsHeaders });
    }

    // Upload signature mode (default)
    const folder = reqUrl.searchParams.get('folder') || 'uploads';
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