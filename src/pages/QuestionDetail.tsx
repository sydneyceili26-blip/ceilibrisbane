import { useEffect, useState } from "react";
import { useParams, Link, useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, Loader2, MessageCircle, Trash2, Pencil, Lock, CheckCircle2 } from "lucide-react";
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

interface Question { id: string; title: string; body: string; author_name: string | null; created_at: string }
interface Answer { id: string; body: string; author_name: string | null; created_at: string }

const replySchema = z.object({
  body: z.string().trim().min(2, "Reply is too short").max(4000),
});

const QuestionDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { state: navState } = useLocation();
  const { user } = useAuth();
  const { isModerator } = useUserRoles();
  const [question, setQuestion] = useState<Question | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
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
    const { data: qu, error } = await supabase.from("questions").select("*").eq("id", id).maybeSingle();
    if (error || !qu) { setNotFound(true); setLoading(false); return; }
    setQuestion(qu as Question);
    document.title = `${(qu as Question).title} - Céilí Brisbane`;
    const { data: ans } = await supabase
      .from("answers")
      .select("*")
      .eq("question_id", id)
      .order("created_at", { ascending: true });
    setAnswers((ans ?? []) as Answer[]);
    setLoading(false);
  };

  useEffect(() => { setLoading(true); load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  const onReply = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!id) return;
    const form = e.currentTarget;
    const f = new FormData(form);
    const parsed = replySchema.safeParse({ body: String(f.get("body") ?? "") });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setSubmitting(true);
    const authorName = (user?.user_metadata?.display_name as string | undefined) || null;
    const { data, error } = await supabase
      .from("answers")
      .insert({ question_id: id, body: parsed.data.body, author_name: authorName })
      .select("id")
      .single();
    setSubmitting(false);
    if (error) { toast.error("Couldn't post your reply."); return; }
    const newId = data?.id as string | undefined;
    if (newId) rememberMyPost("answer", newId);
    form.reset();
    setJustReplied(true);
    setTimeout(() => setJustReplied(false), 4000);
    await load();
    if (newId) {
      setHighlightId(newId);
      setTimeout(() => {
        document.getElementById(`answer-${newId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
      setTimeout(() => setHighlightId((curr) => (curr === newId ? null : curr)), 3000);
    }
  };

  const deleteQuestion = async () => {
    if (!question) return;
    if (!confirm("Delete this question and all its replies?")) return;
    const { error } = await supabase.from("questions").delete().eq("id", question.id);
    if (error) { toast.error("Couldn't delete."); return; }
    forgetMyPost("question", question.id);
    toast.success("Question deleted");
    navigate("/community");
  };

  const deleteAnswer = async (answerId: string) => {
    if (!confirm("Delete this reply?")) return;
    const { error } = await supabase.from("answers").delete().eq("id", answerId);
    if (error) { toast.error("Couldn't delete."); return; }
    forgetMyPost("answer", answerId);
    setAnswers((prev) => prev.filter((a) => a.id !== answerId));
    force((n) => n + 1);
    toast.success("Reply deleted");
  };

  const saveEdit = async (answerId: string) => {
    const trimmed = editBody.trim();
    if (trimmed.length < 2) { toast.error("Reply is too short"); return; }
    setSaving(true);
    const { error } = await supabase.from("answers").update({ body: trimmed }).eq("id", answerId);
    setSaving(false);
    if (error) { toast.error("Couldn't save edit."); return; }
    setAnswers((prev) => prev.map((a) => a.id === answerId ? { ...a, body: trimmed } : a));
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
          ) : (
            <Link to="/community" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Back to community
            </Link>
          )}

          {loading || !question ? (
            <div className="mt-6 h-40 animate-pulse rounded-2xl bg-secondary/60" />
          ) : (
            <>
              <article className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-card md:p-8">
                <div className="flex items-start justify-between gap-3">
                  <h1 className="font-display text-2xl font-bold md:text-3xl">{question.title}</h1>
                  {(isMyPost("question", question.id) || isModerator) && (
                    <div className="flex gap-2">
                      {isMyPost("question", question.id) && (
                        <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
                          <Link to={`/edit-question/${question.id}`}><Pencil className="h-4 w-4" /> Edit</Link>
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={deleteQuestion} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-4 w-4" /> Delete
                      </Button>
                    </div>
                  )}
                </div>
                {question.body && question.body.trim() !== question.title.trim() && (
                  <p className="mt-3 whitespace-pre-wrap text-foreground/90">{question.body}</p>
                )}
                <p className="mt-4 text-xs text-muted-foreground">
                  Asked by {question.author_name?.trim() || "Anonymous"} ·{" "}
                  {formatDistanceToNow(new Date(question.created_at), { addSuffix: true })}
                </p>
              </article>

              <h2 className="mt-10 flex items-center gap-2 font-display text-xl font-semibold">
                <MessageCircle className="h-5 w-5 text-primary" />
                {answers.length} {answers.length === 1 ? "reply" : "replies"}
              </h2>

              <ul className="mt-4 space-y-3">
                {answers.map((a) => (
                  <li
                    key={a.id}
                    id={`answer-${a.id}`}
                    className={`rounded-2xl border bg-card p-5 shadow-soft transition-all ${
                      highlightId === a.id ? "border-primary ring-2 ring-primary/40" : "border-border"
                    }`}
                  >
                    {highlightId === a.id && (
                      <p className="mb-2 text-xs font-medium text-primary">Your reply was posted</p>
                    )}
                    {editingId === a.id ? (
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
                          <Button size="sm" variant="hero" onClick={() => saveEdit(a.id)} disabled={saving}>
                            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                            {saving ? "Saving…" : "Save"}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => { setEditingId(null); setEditBody(""); }}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap text-sm text-foreground/90">{a.body}</p>
                    )}
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <p className="text-xs text-muted-foreground">
                        {a.author_name?.trim() || "Anonymous"} ·{" "}
                        {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                      </p>
                      {(isMyPost("answer", a.id) || isModerator) && editingId !== a.id && (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => { setEditingId(a.id); setEditBody(a.body); }} className="h-7 px-2 text-xs text-muted-foreground">
                            <Pencil className="h-3.5 w-3.5" /> Edit
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => deleteAnswer(a.id)} className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive">
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
                    <Label htmlFor="body">Your answer</Label>
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

export default QuestionDetail;
