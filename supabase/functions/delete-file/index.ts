import { deleteFile } from '../_shared/cloudinary.ts';

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
    if (!accessKey) {
      return Response.json({ error: 'R2 not configured' }, { status: 500, headers: corsHeaders });
    }

    const { url } = await req.json();
    if (!url) {
      return Response.json({ error: 'Missing url' }, { status: 400, headers: corsHeaders });
    }

    const result = await deleteFile(url);
    return Response.json(result, { headers: corsHeaders });

  } catch (err) {
    return Response.json({ error: err.message || 'Delete failed' }, { status: 400, headers: corsHeaders });
  }
});
