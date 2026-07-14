// Supabase Edge Function: paymob-webhook
// يستقبل إشعارات Paymob (transaction callbacks) ويفعّل الاشتراكات / الكورسات
//
// ENV المطلوبة (Supabase Secrets):
// - PAYMOB_API_KEY (مفتاح API السري)
// - PAYMOB_HMAC_SECRET (مفتاح HMAC من Paymob Dashboard -> Account -> Security)
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY
//
// Paymob يرسل POST مع HMAC signature في header 'hmac'

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, hmac",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  const hmacSecret = Deno.env.get("PAYMOB_HMAC_SECRET") || "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  if (!hmacSecret || !supabaseUrl || !supabaseKey) {
    console.error("Missing configuration");
    return Response.json({ success: false, error: "Server configuration error" }, { status: 500, headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const rawBody = await req.text();
    const body = JSON.parse(rawBody);

    // Log incoming webhook
    await supabase.from('webhook_logs').insert({
      gateway: 'paymob',
      event_type: body.type || 'transaction_updated',
      payload: body,
      headers: Object.fromEntries(req.headers.entries()),
      status: 'received',
      created_at: new Date().toISOString()
    });

    // === HMAC Verification ===
    const receivedHmac = req.headers.get('hmac') || '';
    if (!receivedHmac) {
      console.error("Missing HMAC header");
      await logWebhookError(supabase, body, "Missing HMAC header");
      return Response.json({ success: false, error: "Missing HMAC" }, { status: 401, headers: corsHeaders });
    }

    const calculatedHmac = await calculateHMAC(hmacSecret, rawBody);
    if (calculatedHmac !== receivedHmac) {
      console.error("HMAC mismatch");
      await logWebhookError(supabase, body, "HMAC signature verification failed");
      return Response.json({ success: false, error: "Invalid HMAC" }, { status: 401, headers: corsHeaders });
    }

    // HMAC verified - log it
    await supabase.from('webhook_logs')
      .update({ signature_verified: true, status: 'verified' })
      .eq('payload', body)
      .is('signature_verified', false)
      .limit(1);

    // === Extract transaction data ===
    const obj = body.obj || body;
    const transactionId = obj.id?.toString() || obj.transaction_id?.toString() || '';
    const orderId = obj.order_id?.toString() || '';
    const success = obj.success === true || obj.is_success === true || obj.status === 'success';
    const pending = obj.is_pending === true || obj.status === 'pending' || obj.status === 'initiated';
    const failed = obj.is_failed === true || obj.status === 'failed' || obj.status === 'declined' || obj.status === 'canceled' || obj.success === false;
    const amountCents = parseInt(obj.amount_cents || '0');
    const amount = amountCents / 100;
    const currency = obj.currency || 'EGP';
    const paymentMethod = obj.source_data?.type || obj.payment_method || 'unknown';

    if (!transactionId) {
      console.error("Missing transaction ID");
      return Response.json({ success: false, error: "Missing transaction ID" }, { status: 400, headers: corsHeaders });
    }

    // === Duplicate Protection ===
    const { data: existingTx } = await supabase
      .from('transactions')
      .select('*')
      .eq('transaction_id', transactionId)
      .maybeSingle();

    if (existingTx && existingTx.status === 'success') {
      console.log(`Transaction ${transactionId} already processed successfully`);
      return Response.json({ success: true, message: "Already processed" }, { headers: corsHeaders });
    }

    // === Save/Update Transaction ===
    const { data: txRecord, error: txError } = await supabase
      .from('transactions')
      .upsert({
        transaction_id: transactionId,
        gateway: 'paymob',
        type: 'payment',
        amount: amount,
        currency: currency,
        status: success ? 'success' : (failed ? 'failed' : 'pending'),
        gateway_response: obj,
        updated_at: new Date().toISOString()
      }, { onConflict: 'transaction_id', ignoreDuplicates: false })
      .select()
      .single();

    if (txError) {
      console.error("Error saving transaction:", txError);
    }

    // === Find matching payment ===
    const { data: payment } = await supabase
      .from('payments')
      .select('*, metadata')
      .eq('id', orderId)
      .maybeSingle();

    if (!payment) {
      // Try to find by amount + pending status
      const { data: fallbackPayment } = await supabase
        .from('payments')
        .select('*, metadata')
        .eq('status', 'pending')
        .eq('amount', amount)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (fallbackPayment) {
        await processPayment(supabase, fallbackPayment, transactionId, paymentMethod, success, amount);
      }
      return Response.json({ success: true }, { headers: corsHeaders });
    }

    // === Process based on status ===
    if (success) {
      await processPayment(supabase, payment, transactionId, paymentMethod, true, amount);
    } else if (failed) {
      await failPayment(supabase, payment, transactionId, obj);
    }

    // Update webhook log as processed
    await supabase.from('webhook_logs')
      .update({ status: 'processed', processed_at: new Date().toISOString() })
      .eq('payload', body)
      .is('status', 'received')
      .limit(1);

    return Response.json({ success: true }, { headers: corsHeaders });

  } catch (error) {
    console.error("Webhook error:", error);
    try {
      await supabase.from('webhook_logs').insert({
        gateway: 'paymob',
        event_type: 'error',
        payload: { error: error.message },
        status: 'error',
        error_message: error.message,
        created_at: new Date().toISOString()
      });
    } catch { /* ignore logging errors */ }
    return Response.json({ success: false, error: error.message }, { status: 500, headers: corsHeaders });
  }
});

async function calculateHMAC(secret: string, body: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-512' },
    false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  return Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function logWebhookError(supabase: any, payload: any, message: string) {
  try {
    await supabase.from('webhook_logs').insert({
      gateway: 'paymob',
      payload: payload,
      status: 'error',
      error_message: message,
      signature_verified: false,
      created_at: new Date().toISOString()
    });
  } catch { /* ignore */ }
}

async function processPayment(
  supabase: any,
  payment: any,
  transactionId: string,
  paymentMethod: string,
  success: boolean,
  amount: number
) {
  const metadata = payment.metadata || {};
  const paymentType = metadata.payment_type || 'subscription';

  // Update payment record
  await supabase.from('payments').update({
    status: 'success',
    transaction_id: transactionId,
    payment_method: paymentMethod,
    gateway_order_id: transactionId,
    updated_at: new Date().toISOString()
  }).eq('id', payment.id);

  // If this is a course purchase
  if (paymentType === 'course') {
    const courseId = metadata.course_id || payment.course_id;
    if (courseId) {
      await supabase.from('course_purchases').upsert({
        user_id: payment.user_id,
        course_id: courseId,
        payment_id: payment.id,
        status: 'active',
        started_at: new Date().toISOString(),
        expires_at: null,
        last_accessed_at: new Date().toISOString(),
        access_count: 0
      }, { onConflict: 'user_id,course_id', ignoreDuplicates: true });
    }
    return;
  }

  // === Subscription activation ===
  const { data: durationSettings } = await supabase
    .from('teacher_settings')
    .select('setting_value')
    .eq('setting_key', 'subscription_duration')
    .single();

  const duration = durationSettings ? parseInt(durationSettings.setting_value) : 30;
  const startDate = new Date();
  const endDate = new Date(startDate.getTime() + duration * 24 * 60 * 60 * 1000);

  const months = payment.months || 1;
  const term = metadata.term || null;

  if (term) {
    // Term subscription
    const { data: months } = await supabase
      .from('months')
      .select('*')
      .order('order', { ascending: true });

    const startIndex = term === 1 ? 0 : 4;
    const termMonths = months.slice(startIndex, startIndex + 4);

    // Get term duration
    const { data: termSettings } = await supabase
      .from('teacher_settings')
      .select('setting_value')
      .eq('setting_key', 'term_subscription_duration')
      .single();

    const termDuration = termSettings ? parseInt(termSettings.setting_value) : 365;
    const termEnd = new Date(startDate.getTime() + termDuration * 24 * 60 * 60 * 1000);

    for (const m of termMonths) {
      await supabase.from('subscriptions').upsert({
        user_id: payment.user_id,
        month_id: m.id,
        start_date: startDate.toISOString(),
        end_date: termEnd.toISOString(),
        payment_id: payment.id,
        status: 'active'
      }, { onConflict: 'user_id,month_id', ignoreDuplicates: true });

      await supabase.from('subscription_codes').insert({
        user_id: payment.user_id,
        month_id: m.id,
        payment_id: payment.id,
        expires_at: termEnd.toISOString(),
        used: true,
        used_at: new Date().toISOString()
      });
    }
  } else {
    // Monthly subscription
    let monthId = metadata.month_id || null;
    if (!monthId) {
      const { data: user } = await supabase.from('users').select('grade_id').eq('id', payment.user_id).single();
      if (user) {
        const { data: m } = await supabase
          .from('months')
          .select('id')
          .eq('grade_id', user.grade_id)
          .order('order', { ascending: true })
          .limit(1)
          .single();
        monthId = m?.id || null;
      }
    }

    if (monthId) {
      await supabase.from('subscriptions').upsert({
        user_id: payment.user_id,
        month_id: monthId,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        payment_id: payment.id,
        status: 'active'
      }, { onConflict: 'user_id,month_id', ignoreDuplicates: true });

      await supabase.from('subscription_codes').insert({
        user_id: payment.user_id,
        month_id: monthId,
        payment_id: payment.id,
        expires_at: endDate.toISOString(),
        used: true,
        used_at: new Date().toISOString()
      });
    }
  }

  // Log subscription activation
  await supabase.from('login_logs').insert({
    user_id: payment.user_id,
    action: 'subscription_activated',
    status: 'success',
    created_at: new Date().toISOString()
  });
}

async function failPayment(supabase: any, payment: any, transactionId: string, obj: any) {
  await supabase.from('payments').update({
    status: 'failed',
    transaction_id: transactionId,
    error_log: JSON.stringify(obj),
    updated_at: new Date().toISOString()
  }).eq('id', payment.id);

  await supabase.from('login_logs').insert({
    user_id: payment.user_id,
    action: 'payment_failed',
    status: 'failed',
    fail_reason: obj?.data?.message || 'Payment declined',
    created_at: new Date().toISOString()
  });
}
