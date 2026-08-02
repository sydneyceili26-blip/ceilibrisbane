import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRoles } from "@/hooks/useUserRole";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { CATEGORIES, type CategoryKey } from "@/lib/categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ImageUploader from "@/components/ImageUploader";
import { toast } from "sonner";

const schema = z.object({
  category: z.enum(["job","room","sublet","lease_takeover","for_sale","service","event","car","sports_wellness"]),
  title: z.string().trim().min(3, "Title is too short").max(120, "Keep it under 120 chars"),
  description: z.string().trim().min(10, "Add a bit more detail").max(4000),
  suburb: z.string().trim().max(80).optional(),
  contact_name: z.string().trim().min(1, "Your name is required").max(80),
});

const EDITABLE_CATEGORIES = CATEGORIES.filter(c => c.key !== "room");

const EditRequest = () => {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const { isModerator, loading: rolesLoading } = useUserRoles();
  const navigate = useNavigate();

  const [category, setCategory] = useState<CategoryKey>("sublet");
  const [defaults, setDefaults] = useState<Record<string, string>>({});
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { document.title = "Edit request - Céilí Brisbane"; }, []);

  useEffect(() => {
    if (authLoading || rolesLoading) return;
    if (!user) { navigate("/auth"); return; }
    (async () => {
      const { data, error } = await supabase.from("requests").select("*").eq("id", id!).maybeSingle();
      if (error || !data) { toast.error("Request not found"); navigate("/my-posts"); return; }
      if (data.owner_id !== user.id && !isModerator) { toast.error("You can't edit this request"); navigate("/my-posts"); return; }
      setCategory(data.category as CategoryKey);
      setImages(data.image_urls ?? (data.image_url ? [data.image_url] : []));
      setDefaults({
        title: data.title ?? "",
        description: data.description ?? "",
        suburb: data.suburb ?? "",
        contact_name: data.contact_name ?? "",
        link_url: data.link_url ?? "",
      });
      setLoading(false);
    })();
  }, [id, user, authLoading, rolesLoading, navigate]);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = schema.safeParse({
      category,
      title: String(form.get("title") ?? ""),
      description: String(form.get("description") ?? ""),
      suburb: String(form.get("suburb") ?? ""),
      contact_name: String(form.get("contact_name") ?? ""),
    });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }

    setSubmitting(true);
    const { error } = await supabase.from("requests").update({
      category: parsed.data.category,
      title: parsed.data.title,
      description: parsed.data.description,
      suburb: parsed.data.suburb || null,
      contact_name: parsed.data.contact_name,
      image_url: images[0] ?? null,
      image_urls: images,
      link_url: String(form.get("link_url") ?? "") || null,
    }).eq("id", id!);
    setSubmitting(false);

    if (error) { toast.error("Couldn't save changes. Try again."); return; }
    toast.success("Changes saved");
    navigate(`/request/${id}`);
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
          <h1 className="mt-4 font-display text-3xl font-bold md:text-4xl">Edit request</h1>

          <form onSubmit={onSubmit} className="mt-8 space-y-5 rounded-2xl border border-border bg-card p-6 shadow-card md:p-8">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as CategoryKey)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EDITABLE_CATEGORIES.map((c) => (
                    <SelectItem key={c.key} value={c.key}>
                      <span className="inline-flex items-center gap-2">
                        <c.icon className="h-4 w-4" />{c.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" required maxLength={120} defaultValue={defaults.title} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" required rows={6} maxLength={4000} defaultValue={defaults.description} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="suburb">Suburb</Label>
              <Input id="suburb" name="suburb" maxLength={80} defaultValue={defaults.suburb} placeholder="e.g. West End" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact_name">Your name</Label>
              <Input id="contact_name" name="contact_name" required maxLength={80} defaultValue={defaults.contact_name} />
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

export default EditRequest;
