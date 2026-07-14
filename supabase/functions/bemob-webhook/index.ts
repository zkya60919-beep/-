// Supabase Edge Function: bemob-webhook
// الهدف: استقبال إشعارات الدفع من BeMob ومعالجتها
//
// ENV المطلوبة (في Supabase Project → Edge Functions Secrets):
// - BEMOB_WEBHOOK_SECRET (المفتاح السري للتحقق من توقيع BeMob)
// - BEMOB_API_KEY (مفتاح API لـ BeMob - اختياري)
// - SUPABASE_SERVICE_ROLE_KEY (مفتاح خدمة Supabase للوصول الكامل لقاعدة البيانات)
//
// طلب BeMob (Webhook):
// POST {
//   transaction_id: string,
//   order_id: string,
//   status: 'success' | 'failed' | 'cancelled',
//   amount: number,
//   currency: string,
//   student_id: string,
//   course_id: string,
//   signature: string,
//   timestamp: string
// }
//
// رد:
// { success: true } أو { success: false, error: string }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-bemob-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  // Get environment variables
  const webhookSecret = Deno.env.get("BEMOB_WEBHOOK_SECRET") || "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  if (!webhookSecret || webhookSecret.includes("YOUR_")) {
    console.error("BeMob webhook secret not configured");
    return Response.json({ success: false, error: "Webhook not configured" }, { status: 500, headers: corsHeaders });
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Supabase credentials not configured");
    return Response.json({ success: false, error: "Server configuration error" }, { status: 500, headers: corsHeaders });
  }

  // Initialize Supabase client with service role key for full access
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Parse request body
    const body = await req.json();
    console.log("Received BeMob webhook:", JSON.stringify(body));

    const {
      transaction_id,
      order_id,
      status,
      amount,
      currency,
      student_id,
      course_id,
      signature,
      timestamp
    } = body;

    // Validate required fields
    if (!transaction_id || !status || !amount || !student_id || !signature) {
      console.error("Missing required fields in webhook");
      return Response.json({ success: false, error: "Missing required fields" }, { status: 400, headers: corsHeaders });
    }

    // Verify signature
    const isValidSignature = await verifySignature(body, webhookSecret);
    if (!isValidSignature) {
      console.error("Invalid signature from BeMob");
      return Response.json({ success: false, error: "Invalid signature" }, { status: 401, headers: corsHeaders });
    }

    // Check for idempotency - prevent duplicate processing
    const { data: existingPayment } = await supabase
      .from('payments')
      .select('*')
      .eq('bemob_transaction_id', transaction_id)
      .single();

    if (existingPayment && existingPayment.webhook_processed) {
      console.log(`Transaction ${transaction_id} already processed`);
      return Response.json({ success: true, message: "Already processed" }, { headers: corsHeaders });
    }

    // Process based on payment status
    if (status === 'success') {
      await processSuccessfulPayment(supabase, {
        transaction_id,
        order_id,
        amount,
        currency,
        student_id,
        course_id,
        signature,
        timestamp
      });
    } else if (status === 'failed') {
      await processFailedPayment(supabase, transaction_id, student_id);
    } else if (status === 'cancelled') {
      await processCancelledPayment(supabase, transaction_id, student_id);
    }

    return Response.json({ success: true }, { headers: corsHeaders });

  } catch (error) {
    console.error("Error processing BeMob webhook:", error);
    return Response.json({ success: false, error: error.message }, { status: 500, headers: corsHeaders });
  }
});

// Verify BeMob signature
async function verifySignature(body: any, secret: string): Promise<boolean> {
  try {
    // BeMob signature verification logic
    // Typically: HMAC-SHA256 of the payload using the secret
    const receivedSignature = body.signature;
    
    // Create a string to sign (excluding the signature field itself)
    const { signature, ...payload } = body;
    const payloadString = JSON.stringify(payload);
    
    // Create HMAC-SHA256
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(payloadString);
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    const calculatedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    // Compare signatures (timing-safe comparison would be better in production)
    return calculatedSignature === receivedSignature;
  } catch (error) {
    console.error("Signature verification error:", error);
    return false;
  }
}

// Process successful payment
async function processSuccessfulPayment(
  supabase: any,
  paymentData: {
    transaction_id: string;
    order_id: string;
    amount: number;
    currency: string;
    student_id: string;
    course_id: string;
    signature: string;
    timestamp: string;
  }
) {
  const { transaction_id, order_id, amount, student_id, course_id, signature, timestamp } = paymentData;

  console.log(`Processing successful payment: ${transaction_id}`);

  // Start a transaction
  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .update({
      status: 'success',
      payment_gateway: 'bemob',
      bemob_transaction_id: transaction_id,
      bemob_order_id: order_id,
      bemob_signature: signature,
      webhook_received_at: new Date().toISOString(),
      webhook_processed: true,
      student_id: student_id,
      course_id: course_id ? parseInt(course_id) : null,
      updated_at: new Date().toISOString()
    })
    .eq('bemob_transaction_id', transaction_id)
    .select()
    .single();

  if (paymentError && paymentError.code !== 'PGRST116') {
    // If payment doesn't exist by transaction_id, try to find it by student_id and amount
    const { data: newPayment, error: newPaymentError } = await supabase
      .from('payments')
      .update({
        status: 'success',
        payment_gateway: 'bemob',
        bemob_transaction_id: transaction_id,
        bemob_order_id: order_id,
        bemob_signature: signature,
        webhook_received_at: new Date().toISOString(),
        webhook_processed: true,
        student_id: student_id,
        course_id: course_id ? parseInt(course_id) : null,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', student_id)
      .eq('amount', amount)
      .eq('status', 'pending')
      .select()
      .single();

    if (newPaymentError) {
      throw new Error(`Failed to update payment: ${newPaymentError.message}`);
    }
  }

  const finalPayment = payment || newPayment;
  const metadata = (finalPayment.metadata || {});
  const paymentType = metadata.payment_type || 'subscription';

  if (paymentType === 'course') {
    // تفعيل شراء كورس
    const courseIdVal = metadata.course_id || (course_id ? parseInt(course_id) : null);
    if (courseIdVal) {
      const { error: cpError } = await supabase
        .from('course_purchases')
        .upsert({
          user_id: student_id,
          course_id: courseIdVal,
          payment_id: finalPayment.id,
          status: 'active'
        }, { onConflict: 'user_id,course_id', ignoreDuplicates: true });

      if (cpError) {
        console.error("Error creating course purchase:", cpError);
      }
    }
  } else if (course_id) {
    // تفعيل اشتراك (السلوك الحالي)
    const { data: durationSettings } = await supabase
      .from('teacher_settings')
      .select('setting_value')
      .eq('setting_key', 'subscription_duration')
      .single();

    const duration = durationSettings ? parseInt(durationSettings.setting_value) : 30;
    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + duration * 24 * 60 * 60 * 1000);

    const { error: subError } = await supabase
      .from('subscriptions')
      .insert({
        user_id: student_id,
        month_id: parseInt(course_id),
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        payment_id: finalPayment.id,
        status: 'active'
      });

    if (subError) {
      console.error("Error creating subscription:", subError);
      throw new Error(`Failed to create subscription: ${subError.message}`);
    }

    const { error: codeError } = await supabase
      .from('subscription_codes')
      .insert({
        user_id: student_id,
        month_id: parseInt(course_id),
        payment_id: finalPayment.id,
        used: true,
        used_at: new Date().toISOString(),
        expires_at: endDate.toISOString()
      });

    if (codeError) {
      console.error("Error creating subscription code:", codeError);
    }
  }

  await distributeProfits(supabase, finalPayment.id, amount, student_id, course_id);

  // Send notifications (you can integrate with your notification system)
  await sendNotifications(supabase, student_id, finalPayment.id, amount, 'success');

  console.log(`Successfully processed payment ${transaction_id}`);
}

// Process failed payment
async function processFailedPayment(supabase: any, transaction_id: string, student_id: string) {
  console.log(`Processing failed payment: ${transaction_id}`);

  const { error } = await supabase
    .from('payments')
    .update({
      status: 'failed',
      bemob_transaction_id: transaction_id,
      webhook_received_at: new Date().toISOString(),
      webhook_processed: true,
      updated_at: new Date().toISOString()
    })
    .eq('bemob_transaction_id', transaction_id);

  if (error) {
    console.error("Error updating failed payment:", error);
  }

  // Send failure notification
  await sendNotifications(supabase, student_id, null, 0, 'failed');
}

// Process cancelled payment
async function processCancelledPayment(supabase: any, transaction_id: string, student_id: string) {
  console.log(`Processing cancelled payment: ${transaction_id}`);

  const { error } = await supabase
    .from('payments')
    .update({
      status: 'cancelled',
      bemob_transaction_id: transaction_id,
      webhook_received_at: new Date().toISOString(),
      webhook_processed: true,
      updated_at: new Date().toISOString()
    })
    .eq('bemob_transaction_id', transaction_id);

  if (error) {
    console.error("Error updating cancelled payment:", error);
  }
}

// Distribute profits to teacher, investor, and platform
async function distributeProfits(
  supabase: any,
  paymentId: number,
  amount: number,
  studentId: string,
  courseId: string | null
) {
  try {
    // Get profit distribution settings
    const { data: teacherPercent } = await supabase
      .from('teacher_settings')
      .select('setting_value')
      .eq('setting_key', 'teacher_profit_percentage')
      .single();

    const { data: investorPercent } = await supabase
      .from('teacher_settings')
      .select('setting_value')
      .eq('setting_key', 'investor_profit_percentage')
      .single();

    const { data: platformPercent } = await supabase
      .from('teacher_settings')
      .select('setting_value')
      .eq('setting_key', 'platform_profit_percentage')
      .single();

    const teacherSharePercent = teacherPercent ? parseFloat(teacherPercent.setting_value) : 70;
    const investorSharePercent = investorPercent ? parseFloat(investorPercent.setting_value) : 20;
    const platformSharePercent = platformPercent ? parseFloat(platformPercent.setting_value) : 10;

    const teacherShare = (amount * teacherSharePercent) / 100;
    const investorShare = (amount * investorSharePercent) / 100;
    const platformShare = (amount * platformSharePercent) / 100;

    // Update payment with distribution amounts
    await supabase
      .from('payments')
      .update({
        teacher_share: teacherShare,
        investor_share: investorShare,
        platform_share: platformShare
      })
      .eq('id', paymentId);

    // Get teacher ID (you may need to adjust this based on your system)
    const { data: teacherData } = await supabase
      .from('teacher_settings')
      .select('setting_value')
      .eq('setting_key', 'teacher_user_id')
      .single();

    const teacherId = teacherData ? teacherData.setting_value : null;

    // Log teacher distribution
    if (teacherId) {
      await supabase
        .from('payment_distributions')
        .insert({
          payment_id: paymentId,
          recipient_id: teacherId,
          recipient_type: 'teacher',
          amount: teacherShare,
          percentage: teacherSharePercent
        });
    }

    // Log platform distribution
    await supabase
      .from('payment_distributions')
      .insert({
        payment_id: paymentId,
        recipient_id: null, // Platform doesn't have a user ID
        recipient_type: 'platform',
        amount: platformShare,
        percentage: platformSharePercent
      });

    // Log investor distribution (if applicable)
    const { data: investorData } = await supabase
      .from('teacher_settings')
      .select('setting_value')
      .eq('setting_key', 'investor_user_id')
      .single();

    if (investorData) {
      await supabase
        .from('payment_distributions')
        .insert({
          payment_id: paymentId,
          recipient_id: investorData.setting_value,
          recipient_type: 'investor',
          amount: investorShare,
          percentage: investorSharePercent
        });
    }

    console.log(`Profits distributed for payment ${paymentId}`);
  } catch (error) {
    console.error("Error distributing profits:", error);
  }
}

// Send notifications to student and teacher
async function sendNotifications(
  supabase: any,
  studentId: string,
  paymentId: number | null,
  amount: number,
  status: 'success' | 'failed'
) {
  try {
    // Get student info
    const { data: student } = await supabase
      .from('users')
      .select('*')
      .eq('id', studentId)
      .single();

    if (!student) return;

    // Get teacher phone for notification
    const { data: teacherPhone } = await supabase
      .from('teacher_settings')
      .select('setting_value')
      .eq('setting_key', 'teacher_phone')
      .single();

    if (status === 'success') {
      // Send success notification to student
      console.log(`Payment success notification sent to student ${student.phone}`);
      
      // Send notification to teacher
      if (teacherPhone) {
        console.log(`Payment notification sent to teacher: New payment of ${amount} EGP from ${student.name}`);
      }
    } else {
      // Send failure notification to student
      console.log(`Payment failed notification sent to student ${student.phone}`);
    }

    // You can integrate with actual notification services here:
    // - SMS (using Twilio, etc.)
    // - Email (using SendGrid, etc.)
    // - Push notifications
    // - In-app notifications
  } catch (error) {
    console.error("Error sending notifications:", error);
  }
}
