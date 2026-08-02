import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Plus, Search, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ListingCard, { type Listing } from "@/components/ListingCard";
import {
  CATEGORY_MAP,
  HOUSING_KEY,
  HOUSING_META,
  HOUSING_SUBS,
  HOUSING_FILTER_SUBS,
  JOB_TYPES,
  ITEM_TYPES,
  type CategoryKey,
  type HousingSub,
  type JobType,
  type ItemType,
} from "@/lib/categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import NotFound from "./NotFound";

type RouteKey = CategoryKey | typeof HOUSING_KEY;
type FeedItem = Listing & { isRequest?: boolean };

const Category = () => {
  const { key } = useParams<{ key: RouteKey }>();
  const isHousing = key === HOUSING_KEY;
  const meta = isHousing
    ? HOUSING_META
    : key && (key in CATEGORY_MAP)
      ? CATEGORY_MAP[key as CategoryKey]
      : undefined;

  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const sub = (params.get("sub") as HousingSub | null) ?? null;
  const isJob = meta?.key === "job";
  const jobType = (params.get("type") as JobType | null) ?? null;
  const isForSale = meta?.key === "for_sale";
  const itemType = (params.get("type") as ItemType | null) ?? null;
  const minPrice = params.get("min") ?? "";
  const maxPrice = params.get("max") ?? "";
  const sort = (params.get("sort") as "newest" | "price_asc" | "price_desc" | null) ?? "newest";
  const [listings, setListings] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!meta) return;
    document.title = `${meta.label} - Céilí Brisbane`;
    (async () => {
      setLoading(true);
      const categoryKeys = isHousing ? (sub ? [sub] : HOUSING_SUBS) : [meta.key as CategoryKey];

      let listingQuery = supabase.from("listings").select("*").eq("status", "approved").gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false });
      if (isHousing) {
        listingQuery = listingQuery.in("category", categoryKeys);
      } else {
        listingQuery = listingQuery.eq("category", meta.key as CategoryKey);
        if (isJob && jobType) listingQuery = listingQuery.eq("job_type", jobType);
        if (isForSale && itemType) listingQuery = listingQuery.eq("item_type", itemType);
      }

      let requestQuery = supabase.from("requests").select("*").eq("status", "approved").order("created_at", { ascending: false });
      if (isHousing) {
        requestQuery = requestQuery.in("category", categoryKeys);
      } else {
        requestQuery = requestQuery.eq("category", meta.key as CategoryKey);
      }

      const [{ data: listingData }, { data: requestData }] = await Promise.all([listingQuery, requestQuery]);

      const mappedRequests: FeedItem[] = (requestData ?? []).map((r) => ({
        id: r.id,
        category: r.category,
        title: r.title,
        description: r.description,
        suburb: r.suburb ?? null,
        contact_name: r.contact_name,
        owner_id: r.owner_id,
        created_at: r.created_at,
        price: null,
        expires_at: null,
        images: null,
        listing_type: null,
        job_type: null,
        item_type: null,
        is_featured: false,
        isRequest: true,
      } as FeedItem));

      const merged = [...(listingData ?? []) as FeedItem[], ...mappedRequests]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setListings(merged);
      setLoading(false);
    })();
  }, [meta, isHousing, sub, isJob, jobType, isForSale, itemType]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const min = minPrice ? Number(minPrice) : null;
    const max = maxPrice ? Number(maxPrice) : null;
    let result = listings.filter((l) => {
      if (term && ![l.title, l.description, l.suburb ?? ""].some((s) => s.toLowerCase().includes(term))) return false;
      if (min != null && (l.price == null || l.price < min)) return false;
      if (max != null && (l.price == null || l.price > max)) return false;
      return true;
    });
    if (sort === "price_asc") result = [...result].sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
    else if (sort === "price_desc") result = [...result].sort((a, b) => (b.price ?? -Infinity) - (a.price ?? -Infinity));
    return result;
  }, [listings, q, minPrice, maxPrice, sort]);

  if (!meta) return <NotFound />;
  const Icon = meta.icon;

  const setParam = (next: Record<string, string | null>) => {
    const merged = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) {
      if (v == null || v === "") merged.delete(k);
      else merged.set(k, v);
    }
    setParams(merged);
  };

  return (
    <div className="flex min-h-screen flex-col bg-gradient-warm">
      <SiteHeader />

      <main className="flex-1">
        <section
          className="border-b border-border/60"
          style={{ background: `linear-gradient(180deg, hsl(var(${meta.colorVar}) / 0.1), transparent)` }}
        >
          <div className="container py-10 md:py-14">
            <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Home
            </Link>
            <div className="mt-4 flex items-start gap-4">
              <span
                className="grid h-14 w-14 place-items-center rounded-2xl"
                style={{ backgroundColor: `hsl(var(${meta.colorVar}) / 0.15)`, color: `hsl(var(${meta.colorVar}))` }}
              >
                <Icon className="h-7 w-7" />
              </span>
              <div className="flex-1">
                <h1 className="font-display text-3xl font-bold md:text-4xl">{meta.label}</h1>
                <p className="mt-1 text-muted-foreground">{meta.description}</p>
              </div>
              <Button asChild variant="hero" className="hidden sm:inline-flex">
                <Link to={`/post?category=${isHousing ? (sub ?? "room") : meta.key}`}>
                  <Plus className="h-4 w-4" /> Post
                </Link>
              </Button>
            </div>

            {isHousing && (
              <div className="mt-6 flex flex-wrap gap-2">
                <button
                  onClick={() => setParam({ sub: null })}
                  className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-smooth ${
                    !sub ? "bg-foreground text-background" : "border border-border bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  All housing
                </button>
                {HOUSING_FILTER_SUBS.map((s) => {
                  const m = CATEGORY_MAP[s];
                  const active = sub === s;
                  const SubIcon = m.icon;
                  return (
                    <button
                      key={s}
                      onClick={() => setParam({ sub: s })}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-smooth ${
                        active ? "bg-foreground text-background" : "border border-border bg-background text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <SubIcon className="h-3.5 w-3.5" />
                      {m.short}
                    </button>
                  );
                })}
              </div>
            )}
            {isJob && (
              <div className="mt-6 flex flex-wrap gap-2">
                <button
                  onClick={() => setParam({ type: null })}
                  className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-smooth ${
                    !jobType ? "bg-foreground text-background" : "border border-border bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  All jobs
                </button>
                {JOB_TYPES.map((j) => {
                  const active = jobType === j.key;
                  return (
                    <button
                      key={j.key}
                      onClick={() => setParam({ type: j.key })}
                      className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-smooth ${
                        active ? "bg-foreground text-background" : "border border-border bg-background text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {j.label}
                    </button>
                  );
                })}
              </div>
            )}
            {isForSale && (
              <div className="mt-6 flex flex-wrap gap-2">
                <button
                  onClick={() => setParam({ type: null })}
                  className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-smooth ${
                    !itemType ? "bg-foreground text-background" : "border border-border bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  All items
                </button>
                {ITEM_TYPES.map((i) => {
                  const active = itemType === i.key;
                  return (
                    <button
                      key={i.key}
                      onClick={() => setParam({ type: i.key })}
                      className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-smooth ${
                        active ? "bg-foreground text-background" : "border border-border bg-background text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {i.label}
                    </button>
                  );
                })}
              </div>
            )}

            
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="flex flex-1 items-center gap-2 rounded-full border border-border bg-background p-1.5 shadow-soft">
                <Search className="ml-3 h-4 w-4 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => { setQ(e.target.value); setParam({ q: e.target.value || null }); }}
                  placeholder={`Search ${meta.short.toLowerCase()}…`}
                  className="border-0 bg-transparent shadow-none focus-visible:ring-0"
                />
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  inputMode="numeric"
                  placeholder="Min $"
                  value={minPrice}
                  onChange={(e) => setParam({ min: e.target.value || null })}
                  className="h-10 w-24 rounded-full bg-background"
                />
                <Input
                  type="number"
                  inputMode="numeric"
                  placeholder="Max $"
                  value={maxPrice}
                  onChange={(e) => setParam({ max: e.target.value || null })}
                  className="h-10 w-24 rounded-full bg-background"
                />
                <select
                  value={sort}
                  onChange={(e) => setParam({ sort: e.target.value === "newest" ? null : e.target.value })}
                  className="h-10 rounded-full border border-border bg-background px-3 text-sm"
                  aria-label="Sort"
                >
                  <option value="newest">Newest</option>
                  <option value="price_asc">Price: low to high</option>
                  <option value="price_desc">Price: high to low</option>
                </select>
              </div>
            </div>
          </div>
        </section>

        <section className="container py-8 md:py-10">
          {loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="aspect-[4/5] animate-pulse rounded-2xl bg-secondary/60" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
              <p className="font-display text-lg">
                {q ? "No matches yet." : `No ${meta.short.toLowerCase()} listed yet.`}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">Be the first to post one.</p>
              <Button asChild variant="hero" className="mt-5">
                <Link to={`/post?category=${isHousing ? (sub ?? "room") : meta.key}`}>
                  <Plus className="h-4 w-4" /> Post {meta.short.toLowerCase()}
                </Link>
              </Button>
            </div>
          ) : (
            <>
              <p className="mb-4 text-sm text-muted-foreground">
                {filtered.length} result{filtered.length === 1 ? "" : "s"}
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {filtered.map((l) => (
                  <ListingCard
                    key={l.id}
                    listing={l}
                    href={l.isRequest ? `/request/${l.id}` : undefined}
                    isRequest={l.isRequest}
                  />
                ))}
              </div>
            </>
          )}
        </section>
      </main>

      <SiteFooter />
    </div>
  );
};

export default Category;
