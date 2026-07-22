import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { jwtVerify } from 'https://esm.sh/jose@5.2.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, range",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET" && req.method !== "HEAD") return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return new Response("Missing token", { status: 403, headers: corsHeaders });
    }

    const jwtSecret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!jwtSecret) {
      return new Response("Server config error", { status: 500, headers: corsHeaders });
    }

    // Verify token
    const encoder = new TextEncoder();
    let payload;
    try {
      const { payload: p } = await jwtVerify(token, encoder.encode(jwtSecret));
      payload = p;
    } catch (e) {
      return new Response("Invalid or expired token", { status: 403, headers: corsHeaders });
    }

    const videoUrl = payload.url;
    if (!videoUrl || typeof videoUrl !== 'string') {
      return new Response("Invalid token payload", { status: 400, headers: corsHeaders });
    }

    // Proxy the request to the file storage
    const headers = new Headers();
    const range = req.headers.get("range");
    if (range) {
      headers.set("range", range);
    }

    const response = await fetch(videoUrl, {
      method: req.method,
      headers: headers
    });

    if (!response.ok && response.status !== 206) {
      return new Response("Failed to fetch video", { status: response.status, headers: corsHeaders });
    }

    // Forward the response back to the client
    const responseHeaders = new Headers(corsHeaders);
    
    // Copy essential headers
    const headersToCopy = [
      "content-type", 
      "content-length", 
      "content-range", 
      "accept-ranges",
      "cache-control",
      "etag",
      "last-modified"
    ];
    
    for (const h of headersToCopy) {
      if (response.headers.has(h)) {
        responseHeaders.set(h, response.headers.get(h)!);
      }
    }

    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders
    });

  } catch (error) {
    console.error("Video proxy error:", error);
    return new Response(error.message, { status: 500, headers: corsHeaders });
  }
});
