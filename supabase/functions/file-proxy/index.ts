const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, range',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
};

function extractCloudinaryPublicId(url: string): string | null {
  try {
    const u = new URL(url);
    const segs = u.pathname.split('/').filter(Boolean);
    const uploadIdx = segs.indexOf('upload');
    if (uploadIdx === -1 || uploadIdx >= segs.length - 1) return null;
    const rest = segs.slice(uploadIdx + 1);
    const first = rest[0] || '';
    const isVersion = /^v\d+$/.test(first);
    const idParts = isVersion ? rest.slice(1) : rest;
    if (idParts.length === 0) return null;
    const raw = idParts.join('/');
    return raw.replace(/\.[^.]+$/, '');
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'GET' && req.method !== 'HEAD') return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });

  try {
    const reqUrl = new URL(req.url);
    const fileUrl = reqUrl.searchParams.get('url');
    const clientPublicId = reqUrl.searchParams.get('public_id') || '';

    if (!fileUrl) {
      return new Response('Missing url parameter', { status: 400, headers: corsHeaders });
    }

    const publicId = clientPublicId || extractCloudinaryPublicId(fileUrl) || '';

    const rangeHeaders = new Headers();
    const range = req.headers.get('range');
    if (range) rangeHeaders.set('range', range);

    let response = await fetch(fileUrl, { method: req.method, headers: rangeHeaders });

    if (!response.ok && (response.status === 401 || response.status === 403) && publicId) {
      const apiKey = Deno.env.get('CLOUDINARY_API_KEY') || '';
      const apiSecret = Deno.env.get('CLOUDINARY_API_SECRET') || '';
      const cloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME') || '';

      if (apiKey && apiSecret && cloudName) {
        const timestamp = Math.floor(Date.now() / 1000);
        const auth = btoa(`${apiKey}:${apiSecret}`);
        const dlHeaders = new Headers({ 'Authorization': `Basic ${auth}` });
        if (range) dlHeaders.set('range', range);

        const dlUrl = `https://api.cloudinary.com/v1_1/${cloudName}/raw/download?public_id=${encodeURIComponent(publicId)}&type=upload&ts=${timestamp}`;
        const rDl = await fetch(dlUrl, { method: req.method, headers: dlHeaders });
        if (rDl.ok || rDl.status === 206) response = rDl;
      }
    }

    if (!response.ok && response.status !== 206) {
      return new Response('Failed to fetch file: ' + response.status, { status: response.status, headers: corsHeaders });
    }

    const responseHeaders = new Headers(corsHeaders);
    const headersToCopy = [
      'content-type', 'content-length', 'content-range',
      'accept-ranges', 'cache-control', 'etag', 'last-modified',
      'content-disposition',
    ];
    for (const h of headersToCopy) {
      if (response.headers.has(h)) responseHeaders.set(h, response.headers.get(h));
    }

    if (!responseHeaders.has('content-type')) {
      const ext = (publicId || fileUrl).split('.').pop()?.toLowerCase() || '';
      const mime: Record<string, string> = { pdf: 'application/pdf', mp3: 'audio/mpeg', mp4: 'video/mp4', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', zip: 'application/zip' };
      responseHeaders.set('content-type', mime[ext] || 'application/octet-stream');
    }

    return new Response(response.body, { status: response.status, headers: responseHeaders });
  } catch (error) {
    return new Response('Proxy error: ' + (error.message || error), { status: 500, headers: corsHeaders });
  }
});
