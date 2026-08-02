import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  try {
    const { title, type, authorName, authorUserId } = await req.json() as {
      title: string;
      type: string;
      authorName: string | null;
      authorUserId?: string | null;
    };

    if (!title || !type) {
      return new Response("Missing fields", { status: 400, headers: CORS });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
    const FROM = "Céilí Melbourne <noreply@ceilimelbourne.com>";

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const typeLabel: Record<string, string> = {
      listing: "Listing",
      request: "Request",
      question: "Community question",
      regional_post: "Regional post",
    };
    const label = typeLabel[type] ?? type;
    const poster = authorName?.trim() || "Anonymous";

    async function sendEmail(to: string, subject: string, html: string) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
        body: JSON.stringify({
          from: FROM,
          to: [to],
          subject,
          html,
          headers: {
            "List-Unsubscribe": "<https://ceilimelbourne.com>",
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        }),
      });
      console.log("Resend →", to, res.status);
    }

    // 1. Notify all admins / moderators
    const { data: roleRows } = await admin
      .from("user_roles")
      .select("user_id")
      .in("role", ["admin", "moderator"]);

    const userIds = [...new Set((roleRows ?? []).map((r: any) => r.user_id))];
    for (const uid of userIds) {
      const { data } = await admin.auth.admin.getUserById(uid);
      if (!data?.user?.email) continue;
      await sendEmail(
        data.user.email,
        `New post awaiting approval: ${title}`,
        `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a">
          <p>Hi,</p>
          <p>A new <strong>${label}</strong> has been submitted on Céilí Melbourne and is awaiting your approval.</p>
          <div style="border:1px solid #e5e7eb;border-radius:10px;padding:16px 20px;margin:20px 0;background:#f9fafb">
            <p style="margin:0 0 4px 0;font-size:13px;color:#6b7280">${label} · by ${poster}</p>
            <p style="margin:0;font-size:16px;font-weight:600">${title.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
          </div>
          <a href="https://ceilimelbourne.com/admin" style="display:inline-block;background:#2d6a4f;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Review in admin dashboard</a>
          <p style="color:#999;font-size:12px;margin-top:32px">Céilí Melbourne · <a href="https://ceilimelbourne.com" style="color:#999">ceilimelbourne.com</a></p>
        </div>`,
      );
    }

    // 2. Send submission confirmation to the author (logged-in users only)
    if (authorUserId) {
      const { data: authorData } = await admin.auth.admin.getUserById(authorUserId);
      const authorEmail = authorData?.user?.email;
      if (authorEmail) {
        await sendEmail(
          authorEmail,
          "Your post is under review — Céilí Melbourne",
          `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a">
            <p>Hi ${poster},</p>
            <p>Thanks for submitting <strong>${title.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</strong> to Céilí Melbourne!</p>
            <p>Our team will review your post shortly. You'll receive another email once it has been approved or rejected.</p>
            <br>
            <p>Thanks,<br>The Céilí Melbourne team</p>
            <p style="color:#999;font-size:12px;margin-top:32px">Céilí Melbourne · <a href="https://ceilimelbourne.com" style="color:#999">ceilimelbourne.com</a></p>
          </div>`,
        );
      }
    }

    return new Response("OK", { status: 200, headers: CORS });
  } catch (e) {
    console.error("notify-new-post error:", e);
    return new Response("Internal error", { status: 500, headers: CORS });
  }
});
