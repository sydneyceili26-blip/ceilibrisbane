import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Tractor, Plus, Search, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ListingCard from "@/components/ListingCard";
import type { Listing } from "@/components/ListingCard";
import type { CategoryKey } from "@/lib/categories";

interface RegionalPost {
  id: string;
  title: string;
  body: string | null;
  author_name: string | null;
  category: string;
  region: string | null;
  created_at: string;
  image_url: string | null;
  image_urls: string[] | null;
}

const REGIONAL_CAT_MAP: Record<string, CategoryKey> = { jobs: "job", housing: "sublet", general: "service" };

const CATEGORIES = [
  { key: "all", label: "All posts" },
  { key: "jobs", label: "Jobs" },
  { key: "housing", label: "Accommodation" },
  { key: "general", label: "General" },
];

const REGIONS = [
  { key: "all", label: "All regions" },
  { key: "nsw", label: "NSW / ACT" },
  { key: "vic", label: "Victoria" },
  { key: "qld", label: "Queensland" },
  { key: "sa", label: "South Australia" },
  { key: "wa", label: "Western Australia" },
  { key: "tas", label: "Tasmania" },
  { key: "nt", label: "Northern Territory" },
];

const Regional = () => {
  const [posts, setPosts] = useState<RegionalPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");
  const [region, setRegion] = useState("all");

  useEffect(() => {
    document.title = "Regional Work - Céilí Brisbane";
    (async () => {
      const { data: rows } = await supabase
        .from("regional_posts")
        .select("*")
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(300);
      setPosts((rows ?? []) as RegionalPost[]);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return posts.filter((p) => {
      if (category !== "all" && p.category !== category) return false;
      if (region !== "all" && p.region !== region) return false;
      if (term && ![p.title, p.body ?? ""].some((s) => s.toLowerCase().includes(term))) return false;
      return true;
    });
  }, [posts, q, category, region]);

  return (
    <div className="flex min-h-screen flex-col bg-gradient-warm">
      <SiteHeader />
      <main className="flex-1">
        <section className="border-b border-border/60 bg-secondary/40">
          <div className="container py-10 md:py-14">
            <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Home
            </Link>
            <div className="mt-4 flex items-start gap-4">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-amber-500/15 text-amber-600">
                <Tractor className="h-7 w-7" />
              </span>
              <div className="flex-1">
                <h1 className="font-display text-3xl font-bold md:text-4xl">Regional Work</h1>
                <p className="mt-1 text-muted-foreground">
                  Jobs, accommodation and tips for regional Australia — farm work, harvests, outback roles and the 88 days.
                </p>
              </div>
              <Button asChild variant="hero" className="hidden sm:inline-flex">
                <Link to="/regional/post"><Plus className="h-4 w-4" /> Post</Link>
              </Button>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setCategory(c.key)}
                  className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-smooth ${
                    category === c.key
                      ? "bg-foreground text-background"
                      : "border border-border bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {REGIONS.map((r) => (
                <button
                  key={r.key}
                  onClick={() => setRegion(r.key)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-smooth ${
                    region === r.key
                      ? "bg-amber-600 text-white"
                      : "border border-border bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            <div className="mt-5 flex items-center gap-2 rounded-full border border-border bg-background p-1.5 shadow-soft">
              <Search className="ml-3 h-4 w-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search posts…"
                className="border-0 bg-transparent shadow-none focus-visible:ring-0"
              />
            </div>
          </div>
        </section>

        <section className="container py-8 md:py-10">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {loading ? "Loading…" : `${filtered.length} post${filtered.length === 1 ? "" : "s"}`}
            </p>
            <Button asChild variant="hero" size="sm" className="sm:hidden">
              <Link to="/regional/post"><Plus className="h-4 w-4" /> Post</Link>
            </Button>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-secondary/60" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
              <p className="font-display text-lg">Nothing posted yet — be the first!</p>
              <Button asChild variant="hero" className="mt-5">
                <Link to="/regional/post"><Plus className="h-4 w-4" /> Post something</Link>
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {filtered.map((p) => {
                const listing: Listing = {
                  id: p.id,
                  category: REGIONAL_CAT_MAP[p.category] ?? "service",
                  title: p.title,
                  description: p.body ?? "",
                  price: null,
                  suburb: REGIONS.find((r) => r.key === p.region)?.label ?? null,
                  image_url: p.image_url,
                  image_urls: p.image_urls,
                  event_date: null,
                  created_at: p.created_at,
                };
                return (
                  <ListingCard key={p.id} listing={listing} href={`/regional/${p.id}`} />
                );
              })}
            </div>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
};

export default Regional;
