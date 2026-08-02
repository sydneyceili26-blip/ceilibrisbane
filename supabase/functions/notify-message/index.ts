import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { sendApnsPush } from "../_shared/push.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  try {
    const payload = await req.json();
    const record = payload.record as {
      id: string;
      conversation_id: string;
      sender_id: string;
      body: string;
    };

    console.log("1. payload received, conversation_id:", record?.conversation_id, "sender_id:", record?.sender_id);

    if (!record?.conversation_id || !record?.sender_id) {
      console.log("1a. invalid payload - missing fields");
      return new Response("Invalid payload", { status: 400, headers: CORS });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

    console.log("2. RESEND_API_KEY present:", !!RESEND_API_KEY, "key starts with:", RESEND_API_KEY?.slice(0, 5));

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: convo, error: convoError } = await admin
      .from("conversations")
      .select("listing_id, starter_id, owner_id")
      .eq("id", record.conversation_id)
      .single();

    console.log("3. conversation lookup:", convo ? "found" : "not found", convoError?.message ?? "");

    if (!convo) return new Response("Conversation not found", { status: 200, headers: CORS });

    const recipientId = record.sender_id === convo.starter_id ? convo.owner_id : convo.starter_id;
    console.log("4. sender:", record.sender_id, "recipient:", recipientId ?? "null (anonymous)");

    if (recipientId && recipientId === record.sender_id) return new Response("Self-message", { status: 200, headers: CORS });

    let recipientEmail: string | null = null;

    if (recipientId) {
      const { data: authData, error: authError } = await admin.auth.admin.getUserById(recipientId);
      recipientEmail = authData?.user?.email ?? null;
      console.log("5. recipient email:", recipientEmail ?? "none", authError?.message ?? "");
    } else {
      // Anonymous poster — fall back to listing_contacts email
      const { data: contactRow } = await admin
        .from("listing_contacts")
        .select("contact_email")
        .eq("listing_id", convo.listing_id)
        .maybeSingle();
      recipientEmail = contactRow?.contact_email ?? null;
      console.log("5. anonymous listing, contact_email:", recipientEmail ?? "none");
    }

    if (!recipientEmail) return new Response("No recipient email", { status: 200, headers: CORS });

    const [{ data: senderProfile }, { data: listing }, { data: requestRow }] = await Promise.all([
      admin.from("profiles").select("display_name").eq("id", record.sender_id).maybeSingle(),
      admin.from("listings").select("title").eq("id", convo.listing_id).maybeSingle(),
      admin.from("requests").select("title").eq("id", convo.listing_id).maybeSingle(),
    ]);

    const senderName = senderProfile?.display_name ?? "Someone";
    const listingTitle = listing?.title ?? requestRow?.title ?? "your post";
    console.log("6. sender name:", senderName, "listing title:", listingTitle, "sending to:", recipientEmail);

    const preview = record.body.length > 300 ? record.body.slice(0, 300) + "…" : record.body;
    const replyUrl = `https://ceilimelbourne.com/messages/${record.conversation_id}`;

    const emailPromise = fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Céilí Melbourne <noreply@ceilimelbourne.com>",
        to: [recipientEmail],
        subject: `${senderName} sent you a message on Céilí Melbourne`,
        headers: {
          "List-Unsubscribe": `<https://ceilimelbourne.com>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a">
            <p style="margin-bottom:8px">Hi there,</p>
            <p><strong>${senderName}</strong> sent you a message about <strong>${listingTitle}</strong> on Céilí Melbourne:</p>
            <blockquote style="border-left:3px solid #2d6a4f;margin:16px 0;padding:12px 16px;background:#f6f9f7;border-radius:0 8px 8px 0;color:#333;white-space:pre-wrap">${preview.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</blockquote>
            <a href="${replyUrl}" style="display:inline-block;background:#2d6a4f;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:8px">Reply in Céilí Melbourne</a>
            <p style="color:#999;font-size:12px;margin-top:32px">Céilí Melbourne · <a href="https://ceilimelbourne.com" style="color:#999">ceilimelbourne.com</a></p>
          </div>
        `,
      }),
    });

    const pushPromise = (async () => {
      if (!recipientId) return;
      const { data: tokens } = await admin
        .from("push_tokens")
        .select("token")
        .eq("user_id", recipientId);
      if (!tokens?.length) return;
      await Promise.all(
        tokens.map((t) =>
          sendApnsPush(t.token, {
            title: `New message from ${senderName}`,
            body: record.body.length > 100 ? record.body.slice(0, 100) + "…" : record.body,
            data: { conversationId: record.conversation_id },
          })
        )
      );
    })();

    const [emailRes] = await Promise.all([emailPromise, pushPromise]);
    const resendBody = await emailRes.text();
    console.log("7. Resend status:", emailRes.status, "body:", resendBody);

    if (!emailRes.ok) {
      return new Response("Email send failed", { status: 500, headers: CORS });
    }

    return new Response("OK", { status: 200, headers: CORS });
  } catch (e) {
    console.error("notify-message error:", e);
    return new Response("Internal error", { status: 500, headers: CORS });
  }
});
