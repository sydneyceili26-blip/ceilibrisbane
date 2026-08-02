import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Trash2, ShieldAlert, ExternalLink, Shield, ShieldOff, UserCog, History, CheckCircle, XCircle, Clock, BarChart2, MessageCircle } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRoles, type AppRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { logAdminAction, type AdminAction } from "@/lib/adminLog";

interface ReportRow {
  id: string;
  reason: string;
  details: string | null;
  created_at: string;
  listing_id: string;
  listing: { id: string; title: string; suburb: string | null } | null;
}

interface ListingRow {
  id: string;
  title: string;
  category: string;
  suburb: string | null;
  contact_name: string;
  owner_id: string | null;
  created_at: string;
}

interface UserRow {
  id: string;
  display_name: string | null;
  created_at: string;
  roles: AppRole[];
}

interface QuestionRow {
  id: string;
  title: string;
  author_name: string | null;
  created_at: string;
}

interface RegionalPostRow {
  id: string;
  title: string;
  category: string;
  region: string | null;
  author_name: string | null;
  created_at: string;
}

interface ActivityRow {
  id: string;
  actor_id: string;
  actor_name: string | null;
  action: AdminAction;
  target_type: string;
  target_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

interface PendingItem {
  id: string;
  title: string;
  type: "listing" | "request" | "question" | "regional_post";
  author: string | null;
  category: string | null;
  created_at: string;
  owner_id?: string | null;
}

const Admin = () => {
  const { user, loading: authLoading } = useAuth();
  const { isModerator, isAdmin, loading: roleLoading } = useUserRoles();
  const navigate = useNavigate();

  const [blocks, setBlocks] = useState<{ id: string; blocker_id: string; blocked_id: string; created_at: string; blocker_name: string | null; blocked_name: string | null }[]>([]);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [listings, setListings] = useState<ListingRow[]>([]);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [regionalPosts, setRegionalPosts] = useState<RegionalPostRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [pageViews, setPageViews] = useState<{ page: string; created_at: string }[]>([]);
  const [viewsToday, setViewsToday] = useState(0);
  const [viewsWeek, setViewsWeek] = useState(0);
  const [viewsMonth, setViewsMonth] = useState(0);
  const [dailyViews, setDailyViews] = useState<{ label: string; count: number }[]>([]);
  const [listingQuery, setListingQuery] = useState("");
  const [questionQuery, setQuestionQuery] = useState("");
  const [regionalQuery, setRegionalQuery] = useState("");
  const [userQuery, setUserQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Admin dashboard - Céilí Brisbane";
  }, []);

  const loadReports = async () => {
    const { data } = await supabase
      .from("reports")
      .select("id,reason,details,created_at,listing_id,listing:listings(id,title,suburb)")
      .order("created_at", { ascending: false });
    setReports((data as any) ?? []);
  };

  const loadListings = async () => {
    const { data } = await supabase
      .from("listings")
      .select("id,title,category,suburb,contact_name,owner_id,created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    setListings((data as any) ?? []);
  };

  const loadUsers = async () => {
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("id,display_name,created_at").order("created_at", { ascending: false }).limit(500),
      supabase.from("user_roles").select("user_id,role"),
    ]);
    const rolesByUser = new Map<string, AppRole[]>();
    (roles ?? []).forEach((r: any) => {
      rolesByUser.set(r.user_id, [...(rolesByUser.get(r.user_id) ?? []), r.role]);
    });
    setUsers(
      (profiles ?? []).map((p: any) => ({ ...p, roles: rolesByUser.get(p.id) ?? [] }))
    );
  };

  const loadQuestions = async () => {
    const { data } = await supabase
      .from("questions")
      .select("id,title,author_name,created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    setQuestions((data as any) ?? []);
  };

  const loadRegionalPosts = async () => {
    const { data } = await supabase
      .from("regional_posts")
      .select("id,title,category,region,author_name,created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    setRegionalPosts((data as any) ?? []);
  };

  const loadPending = async () => {
    const [{ data: pListings }, { data: pRequests }, { data: pQuestions }, { data: pRegional }] = await Promise.all([
      supabase.from("listings").select("id,title,category,contact_name,owner_id,created_at").eq("status", "pending").order("created_at", { ascending: true }),
      supabase.from("requests").select("id,title,category,contact_name,created_at").eq("status", "pending").order("created_at", { ascending: true }),
      supabase.from("questions").select("id,title,author_name,created_at").eq("status", "pending").order("created_at", { ascending: true }),
      supabase.from("regional_posts").select("id,title,category,author_name,created_at").eq("status", "pending").order("created_at", { ascending: true }),
    ]);
    const items: PendingItem[] = [
      ...((pListings ?? []) as any[]).map((r) => ({ id: r.id, title: r.title, type: "listing" as const, author: r.contact_name, category: r.category, created_at: r.created_at, owner_id: r.owner_id })),
      ...((pRequests ?? []) as any[]).map((r) => ({ id: r.id, title: r.title, type: "request" as const, author: r.contact_name, category: r.category, created_at: r.created_at })),
      ...((pQuestions ?? []) as any[]).map((r) => ({ id: r.id, title: r.title, type: "question" as const, author: r.author_name, category: null, created_at: r.created_at })),
      ...((pRegional ?? []) as any[]).map((r) => ({ id: r.id, title: r.title, type: "regional_post" as const, author: r.author_name, category: r.category, created_at: r.created_at })),
    ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    setPendingItems(items);
  };

  const loadBlocks = async () => {
    const { data: blockRows } = await supabase.from("blocked_users").select("id,blocker_id,blocked_id,created_at").order("created_at", { ascending: false }).limit(200);
    if (!blockRows?.length) { setBlocks([]); return; }
    const ids = Array.from(new Set([...blockRows.map((b: any) => b.blocker_id), ...blockRows.map((b: any) => b.blocked_id)]));
    const { data: profiles } = await supabase.from("profiles").select("id,display_name").in("id", ids);
    const nameById = new Map((profiles ?? []).map((p: any) => [p.id, p.display_name]));
    setBlocks(blockRows.map((b: any) => ({ ...b, blocker_name: nameById.get(b.blocker_id) ?? null, blocked_name: nameById.get(b.blocked_id) ?? null })));
  };

  const loadActivity = async () => {
    const { data } = await supabase
      .from("admin_activity_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    setActivity((data as any) ?? []);
  };

  const loadPageViews = async () => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday); startOfWeek.setDate(startOfWeek.getDate() - 6);
    const since30 = new Date(); since30.setDate(since30.getDate() - 30);

    const dayBoundaries = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(startOfToday); d.setDate(d.getDate() - (13 - i));
      const next = new Date(d); next.setDate(next.getDate() + 1);
      return { d, next, label: d.toLocaleDateString("en-AU", { day: "numeric", month: "short" }) };
    });

    const [summaryResults, dayResults, { data: rows }] = await Promise.all([
      Promise.all([
        supabase.from("page_views").select("*", { count: "exact", head: true }).gte("created_at", startOfToday.toISOString()),
        supabase.from("page_views").select("*", { count: "exact", head: true }).gte("created_at", startOfWeek.toISOString()),
        supabase.from("page_views").select("*", { count: "exact", head: true }).gte("created_at", since30.toISOString()),
      ]),
      Promise.all(
        dayBoundaries.map(({ d, next }) =>
          supabase.from("page_views").select("*", { count: "exact", head: true })
            .gte("created_at", d.toISOString())
            .lt("created_at", next.toISOString())
        )
      ),
      supabase.from("page_views").select("page,created_at").gte("created_at", since30.toISOString()).order("created_at", { ascending: false }),
    ]);

    const [{ count: today }, { count: week }, { count: month }] = summaryResults;
    setViewsToday(today ?? 0);
    setViewsWeek(week ?? 0);
    setViewsMonth(month ?? 0);
    setPageViews((rows as any) ?? []);
    setDailyViews(dayBoundaries.map(({ label }, i) => ({ label, count: dayResults[i].count ?? 0 })));
  };

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([
      loadReports(),
      loadListings(),
      loadQuestions(),
      loadRegionalPosts(),
      loadPending(),
      loadActivity(),
      loadPageViews(),
      loadBlocks(),
      isAdmin ? loadUsers() : Promise.resolve(),
    ]);
    setLoading(false);
  };

  useEffect(() => {
    if (isModerator) loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isModerator, isAdmin]);

  if (authLoading || roleLoading) {
    return (
      <div className="flex min-h-screen flex-col bg-gradient-warm">
        <SiteHeader />
        <main className="container flex-1 py-12"><p className="text-muted-foreground">Loading…</p></main>
        <SiteFooter />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (!isModerator) {
    return (
      <div className="flex min-h-screen flex-col bg-gradient-warm">
        <SiteHeader />
        <main className="container flex-1 py-12">
          <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-8 text-center">
            <ShieldAlert className="mx-auto h-10 w-10 text-muted-foreground" />
            <h1 className="mt-4 font-display text-xl font-semibold">Moderators only</h1>
            <p className="mt-2 text-sm text-muted-foreground">You don't have permission to access admin tools.</p>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const contactPoster = async (listingId: string, ownerId: string) => {
    if (!user) return;
    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .eq("listing_id", listingId)
      .eq("starter_id", user.id)
      .maybeSingle();
    if (existing?.id) { navigate(`/messages/${existing.id}`); return; }
    const { data: created, error } = await supabase
      .from("conversations")
      .insert({ listing_id: listingId, starter_id: user.id, owner_id: ownerId })
      .select("id")
      .single();
    if (error || !created) return toast({ title: "Couldn't start chat", description: error?.message, variant: "destructive" });
    navigate(`/messages/${created.id}`);
  };

  const dismissReport = async (r: ReportRow) => {
    const { error } = await supabase.from("reports").delete().eq("id", r.id);
    if (error) return toast({ title: "Couldn't dismiss", description: error.message, variant: "destructive" });
    await logAdminAction(user, "report_dismissed", "report", r.id, {
      reason: r.reason,
      listing_id: r.listing_id,
      listing_title: r.listing?.title,
    });
    toast({ title: "Report dismissed" });
    loadReports();
    loadActivity();
  };

  const removeListing = async (listing: { id: string; title?: string }) => {
    if (!confirm("Delete this listing? This cannot be undone.")) return;
    const { data: deleted, error } = await supabase.from("listings").delete().eq("id", listing.id).select("id");
    if (error) { console.error("Admin delete listing error:", error); return toast({ title: "Couldn't delete", description: error.message, variant: "destructive" }); }
    if (!deleted?.length) return toast({ title: "Couldn't delete", description: "No rows affected — check RLS permissions", variant: "destructive" });
    await logAdminAction(user, "listing_removed", "listing", listing.id, {
      title: listing.title ?? null,
    });
    toast({ title: "Listing removed" });
    loadListings();
    loadReports();
    loadActivity();
  };

  const removeQuestion = async (q: QuestionRow) => {
    if (!confirm("Delete this question and all its replies? This cannot be undone.")) return;
    const { error } = await supabase.from("questions").delete().eq("id", q.id);
    if (error) return toast({ title: "Couldn't delete", description: error.message, variant: "destructive" });
    await logAdminAction(user, "question_removed", "question", q.id, { title: q.title });
    toast({ title: "Question removed" });
    loadQuestions();
    loadActivity();
  };

  const removeRegionalPost = async (p: RegionalPostRow) => {
    if (!confirm("Delete this regional post? This cannot be undone.")) return;
    const { error } = await supabase.from("regional_posts").delete().eq("id", p.id);
    if (error) return toast({ title: "Couldn't delete", description: error.message, variant: "destructive" });
    await logAdminAction(user, "regional_post_removed", "regional_post", p.id, { title: p.title });
    toast({ title: "Regional post removed" });
    loadRegionalPosts();
    loadActivity();
  };

  const TABLE_FOR_TYPE: Record<PendingItem["type"], string> = {
    listing: "listings",
    request: "requests",
    question: "questions",
    regional_post: "regional_posts",
  };

  const approvePost = async (item: PendingItem) => {
    const { error } = await supabase.from(TABLE_FOR_TYPE[item.type]).update({ status: "approved" }).eq("id", item.id);
    if (error) return toast({ title: "Couldn't approve", description: error.message, variant: "destructive" });
    await logAdminAction(user, "post_approved", item.type as any, item.id, { title: item.title, type: item.type });
    supabase.functions.invoke("notify-post-decision", { body: { postId: item.id, postType: item.type, postTitle: item.title, authorName: item.author, decision: "approved" } });
    toast({ title: "Post approved", description: item.title });
    loadPending();
    loadActivity();
  };

  const rejectPost = async (item: PendingItem) => {
    if (!confirm(`Reject "${item.title}"? The poster will see it as rejected.`)) return;
    const { error } = await supabase.from(TABLE_FOR_TYPE[item.type]).update({ status: "rejected" }).eq("id", item.id);
    if (error) return toast({ title: "Couldn't reject", description: error.message, variant: "destructive" });
    await logAdminAction(user, "post_rejected", item.type as any, item.id, { title: item.title, type: item.type });
    supabase.functions.invoke("notify-post-decision", { body: { postId: item.id, postType: item.type, postTitle: item.title, authorName: item.author, decision: "rejected" } });
    toast({ title: "Post rejected" });
    loadPending();
    loadActivity();
  };

  const toggleRole = async (targetUser: UserRow, role: AppRole, hasRole: boolean) => {
    if (hasRole) {
      if (targetUser.id === user.id && role === "admin") {
        if (!confirm("Remove your own admin role? You will lose access.")) return;
      }
      const { error } = await supabase.from("user_roles").delete().eq("user_id", targetUser.id).eq("role", role);
      if (error) return toast({ title: "Couldn't update role", description: error.message, variant: "destructive" });
      await logAdminAction(user, "role_revoked", "user", targetUser.id, {
        role,
        target_name: targetUser.display_name,
      });
    } else {
      const { error } = await supabase.from("user_roles").insert({ user_id: targetUser.id, role });
      if (error) return toast({ title: "Couldn't update role", description: error.message, variant: "destructive" });
      await logAdminAction(user, "role_granted", "user", targetUser.id, {
        role,
        target_name: targetUser.display_name,
      });
    }
    toast({ title: "Role updated" });
    loadUsers();
    loadActivity();
  };

  const filteredListings = listings.filter((l) => {
    const q = listingQuery.toLowerCase().trim();
    if (!q) return true;
    return [l.title, l.suburb, l.contact_name, l.category].some((v) => v?.toLowerCase().includes(q));
  });

  const filteredQuestions = questions.filter((q) => {
    const s = questionQuery.toLowerCase().trim();
    if (!s) return true;
    return [q.title, q.author_name].some((v) => v?.toLowerCase().includes(s));
  });

  const filteredRegionalPosts = regionalPosts.filter((p) => {
    const s = regionalQuery.toLowerCase().trim();
    if (!s) return true;
    return [p.title, p.author_name, p.category, p.region].some((v) => v?.toLowerCase().includes(s));
  });

  const filteredUsers = users.filter((u) => {
    const q = userQuery.toLowerCase().trim();
    if (!q) return true;
    return (u.display_name ?? "").toLowerCase().includes(q) || u.id.toLowerCase().includes(q);
  });

  return (
    <div className="flex min-h-screen flex-col bg-gradient-warm">
      <SiteHeader />
      <main className="container flex-1 py-10">
        <h1 className="font-display text-3xl font-bold">Admin dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage reports, listings{isAdmin ? ", and users" : ""}.
        </p>

        <Tabs defaultValue="pending" className="mt-8">
          <TabsList className="flex-wrap">
            <TabsTrigger value="pending" className="gap-1.5">
              <Clock className="h-4 w-4" />
              Pending
              {pendingItems.length > 0 && (
                <span className="ml-1 rounded-full bg-yellow-500 px-1.5 py-0.5 text-xs font-bold text-white leading-none">
                  {pendingItems.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="reports">Reports ({reports.length})</TabsTrigger>
            <TabsTrigger value="listings">Listings ({listings.length})</TabsTrigger>
            <TabsTrigger value="questions">Questions ({questions.length})</TabsTrigger>
            <TabsTrigger value="regional">Regional ({regionalPosts.length})</TabsTrigger>
            {isAdmin && <TabsTrigger value="users">Users ({users.length})</TabsTrigger>}
            <TabsTrigger value="blocks">Blocks ({blocks.length})</TabsTrigger>
            <TabsTrigger value="activity"><History className="h-4 w-4 mr-1" /> Activity</TabsTrigger>
            <TabsTrigger value="analytics"><BarChart2 className="h-4 w-4 mr-1" /> Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-6 space-y-3">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : pendingItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
                <CheckCircle className="mx-auto h-8 w-8 text-emerald-500" />
                <p className="mt-3 font-display text-lg font-semibold">All clear!</p>
                <p className="mt-1 text-sm text-muted-foreground">No posts waiting for approval.</p>
              </div>
            ) : (
              pendingItems.map((item) => {
                const typeLabel: Record<PendingItem["type"], string> = {
                  listing: "Listing",
                  request: "Request",
                  question: "Question",
                  regional_post: "Regional post",
                };
                const viewHref: Record<PendingItem["type"], string> = {
                  listing: `/listing/${item.id}`,
                  request: `/request/${item.id}`,
                  question: `/community/${item.id}`,
                  regional_post: `/regional/${item.id}`,
                };
                return (
                  <div key={`${item.type}-${item.id}`} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{typeLabel[item.type]}</Badge>
                          {item.category && <Badge variant="secondary">{item.category}</Badge>}
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        <h3 className="mt-2 font-display text-lg font-semibold leading-snug">{item.title}</h3>
                        {item.author && (
                          <p className="mt-0.5 text-sm text-muted-foreground">by {item.author}</p>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {item.type === "listing" && item.owner_id && item.owner_id !== user?.id && (
                          <Button variant="outline" size="sm" title="Message poster" onClick={() => contactPoster(item.id, item.owner_id!)}>
                            <MessageCircle className="h-4 w-4" /> Message
                          </Button>
                        )}
                        <Button asChild variant="outline" size="sm">
                          <Link to={viewHref[item.type]} state={{ from: "admin" }}><ExternalLink className="h-4 w-4" /> View</Link>
                        </Button>
                        <Button variant="default" size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => approvePost(item)}>
                          <CheckCircle className="h-4 w-4" /> Approve
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => rejectPost(item)}>
                          <XCircle className="h-4 w-4" /> Reject
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </TabsContent>

          <TabsContent value="reports" className="mt-6 space-y-3">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : reports.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
                <p className="text-sm text-muted-foreground">No open reports. ☘</p>
              </div>
            ) : (
              reports.map((r) => (
                <div key={r.id} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive">{r.reason}</span>
                        <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</span>
                      </div>
                      <h3 className="mt-2 font-display text-lg font-semibold">{r.listing?.title ?? "(listing already removed)"}</h3>
                      {r.listing?.suburb && <p className="text-xs text-muted-foreground">{r.listing.suburb}</p>}
                      {r.details && <p className="mt-2 text-sm text-muted-foreground">{r.details}</p>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {r.listing && (
                        <Button asChild variant="outline" size="sm">
                          <Link to={`/listing/${r.listing.id}`}><ExternalLink className="h-4 w-4" /> View</Link>
                        </Button>
                      )}
                      {r.listing && (
                        <Button variant="destructive" size="sm" onClick={() => removeListing({ id: r.listing!.id, title: r.listing!.title })}>
                          <Trash2 className="h-4 w-4" /> Remove listing
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => dismissReport(r)}>Dismiss</Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="listings" className="mt-6">
            <Input
              placeholder="Search by title, suburb, contact, category…"
              value={listingQuery}
              onChange={(e) => setListingQuery(e.target.value)}
              className="mb-4 max-w-md"
            />
            <div className="rounded-2xl border border-border bg-card shadow-soft">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead className="hidden md:table-cell">Category</TableHead>
                    <TableHead className="hidden md:table-cell">Suburb</TableHead>
                    <TableHead className="hidden sm:table-cell">Posted</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredListings.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground">No listings</TableCell></TableRow>
                  ) : filteredListings.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium">{l.title}</TableCell>
                      <TableCell className="hidden md:table-cell"><Badge variant="secondary">{l.category}</Badge></TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">{l.suburb ?? "-"}</TableCell>
                      <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">{formatDistanceToNow(new Date(l.created_at), { addSuffix: true })}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {l.owner_id && l.owner_id !== user?.id && (
                            <Button variant="outline" size="sm" title="Message poster" onClick={() => contactPoster(l.id, l.owner_id!)}>
                              <MessageCircle className="h-4 w-4" />
                            </Button>
                          )}
                          <Button asChild variant="outline" size="sm">
                            <Link to={`/listing/${l.id}`}><ExternalLink className="h-4 w-4" /></Link>
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => removeListing({ id: l.id, title: l.title })}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="questions" className="mt-6">
            <Input
              placeholder="Search by title or author…"
              value={questionQuery}
              onChange={(e) => setQuestionQuery(e.target.value)}
              className="mb-4 max-w-md"
            />
            <div className="rounded-2xl border border-border bg-card shadow-soft">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Question</TableHead>
                    <TableHead className="hidden sm:table-cell">Author</TableHead>
                    <TableHead className="hidden md:table-cell">Posted</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredQuestions.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground">No questions</TableCell></TableRow>
                  ) : filteredQuestions.map((q) => (
                    <TableRow key={q.id}>
                      <TableCell className="font-medium">{q.title}</TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">{q.author_name ?? "Anonymous"}</TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{formatDistanceToNow(new Date(q.created_at), { addSuffix: true })}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button asChild variant="outline" size="sm">
                            <Link to={`/community/${q.id}`}><ExternalLink className="h-4 w-4" /></Link>
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => removeQuestion(q)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="regional" className="mt-6">
            <Input
              placeholder="Search by title, author, category…"
              value={regionalQuery}
              onChange={(e) => setRegionalQuery(e.target.value)}
              className="mb-4 max-w-md"
            />
            <div className="rounded-2xl border border-border bg-card shadow-soft">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead className="hidden md:table-cell">Category</TableHead>
                    <TableHead className="hidden sm:table-cell">Author</TableHead>
                    <TableHead className="hidden md:table-cell">Posted</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRegionalPosts.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground">No regional posts</TableCell></TableRow>
                  ) : filteredRegionalPosts.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.title}</TableCell>
                      <TableCell className="hidden md:table-cell"><Badge variant="secondary">{p.category}</Badge></TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">{p.author_name ?? "Anonymous"}</TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button asChild variant="outline" size="sm">
                            <Link to={`/regional/${p.id}`}><ExternalLink className="h-4 w-4" /></Link>
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => removeRegionalPost(p)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {isAdmin && (
            <TabsContent value="users" className="mt-6">
              <Input
                placeholder="Search by name or user id…"
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                className="mb-4 max-w-md"
              />
              <div className="rounded-2xl border border-border bg-card shadow-soft">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Roles</TableHead>
                      <TableHead className="hidden sm:table-cell">Joined</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground">No users</TableCell></TableRow>
                    ) : filteredUsers.map((u) => {
                      const isAdminRow = u.roles.includes("admin");
                      const isModRow = u.roles.includes("moderator");
                      return (
                        <TableRow key={u.id}>
                          <TableCell>
                            <div className="font-medium">{u.display_name ?? "(no name)"}</div>
                            <div className="text-xs text-muted-foreground font-mono">{u.id.slice(0, 8)}…</div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {u.roles.length === 0 && <Badge variant="outline">user</Badge>}
                              {u.roles.map((r) => (
                                <Badge key={r} variant={r === "admin" ? "default" : "secondary"}>{r}</Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">{formatDistanceToNow(new Date(u.created_at), { addSuffix: true })}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="outline" size="sm" onClick={() => toggleRole(u, "moderator", isModRow)} title={isModRow ? "Remove moderator" : "Make moderator"}>
                                <UserCog className="h-4 w-4" /> {isModRow ? "Unmod" : "Mod"}
                              </Button>
                              <Button variant={isAdminRow ? "destructive" : "default"} size="sm" onClick={() => toggleRole(u, "admin", isAdminRow)}>
                                {isAdminRow ? <><ShieldOff className="h-4 w-4" /> Revoke admin</> : <><Shield className="h-4 w-4" /> Make admin</>}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">User accounts themselves can only be deleted from Lovable Cloud's backend dashboard for safety.</p>
            </TabsContent>
          )}

          <TabsContent value="blocks" className="mt-6">
            <div className="rounded-2xl border border-border bg-card shadow-soft">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Blocked by</TableHead>
                    <TableHead>Blocked user</TableHead>
                    <TableHead className="hidden sm:table-cell">When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {blocks.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="text-center text-sm text-muted-foreground">No blocks yet</TableCell></TableRow>
                  ) : blocks.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="text-sm">{b.blocker_name ?? b.blocker_id.slice(0, 8)}</TableCell>
                      <TableCell className="text-sm font-medium">{b.blocked_name ?? b.blocked_id.slice(0, 8)}</TableCell>
                      <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">{formatDistanceToNow(new Date(b.created_at), { addSuffix: true })}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Each block hides that user's content from the blocker's feed. Review blocked users and take action within 24 hours of any report.</p>
          </TabsContent>

          <TabsContent value="activity" className="mt-6">
            <div className="rounded-2xl border border-border bg-card shadow-soft">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead className="hidden md:table-cell">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activity.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground">No activity yet</TableCell></TableRow>
                  ) : activity.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                      </TableCell>
                      <TableCell className="text-sm">{a.actor_name ?? a.actor_id.slice(0, 8)}</TableCell>
                      <TableCell>
                        <Badge variant={a.action.includes("removed") || a.action.includes("revoked") ? "destructive" : "secondary"}>
                          {a.action.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="text-muted-foreground">{a.target_type}</div>
                        <div className="font-mono">{a.target_id?.slice(0, 8) ?? "-"}</div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground max-w-md truncate">
                        {a.details ? JSON.stringify(a.details) : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="mt-6">
            {(() => {
              const days = dailyViews;
              const maxDay = Math.max(...days.map(d => d.count), 1);

              // top pages from fetched rows (approximation from most recent 1000 views)
              const pageCounts: Record<string, number> = {};
              pageViews.forEach(v => { pageCounts[v.page] = (pageCounts[v.page] ?? 0) + 1; });
              const topPages = Object.entries(pageCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);

              return (
                <div className="space-y-6">
                  <div className="grid gap-4 sm:grid-cols-3">
                    {[
                      { label: "Views today", value: viewsToday },
                      { label: "Views this week", value: viewsWeek },
                      { label: "Views last 30 days", value: viewsMonth },
                    ].map(s => (
                      <div key={s.label} className="rounded-2xl border border-border bg-card p-5 shadow-soft text-center">
                        <p className="text-3xl font-bold font-display">{s.value}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{s.label}</p>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
                    <h3 className="font-display font-semibold mb-4">Daily page views (last 14 days)</h3>
                    <div className="flex items-end gap-1 h-32">
                      {days.map(d => (
                        <div key={d.label} className="flex flex-1 flex-col items-center gap-1">
                          <span className="text-[10px] text-muted-foreground">{d.count || ""}</span>
                          <div
                            className="w-full rounded-t bg-primary/70 transition-all"
                            style={{ height: `${(d.count / maxDay) * 96}px`, minHeight: d.count ? 4 : 0 }}
                          />
                          <span className="text-[9px] text-muted-foreground rotate-0 leading-tight text-center">{d.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border bg-card shadow-soft">
                    <div className="p-5 border-b border-border">
                      <h3 className="font-display font-semibold">Top pages (last 30 days)</h3>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Page</TableHead>
                          <TableHead className="text-right">Views</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {topPages.length === 0 ? (
                          <TableRow><TableCell colSpan={2} className="text-center text-sm text-muted-foreground">No data yet</TableCell></TableRow>
                        ) : topPages.map(([page, count]) => (
                          <TableRow key={page}>
                            <TableCell className="font-mono text-sm">{page}</TableCell>
                            <TableCell className="text-right font-semibold">{count}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              );
            })()}
          </TabsContent>
        </Tabs>
      </main>
      <SiteFooter />
    </div>
  );
};

export default Admin;
