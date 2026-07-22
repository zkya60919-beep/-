import { uploadImage } from '../_shared/cloudinary.ts';

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

    const formData = await req.formData();
    const file = formData.get('file') || formData.get('image');
    const folder = (formData.get('folder') as string) || 'images';

    if (!file || !(file instanceof File)) {
      return Response.json({ error: 'Missing file' }, { status: 400, headers: corsHeaders });
    }

    const result = await uploadImage(file, folder);
    return Response.json(result, { headers: corsHeaders });

  } catch (err) {
    return Response.json({ error: err.message || 'Upload failed' }, { status: 400, headers: corsHeaders });
  }
});
