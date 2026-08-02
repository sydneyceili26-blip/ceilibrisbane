import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { sendApnsPush } from "../_shared/push.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

const TABLE: Record<string, string> = {
  listing: "listings",
  request: "requests",
  question: "questions",
  regional_post: "regional_posts",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  try {
    const { postId, postType, postTitle, authorName, decision } = await req.json() as {
      postId: string;
      postType: string;
      postTitle: string;
      authorName: string | null;
      decision: "approved" | "rejected";
    };

    if (!postId || !postType || !postTitle || !decision) {
      return new Response("Missing fields", { status: 400, headers: CORS });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
    const FROM = "Céilí Melbourne <noreply@ceilimelbourne.com>";

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const table = TABLE[postType];
    if (!table) return new Response("Unknown type", { status: 400, headers: CORS });

    // Look up the post's owner_id
    const { data: post } = await admin.from(table).select("owner_id").eq("id", postId).maybeSingle();
    if (!post?.owner_id) {
      // Guest post — no email to send
      return new Response("No owner", { status: 200, headers: CORS });
    }

    const { data: userData } = await admin.auth.admin.getUserById(post.owner_id);
    const authorEmail = userData?.user?.email;
    if (!authorEmail) {
      return new Response("No email", { status: 200, headers: CORS });
    }

    const poster = authorName?.trim() || "there";
    const safeTitle = postTitle.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const isApproved = decision === "approved";

    const subject = isApproved
      ? `Your post has been approved — Céilí Melbourne`
      : `Update on your Céilí Melbourne post`;

    const html = isApproved
      ? `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a">
          <p>Hi ${poster},</p>
          <p>Great news — your post <strong>${safeTitle}</strong> has been <strong style="color:#2d6a4f">approved</strong> and is now live on Céilí Melbourne!</p>
          <a href="https://ceilimelbourne.com" style="display:inline-block;background:#2d6a4f;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:8px">View on Céilí Melbourne →</a>
          <br><br>
          <p>Thanks,<br>The Céilí Melbourne team</p>
          <p style="color:#999;font-size:12px;margin-top:32px">Céilí Melbourne · <a href="https://ceilimelbourne.com" style="color:#999">ceilimelbourne.com</a></p>
        </div>`
      : `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a">
          <p>Hi ${poster},</p>
          <p>Unfortunately, your post <strong>${safeTitle}</strong> wasn't approved for Céilí Melbourne at this time.</p>
          <p>If you have any questions, feel free to reply to this email or resubmit with any changes.</p>
          <br>
          <p>Thanks,<br>The Céilí Melbourne team</p>
          <p style="color:#999;font-size:12px;margin-top:32px">Céilí Melbourne · <a href="https://ceilimelbourne.com" style="color:#999">ceilimelbourne.com</a></p>
        </div>`;

    const emailPromise = fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: FROM,
        to: [authorEmail],
        subject,
        html,
        headers: {
          "List-Unsubscribe": "<https://ceilimelbourne.com>",
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      }),
    });

    const pushPromise = (async () => {
      const { data: tokens } = await admin
        .from("push_tokens")
        .select("token")
        .eq("user_id", post.owner_id);
      if (!tokens?.length) return;
      const pushTitle = isApproved ? "Post approved ✓" : "Post update";
      const pushBody = isApproved
        ? `Your post "${postTitle}" is now live!`
        : `Your post "${postTitle}" wasn't approved this time.`;
      await Promise.all(
        tokens.map((t) => sendApnsPush(t.token, { title: pushTitle, body: pushBody }))
      );
    })();

    const [res] = await Promise.all([emailPromise, pushPromise]);
    console.log("Resend decision email →", authorEmail, res.status);

    return new Response("OK", { status: 200, headers: CORS });
  } catch (e) {
    console.error("notify-post-decision error:", e);
    return new Response("Internal error", { status: 500, headers: CORS });
  }
});
