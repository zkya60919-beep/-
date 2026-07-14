// Device Auth Edge Function
// إدارة تسجيل الأجهزة ومنع مشاركة الحسابات (Single Device Login)
//
// POST /register-device : تسجيل جهاز جديد أو التحقق من الجهاز الحالي
//   { user_id, device_id, device_name, device_type, ip_address }
//   الرد: { allowed: true/false, message, is_new: true/false }
//
// POST /reset-device : إعادة تعيين الجهاز (المعلم فقط)
//   { user_id, admin_session }
//   الرد: { success: true/false }
//
// ENV:
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });

  const url = new URL(req.url);
  const action = url.pathname.split('/').pop() || 'register-device';
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  if (!supabaseUrl || !supabaseKey) {
    return Response.json({ success: false, error: "Server configuration error" }, { status: 500, headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.json();

    if (action === 'register-device') {
      return await registerDevice(supabase, body, req);
    } else if (action === 'reset-device') {
      return await resetDevice(supabase, body);
    } else if (action === 'check-device') {
      return await checkDevice(supabase, body);
    }

    return Response.json({ success: false, error: "Unknown action" }, { status: 400, headers: corsHeaders });
  } catch (error) {
    console.error("Device auth error:", error);
    return Response.json({ success: false, error: error.message }, { status: 500, headers: corsHeaders });
  }
});

async function registerDevice(supabase: any, body: any, req: any) {
  let { user_id, device_id, device_name, device_type, ip_address, user_agent, browser, os } = body;
  
  if (!ip_address) {
    ip_address = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '';
  }

  if (!user_id || !device_id) {
    return Response.json({ success: false, error: "Missing user_id or device_id" }, { status: 400, headers: corsHeaders });
  }

  // Check existing registration
  const { data: existing } = await supabase
    .from('device_registrations')
    .select('*')
    .eq('user_id', user_id)
    .maybeSingle();

  if (existing) {
    // Device record exists — UPDATE it with new device info
    await supabase.from('device_registrations')
      .update({
        device_id,
        device_name,
        device_type,
        ip_address,
        user_agent,
        is_active: true,
        last_seen_at: new Date().toISOString()
      })
      .eq('id', existing.id);

  } else {
    // First time registration
    await supabase.from('device_registrations').insert({
      user_id,
      device_id,
      device_name,
      device_type,
      ip_address,
      user_agent,
      is_active: true,
      last_seen_at: new Date().toISOString()
    });
  }

  // Log login (best-effort — ignore if table missing)
  try {
    await supabase.from('login_logs').insert({
      user_id,
      action: 'login',
      status: 'success',
      device_id,
      created_at: new Date().toISOString()
    });
  } catch (_) {
    // login_logs table may not exist yet
  }

  return Response.json({
    success: true,
    allowed: true,
    device_registered: false,
    message: "Device registered successfully, previous sessions terminated"
  }, { headers: corsHeaders });
}

async function checkDevice(supabase: any, body: any) {
  const { user_id, device_id } = body;
  if (!user_id || !device_id) {
    return Response.json({ success: false, error: "Missing user_id or device_id" }, { status: 400, headers: corsHeaders });
  }

  const { data: existing } = await supabase
    .from('device_registrations')
    .select('*')
    .eq('user_id', user_id)
    .eq('is_active', true)
    .maybeSingle();

  if (!existing) {
    return Response.json({ success: true, allowed: true, message: "No active device" }, { headers: corsHeaders });
  }

  if (existing.device_id !== device_id) {
    return Response.json({
      success: true,
      allowed: false,
      message: "تم تسجيل الدخول من جهاز آخر. تم إنهاء جلستك الحالية."
    }, { headers: corsHeaders });
  }

  // Update last seen
  await supabase.from('device_registrations')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', existing.id);

  return Response.json({ success: true, allowed: true, message: "Device verified" }, { headers: corsHeaders });
}

async function resetDevice(supabase: any, body: any) {
  const { user_id, admin_session, admin_sig } = body;

  if (!user_id || !admin_session) {
    return Response.json({ success: false, error: "Missing required fields" }, { status: 400, headers: corsHeaders });
  }

  // Verify admin session via admin-validate
  const adminUrl = Deno.env.get("SUPABASE_URL") + "/functions/v1/admin-validate";
  try {
    const adminRes = await fetch(adminUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: admin_session,
        expires_at: 0,
        signature: admin_sig || ''
      })
    });
    const adminData = await adminRes.json();
    if (!adminData.valid) {
      return Response.json({ success: false, error: "Unauthorized: admin only" }, { status: 403, headers: corsHeaders });
    }
  } catch {
    return Response.json({ success: false, error: "Admin verification failed" }, { status: 403, headers: corsHeaders });
  }

  // Get current device info for logging
  const { data: currentDevice } = await supabase
    .from('device_registrations')
    .select('*')
    .eq('user_id', user_id)
    .eq('is_active', true)
    .maybeSingle();

  // Reset device
  const { error } = await supabase
    .from('device_registrations')
    .update({ is_active: false })
    .eq('user_id', user_id);

  if (error) throw error;

  // Log the reset
  await supabase.from('login_logs').insert({
    user_id,
    action: 'device_reset_by_admin',
    status: 'success',
    device_id: currentDevice?.device_id || null,
    created_at: new Date().toISOString()
  });

  return Response.json({
    success: true,
    message: "Device reset successfully. Student can now login from another device."
  }, { headers: corsHeaders });
}
