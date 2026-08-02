import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { rememberMyPost } from "@/lib/myPosts";

const schema = z.object({
  title: z.string().trim().min(10, "Add a clearer question").max(160),
});

const AskQuestion = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { document.title = "Ask the community - Céilí Brisbane"; }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) navigate("/auth");
  }, [user, authLoading, navigate]);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const parsed = schema.safeParse({ title: String(f.get("title") ?? "") });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setSubmitting(true);
    const v = parsed.data;
    const authorName = (user?.user_metadata?.display_name as string | undefined) || null;
    const { data, error } = await supabase
      .from("questions")
      .insert({ title: v.title, body: v.title, author_name: authorName })
      .select("id")
      .single();
    setSubmitting(false);
    if (error) { toast.error("Couldn't post - try again."); return; }
    rememberMyPost("question", data.id);
    toast.success("Question submitted — an admin will review it shortly.");
    supabase.functions.invoke("notify-new-post", { body: { title: v.title, type: "question", authorName, authorUserId: user?.id ?? null } });
    navigate("/my-posts");
  };

  return (
    <div className="flex min-h-screen flex-col bg-gradient-warm">
      <SiteHeader />
      <main className="container flex-1 py-8 md:py-12">
        <div className="mx-auto max-w-2xl">
          <Link to="/community" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Community
          </Link>
          <h1 className="mt-4 font-display text-3xl font-bold md:text-4xl">Ask the community</h1>
          <p className="mt-2 text-muted-foreground">Ask anything — the community is here to help.</p>

          <form onSubmit={onSubmit} className="mt-8 space-y-5 rounded-2xl border border-border bg-card p-6 shadow-card md:p-8">
            <div className="space-y-2">
              <Label htmlFor="title">Question</Label>
              <Input id="title" name="title" required maxLength={160} placeholder="e.g. Best suburb for someone new working in the CBD?" />
            </div>
            <Button type="submit" variant="hero" size="lg" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? "Posting…" : "Post question"}
            </Button>
          </form>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
};

export default AskQuestion;
