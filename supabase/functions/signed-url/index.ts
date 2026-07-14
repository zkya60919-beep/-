// Signed URL Edge Function
// Verifies user access (active subscription or course purchase) and generates temporary signed video URL.
//
// POST { video_id?, course_video_id?, user_id }
// Response: { success, signed_url, expires_in } | { success: false, error }
//
// ENV: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SignJWT } from 'https://esm.sh/jose@5.2.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SIGNED_URL_TTL = 60 * 60 * 6; // 6 hours, enough for a long video session

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  if (!supabaseUrl || !supabaseKey) {
    return Response.json({ success: false, error: "Server config error" }, { status: 500, headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.json();
    const { video_id, course_video_id, user_id } = body;

    if (!user_id || !(video_id || course_video_id)) {
      return Response.json({ success: false, error: "Missing required fields" }, { status: 400, headers: corsHeaders });
    }

    let hasAccess = false;
    let videoUrl = '';

    if (video_id) {
      const { data: video } = await supabase
        .from('videos')
        .select('video_url, playback_url, month_id, is_free')
        .eq('id', video_id)
        .single();

      if (!video) return Response.json({ success: false, error: "Video not found" }, { status: 404 });

      videoUrl = video.playback_url || video.video_url || '';

      if (video.is_free) {
        hasAccess = true;
      } else {
        const { data: sub } = await supabase
          .from('subscriptions')
          .select('id')
          .eq('user_id', user_id)
          .eq('month_id', video.month_id)
          .eq('status', 'active')
          .gt('end_date', new Date().toISOString())
          .maybeSingle();
        hasAccess = !!sub;
      }
    } else if (course_video_id) {
      const { data: cv } = await supabase
        .from('course_videos')
        .select('video_url, course_id')
        .eq('id', course_video_id)
        .single();

      if (!cv) return Response.json({ success: false, error: "Course video not found" }, { status: 404 });

      videoUrl = cv.video_url || '';

      const { data: purchase } = await supabase
        .from('course_purchases')
        .select('id')
        .eq('user_id', user_id)
        .eq('course_id', cv.course_id)
        .eq('status', 'active')
        .maybeSingle();
      hasAccess = !!purchase;
    }

    if (!hasAccess) {
      return Response.json({ success: false, error: "لا يوجد اشتراك نشط أو شراء للكورس" }, { status: 403, headers: corsHeaders });
    }

    if (!videoUrl) {
      return Response.json({ success: false, error: "No video URL" }, { status: 404, headers: corsHeaders });
    }

    // Generate JWT token for proxy
    const encoder = new TextEncoder();
    const token = await new SignJWT({ url: videoUrl, user_id })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(`${SIGNED_URL_TTL}s`)
      .sign(encoder.encode(supabaseKey));

    const signedUrl = `${supabaseUrl}/functions/v1/video-proxy?token=${token}`;

    // Log access
    await supabase.from('login_logs').insert({
      user_id,
      action: 'video_access',
      status: 'success',
      created_at: new Date().toISOString()
    });

    return Response.json({
      success: true,
      signed_url: signedUrl,
      expires_in: SIGNED_URL_TTL,
      expires_at: new Date(Date.now() + SIGNED_URL_TTL * 1000).toISOString()
    }, { headers: corsHeaders });


  } catch (error) {
    console.error("Signed URL error:", error);
    return Response.json({ success: false, error: error.message }, { status: 500, headers: corsHeaders });
  }
});
