import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Heart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ListingCard, { type Listing } from "@/components/ListingCard";
import { Button } from "@/components/ui/button";

const Favourites = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Listing[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => { document.title = "Your favourites - Céilí Brisbane"; }, []);
  useEffect(() => { if (!loading && !user) navigate("/auth"); }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setFetching(true);
      const { data: favs } = await supabase.from("favourites").select("listing_id").eq("user_id", user.id);
      const ids = (favs ?? []).map((f) => f.listing_id);
      if (!ids.length) { setItems([]); setFetching(false); return; }
      const { data } = await supabase.from("listings").select("*").in("id", ids).order("created_at", { ascending: false });
      setItems((data ?? []) as Listing[]);
      setFetching(false);
    })();
  }, [user]);

  return (
    <div className="flex min-h-screen flex-col bg-gradient-warm">
      <SiteHeader />
      <main className="container flex-1 py-8 md:py-10">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Home
        </Link>
        <h1 className="mt-4 flex items-center gap-2 font-display text-3xl font-bold md:text-4xl">
          <Heart className="h-7 w-7 text-primary" /> Your favourites
        </h1>

        {fetching ? null : items.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
            <p className="font-display text-lg">No favourites yet.</p>
            <p className="mt-1 text-sm text-muted-foreground">Tap the heart on any listing to save it here.</p>
            <Button asChild variant="hero" className="mt-5"><Link to="/categories">Browse categories</Link></Button>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {items.map((l) => <ListingCard key={l.id} listing={l} />)}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
};

export default Favourites;
