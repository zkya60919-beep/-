// Paymob Proxy Edge Function
// يدعم: Card (iframe), Cash (bill reference), Wallet (iframe)
//
// ENV (Supabase Secrets):
// - PAYMOB_API_KEY
// - PAYMOB_CARD_INTEGRATION_ID (5768731)
// - PAYMOB_CARD_IFRAME_ID (1058217)
// - PAYMOB_CASH_INTEGRATION_ID (5774507)
//
// الطلب: POST { amount, billing_data, callback_url, payment_method }
//   payment_method: 'card' | 'cash' | 'wallet'
// الرد: { success, payment_url?, bill_reference?, order_id, payment_key }

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });

  const apiKey = Deno.env.get("PAYMOB_API_KEY") || "";
  const cardIntId = Deno.env.get("PAYMOB_CARD_INTEGRATION_ID") || Deno.env.get("PAYMOB_INTEGRATION_ID") || "";
  const cashIntId = Deno.env.get("PAYMOB_CASH_INTEGRATION_ID") || "";
  const walletIntId = Deno.env.get("PAYMOB_WALLET_INTEGRATION_ID") || "";
  const cardIframeId = Deno.env.get("PAYMOB_CARD_IFRAME_ID") || Deno.env.get("PAYMOB_IFRAME_ID") || cardIntId;

  if (!apiKey || apiKey.includes("YOUR_")) {
    return Response.json({ success: false, error: "Paymob not configured" }, { status: 500, headers: corsHeaders });
  }

  let body;
  try { body = await req.json(); }
  catch { return Response.json({ success: false, error: "Invalid JSON" }, { status: 400, headers: corsHeaders }); }

  const { amount, billing_data, callback_url, payment_method } = body;
  if (!amount || !billing_data || !callback_url) {
    return Response.json({ success: false, error: "Missing amount, billing_data, or callback_url" }, { status: 400, headers: corsHeaders });
  }

  const method = payment_method || 'card';
  let integrationId = cardIntId;
  if (method === 'cash') integrationId = cashIntId;
  else if (method === 'wallet') integrationId = walletIntId;

  if (!integrationId) {
    return Response.json({ success: false, error: `Integration not configured for: ${method}` }, { status: 500, headers: corsHeaders });
  }

  try {
    // Step 1: Auth
    const authRes = await fetch("https://accept.paymob.com/api/auth/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: apiKey }),
    });
    const authData = await authRes.json();
    if (!authData.token) throw new Error("Auth failed: " + JSON.stringify(authData));
    const token = authData.token;

    // Step 2: Create order
    const orderRes = await fetch("https://accept.paymob.com/api/ecommerce/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        auth_token: token,
        delivery_needed: false,
        amount_cents: Math.round(amount * 100),
        currency: "EGP",
        items: [],
      }),
    });
    const orderData = await orderRes.json();
    if (!orderData.id) throw new Error("Order failed: " + JSON.stringify(orderData));

    // Step 3: Payment key
    const paymentKeyRes = await fetch("https://accept.paymob.com/api/acceptance/payment_keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        auth_token: token,
        amount_cents: Math.round(amount * 100),
        expiration: 3600,
        order_id: orderData.id,
        billing_data: billing_data,
        currency: "EGP",
        integration_id: parseInt(integrationId) || integrationId,
        redirect_url: callback_url,
      }),
    });
    const paymentKeyData = await paymentKeyRes.json();
    if (!paymentKeyData.token) throw new Error("Payment key failed: " + JSON.stringify(paymentKeyData));

    // Step 4: Check for bill_reference in payment key response (cash)
    const billRef = paymentKeyData.bill_reference || paymentKeyData.billReference || null;

    if (method === 'cash' && billRef) {
      // Cash with bill reference from payment key
      return Response.json({
        success: true,
        bill_reference: billRef,
        order_id: orderData.id,
        payment_key: paymentKeyData.token,
      }, { headers: corsHeaders });
    }

    if (method === 'cash') {
      // Try bills endpoint if no bill_reference in payment key
      try {
        const billRes = await fetch("https://accept.paymob.com/api/acceptance/bills", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            auth_token: token,
            order_id: orderData.id,
            amount_cents: Math.round(amount * 100),
            payment_key: paymentKeyData.token,
          }),
        });
        const billData = await billRes.json();
        const ref = billData.bill_reference || billData.reference_number || billData.id?.toString() || null;
        if (ref) {
          return Response.json({
            success: true,
            bill_reference: ref,
            order_id: orderData.id,
            payment_key: paymentKeyData.token,
          }, { headers: corsHeaders });
        }
      } catch { /* fallback to iframe */ }

      // No bill reference available — return error instead of broken iframe
      return Response.json({
        success: false,
        error: "تعذر إنشاء رقم مرجعي للدفع النقدي، يرجى المحاولة مرة أخرى أو اختيار طريقة دفع أخرى",
      }, { status: 500, headers: corsHeaders });
    }

    // Card / Wallet → iframe
    let iframeId = cardIframeId;
    if (method === 'wallet') iframeId = Deno.env.get("PAYMOB_WALLET_IFRAME_ID") || integrationId;

    return Response.json({
      success: true,
      payment_url: `https://accept.paymob.com/api/acceptance/iframes/${iframeId}?payment_token=${paymentKeyData.token}`,
      order_id: orderData.id,
      payment_key: paymentKeyData.token,
    }, { headers: corsHeaders });

  } catch (err) {
    console.error("Paymob proxy error:", err);
    return Response.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders });
  }
});
