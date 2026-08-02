import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type NotifItem =
  | {
      kind: "answer";
      id: string;
      questionId: string;
      questionTitle: string;
      author: string;
      snippet: string;
      createdAt: string;
    }
  | {
      kind: "message";
      id: string;
      conversationId: string;
      listingTitle: string;
      author: string;
      snippet: string;
      createdAt: string;
    };

const LS = {
  seenAnswers: "ceili.notif.seenAnswersAt",
  seenMessages: "ceili.notif.seenMessagesAt",
  pushAsked: "ceili.notif.pushAsked",
};

const readMyQuestions = (): string[] => {
  try {
    const raw = localStorage.getItem("ceili.myQuestions");
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
};

const getSeen = (key: string) => {
  const v = localStorage.getItem(key);
  return v ? new Date(v) : new Date(0);
};

const showPush = (title: string, body: string, tag?: string) => {
  if (typeof window === "undefined") return;
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, icon: "/favicon.png", tag: tag ?? title });
  } catch {
    /* ignore */
  }
};

// Keep only the latest message per conversation
const collapseMessages = (list: NotifItem[]): NotifItem[] => {
  const seen = new Set<string>();
  const out: NotifItem[] = [];
  for (const n of list) {
    if (n.kind === "message") {
      if (seen.has(n.conversationId)) continue;
      seen.add(n.conversationId);
    }
    out.push(n);
  }
  return out;
};

export const useNotifications = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<NotifItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const seenAnswersRef = useRef<Date>(getSeen(LS.seenAnswers));
  const seenMessagesRef = useRef<Date>(getSeen(LS.seenMessages));

  const recompute = useCallback((all: NotifItem[]) => {
    const sa = seenAnswersRef.current;
    const sm = seenMessagesRef.current;
    const unread = all.filter((n) =>
      n.kind === "answer"
        ? new Date(n.createdAt) > sa
        : new Date(n.createdAt) > sm
    ).length;
    setUnreadCount(unread);
  }, []);

  const load = useCallback(async () => {
    const myQuestions = readMyQuestions();
    const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString();
    const next: NotifItem[] = [];

    if (myQuestions.length) {
      const { data: ans } = await supabase
        .from("answers")
        .select("id, body, author_name, created_at, question_id")
        .in("question_id", myQuestions)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(30);
      if (ans && ans.length) {
        const qIds = Array.from(new Set(ans.map((a) => a.question_id)));
        const { data: qs } = await supabase
          .from("questions")
          .select("id,title")
          .in("id", qIds);
        const tById = new Map((qs ?? []).map((q) => [q.id, q.title]));
        ans.forEach((a) => {
          next.push({
            kind: "answer",
            id: a.id,
            questionId: a.question_id,
            questionTitle: tById.get(a.question_id) ?? "Your question",
            author: a.author_name?.trim() || "Anonymous",
            snippet: a.body.slice(0, 120),
            createdAt: a.created_at,
          });
        });
      }
    }

    if (user) {
      const { data: convos } = await supabase
        .from("conversations")
        .select("id,listing_id,starter_id,owner_id");
      if (convos && convos.length) {
        const convoIds = convos.map((c) => c.id);
        const listingIds = Array.from(new Set(convos.map((c) => c.listing_id)));
        const [{ data: msgs }, { data: listings }] = await Promise.all([
          supabase
            .from("messages")
            .select("id, conversation_id, sender_id, body, created_at")
            .in("conversation_id", convoIds)
            .neq("sender_id", user.id)
            .gte("created_at", since)
            .order("created_at", { ascending: false })
            .limit(30),
          supabase.from("listings").select("id,title").in("id", listingIds),
        ]);
        const titleById = new Map((listings ?? []).map((l) => [l.id, l.title]));
        const convoById = new Map(convos.map((c) => [c.id, c]));
        const senderIds = Array.from(new Set((msgs ?? []).map((m) => m.sender_id)));
        const { data: profs } = senderIds.length
          ? await supabase.from("profiles").select("id,display_name").in("id", senderIds)
          : { data: [] as { id: string; display_name: string | null }[] };
        const nameById = new Map((profs ?? []).map((p) => [p.id, p.display_name]));
        (msgs ?? []).forEach((m) => {
          const c = convoById.get(m.conversation_id);
          next.push({
            kind: "message",
            id: m.id,
            conversationId: m.conversation_id,
            listingTitle: (c && titleById.get(c.listing_id)) || "Listing",
            author: nameById.get(m.sender_id) || "Someone",
            snippet: m.body.slice(0, 120),
            createdAt: m.created_at,
          });
        });
      }
    }

    next.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    const collapsed = collapseMessages(next).slice(0, 40);
    setItems(collapsed);
    recompute(collapsed);
  }, [user, recompute]);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime subscriptions
  useEffect(() => {
    const channel = supabase
      .channel("notif-feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "answers" },
        async (payload) => {
          const row = payload.new as {
            id: string;
            question_id: string;
            body: string;
            author_name: string | null;
            created_at: string;
          };
          if (!readMyQuestions().includes(row.question_id)) return;
          const { data: q } = await supabase
            .from("questions")
            .select("title")
            .eq("id", row.question_id)
            .maybeSingle();
          const item: NotifItem = {
            kind: "answer",
            id: row.id,
            questionId: row.question_id,
            questionTitle: q?.title ?? "Your question",
            author: row.author_name?.trim() || "Anonymous",
            snippet: row.body.slice(0, 120),
            createdAt: row.created_at,
          };
          setItems((prev) => {
            if (prev.some((p) => p.id === item.id)) return prev;
            const next = collapseMessages([item, ...prev]).slice(0, 40);
            recompute(next);
            return next;
          });
          showPush("New reply to your question", `${item.author}: ${item.snippet}`, `answer-${item.questionId}`);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [recompute]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notif-msg-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        async (payload) => {
          const row = payload.new as {
            id: string;
            conversation_id: string;
            sender_id: string;
            body: string;
            created_at: string;
          };
          if (row.sender_id === user.id) return;
          // Verify it's one of our conversations (RLS should already filter, but double-check)
          const { data: c } = await supabase
            .from("conversations")
            .select("id,listing_id,starter_id,owner_id")
            .eq("id", row.conversation_id)
            .maybeSingle();
          if (!c) return;
          const [{ data: l }, { data: p }] = await Promise.all([
            supabase.from("listings").select("title").eq("id", c.listing_id).maybeSingle(),
            supabase.from("profiles").select("display_name").eq("id", row.sender_id).maybeSingle(),
          ]);
          const item: NotifItem = {
            kind: "message",
            id: row.id,
            conversationId: row.conversation_id,
            listingTitle: l?.title ?? "Listing",
            author: p?.display_name || "Someone",
            snippet: row.body.slice(0, 120),
            createdAt: row.created_at,
          };
          setItems((prev) => {
            if (prev.some((p) => p.id === item.id)) return prev;
            // Remove older entries for the same conversation, then collapse
            const filtered = prev.filter(
              (p) => !(p.kind === "message" && p.conversationId === item.conversationId)
            );
            const next = collapseMessages([item, ...filtered]).slice(0, 40);
            recompute(next);
            return next;
          });
          showPush(`New message from ${item.author}`, item.snippet, `convo-${item.conversationId}`);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, recompute]);

  const markAllRead = useCallback(() => {
    const now = new Date().toISOString();
    localStorage.setItem(LS.seenAnswers, now);
    localStorage.setItem(LS.seenMessages, now);
    seenAnswersRef.current = new Date(now);
    seenMessagesRef.current = new Date(now);
    setUnreadCount(0);
  }, []);

  const requestPushPermission = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
    if (Notification.permission === "granted" || Notification.permission === "denied") {
      return Notification.permission;
    }
    localStorage.setItem(LS.pushAsked, "1");
    return await Notification.requestPermission();
  }, []);

  return { items, unreadCount, markAllRead, requestPushPermission, refresh: load };
};
