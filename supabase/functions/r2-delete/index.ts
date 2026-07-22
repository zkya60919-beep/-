const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });

  try {
    const accessKey = Deno.env.get('R2_ACCESS_KEY_ID') || '';
    const secretKey = Deno.env.get('R2_SECRET_ACCESS_KEY') || '';
    const bucket = Deno.env.get('R2_BUCKET') || '';
    const endpoint = Deno.env.get('R2_ENDPOINT') || '';

    if (!accessKey || !secretKey || !bucket || !endpoint) {
      return Response.json({ error: 'R2 not configured' }, { status: 500, headers: corsHeaders });
    }

    const { url } = await req.json();
    if (!url) {
      return Response.json({ error: 'Missing url' }, { status: 400, headers: corsHeaders });
    }

    const publicUrl = Deno.env.get('R2_PUBLIC_URL') || '';
    let key = '';
    if (publicUrl && url.startsWith(publicUrl)) {
      key = url.substring(publicUrl.length + 1);
    } else {
      try {
        const u = new URL(url);
        const idx = u.pathname.indexOf(`/${bucket}/`);
        key = idx !== -1 ? u.pathname.substring(idx + bucket.length + 2) : u.pathname.substring(1);
      } catch {
        key = url;
      }
    }

    if (!key) {
      return Response.json({ error: 'Could not extract key from url' }, { status: 400, headers: corsHeaders });
    }

    const region = 'auto';
    const service = 's3';
    const now = new Date();
    const dateStamp = now.toISOString().replace(/[:-]|\.\d{3}/g, '').substring(0, 8);
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '').substring(0, 15) + 'Z';
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;

    const host = new URL(endpoint).host;
    const canonicalUri = `/${encodeURIComponent(bucket).replace(/%2F/g, '/')}/${encodeURI(key).replace(/%20/g, '+')}`;
    const canonicalQueryString = '';
    const canonicalHeaders = `host:${host}\n`;
    const signedHeaders = 'host';
    const payloadHash = 'UNSIGNED-PAYLOAD';
    const canonicalRequest = `DELETE\n${canonicalUri}\n${canonicalQueryString}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

    const sha256Hex = async (d: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(d)))).map(b => b.toString(16).padStart(2, '0')).join('');
    const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${await sha256Hex(canonicalRequest)}`;

    const importKey = (k: string | ArrayBuffer) => crypto.subtle.importKey('raw', typeof k === 'string' ? new TextEncoder().encode(k) : k, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const hmac = async (key: CryptoKey, d: string) => crypto.subtle.sign('HMAC', key, new TextEncoder().encode(d));
    const kDate = await importKey('AWS4' + secretKey);
    const kRegion = await importKey(await hmac(kDate, dateStamp) as ArrayBuffer);
    const kService = await importKey(await hmac(kRegion, region) as ArrayBuffer);
    const kSigning = await importKey(await hmac(kService, service) as ArrayBuffer);
    const signature = Array.from(new Uint8Array(await hmac(kSigning, stringToSign))).map(b => b.toString(16).padStart(2, '0')).join('');

    const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
    const deleteUrl = `${endpoint}/${bucket}/${key}`;

    const res = await fetch(deleteUrl, {
      method: 'DELETE',
      headers: {
        'Host': host,
        'x-amz-date': amzDate,
        'x-amz-content-sha256': payloadHash,
        'Authorization': authorization,
      },
    });

    if (!res.ok && res.status !== 204) {
      const errText = await res.text();
      return Response.json({ error: `Delete failed: ${res.status} ${errText}` }, { status: res.status, headers: corsHeaders });
    }

    return Response.json({ success: true, key }, { headers: corsHeaders });

  } catch (err) {
    return Response.json({ error: err.message || 'Delete failed' }, { status: 400, headers: corsHeaders });
  }
});
