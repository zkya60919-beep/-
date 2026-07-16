import cloudinary from 'npm:cloudinary@2.5.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, range',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
};

cloudinary.v2.config({
  cloud_name: Deno.env.get('CLOUDINARY_CLOUD_NAME') || '',
  api_key: Deno.env.get('CLOUDINARY_API_KEY') || '',
  api_secret: Deno.env.get('CLOUDINARY_API_SECRET') || '',
});

function isCloudinaryUrl(url: string): boolean {
  return url.indexOf('res.cloudinary.com') !== -1 || url.indexOf('cloudinary.com') !== -1;
}

function extractCloudinaryInfo(url: string): { publicId: string; resourceType: string; version: string } | null {
  try {
    const u = new URL(url);
    const segs = u.pathname.split('/').filter(Boolean);
    const uploadIdx = segs.indexOf('upload') !== -1 ? segs.indexOf('upload') : segs.indexOf('authenticated');
    if (uploadIdx === -1 || uploadIdx >= segs.length - 1) return null;
    const resourceType = segs[uploadIdx - 1] || 'raw';
    const rest = segs.slice(uploadIdx + 1);
    const first = rest[0] || '';
    const isVersion = /^v\d+$/.test(first);
    const version = isVersion ? first : '';
    const idParts = isVersion ? rest.slice(1) : rest;
    if (idParts.length === 0) return null;
    const full = idParts.join('/');
    const dotIdx = full.lastIndexOf('.');
    const publicId = dotIdx > 0 ? full.substring(0, dotIdx) : full;
    return { publicId, resourceType, version };
  } catch {
    return null;
  }
}

async function trySdkSignedUrl(info: { publicId: string; resourceType: string }): Promise<Response | null> {
  const { publicId, resourceType } = info;
  try {
    const url = cloudinary.v2.url(publicId, {
      resource_type: resourceType as any,
      type: 'upload',
      sign_url: true,
      secure: true,
    });
    const r = await fetch(url);
    if (r.ok || r.status === 206) return r;
  } catch {}
  return null;
}

async function tryPrivateDownload(publicId: string, resourceType: string): Promise<Response | null> {
  try {
    const url = cloudinary.v2.url(publicId, {
      resource_type: resourceType as any,
      type: 'authenticated',
      secure: true,
    });
    const r = await fetch(url);
    if (r.ok || r.status === 206) return r;
  } catch {}
  return null;
}

async function tryAdminResource(info: { publicId: string; resourceType: string }): Promise<Response | null> {
  const { publicId, resourceType } = info;
  try {
    const result = await cloudinary.v2.api.resource(publicId, { resource_type: resourceType, type: 'upload' });
    const downloadUrl = result.secure_url || result.url;
    if (downloadUrl) {
      const r = await fetch(downloadUrl);
      if (r.ok || r.status === 206) return r;
    }
  } catch {}
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
        let dl = await trySdkSignedUrl(info);
        if (!dl) dl = await tryPrivateDownload(info.publicId, info.resourceType);
        if (!dl) dl = await tryAdminResource(info);
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
