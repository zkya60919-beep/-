const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

async function hmacSha256(key: CryptoKey, data: string): Promise<ArrayBuffer> {
  return crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
}

async function sha256Hex(data: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function getSigningKey(secret: string, date: string, region: string, service: string): Promise<CryptoKey> {
  const kDate = await hmacSha256(await crypto.subtle.importKey('raw', new TextEncoder().encode('AWS4' + secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']), date);
  const kRegion = await hmacSha256(await crypto.subtle.importKey('raw', kDate, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']), region);
  const kService = await hmacSha256(await crypto.subtle.importKey('raw', kRegion, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']), service);
  return crypto.subtle.importKey('raw', await hmacSha256(await crypto.subtle.importKey('raw', kService, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']), 'aws4_request'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}

function getSignatureKeyHex(secret: string, date: string, region: string, service: string): Promise<string> {
  return getSigningKey(secret, date, region, service).then(k =>
    hmacSha256(k, 'aws4_request').then(buf =>
      Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
    )
  );
}

async function presignPut(
  accessKey: string, secretKey: string, bucket: string, endpoint: string,
  key: string, contentType: string, expiresIn: number
): Promise<string> {
  const region = 'auto';
  const service = 's3';
  const now = new Date();
  const dateStamp = now.toISOString().replace(/[:-]|\.\d{3}/g, '').substring(0, 8);
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '').substring(0, 15) + 'Z';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const payloadHash = 'UNSIGNED-PAYLOAD';

  const host = new URL(endpoint).host;
  const canonicalUri = `/${encodeURIComponent(bucket).replace(/%2F/g, '/')}/${key}`;
  const canonicalQueryString = [
    `X-Amz-Algorithm=AWS4-HMAC-SHA256`,
    `X-Amz-Credential=${encodeURIComponent(accessKey + '/' + credentialScope)}`,
    `X-Amz-Date=${amzDate}`,
    `X-Amz-Expires=${expiresIn}`,
    `X-Amz-SignedHeaders=${encodeURIComponent('content-type;host')}`,
  ].sort().join('&');

  const canonicalHeaders = `content-type:${contentType}\nhost:${host}\n`;
  const signedHeaders = 'content-type;host';
  const canonicalRequest = `PUT\n${canonicalUri}\n${canonicalQueryString}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${await sha256Hex(canonicalRequest)}`;

  const signingKey = await getSigningKey(secretKey, dateStamp, region, service);
  const signatureBytes = await hmacSha256(signingKey, stringToSign);
  const signature = Array.from(new Uint8Array(signatureBytes)).map(b => b.toString(16).padStart(2, '0')).join('');

  return `${endpoint}/${bucket}/${key}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=${encodeURIComponent(accessKey + '/' + credentialScope)}&X-Amz-Date=${amzDate}&X-Amz-Expires=${expiresIn}&X-Amz-SignedHeaders=${encodeURIComponent(signedHeaders)}&X-Amz-Signature=${signature}`;
}

async function presignDelete(
  accessKey: string, secretKey: string, bucket: string, endpoint: string, key: string, expiresIn: number
): Promise<string> {
  const region = 'auto';
  const service = 's3';
  const now = new Date();
  const dateStamp = now.toISOString().replace(/[:-]|\.\d{3}/g, '').substring(0, 8);
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '').substring(0, 15) + 'Z';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const payloadHash = 'UNSIGNED-PAYLOAD';

  const host = new URL(endpoint).host;
  const canonicalUri = `/${encodeURIComponent(bucket).replace(/%2F/g, '/')}/${key}`;
  const canonicalQueryString = [
    `X-Amz-Algorithm=AWS4-HMAC-SHA256`,
    `X-Amz-Credential=${encodeURIComponent(accessKey + '/' + credentialScope)}`,
    `X-Amz-Date=${amzDate}`,
    `X-Amz-Expires=${expiresIn}`,
    `X-Amz-SignedHeaders=${encodeURIComponent('host')}`,
  ].sort().join('&');

  const canonicalHeaders = `host:${host}\n`;
  const signedHeaders = 'host';
  const canonicalRequest = `DELETE\n${canonicalUri}\n${canonicalQueryString}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${await sha256Hex(canonicalRequest)}`;

  const signingKey = await getSigningKey(secretKey, dateStamp, region, service);
  const signatureBytes = await hmacSha256(signingKey, stringToSign);
  const signature = Array.from(new Uint8Array(signatureBytes)).map(b => b.toString(16).padStart(2, '0')).join('');

  return `${endpoint}/${bucket}/${key}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=${encodeURIComponent(accessKey + '/' + credentialScope)}&X-Amz-Date=${amzDate}&X-Amz-Expires=${expiresIn}&X-Amz-SignedHeaders=${encodeURIComponent(signedHeaders)}&X-Amz-Signature=${signature}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const accessKey = Deno.env.get('R2_ACCESS_KEY_ID') || '';
    const secretKey = Deno.env.get('R2_SECRET_ACCESS_KEY') || '';
    const bucket = Deno.env.get('R2_BUCKET') || '';
    const endpoint = Deno.env.get('R2_ENDPOINT') || '';

    if (!accessKey || !secretKey || !bucket || !endpoint) {
      return Response.json({ error: 'R2 not configured' }, { status: 500, headers: corsHeaders });
    }

    const body = await req.json();
    const { key, content_type, action } = body;

    if (!key) {
      return Response.json({ error: 'Missing key' }, { status: 400, headers: corsHeaders });
    }

    const expiresIn = 3600;

    if (action === 'delete') {
      const deleteUrl = await presignDelete(accessKey, secretKey, bucket, endpoint, key, expiresIn);
      return Response.json({ delete_url: deleteUrl }, { headers: corsHeaders });
    }

    if (!content_type) {
      return Response.json({ error: 'Missing content_type' }, { status: 400, headers: corsHeaders });
    }

    const publicUrl = Deno.env.get('R2_PUBLIC_URL') || '';
    const uploadUrl = await presignPut(accessKey, secretKey, bucket, endpoint, key, content_type, expiresIn);
    const fileUrl = publicUrl ? `${publicUrl}/${key}` : '';

    return Response.json({ upload_url: uploadUrl, file_url: fileUrl, key }, { headers: corsHeaders });

  } catch (err) {
    return Response.json({ error: err.message }, { status: 400, headers: corsHeaders });
  }
});
