import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Loader2 } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
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

const PostRegional = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [category, setCategory] = useState<"jobs" | "housing" | "general">("jobs");
  const [region, setRegion] = useState<string>("");
  const [images, setImages] = useState<string[]>([]);

  useEffect(() => { document.title = "Post to Regional Work - Céilí Brisbane"; }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) navigate("/auth");
  }, [user, authLoading, navigate]);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const parsed = schema.safeParse({
      title: String(f.get("title") ?? ""),
      body: String(f.get("body") ?? ""),
      category,
      region: region || undefined,
    });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setSubmitting(true);
    const v = parsed.data;
    const authorName = (user?.user_metadata?.display_name as string | undefined) || null;
    const { data, error } = await supabase
      .from("regional_posts")
      .insert({
        title: v.title,
        body: v.body,
        author_name: authorName,
        category: v.category,
        region: v.region || null,
        owner_id: user?.id ?? null,
        image_url: images[0] ?? null,
        image_urls: images,
        link_url: String(f.get("link_url") ?? "") || null,
      })
      .select("id")
      .single();
    setSubmitting(false);
    if (error) { toast.error("Couldn't post — try again."); return; }
    toast.success("Post submitted — an admin will review it shortly.");
    supabase.functions.invoke("notify-new-post", { body: { title: v.title, type: "regional_post", authorName, authorUserId: user?.id ?? null } });
    navigate("/my-posts");
  };

  return (
    <div className="flex min-h-screen flex-col bg-gradient-warm">
      <SiteHeader />
      <main className="container flex-1 py-8 md:py-12">
        <div className="mx-auto max-w-2xl">
          <Link to="/regional" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Regional Work
          </Link>
          <h1 className="mt-4 font-display text-3xl font-bold md:text-4xl">Post to Regional Work</h1>
          <p className="mt-2 text-muted-foreground">Posts are reviewed by an admin before going live.</p>

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
              <Input
                id="title"
                name="title"
                required
                maxLength={160}
                placeholder={
                  category === "jobs"
                    ? "e.g. Fruit picking work available in Mildura — start ASAP"
                    : category === "housing"
                    ? "e.g. Room available for regional workers near Griffith"
                    : "e.g. Tips for finding 88-day farm work in QLD?"
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="body">Details</Label>
              <Textarea
                id="body"
                name="body"
                required
                rows={6}
                maxLength={4000}
                placeholder={
                  category === "jobs"
                    ? "Describe the role, pay, hours, visa eligibility, location, how to apply and any other details."
                    : category === "housing"
                    ? "Describe the accommodation, cost, distance from work, what's included and how to get in touch."
                    : "Share what you know — the more detail the better."
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="link_url">Link <span className="text-muted-foreground">(optional)</span></Label>
              <Input id="link_url" name="link_url" type="url" placeholder="https://..." />
            </div>

            <div className="space-y-2">
              <Label>Photos <span className="text-muted-foreground">(optional)</span></Label>
              <ImageUploader value={images} onChange={setImages} />
            </div>

            <Button type="submit" variant="hero" size="lg" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? "Posting…" : "Post"}
            </Button>
          </form>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
};

export default PostRegional;
