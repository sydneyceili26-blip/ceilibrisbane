import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const now = new Date();
  const in6 = new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString();
  const in8 = new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000).toISOString();

  const { data: listings, error } = await admin
    .from("listings")
    .select("id, title, owner_id, expires_at")
    .eq("status", "approved")
    .gte("expires_at", in6)
    .lte("expires_at", in8)
    .is("expiry_notified_at", null)
    .not("owner_id", "is", null);

  if (error) {
    console.error("DB error:", error);
    return new Response("DB error", { status: 500, headers: CORS });
  }

  const total = listings?.length ?? 0;
  console.log(`Found ${total} listings expiring in ~7 days`);
  if (!total) return new Response("Nothing to notify", { status: 200, headers: CORS });

  let sent = 0;
  for (const listing of listings!) {
    const { data: authData } = await admin.auth.admin.getUserById(listing.owner_id!);
    const email = authData?.user?.email;
    if (!email) continue;

    const daysLeft = Math.round(
      (new Date(listing.expires_at).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: "Céilí Melbourne <noreply@ceilimelbourne.com>",
        to: [email],
        subject: `Your listing expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"} — renew now`,
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a">
            <p style="margin-bottom:8px">Hi there,</p>
            <p>Your listing <strong>${listing.title.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</strong> on Céilí Melbourne expires in <strong>${daysLeft} day${daysLeft === 1 ? "" : "s"}</strong>.</p>
            <p style="color:#555">Renew it to keep it visible for another 60 days — it only takes one click.</p>
            <a href="https://ceilimelbourne.com/my-posts" style="display:inline-block;background:#2d6a4f;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:8px">Renew my listing</a>
            <p style="color:#999;font-size:12px;margin-top:32px">Céilí Melbourne · <a href="https://ceilimelbourne.com" style="color:#999">ceilimelbourne.com</a></p>
          </div>
        `,
      }),
    });

    if (res.ok) {
      await admin.from("listings").update({ expiry_notified_at: now.toISOString() }).eq("id", listing.id);
      sent++;
      console.log(`Notified owner of listing ${listing.id}`);
    } else {
      console.error("Resend error for listing", listing.id, await res.text());
    }
  }

  return new Response(`Sent ${sent}/${total} notifications`, { status: 200, headers: CORS });
});
