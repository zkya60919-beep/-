import { deleteFile } from '../_shared/cloudinary.js';

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

    const { public_id, resource_type } = await req.json();
    if (!public_id || !resource_type) {
      return Response.json({ error: 'Missing public_id or resource_type' }, { status: 400, headers: corsHeaders });
    }

    const result = await deleteFile(public_id, resource_type, cloudName, apiKey, apiSecret);
    return Response.json(result, { headers: corsHeaders });

  } catch (err) {
    return Response.json({ error: err.message || 'Delete failed' }, { status: 400, headers: corsHeaders });
  }
});