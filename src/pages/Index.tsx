import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Plus, LayoutGrid, MessageCircle, Search as SearchIcon } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ListingCard, { type Listing } from "@/components/ListingCard";
import AdBanner from "@/components/AdBanner";
import { type CategoryKey } from "@/lib/categories";
import { supabase } from "@/integrations/supabase/client";
import { useBlockedUsers } from "@/hooks/useBlockedUsers";

const HERO_IMAGES: { src: string; position: string }[] = [
  { src: "/hero/1.jpg", position: "center 30%" },
  { src: "/hero/2.jpg", position: "center 55%" },
  { src: "/hero/3.jpg", position: "center 50%" },
  { src: "/hero/4.jpg", position: "center 40%" },
  { src: "/hero/5.jpg", position: "center 40%" },
];

type FeedItem = Listing & { isRequest?: boolean; isRegional?: boolean };

const Index = () => {
  const { blockedIds } = useBlockedUsers();
  const [listings, setListings] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [heroIdx, setHeroIdx] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setInterval(() => setHeroIdx((i) => (i + 1) % HERO_IMAGES.length), 5000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    document.title = "Céilí Brisbane - A friendly noticeboard for Perth newcomers";
  }, []);

  useEffect(() => {
    (async () => {
      const [{ data: listingsData }, { data: requestsData }, { data: regionalData }] = await Promise.all([
        supabase.from("listings").select("*").eq("status", "approved").gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }).limit(12),
        supabase.from("requests").select("*").eq("status", "approved").order("created_at", { ascending: false }).limit(12),
        supabase.from("regional_posts").select("*").eq("status", "approved").order("created_at", { ascending: false }).limit(12),
      ]);
      const regionalCatMap: Record<string, CategoryKey> = { jobs: "job", housing: "sublet", general: "service" };
      const mapped: FeedItem[] = [
        ...((listingsData ?? []) as Listing[]).map(l => ({ ...l, isRequest: false })),
        ...((requestsData ?? []) as any[]).map(r => ({
          id: r.id, category: r.category, title: r.title, description: r.description,
          price: null, suburb: r.suburb ?? null, image_url: null, image_urls: null,
          event_date: null, created_at: r.created_at, expires_at: null, isRequest: true,
        })),
        ...((regionalData ?? []) as any[]).map(r => ({
          id: r.id, category: regionalCatMap[r.category] ?? "service", title: r.title,
          description: r.body ?? "", price: null, suburb: r.region?.toUpperCase() ?? null,
          image_url: r.image_url ?? null, image_urls: r.image_urls ?? null,
          event_date: null, created_at: r.created_at, expires_at: null, isRegional: true,
        })),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 12);
      setListings(mapped);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-gradient-warm">
      <SiteHeader />

      <main className="flex-1">
        {/* HERO */}
        <section className="relative min-h-[520px] overflow-hidden py-14 md:py-28">
          {/* Slideshow background */}
          {HERO_IMAGES.map(({ src, position }, i) => (
            <div
              key={src}
              className="absolute inset-0 bg-cover transition-opacity duration-1000"
              style={{ backgroundImage: `url(${src})`, backgroundPosition: position, opacity: i === heroIdx ? 1 : 0 }}
            />
          ))}
          {/* Dark overlay so text stays readable */}
          <div className="absolute inset-0 bg-black/30" />
          <div className="container relative">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white shadow-soft backdrop-blur-sm">
              ☘ Fáilte · Welcome
            </span>
            <h1 className="mt-5 font-display text-5xl font-bold leading-tight text-white md:text-7xl">
              <span className="text-white">Perth, Sorted</span>
            </h1>
            <p className="mt-5 text-base text-white/80 md:text-lg">
              Céilí Brisbane is the one-stop shop for people on holiday visas, permanent residents, and citizens alike - whether you're still at home, just landed, or have been here for years. Find a gaff, find a job, find an event, and everything in between
            </p>

            <form
              onSubmit={(e) => { e.preventDefault(); navigate(`/search?q=${encodeURIComponent(q.trim())}`); }}
              className="mx-auto mt-8 flex max-w-xl items-center gap-2 rounded-full border border-white/20 bg-white/90 p-1.5 shadow-soft backdrop-blur-sm"
            >
              <SearchIcon className="ml-3 h-4 w-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search rooms, jobs, items, suburbs…"
                className="border-0 bg-transparent shadow-none focus-visible:ring-0"
              />
              <Button type="submit" variant="hero" size="sm" className="rounded-full">Search</Button>
            </form>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg" variant="hero">
                <Link to="/categories"><LayoutGrid className="h-4 w-4" /> Browse categories</Link>
              </Button>
              <Button asChild size="lg" className="border-white/30 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20" variant="outline">
                <Link to="/post"><Plus className="h-4 w-4" /> Make a post</Link>
              </Button>
            </div>
          </div>
          </div>
        </section>

        {/* RECENT LISTINGS */}
        <section className="container pb-12 pt-12">
          <div className="mx-auto max-w-6xl">
            <div className="mb-6 flex items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl font-bold md:text-3xl">Latest listings</h2>
                <p className="mt-1 text-sm text-muted-foreground">Fresh from the community noticeboard.</p>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link to="/categories"><LayoutGrid className="h-4 w-4" /> Browse categories</Link>
              </Button>
            </div>
            {loading ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="aspect-[4/3] animate-pulse rounded-2xl bg-card" />
                ))}
              </div>
            ) : listings.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
                <p className="text-sm text-muted-foreground">No listings yet - be the first to post one.</p>
                <Button asChild variant="hero" className="mt-4">
                  <Link to="/post"><Plus className="h-4 w-4" /> Make a post</Link>
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {listings.filter(l => !l.owner_id || !blockedIds.has(l.owner_id)).flatMap((l, i) => {
                  const card = (
                    <ListingCard
                      key={l.id}
                      listing={l}
                      href={l.isRegional ? `/regional/${l.id}` : l.isRequest ? `/request/${l.id}` : undefined}
                      isRequest={l.isRequest}
                    />
                  );
                  if ((i + 1) % 6 === 0 && i !== listings.length - 1) {
                    return [card, <div key={`ad-${i}`} className="col-span-full"><AdBanner slot="3482393089" /></div>];
                  }
                  return [card];
                })}
              </div>
            )}
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="container py-12">
          <div className="mx-auto max-w-4xl rounded-3xl border border-border bg-card p-8 shadow-soft md:p-12">
            <h2 className="font-display text-2xl font-bold md:text-3xl">How it works</h2>
            <ol className="mt-6 grid gap-6 md:grid-cols-3">
              {[
                { n: "1", t: "Browse", d: "Head to the categories page to find rooms, jobs, marketplace items and more." },
                { n: "2", t: "Post", d: "Share a listing in under a minute - no sign-up, no fees, no fuss." },
                { n: "3", t: "Connect", d: "Message posters directly, or ask the community in our Q&A board." },
              ].map((s) => (
                <li key={s.n}>
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-primary font-display text-sm font-bold text-primary-foreground">
                    {s.n}
                  </span>
                  <h3 className="mt-3 font-display text-lg font-semibold">{s.t}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
                </li>
              ))}
            </ol>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild variant="hero">
                <Link to="/categories"><LayoutGrid className="h-4 w-4" /> Browse categories <ArrowRight className="h-4 w-4" /></Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/community"><MessageCircle className="h-4 w-4" /> Ask the community</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="container py-16">
          <div className="overflow-hidden rounded-3xl bg-gradient-hero p-8 text-primary-foreground shadow-glow md:p-12">
            <div className="grid items-center gap-6 md:grid-cols-[1fr_auto]">
              <div>
                <h2 className="font-display text-2xl font-bold md:text-3xl">New to Perth? Pull up a chair.</h2>
                <p className="mt-2 max-w-xl opacity-90">
                  Whether you're hunting a room, looking for work, or just want to find your people - start here.
                </p>
              </div>
              <Button asChild size="lg" variant="secondary" className="font-semibold">
                <Link to="/categories"><LayoutGrid className="h-4 w-4" /> Browse categories</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
};

export default Index;
