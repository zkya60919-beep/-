// Supabase Edge Function: send-sms
// إرسال رسالة SMS عبر Twilio
//
// ENV المطلوبة (في Supabase Edge Functions Secrets):
// - TWILIO_ACCOUNT_SID (من لوحة تحكم Twilio)
// - TWILIO_AUTH_TOKEN (من لوحة تحكم Twilio)
// - TWILIO_PHONE_NUMBER (رقم الهاتف من Twilio، مثال: +12025551234)

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { to, message } = await req.json();

    if (!to || !message) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, message" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const fromNumber = Deno.env.get("TWILIO_PHONE_NUMBER");

    if (!accountSid || !authToken || !fromNumber) {
      return new Response(
        JSON.stringify({ error: "Twilio credentials not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // تحويل رقم الهاتف إلى صيغة E.164 (+20XXXXXXXXX)
    let mobile = to.replace(/[^0-9]/g, "");
    if (mobile.startsWith("002")) mobile = mobile.slice(3);
    if (mobile.startsWith("01")) mobile = "20" + mobile;
    if (!mobile.startsWith("+")) mobile = "+" + mobile;

    const auth = btoa(`${accountSid}:${authToken}`);
    const payload = new URLSearchParams({
      To: mobile,
      From: fromNumber,
      Body: message,
    });

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Authorization": `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: payload,
      }
    );

    const result = await response.json();

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: result.message || "Twilio error", details: result }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ success: true, sid: result.sid }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});