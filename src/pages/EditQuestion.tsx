import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRoles } from "@/hooks/useUserRole";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { isMyPost } from "@/lib/myPosts";

const schema = z.object({
  title: z.string().trim().min(10, "Add a clearer question").max(160),
  author_name: z.string().trim().max(80).optional(),
});

const EditQuestion = () => {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const { isModerator, loading: rolesLoading } = useUserRoles();
  const navigate = useNavigate();
  const [defaults, setDefaults] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { document.title = "Edit question - Céilí Brisbane"; }, []);

  useEffect(() => {
    if (authLoading || rolesLoading) return;
    if (!user) { navigate("/auth"); return; }
    if (!isMyPost("question", id!) && !isModerator) { toast.error("You can't edit this question"); navigate("/community"); return; }
    (async () => {
      const { data, error } = await supabase.from("questions").select("*").eq("id", id!).maybeSingle();
      if (error || !data) { toast.error("Question not found"); navigate("/community"); return; }
      setDefaults({ title: data.title ?? "", author_name: data.author_name ?? "" });
      setLoading(false);
    })();
  }, [id, user, authLoading, rolesLoading, navigate]);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const parsed = schema.safeParse({
      title: String(f.get("title") ?? ""),
      author_name: String(f.get("author_name") ?? ""),
    });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setSubmitting(true);
    const { error } = await supabase.from("questions").update({
      title: parsed.data.title,
      body: parsed.data.title,
      author_name: parsed.data.author_name || null,
    }).eq("id", id!);
    setSubmitting(false);
    if (error) { toast.error("Couldn't save changes. Try again."); return; }
    toast.success("Changes saved");
    navigate(`/community/${id}`);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-gradient-warm">
        <SiteHeader />
        <main className="container flex-1 py-16 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-warm">
      <SiteHeader />
      <main className="container flex-1 py-8 md:py-12">
        <div className="mx-auto max-w-2xl">
          <Link to="/community" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Community
          </Link>
          <h1 className="mt-4 font-display text-3xl font-bold md:text-4xl">Edit question</h1>

          <form onSubmit={onSubmit} className="mt-8 space-y-5 rounded-2xl border border-border bg-card p-6 shadow-card md:p-8">
            <div className="space-y-2">
              <Label htmlFor="title">Question</Label>
              <Input id="title" name="title" required maxLength={160} defaultValue={defaults.title} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="author_name">Name <span className="text-muted-foreground">(optional)</span></Label>
              <Input id="author_name" name="author_name" maxLength={80} defaultValue={defaults.author_name} />
            </div>
            <Button type="submit" variant="hero" size="lg" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? "Saving…" : "Save changes"}
            </Button>
          </form>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
};

export default EditQuestion;
