import { uploadImage } from '../_shared/cloudinary.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });

  try {
    const cloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME') || '';
    const apiKey = Deno.env.get('CLOUDINARY_API_KEY') || '';
    const apiSecret = Deno.env.get('CLOUDINARY_API_SECRET') || '';

    if (!cloudName || !apiKey || !apiSecret) {
      return Response.json({ error: 'Cloudinary not configured' }, { status: 500, headers: corsHeaders });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const folder = (formData.get('folder') as string) || 'images';

    if (!file) {
      return Response.json({ error: 'No file provided' }, { status: 400, headers: corsHeaders });
    }

    const result = await uploadImage(file, folder, cloudName, apiKey, apiSecret);
    return Response.json(result, { headers: corsHeaders });

  } catch (err) {
    return Response.json({ error: err.message || 'Upload failed' }, { status: 400, headers: corsHeaders });
  }
});