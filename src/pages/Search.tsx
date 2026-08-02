import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search as SearchIcon, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ListingCard, { type Listing } from "@/components/ListingCard";
import { Input } from "@/components/ui/input";

const Search = () => {
  const [params, setParams] = useSearchParams();
  const initial = params.get("q") ?? "";
  const [q, setQ] = useState(initial);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = q ? `“${q}” - Céilí Brisbane search` : "Search - Céilí Brisbane";
  }, [q]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("listings")
        .select("*")
        .eq("status", "approved")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(200);
      setListings((data ?? []) as Listing[]);
      setLoading(false);
    })();
  }, []);

  const term = q.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!term) return listings;
    return listings.filter((l) =>
      [l.title, l.description, l.suburb ?? ""].some((s) => s.toLowerCase().includes(term)),
    );
  }, [listings, term]);

  const onChange = (val: string) => {
    setQ(val);
    const next = new URLSearchParams(params);
    if (val) next.set("q", val);
    else next.delete("q");
    setParams(next, { replace: true });
  };

  return (
    <div className="flex min-h-screen flex-col bg-gradient-warm">
      <SiteHeader />
      <main className="container flex-1 py-8 md:py-10">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Home
        </Link>
        <h1 className="mt-4 font-display text-3xl font-bold md:text-4xl">Search listings</h1>
        <div className="mt-5 flex items-center gap-2 rounded-full border border-border bg-background p-1.5 shadow-soft">
          <SearchIcon className="ml-3 h-4 w-4 text-muted-foreground" />
          <Input
            autoFocus
            value={q}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Search rooms, jobs, items, suburbs…"
            className="border-0 bg-transparent shadow-none focus-visible:ring-0"
          />
        </div>

        <p className="mt-6 text-sm text-muted-foreground">
          {loading ? "Searching…" : term ? `${filtered.length} result${filtered.length === 1 ? "" : "s"}` : `${listings.length} recent listings`}
        </p>

        {!loading && filtered.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
            <p className="font-display text-lg">No matches found.</p>
            <p className="mt-1 text-sm text-muted-foreground">Try a different keyword or browse categories.</p>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {filtered.map((l) => <ListingCard key={l.id} listing={l} />)}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
};

export default Search;
