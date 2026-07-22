const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, range',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'GET' && req.method !== 'HEAD') return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });

  try {
    const reqUrl = new URL(req.url);
    const fileUrl = reqUrl.searchParams.get('url');
    if (!fileUrl) {
      return new Response('Missing url parameter', { status: 400, headers: corsHeaders });
    }

    const response = await fetch(fileUrl, { method: req.method });

    if (!response.ok && response.status !== 206) {
      return new Response('Failed: ' + response.status, { status: response.status, headers: corsHeaders });
    }

    const responseHeaders = new Headers(corsHeaders);
    for (const h of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'cache-control', 'etag', 'last-modified', 'content-disposition']) {
      if (response.headers.has(h)) responseHeaders.set(h, response.headers.get(h)!);
    }

    if (!responseHeaders.has('content-type')) {
      const ext = (fileUrl.split('.').pop() || '').toLowerCase();
      const mime: Record<string, string> = { pdf: 'application/pdf', mp3: 'audio/mpeg', mp4: 'video/mp4', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webm: 'video/webm' };
      responseHeaders.set('content-type', mime[ext] || 'application/octet-stream');
    }

    return new Response(response.body, { status: response.status, headers: responseHeaders });
  } catch (error) {
    return new Response('Proxy error: ' + (error.message || error), { status: 500, headers: corsHeaders });
  }
});
