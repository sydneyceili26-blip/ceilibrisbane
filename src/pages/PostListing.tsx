import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, useParams, Link } from "react-router-dom";
import { ArrowLeft, Loader2, HelpCircle } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRoles } from "@/hooks/useUserRole";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { CATEGORIES, JOB_TYPES, ITEM_TYPES, type CategoryKey, type JobType, type ItemType } from "@/lib/categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ImageUploader from "@/components/ImageUploader";
import { toast } from "sonner";

const schema = z.object({
  category: z.enum(["job","room","sublet","lease_takeover","for_sale","service","event","car","sports_wellness"]),
  job_type: z.string().trim().max(40).optional(),
  item_type: z.string().trim().max(40).optional(),
  title: z.string().trim().min(3, "Title is too short").max(120, "Keep it under 120 chars"),
  description: z.string().trim().min(10, "Add a bit more detail").max(4000),
  price: z.string().trim().max(12).optional(),
  suburb: z.string().trim().max(80).optional(),
  contact_name: z.string().trim().min(1, "Your name is required").max(80),
  contact_email: z.string().trim().email("Invalid email").max(255).optional().or(z.literal("")),
  contact_phone: z.string().trim().max(40).optional(),
  image_url: z.string().trim().url("Invalid URL").max(500).optional().or(z.literal("")),
  event_date: z.string().optional(),
  ticket_url: z.string().trim().url("Enter a valid URL").max(500).optional().or(z.literal("")),
}).refine((d) => d.contact_email || d.contact_phone, {
  message: "Provide at least an email or phone",
  path: ["contact_email"],
});

type Defaults = {
  title?: string; description?: string; price?: string; suburb?: string;
  contact_name?: string; contact_email?: string; contact_phone?: string;
  event_date?: string; ticket_url?: string;
};

const PostListing = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { id: editId } = useParams<{ id: string }>();
  const isEdit = !!editId;
  const { user, loading: authLoading } = useAuth();
  const { isModerator, loading: rolesLoading } = useUserRoles();

  const initial = (params.get("category") as CategoryKey) || "sublet";
  const [category, setCategory] = useState<CategoryKey>(initial);
  const [mode, setMode] = useState<"listing" | "request">("listing");
  const catByKey = Object.fromEntries(CATEGORIES.map(c => [c.key, c]));
  const REQUEST_CATEGORIES = [
    { key: "sublet",         label: "Sublet",         icon: catByKey["sublet"].icon },
    { key: "lease_takeover", label: "Lease takeover",  icon: catByKey["lease_takeover"].icon },
    { key: "job",            label: "Job",             icon: catByKey["job"].icon },
    { key: "for_sale",       label: "Item",            icon: catByKey["for_sale"].icon },
    { key: "service",        label: "Service",         icon: catByKey["service"].icon },
    { key: "car",            label: "Vehicle",         icon: catByKey["car"].icon },
    { key: "event",          label: "Event",           icon: catByKey["event"].icon },
    { key: "other",          label: "Other",           icon: HelpCircle },
  ];
  const [jobType, setJobType] = useState<JobType | "">("");
  const [itemType, setItemType] = useState<ItemType | "">("");
  const [images, setImages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [defaults, setDefaults] = useState<Defaults>({});
  const [loadingListing, setLoadingListing] = useState(isEdit);

  useEffect(() => {
    document.title = isEdit ? "Edit listing - Céilí Brisbane" : "Make a post - Céilí Brisbane";
  }, [isEdit]);

  useEffect(() => {
    if (authLoading || rolesLoading) return;
    if (!user) { navigate("/auth"); return; }
    if (!isEdit) return;
    (async () => {
      const { data, error } = await supabase.from("listings").select("*").eq("id", editId).maybeSingle();
      if (error || !data) { toast.error("Listing not found"); navigate("/my-posts"); return; }
      if (data.owner_id !== user.id && !isModerator) { toast.error("You can't edit this listing"); navigate("/my-posts"); return; }
      setCategory(data.category as CategoryKey);
      setJobType((data.job_type as JobType) || "");
      setItemType((data.item_type as ItemType) || "");
      setImages(data.image_urls ?? (data.image_url ? [data.image_url] : []));
      const { data: contact } = await supabase
        .from("listing_contacts")
        .select("contact_email, contact_phone")
        .eq("listing_id", editId!)
        .maybeSingle();
      setDefaults({
        title: data.title ?? "",
        description: data.description ?? "",
        price: data.price != null ? String(data.price) : "",
        suburb: data.suburb ?? "",
        contact_name: data.contact_name ?? "",
        contact_email: contact?.contact_email ?? "",
        contact_phone: contact?.contact_phone ?? "",
        event_date: data.event_date ? new Date(data.event_date).toISOString().slice(0, 16) : "",
        ticket_url: data.ticket_url ?? "",
      });
      setLoadingListing(false);
    })();
  }, [isEdit, editId, user, authLoading, rolesLoading, navigate]);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const raw = {
      category,
      job_type: category === "job" ? jobType : "",
      item_type: category === "for_sale" ? itemType : "",
      title: String(form.get("title") ?? ""),
      description: String(form.get("description") ?? ""),
      price: String(form.get("price") ?? ""),
      suburb: String(form.get("suburb") ?? ""),
      contact_name: String(form.get("contact_name") ?? ""),
      contact_email: String(form.get("contact_email") ?? ""),
      contact_phone: String(form.get("contact_phone") ?? ""),
      image_url: images[0] ?? "",
      event_date: String(form.get("event_date") ?? ""),
      ticket_url: String(form.get("ticket_url") ?? ""),
    };

    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }

    setSubmitting(true);
    const v = parsed.data;
    const payload = {
      category: v.category,
      job_type: v.job_type || null,
      item_type: v.item_type || null,
      title: v.title,
      description: v.description,
      price: v.price ? Number(v.price) : null,
      suburb: v.suburb || null,
      contact_name: v.contact_name,
      image_url: v.image_url || null,
      image_urls: images,
      event_date: v.event_date ? new Date(v.event_date).toISOString() : null,
      ticket_url: v.ticket_url || null,
    };
    const contactPayload = {
      contact_email: v.contact_email || null,
      contact_phone: v.contact_phone || null,
    };

    if (isEdit) {
      const { error } = await supabase.from("listings").update(payload).eq("id", editId!);
      if (!error) {
        await supabase
          .from("listing_contacts")
          .upsert({ listing_id: editId!, ...contactPayload, updated_at: new Date().toISOString() });
      }
      setSubmitting(false);
      if (error) { toast.error("Couldn't save changes. Try again."); return; }
      toast.success("Changes saved");
      navigate(`/listing/${editId}`);
      return;
    }

    const { data: sess } = await supabase.auth.getSession();
    const ownerId = sess.session?.user.id ?? null;

    if (mode === "request") {
      const requestPayload = {
        category: v.category,
        title: v.title,
        description: v.description,
        suburb: v.suburb || null,
        contact_name: v.contact_name,
        owner_id: ownerId,
        image_url: images[0] ?? null,
        image_urls: images,
        link_url: v.ticket_url || null,
      };
      const { error } = await supabase.from("requests").insert(requestPayload);
      setSubmitting(false);
      if (error) {
        console.error("Request insert error:", error);
        toast.error(`Couldn't post your request: ${error.message}`);
        return;
      }
      toast.success("Request submitted — an admin will review it shortly.");
      supabase.functions.invoke("notify-new-post", { body: { title: v.title, type: "request", authorName: v.contact_name, authorUserId: ownerId } });
      navigate("/my-posts");
      return;
    }

    const { data, error } = await supabase
      .from("listings")
      .insert({ ...payload, owner_id: ownerId })
      .select("id")
      .single();

    if (!error && data) {
      await supabase
        .from("listing_contacts")
        .insert({ listing_id: data.id, ...contactPayload });
    }

    setSubmitting(false);
    if (error) {
      console.error("Listing insert error:", error);
      toast.error(`Couldn't post your listing: ${error.message}`);
      return;
    }
    toast.success("Listing submitted — an admin will review it shortly.");
    supabase.functions.invoke("notify-new-post", { body: { title: v.title, type: "listing", authorName: v.contact_name, authorUserId: ownerId } });
    navigate("/my-posts");
  };

  const isHousing = category === "room" || category === "sublet" || category === "lease_takeover";
  const isEvent = category === "event";

  const placeholders: Record<CategoryKey, { title: string; description: string }> = {
    room: {
      title: "e.g. Sunny double room in West End - Irish household",
      description: "Tell people about the room and house - size, furnished or not, who else lives there, bills included, bond, available from, close to which beach/train, house vibe (quiet, social, GAA crowd…).",
    },
    sublet: {
      title: "e.g. 6-week sublet in New Farm - fully furnished",
      description: "Dates available, weekly rent, whether bills are included, type of place (studio, room in share), what's nearby, and why you're subletting (going home for Chrissy, travelling, etc.).",
    },
    lease_takeover: {
      title: "e.g. Lease takeover - 2-bed apartment in Fortitude Valley until Aug",
      description: "Lease end date, weekly rent, bond, what's included, building features, why you're leaving, and any agent/landlord requirements for the takeover.",
    },
    job: {
      title: "e.g. Full-time carpenter wanted - CBD sites",
      description: "Role, hours, pay range, location, sponsorship/visa requirements (417, 482, PR), start date, tickets/licences needed (White Card, RSA…), and how to apply.",
    },
    for_sale: {
      title: "e.g. Near-new Fisher & Paykel fridge - moving sale",
      description: "Brand, age, condition, dimensions, reason for selling, pickup suburb, whether you can deliver, and if you're open to offers. Cash or bank transfer?",
    },
    service: {
      title: "e.g. Two Irish lads with a ute - moves & rubbish runs",
      description: "What you offer, areas you cover in Perth, rates, availability, insurance/qualifications, and how to book you.",
    },
    event: {
      title: "e.g. Trad session at the Mercantile - Sunday arvo",
      description: "What's on, who it's for, where exactly, start/finish times, cost (if any), what to bring, and a contact for questions.",
    },
    car: {
      title: "e.g. 2012 Toyota Hiace - backpacker-ready, rego till Oct",
      description: "Make, model, year, kms, rego expiry, condition, any mods (bed, curtains, fridge), service history, reason for selling, and pickup location.",
    },
    sports_wellness: {
      title: "e.g. GAA training Tuesdays - new players welcome",
      description: "What's on offer (club, class, coach, session), location, days/times, cost, who it's for (beginners, all levels), and how to get involved.",
    },
  };
  const requestPlaceholders: Record<string, { title: string; description: string }> = {
  sublet: {
    title: "e.g. Looking for a short-term sublet in the Inner North - 4 to 8 weeks",
    description: "Dates you need it for, your budget per week, area preferences, how many people, and anything else useful (furnished, bills included, etc.).",
  },
  lease_takeover: {
    title: "e.g. Looking to take over a lease in Woolloongabba from August",
    description: "When you need to move in, how long you're looking to stay, your budget, preferred area, and any requirements around bond or agent approval.",
  },
  job: {
    title: "e.g. Experienced chef looking for work in Perth CBD",
    description: "Tell people about yourself - experience, availability, visa type, what kind of role you're after and your preferred area.",
  },
  for_sale: {
    title: "e.g. Looking to buy a second-hand bike - any condition",
    description: "What you're looking for, your budget, condition you'd accept, and where you can pick up from.",
  },
  service: {
    title: "e.g. Need a reliable plumber in the Inner North",
    description: "What the job is, rough timeline, your suburb, and any specific requirements.",
  },
  car: {
    title: "e.g. Looking for a reliable car under $5,000 - any make",
    description: "What you need it for, your budget, preferred make/model, rego requirements, and where you're based.",
  },
  event: {
    title: "e.g. Looking for GAA players in the Inner North",
    description: "What you're organising or looking for, when, where, and who it's for.",
  },
  other: {
    title: "e.g. Looking for a Gaelic football jersey - size L",
    description: "Describe what you're looking for and how people can help.",
  },
};
  const ph = mode === "request" ? (requestPlaceholders[category] ?? requestPlaceholders.other) : placeholders[category];

  if (isEdit && loadingListing) {
    return (
      <div className="flex min-h-screen flex-col bg-gradient-warm">
        <SiteHeader />
        <main className="container flex-1 py-16 text-center text-muted-foreground">
          <Loader2 className="mx-auto h-6 w-6 animate-spin" />
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-warm">
      <SiteHeader />

      <main className="container flex-1 py-8 md:py-12">
        <div className="mx-auto max-w-2xl">
          <Link to={isEdit ? "/my-posts" : "/"} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> {isEdit ? "My posts" : "Home"}
          </Link>
          <h1 className="mt-4 font-display text-3xl font-bold md:text-4xl">{isEdit ? "Edit listing" : "Make a post"}</h1>
          {!isEdit && (
  <>
    <div className="mt-4 flex rounded-xl border border-border bg-card p-1 max-w-sm">
      <button
        type="button"
        onClick={() => setMode("listing")}
        className={`flex-1 rounded-lg py-2 text-sm font-medium transition-smooth ${
          mode === "listing" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        I'm offering something
      </button>
      <button
        type="button"
        onClick={() => setMode("request")}
        className={`flex-1 rounded-lg py-2 text-sm font-medium transition-smooth ${
          mode === "request" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        I'm looking for something
      </button>
    </div>
    <p className="mt-2 text-sm text-muted-foreground">
      {mode === "listing"
        ? "You have a room, job, item, or service to offer."
        : "You're searching for a room, job, item, or service."}
    </p>
  </>
)}
          {!isEdit && <p className="mt-1 text-xs text-muted-foreground">Posts are reviewed by an admin before going live.</p>}

          <form onSubmit={onSubmit} className="mt-8 space-y-5 rounded-2xl border border-border bg-card p-6 shadow-card md:p-8">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as CategoryKey)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
{(mode === "request" ? REQUEST_CATEGORIES : CATEGORIES.filter(c => c.key !== "room")).map((c) => (
  <SelectItem key={c.key} value={c.key}>
    <span className="inline-flex items-center gap-2">
      {"icon" in c && <c.icon className="h-4 w-4" />}{c.label}
    </span>
  </SelectItem>
))}                </SelectContent>
              </Select>
            </div>

            {category === "job" && (
              <div className="space-y-2">
                <Label>Industry</Label>
                <Select value={jobType} onValueChange={(v) => setJobType(v as JobType)}>
                  <SelectTrigger><SelectValue placeholder="Select an industry" /></SelectTrigger>
                  <SelectContent>
                    {JOB_TYPES.map((j) => (
                      <SelectItem key={j.key} value={j.key}>{j.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {category === "for_sale" && (
              <div className="space-y-2">
                <Label>Item type</Label>
                <Select value={itemType} onValueChange={(v) => setItemType(v as ItemType)}>
                  <SelectTrigger><SelectValue placeholder="Select an item type" /></SelectTrigger>
                  <SelectContent>
                    {ITEM_TYPES.map((i) => (
                      <SelectItem key={i.key} value={i.key}>{i.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" required maxLength={120} defaultValue={defaults.title} placeholder={ph.title} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" required rows={6} maxLength={4000} defaultValue={defaults.description}
                placeholder={ph.description} />
            </div>



            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="price">
                  Price {isHousing ? "(per week, AUD)" : category === "job" ? "(per year, AUD)" : "(AUD)"}
                </Label>
                <Input id="price" name="price" type="number" min="0" step="1" defaultValue={defaults.price} placeholder="Optional" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="suburb">Suburb</Label>
                <Input id="suburb" name="suburb" maxLength={80} defaultValue={defaults.suburb} placeholder="e.g. West End" />
              </div>
            </div>

            {isEvent && (
              <div className="space-y-2">
                <Label htmlFor="event_date">Event date & time</Label>
                <Input id="event_date" name="event_date" type="datetime-local" defaultValue={defaults.event_date} />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="ticket_url">{isEvent ? "Ticket link" : "Link"} <span className="text-muted-foreground">(optional)</span></Label>
              <Input id="ticket_url" name="ticket_url" type="url" placeholder="https://..." defaultValue={defaults.ticket_url} />
            </div>

            <div className="space-y-2">
              <Label>Photos <span className="text-muted-foreground">(optional)</span></Label>
              <ImageUploader value={images} onChange={setImages} />
            </div>

            <div className="rounded-xl bg-secondary/50 p-5">
              <h3 className="font-display text-base font-semibold">Your contact details</h3>
              <p className="text-xs text-muted-foreground">Shown publicly so people can reach you. Email or phone required.</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="contact_name">Name</Label>
                  <Input id="contact_name" name="contact_name" required maxLength={80} defaultValue={defaults.contact_name} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact_email">Email</Label>
                  <Input id="contact_email" name="contact_email" type="email" maxLength={255} defaultValue={defaults.contact_email} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact_phone">Phone</Label>
                  <Input id="contact_phone" name="contact_phone" type="tel" maxLength={40} defaultValue={defaults.contact_phone} />
                </div>
              </div>
            </div>

            <Button type="submit" variant="hero" size="lg" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? (isEdit ? "Saving…" : "Posting…") : (isEdit ? "Save changes" : "Make post")}
            </Button>
          </form>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
};

export default PostListing;
