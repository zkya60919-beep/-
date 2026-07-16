const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, range',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
};

function extractCloudinaryInfo(url: string): { publicId: string; resourceType: string; version: string; pathAfterUpload: string; extension: string } | null {
  try {
    const u = new URL(url);
    const segs = u.pathname.split('/').filter(Boolean);
    const uploadIdx = segs.indexOf('upload');
    if (uploadIdx === -1 || uploadIdx >= segs.length - 1) return null;
    const resourceType = segs[uploadIdx - 1] || 'raw';
    const rest = segs.slice(uploadIdx + 1);
    const pathAfterUpload = rest.join('/');
    const first = rest[0] || '';
    const isVersion = /^v\d+$/.test(first);
    const version = isVersion ? first : '';
    const idParts = isVersion ? rest.slice(1) : rest;
    if (idParts.length === 0) return null;
    const full = idParts.join('/');
    const dotIdx = full.lastIndexOf('.');
    const extension = dotIdx > 0 ? full.substring(dotIdx + 1) : 'pdf';
    const publicId = dotIdx > 0 ? full.substring(0, dotIdx) : full;
    return { publicId, resourceType, version, pathAfterUpload, extension };
  } catch {
    return null;
  }
}

function isCloudinaryUrl(url: string): boolean {
  return url.indexOf('res.cloudinary.com') !== -1 || url.indexOf('cloudinary.com') !== -1;
}

async function sha1Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-1', bytes);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function getCreds() {
  return {
    cloudName: Deno.env.get('CLOUDINARY_CLOUD_NAME') || '',
    apiKey: Deno.env.get('CLOUDINARY_API_KEY') || '',
    apiSecret: Deno.env.get('CLOUDINARY_API_SECRET') || '',
  };
}

function toUrlSafeBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '').substring(0, 8);
}

async function trySignedDelivery(info: { publicId: string; resourceType: string; version: string; extension: string }): Promise<Response | null> {
  const { cloudName, apiSecret } = getCreds();
  if (!cloudName || !apiSecret) return null;

  const { publicId, resourceType, version, extension } = info;
  const versionStr = version ? `?version=${version}` : '';

  // Approach 1: s-- prefix signed URL (Cloudinary standard format)
  const signStr1 = publicId + apiSecret;
  const digest1 = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(signStr1));
  const sig1 = toUrlSafeBase64(new Uint8Array(digest1));
  const url1 = `https://res.cloudinary.com/${cloudName}/${resourceType}/upload/s--${sig1}--/${version ? version + '/' : ''}${publicId}.${extension}`;
  const r1 = await fetch(url1, { method: 'GET' });
  if (r1.ok || r1.status === 206) return r1;

  // Approach 2: s-- prefix with version
  const signStr2 = publicId + versionStr + apiSecret;
  const digest2 = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(signStr2));
  const sig2 = toUrlSafeBase64(new Uint8Array(digest2));
  const url2 = `https://res.cloudinary.com/${cloudName}/${resourceType}/upload/s--${sig2}--/${version ? version + '/' : ''}${publicId}.${extension}`;
  const r2 = await fetch(url2, { method: 'GET' });
  if (r2.ok || r2.status === 206) return r2;

  // Approach 3: Query param signature without version
  const sig3 = await sha1Hex(publicId + apiSecret);
  const url3 = `https://res.cloudinary.com/${cloudName}/${resourceType}/upload/${version ? version + '/' : ''}${publicId}.${extension}?sig=${sig3}`;
  const r3 = await fetch(url3, { method: 'GET' });
  if (r3.ok || r3.status === 206) return r3;

  // Approach 4: Query param signature with version
  const sig4 = await sha1Hex(publicId + versionStr + apiSecret);
  const url4 = `https://res.cloudinary.com/${cloudName}/${resourceType}/upload/${version ? version + '/' : ''}${publicId}.${extension}?sig=${sig4}`;
  const r4 = await fetch(url4, { method: 'GET' });
  if (r4.ok || r4.status === 206) return r4;

  return null;
}

async function tryUploadApiDownload(publicId: string, resourceType: string): Promise<Response | null> {
  const { cloudName, apiKey, apiSecret } = getCreds();
  if (!cloudName || !apiKey || !apiSecret) return null;

  const timestamp = Math.floor(Date.now() / 1000);
  const sigStr = `public_id=${publicId}&timestamp=${timestamp}` + apiSecret;
  const signature = await sha1Hex(sigStr);

  const body = new URLSearchParams();
  body.set('public_id', publicId);
  body.set('timestamp', String(timestamp));
  body.set('api_key', apiKey);
  body.set('signature', signature);

  const r = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/download`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (r.ok) {
    const data = await r.json();
    if (data.url) {
      const fileR = await fetch(data.url);
      if (fileR.ok) return fileR;
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'GET' && req.method !== 'HEAD') return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });

  try {
    const reqUrl = new URL(req.url);
    const fileUrl = reqUrl.searchParams.get('url');
    if (!fileUrl) {
      return new Response('Missing url parameter', { status: 400, headers: corsHeaders });
    }

    let response = await fetch(fileUrl, { method: req.method });

    if (!response.ok && (response.status === 401 || response.status === 403) && isCloudinaryUrl(fileUrl)) {
      const info = extractCloudinaryInfo(fileUrl);
      if (info) {
        let dl = await trySignedDelivery(info);
        if (!dl) {
          dl = await tryUploadApiDownload(info.publicId, info.resourceType);
        }
        if (dl) response = dl;
      }
    }

    if (!response.ok && response.status !== 206) {
      return new Response('Failed: ' + response.status, { status: response.status, headers: corsHeaders });
    }

    const responseHeaders = new Headers(corsHeaders);
    for (const h of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'cache-control', 'etag', 'last-modified', 'content-disposition']) {
      if (response.headers.has(h)) responseHeaders.set(h, response.headers.get(h));
    }

    if (!responseHeaders.has('content-type')) {
      const ext = (fileUrl.split('.').pop() || '').toLowerCase();
      const mime: Record<string, string> = { pdf: 'application/pdf', mp3: 'audio/mpeg', mp4: 'video/mp4', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif' };
      responseHeaders.set('content-type', mime[ext] || 'application/octet-stream');
    }

    return new Response(response.body, { status: response.status, headers: responseHeaders });
  } catch (error) {
    return new Response('Proxy error: ' + (error.message || error), { status: 500, headers: corsHeaders });
  }
});
