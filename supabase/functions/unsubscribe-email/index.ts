import { createClient } from "npm:@supabase/supabase-js@2";
import { verifyUnsubscribeToken } from "../_shared/unsubscribe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type UnsubscribeStatus = "confirm" | "success" | "error";

function getAdminClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY secrets.");
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function statusUrl(status: UnsubscribeStatus, token?: string) {
  const siteUrl = Deno.env.get("PUBLIC_SITE_URL") ?? "https://bearsprediction.com";
  const redirectUrl = new URL("/email/unsubscribed", siteUrl);
  redirectUrl.searchParams.set("status", status);
  if (token) redirectUrl.searchParams.set("token", token);
  return redirectUrl;
}

function jsonResponse(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const secret = Deno.env.get("UNSUBSCRIBE_SIGNING_SECRET");
  if (!secret) {
    console.error("UNSUBSCRIBE_SIGNING_SECRET is not configured");
    return req.method === "GET"
      ? Response.redirect(statusUrl("error"), 303)
      : jsonResponse({ ok: false, error: "Unable to unsubscribe." }, 500);
  }

  // GET is read-only because inbox security products commonly visit links
  // before recipients do. Verify the token, then let the site ask the person to
  // confirm. Only the POST below changes email preferences.
  if (req.method === "GET") {
    try {
      const token = new URL(req.url).searchParams.get("token");
      if (!token) throw new Error("Missing unsubscribe token.");
      await verifyUnsubscribeToken(token, secret);
      return Response.redirect(statusUrl("confirm", token), 303);
    } catch (error) {
      console.error("Failed to verify unsubscribe link", error);
      return Response.redirect(statusUrl("error"), 303);
    }
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed." }, 405);
  }

  try {
    const body = await req.json();
    const token = typeof body?.token === "string" ? body.token : null;
    if (!token) throw new Error("Missing unsubscribe token.");

    const payload = await verifyUnsubscribeToken(token, secret);
    const { error } = await getAdminClient()
      .from("email_preferences")
      .upsert({
        user_id: payload.userId,
        marketing_subscribed: false,
        unsubscribed_at: new Date().toISOString(),
      });

    if (error) {
      throw new Error(`Failed to update unsubscribe state: ${error.message}`);
    }

    return jsonResponse({ ok: true }, 200);
  } catch (error) {
    console.error("Failed to process unsubscribe request", error);
    return jsonResponse({ ok: false, error: "Unable to unsubscribe." }, 400);
  }
});
