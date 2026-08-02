import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Send, MessageCircle, ImagePlus, ExternalLink } from "lucide-react";
import BlockButton from "@/components/BlockButton";
import { useBlockedUsers } from "@/hooks/useBlockedUsers";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import UserAvatar from "@/components/UserAvatar";
import ScamWarning from "@/components/ScamWarning";
import { formatDistanceToNow } from "date-fns";

interface ConversationRow {
  id: string;
  listing_id: string;
  starter_id: string;
  owner_id: string | null;
  last_message_at: string;
}

interface ConvoView extends ConversationRow {
  listing_title: string;
  ref_is_request: boolean;
  other_id: string;
  other_name: string;
  other_avatar: string | null;
  last_body?: string;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

const Messages = () => {
  const { id: conversationId } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const { blockedIds, blockUser, unblockUser } = useBlockedUsers();
  const [convos, setConvos] = useState<ConvoView[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<ConvoView | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = "Messages - Céilí Brisbane";
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/auth"); return; }
    loadConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  const loadConversations = async () => {
    if (!user) return;
    setLoading(true);
    const { data: rows } = await supabase
      .from("conversations")
      .select("*")
      .order("last_message_at", { ascending: false });

    if (!rows || rows.length === 0) {
      setConvos([]);
      setLoading(false);
      return;
    }

    const allRefIds = Array.from(new Set(rows.map((r) => r.listing_id)));
    const otherIds = Array.from(new Set(
      rows.map((r) => (r.starter_id === user.id ? r.owner_id : r.starter_id)).filter((id): id is string => id !== null)
    ));

    const [{ data: listings }, { data: requests }, { data: profiles }] = await Promise.all([
      supabase.from("listings").select("id,title").in("id", allRefIds),
      supabase.from("requests").select("id,title").in("id", allRefIds),
      otherIds.length > 0
        ? supabase.from("profiles").select("id,display_name,avatar_url").in("id", otherIds)
        : Promise.resolve({ data: [] }),
    ]);

    const listingTitleById = new Map((listings ?? []).map((l): [string, string] => [l.id, l.title]));
    const requestTitleById = new Map((requests ?? []).map((r): [string, string] => [r.id, r.title]));
    const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

    const view: ConvoView[] = rows.map((r) => {
      const otherId = r.starter_id === user.id ? r.owner_id : r.starter_id;
      const p = otherId ? profileById.get(otherId) : null;
      const isRequest = !listingTitleById.has(r.listing_id) && requestTitleById.has(r.listing_id);
      return {
        ...r,
        listing_title: listingTitleById.get(r.listing_id) ?? requestTitleById.get(r.listing_id) ?? "Post",
        ref_is_request: isRequest,
        other_id: otherId ?? "",
        other_name: p?.display_name ?? (otherId ? "User" : "Anonymous poster"),
        other_avatar: p?.avatar_url ?? null,
      };
    });
    setConvos(view);
    setLoading(false);
  };

  // Pick active conversation
  useEffect(() => {
    if (!conversationId) { setActive(null); return; }
    const found = convos.find((c) => c.id === conversationId);
    if (found) setActive(found);
  }, [conversationId, convos]);

  // Load messages + subscribe
  useEffect(() => {
    if (!active) { setMessages([]); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", active.id)
        .order("created_at", { ascending: true });
      if (!cancelled) setMessages((data as Message[]) ?? []);
    })();

    const channel = supabase
      .channel(`messages-${active.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${active.id}` },
        (payload) => {
          setMessages((prev) => {
            const m = payload.new as Message;
            if (prev.some((p) => p.id === m.id)) return prev;
            return [...prev, m];
          });
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [active]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const sendImage = async (file: File) => {
    if (!user || !active) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Image too large", description: "Max size is 5 MB", variant: "destructive" });
      return;
    }
    setImageUploading(true);
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${active.id}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("chat-images").upload(path, file, { upsert: false });
    if (upErr) {
      toast({ title: "Couldn't upload image", description: upErr.message, variant: "destructive" });
      setImageUploading(false);
      return;
    }
    const { data: { publicUrl } } = supabase.storage.from("chat-images").getPublicUrl(path);
    const body = `__img__:${publicUrl}`;
    const { error } = await supabase.from("messages").insert({ conversation_id: active.id, sender_id: user.id, body });
    if (error) {
      toast({ title: "Couldn't send image", description: error.message, variant: "destructive" });
    } else {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session?.access_token) return;
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notify-message`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ record: { id: crypto.randomUUID(), conversation_id: active.id, sender_id: user.id, body } }),
        }).catch(() => {});
      });
    }
    setImageUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const send = async () => {
    if (!user || !active || !input.trim() || sending) return;
    setSending(true);
    const body = input.trim().slice(0, 4000);
    const { error } = await supabase.from("messages").insert({
      conversation_id: active.id,
      sender_id: user.id,
      body,
    });
    if (error) {
      toast({ title: "Couldn't send message", description: error.message, variant: "destructive" });
    } else {
      setInput("");
      // Fire-and-forget notification email (bypasses unreliable DB webhook)
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session?.access_token) return;
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notify-message`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            record: { id: crypto.randomUUID(), conversation_id: active.id, sender_id: user.id, body },
          }),
        }).catch(() => {});
      });
    }
    setSending(false);
  };

  return (
    <div className="flex min-h-screen flex-col bg-gradient-warm overflow-x-hidden">
      <SiteHeader />
      <main className="container flex-1 py-6 md:py-10">
        <h1 className="font-display text-3xl font-bold">Messages</h1>
        <p className="mt-1 text-sm text-muted-foreground">Chat with listing posters directly inside the app.</p>

        <div className="mt-6 grid gap-4 lg:grid-cols-[320px_1fr]">
          {/* Conversation list */}
          <aside className={`rounded-2xl border border-border bg-card shadow-card ${active ? "hidden lg:block" : ""}`}>
            {loading ? (
              <div className="p-4 text-sm text-muted-foreground">Loading…</div>
            ) : convos.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                <MessageCircle className="mx-auto mb-2 h-6 w-6" />
                No conversations yet. Open a listing and tap “Chat with poster”.
              </div>
            ) : (
              <ul className="divide-y divide-border max-h-80 overflow-y-auto">
                {convos.filter(c => !blockedIds.has(c.other_id)).map((c) => (
                  <li key={c.id}>
                    <Link
                      to={`/messages/${c.id}`}
                      className={`flex items-center gap-3 px-4 py-3 transition-smooth hover:bg-secondary/60 ${
                        active?.id === c.id ? "bg-secondary/60" : ""
                      }`}
                    >
                      <UserAvatar url={c.other_avatar} name={c.other_name} size={40} expandable />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate font-medium">{c.other_name}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(c.last_message_at), { addSuffix: true })}
                          </span>
                        </div>
                        <p className="truncate text-xs text-muted-foreground">Re: {c.listing_title}</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </aside>

          {/* Chat panel */}
          <section className={`flex min-h-[60vh] flex-col rounded-2xl border border-border bg-card shadow-card ${!active ? "hidden lg:flex" : "flex"}`}>
            {!active ? (
              <div className="m-auto p-8 text-center text-sm text-muted-foreground">
                Select a conversation to start chatting.
              </div>
            ) : (
              <>
                <header className="flex items-center gap-3 border-b border-border px-4 py-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="lg:hidden"
                    onClick={() => navigate("/messages")}
                    aria-label="Back"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <UserAvatar url={active.other_avatar} name={active.other_name} size={40} expandable />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{active.other_name}</p>
                    <p className="truncate text-xs text-muted-foreground">Re: {active.listing_title}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <BlockButton
                      blockedIds={blockedIds}
                      userId={active.other_id}
                      userName={active.other_name}
                      onBlock={blockUser}
                      onUnblock={unblockUser}
                    />
                    <Button asChild variant="outline" size="sm">
                      <Link
                        to={active.ref_is_request ? `/request/${active.listing_id}` : `/listing/${active.listing_id}`}
                        state={{ from: "messages", conversationId: active.id }}
                      >
                        <ExternalLink className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Back to post</span>
                      </Link>
                    </Button>
                  </div>
                </header>

                <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
                  <ScamWarning variant="compact" />
                  {messages.length === 0 && (
                    <p className="py-10 text-center text-sm text-muted-foreground">
                      Say hello - this conversation is just between you two.
                    </p>
                  )}
                  {messages.map((m) => {
                    const mine = m.sender_id === user?.id;
                    return (
                      <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[80%] rounded-2xl text-sm shadow-sm overflow-hidden ${
                            mine ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
                          } ${m.body.startsWith("__img__:") ? "p-1" : "px-3 py-2"}`}
                        >
                          {m.body.startsWith("__img__:") ? (
                            <img
                              src={m.body.slice(8)}
                              alt="shared image"
                              className="max-w-[260px] rounded-xl object-cover cursor-zoom-in"
                              onClick={() => window.open(m.body.slice(8), "_blank")}
                            />
                          ) : (
                            <p className="whitespace-pre-wrap break-words">{m.body}</p>
                          )}
                          <p className={`mt-1 px-1 text-[10px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                            {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <form
                  onSubmit={(e) => { e.preventDefault(); send(); }}
                  className="flex items-center gap-2 border-t border-border p-3"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) sendImage(f); }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={imageUploading}
                    aria-label="Send image"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <ImagePlus className="h-5 w-5 text-muted-foreground" />
                  </Button>
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Type a message…"
                    maxLength={4000}
                    autoFocus
                    className="text-base"
                  />
                  <Button type="submit" variant="hero" size="icon" disabled={!input.trim() || sending} aria-label="Send">
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </>
            )}
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
};

export default Messages;
