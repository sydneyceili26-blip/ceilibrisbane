import { useEffect, useState } from "react";
import { useParams, Link, useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, Loader2, MessageCircle, Trash2, Pencil, Lock, CheckCircle2 } from "lucide-react";
import ChatWithPosterButton from "@/components/ChatWithPosterButton";
import { z } from "zod";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRoles } from "@/hooks/useUserRole";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import NotFound from "./NotFound";
import { rememberMyPost, forgetMyPost, isMyPost } from "@/lib/myPosts";

interface RegionalPost {
  id: string;
  title: string;
  body: string | null;
  author_name: string | null;
  category: string;
  region: string | null;
  created_at: string;
  owner_id: string | null;
  image_url: string | null;
  image_urls: string[];
  link_url: string | null;
}
interface RegionalReply {
  id: string;
  body: string;
  author_name: string | null;
  created_at: string;
}

const replySchema = z.object({
  body: z.string().trim().min(2, "Reply is too short").max(4000),
  author_name: z.string().trim().max(80).optional(),
});

const REGIONS: Record<string, string> = {
  nsw: "NSW / ACT", vic: "Victoria", qld: "Queensland",
  sa: "South Australia", wa: "Western Australia", tas: "Tasmania", nt: "Northern Territory",
};

const CATEGORY_COLOURS: Record<string, string> = {
  jobs: "bg-emerald-100 text-emerald-700",
  housing: "bg-sky-100 text-sky-700",
  general: "bg-amber-100 text-amber-700",
};
const CATEGORY_LABELS: Record<string, string> = {
  jobs: "Jobs", housing: "Accommodation", general: "General",
};

const RegionalPostDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { isModerator } = useUserRoles();
  const navigate = useNavigate();
  const { state: navState } = useLocation();
  const [post, setPost] = useState<RegionalPost | null>(null);
  const [replies, setReplies] = useState<RegionalReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [justReplied, setJustReplied] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [, force] = useState(0);

  const load = async () => {
    if (!id) return;
    const { data, error } = await supabase.from("regional_posts").select("*").eq("id", id).maybeSingle();
    if (error || !data) { setNotFound(true); setLoading(false); return; }
    setPost(data as RegionalPost);
    document.title = `${(data as RegionalPost).title} - Céilí Brisbane`;
    const { data: reps } = await supabase
      .from("regional_replies")
      .select("*")
      .eq("post_id", id)
      .order("created_at", { ascending: true });
    setReplies((reps ?? []) as RegionalReply[]);
    setLoading(false);
  };

  useEffect(() => { setLoading(true); load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  const onReply = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!id) return;
    const f = new FormData(e.currentTarget);
    const parsed = replySchema.safeParse({
      body: String(f.get("body") ?? ""),
      author_name: String(f.get("author_name") ?? ""),
    });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setSubmitting(true);
    const { data, error } = await supabase
      .from("regional_replies")
      .insert({ post_id: id, body: parsed.data.body, author_name: parsed.data.author_name || null })
      .select("id")
      .single();
    setSubmitting(false);
    if (error) { toast.error("Couldn't post your reply."); return; }
    const newId = data?.id as string | undefined;
    if (newId) rememberMyPost("regional_reply", newId);
    (e.currentTarget as HTMLFormElement).reset();
    setJustReplied(true);
    setTimeout(() => setJustReplied(false), 4000);
    await load();
    if (newId) {
      setHighlightId(newId);
      setTimeout(() => {
        document.getElementById(`reply-${newId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
      setTimeout(() => setHighlightId((curr) => (curr === newId ? null : curr)), 3000);
    }
  };

  const deletePost = async () => {
    if (!post) return;
    if (!confirm("Delete this post and all its replies?")) return;
    const { error } = await supabase.from("regional_posts").delete().eq("id", post.id);
    if (error) { toast.error("Couldn't delete."); return; }
    forgetMyPost("regional_post", post.id);
    toast.success("Post deleted");
    navigate("/regional");
  };

  const deleteReply = async (replyId: string) => {
    if (!confirm("Delete this reply?")) return;
    const { error } = await supabase.from("regional_replies").delete().eq("id", replyId);
    if (error) { toast.error("Couldn't delete."); return; }
    forgetMyPost("regional_reply", replyId);
    setReplies((prev) => prev.filter((r) => r.id !== replyId));
    force((n) => n + 1);
    toast.success("Reply deleted");
  };

  const saveEdit = async (replyId: string) => {
    const trimmed = editBody.trim();
    if (trimmed.length < 2) { toast.error("Reply is too short"); return; }
    setSaving(true);
    const { error } = await supabase.from("regional_replies").update({ body: trimmed }).eq("id", replyId);
    setSaving(false);
    if (error) { toast.error("Couldn't save edit."); return; }
    setReplies((prev) => prev.map((r) => r.id === replyId ? { ...r, body: trimmed } : r));
    setEditingId(null);
    setEditBody("");
    toast.success("Reply updated");
  };

  if (notFound) return <NotFound />;

  return (
    <div className="flex min-h-screen flex-col bg-gradient-warm">
      <SiteHeader />
      <main className="container flex-1 py-8 md:py-12">
        <div className="mx-auto max-w-2xl">
          {navState?.from === "admin" ? (
            <Link to="/admin" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Back to moderation
            </Link>
          ) : navState?.from === "my-posts" ? (
            <Link to="/my-posts" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> My posts
            </Link>
          ) : (
            <Link to="/regional" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Regional Work
            </Link>
          )}

          {loading || !post ? (
            <div className="mt-6 h-40 animate-pulse rounded-2xl bg-secondary/60" />
          ) : (
            <>
              <article className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-card md:p-8">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${CATEGORY_COLOURS[post.category] ?? "bg-secondary text-foreground"}`}>
                      {CATEGORY_LABELS[post.category] ?? post.category}
                    </span>
                    {post.region && (
                      <span className="text-xs text-muted-foreground">{REGIONS[post.region] ?? post.region}</span>
                    )}
                  </div>
                  {(user?.id === post.owner_id || isMyPost("regional_post", post.id) || isModerator) && (
                    <div className="flex gap-2">
                      <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
                        <Link to={`/edit-regional/${post.id}`}><Pencil className="h-4 w-4" /> Edit</Link>
                      </Button>
                      <Button variant="ghost" size="sm" onClick={deletePost} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-4 w-4" /> Delete
                      </Button>
                    </div>
                  )}
                </div>
                <h1 className="mt-3 font-display text-2xl font-bold md:text-3xl">{post.title}</h1>
                {post.body && (
                  <p className="mt-4 whitespace-pre-wrap text-foreground/90">{post.body}</p>
                )}
                {post.link_url && (
                  <a href={post.link_url} target="_blank" rel="noopener noreferrer"
                    className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
                    🔗 View link
                  </a>
                )}
                {(() => {
                  const imgs = post.image_urls?.length ? post.image_urls : post.image_url ? [post.image_url] : [];
                  return imgs.length > 0 ? (
                    <div className="mt-4 grid gap-2 grid-cols-2 sm:grid-cols-3">
                      {imgs.map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                          <img src={url} alt={`Photo ${i + 1}`} className="aspect-square w-full rounded-xl object-cover hover:opacity-90 transition-opacity" />
                        </a>
                      ))}
                    </div>
                  ) : null;
                })()}
                <p className="mt-4 text-xs text-muted-foreground">
                  Posted by {post.author_name?.trim() || "Anonymous"} ·{" "}
                  {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                </p>
              </article>

              {post.owner_id && user?.id !== post.owner_id && (
                <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-card">
                  <p className="mb-3 text-sm font-medium">Contact the poster</p>
                  {user ? (
                    <ChatWithPosterButton listingId={post.id} ownerId={post.owner_id} />
                  ) : (
                    <div className="rounded-lg border border-border bg-secondary/40 p-3">
                      <p className="flex items-center gap-2 text-xs font-medium">
                        <Lock className="h-3.5 w-3.5" /> Sign in to send a message
                      </p>
                      <Button asChild variant="hero" size="sm" className="mt-3 w-full">
                        <Link to="/auth">Sign in</Link>
                      </Button>
                    </div>
                  )}
                </div>
              )}

              <h2 className="mt-10 flex items-center gap-2 font-display text-xl font-semibold">
                <MessageCircle className="h-5 w-5 text-primary" />
                {replies.length} {replies.length === 1 ? "reply" : "replies"}
              </h2>

              <ul className="mt-4 space-y-3">
                {replies.map((r) => (
                  <li
                    key={r.id}
                    id={`reply-${r.id}`}
                    className={`rounded-2xl border bg-card p-5 shadow-soft transition-all ${
                      highlightId === r.id ? "border-primary ring-2 ring-primary/40" : "border-border"
                    }`}
                  >
                    {highlightId === r.id && (
                      <p className="mb-2 text-xs font-medium text-primary">Your reply was posted</p>
                    )}
                    {editingId === r.id ? (
                      <div className="space-y-2">
                        <Textarea
                          value={editBody}
                          onChange={(e) => setEditBody(e.target.value)}
                          rows={4}
                          maxLength={4000}
                          autoFocus
                          className="text-sm"
                        />
                        <div className="flex gap-2">
                          <Button size="sm" variant="hero" onClick={() => saveEdit(r.id)} disabled={saving}>
                            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                            {saving ? "Saving…" : "Save"}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => { setEditingId(null); setEditBody(""); }}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap text-sm text-foreground/90">{r.body}</p>
                    )}
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <p className="text-xs text-muted-foreground">
                        {r.author_name?.trim() || "Anonymous"} ·{" "}
                        {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                      </p>
                      {isMyPost("regional_reply", r.id) && editingId !== r.id && (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => { setEditingId(r.id); setEditBody(r.body); }} className="h-7 px-2 text-xs text-muted-foreground">
                            <Pencil className="h-3.5 w-3.5" /> Edit
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => deleteReply(r.id)} className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive">
                            <Trash2 className="h-3.5 w-3.5" /> Delete
                          </Button>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>

              {user ? (
                justReplied ? (
                  <div className="mt-8 rounded-2xl border border-primary/40 bg-primary/5 p-6 shadow-card text-center">
                    <CheckCircle2 className="mx-auto h-8 w-8 text-primary" />
                    <p className="mt-2 font-display text-lg font-semibold text-primary">Reply posted!</p>
                    <p className="mt-1 text-sm text-muted-foreground">Your reply is now showing above.</p>
                  </div>
                ) : (
                <form onSubmit={onReply} className="mt-8 space-y-4 rounded-2xl border border-border bg-card p-6 shadow-card">
                  <h3 className="font-display text-lg font-semibold">Add a reply</h3>
                  <div className="space-y-2">
                    <Label htmlFor="body">Your reply</Label>
                    <Textarea id="body" name="body" required rows={4} maxLength={4000} placeholder="Share what you know…" />
                  </div>
                  <Button type="submit" variant="hero" disabled={submitting}>
                    {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    {submitting ? "Posting…" : "Post reply"}
                  </Button>
                </form>
                )
              ) : (
                <div className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-card text-center">
                  <Lock className="mx-auto h-5 w-5 text-muted-foreground" />
                  <p className="mt-2 font-medium">Sign in to add a reply</p>
                  <Button asChild variant="hero" className="mt-4">
                    <Link to="/auth">Sign in / create account</Link>
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
};

export default RegionalPostDetail;
