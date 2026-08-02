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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ImageUploader from "@/components/ImageUploader";
import { toast } from "sonner";

const schema = z.object({
  title: z.string().trim().min(5, "Add a clearer title").max(160),
  body: z.string().trim().min(10, "Add a bit more detail").max(4000),
  author_name: z.string().trim().max(80).optional(),
  category: z.enum(["jobs", "housing", "general"]),
  region: z.string().optional(),
});

const REGIONS = [
  { key: "nsw", label: "NSW / ACT" },
  { key: "vic", label: "Victoria" },
  { key: "qld", label: "Queensland" },
  { key: "sa", label: "South Australia" },
  { key: "wa", label: "Western Australia" },
  { key: "tas", label: "Tasmania" },
  { key: "nt", label: "Northern Territory" },
];

const EditRegionalPost = () => {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const { isModerator, loading: rolesLoading } = useUserRoles();
  const navigate = useNavigate();

  const [category, setCategory] = useState<"jobs" | "housing" | "general">("jobs");
  const [region, setRegion] = useState<string>("");
  const [images, setImages] = useState<string[]>([]);
  const [defaults, setDefaults] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { document.title = "Edit regional post - Céilí Brisbane"; }, []);

  useEffect(() => {
    if (authLoading || rolesLoading) return;
    if (!user) { navigate("/auth"); return; }
    (async () => {
      const { data, error } = await supabase.from("regional_posts").select("*").eq("id", id!).maybeSingle();
      if (error || !data) { toast.error("Post not found"); navigate("/my-posts"); return; }
      if (data.owner_id !== user.id && !isModerator) { toast.error("You can't edit this post"); navigate("/my-posts"); return; }
      setCategory(data.category as typeof category);
      setRegion(data.region ?? "");
      setImages(data.image_urls ?? (data.image_url ? [data.image_url] : []));
      setDefaults({
        title: data.title ?? "",
        body: data.body ?? "",
        author_name: data.author_name ?? "",
        link_url: data.link_url ?? "",
      });
      setLoading(false);
    })();
  }, [id, user, authLoading, rolesLoading, navigate]);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const parsed = schema.safeParse({
      title: String(f.get("title") ?? ""),
      body: String(f.get("body") ?? ""),
      author_name: String(f.get("author_name") ?? ""),
      category,
      region: region || undefined,
    });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }

    setSubmitting(true);
    const { error } = await supabase.from("regional_posts").update({
      title: parsed.data.title,
      body: parsed.data.body,
      author_name: parsed.data.author_name || null,
      category: parsed.data.category,
      region: parsed.data.region || null,
      image_url: images[0] ?? null,
      image_urls: images,
      link_url: String(f.get("link_url") ?? "") || null,
    }).eq("id", id!);
    setSubmitting(false);

    if (error) { toast.error("Couldn't save changes. Try again."); return; }
    toast.success("Changes saved");
    navigate(`/regional/${id}`);
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
          <Link to="/my-posts" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> My posts
          </Link>
          <h1 className="mt-4 font-display text-3xl font-bold md:text-4xl">Edit regional post</h1>

          <form onSubmit={onSubmit} className="mt-8 space-y-5 rounded-2xl border border-border bg-card p-6 shadow-card md:p-8">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={category} onValueChange={(v) => setCategory(v as typeof category)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="jobs">Jobs</SelectItem>
                    <SelectItem value="housing">Accommodation</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>State / Region <span className="text-muted-foreground">(optional)</span></Label>
                <Select value={region} onValueChange={setRegion}>
                  <SelectTrigger><SelectValue placeholder="Select a region" /></SelectTrigger>
                  <SelectContent>
                    {REGIONS.map((r) => (
                      <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" required maxLength={160} defaultValue={defaults.title} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="body">Details</Label>
              <Textarea id="body" name="body" required rows={6} maxLength={4000} defaultValue={defaults.body} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="author_name">Your name <span className="text-muted-foreground">(optional)</span></Label>
              <Input id="author_name" name="author_name" maxLength={80} defaultValue={defaults.author_name} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="link_url">Link <span className="text-muted-foreground">(optional)</span></Label>
              <Input id="link_url" name="link_url" type="url" placeholder="https://..." defaultValue={defaults.link_url} />
            </div>

            <div className="space-y-2">
              <Label>Photos <span className="text-muted-foreground">(optional)</span></Label>
              <ImageUploader value={images} onChange={setImages} />
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

export default EditRegionalPost;
