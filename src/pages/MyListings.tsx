import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Trash2, Loader2, RefreshCw, Pencil, Tractor } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ListingCard, { type Listing } from "@/components/ListingCard";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { type CategoryKey } from "@/lib/categories";

type FeedItem = Listing & { isRequest?: boolean; isRegional?: boolean; status?: string | null };

const MyListings = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [fetching, setFetching] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => { document.title = "My posts - Céilí Brisbane"; }, []);
  useEffect(() => { if (!loading && !user) navigate("/auth"); }, [loading, user, navigate]);

  const refresh = async () => {
    if (!user) return;
    setFetching(true);
    const [{ data: listingsData }, { data: requestsData }, { data: regionalData }] = await Promise.all([
      supabase.from("listings").select("*").eq("owner_id", user.id).order("created_at", { ascending: false }),
      supabase.from("requests").select("id, category, title, description, suburb, contact_name, created_at, status").eq("owner_id", user.id).order("created_at", { ascending: false }),
      supabase.from("regional_posts").select("id, category, title, body, region, created_at, status").eq("owner_id", user.id).order("created_at", { ascending: false }),
    ]);
    const mapped: FeedItem[] = [
      ...((listingsData ?? []) as Listing[]).map(l => ({ ...l, isRequest: false })),
      ...((requestsData ?? []) as any[]).map(r => ({
        id: r.id,
        category: r.category as CategoryKey,
        title: r.title,
        description: r.description,
        price: null,
        suburb: r.suburb ?? null,
        image_url: null,
        event_date: null,
        created_at: r.created_at,
        expires_at: null,
        status: r.status ?? null,
        isRequest: true,
      })),
      ...((regionalData ?? []) as any[]).map(r => ({
        id: r.id,
        category: r.category as CategoryKey,
        title: r.title,
        description: r.body ?? "",
        price: null,
        suburb: r.region ?? null,
        image_url: null,
        event_date: null,
        created_at: r.created_at,
        expires_at: null,
        status: r.status ?? null,
        isRegional: true,
      })),
    ];
    mapped.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setItems(mapped);
    setFetching(false);
  };
  useEffect(() => { refresh(); }, [user]);

  const remove = async (id: string, isRequest?: boolean, isRegional?: boolean) => {
    const label = isRegional ? "regional post" : isRequest ? "request" : "listing";
    if (!confirm(`Delete this ${label}?`)) return;
    setDeletingId(id);
    if (isRegional) {
      const { error } = await supabase.from("regional_posts").delete().eq("id", id);
      setDeletingId(null);
      if (error) { return toast.error(`Couldn't delete: ${error.message}`); }
      toast.success("Deleted");
    } else if (isRequest) {
      const { error } = await supabase.from("requests").delete().eq("id", id);
      setDeletingId(null);
      if (error) { return toast.error(`Couldn't delete: ${error.message}`); }
      toast.success("Deleted");
    } else {
      const { data: deleted, error } = await supabase.from("listings").delete().eq("id", id).select("id");
      setDeletingId(null);
      if (error) { return toast.error(`Couldn't delete: ${error.message}`); }
      if (!deleted?.length) return toast.error("Couldn't delete — you may not have permission");
      toast.success("Deleted");
    }
    refresh();
  };

  const renew = async (id: string) => {
    const newExpiry = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabase.from("listings").update({ expires_at: newExpiry, expiry_notified_at: null }).eq("id", id);
    if (error) return toast.error("Couldn't renew");
    toast.success("Renewed for 60 more days");
    refresh();
  };

  const now = Date.now();

  return (
    <div className="flex min-h-screen flex-col bg-gradient-warm">
      <SiteHeader />
      <main className="container flex-1 py-8 md:py-10">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Home
        </Link>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-3xl font-bold md:text-4xl">My posts</h1>
          <Button asChild variant="hero"><Link to="/post">Post a new listing</Link></Button>
        </div>

        {fetching ? null : items.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
            <p className="font-display text-lg">You haven't posted anything yet.</p>
            <Button asChild variant="hero" className="mt-5"><Link to="/post">Post your first listing</Link></Button>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((l) => {
              const expiresAt = l.expires_at ? new Date(l.expires_at).getTime() : null;
              const expired = expiresAt != null && expiresAt < now;
              const expiringSoon = expiresAt != null && !expired && expiresAt - now < 7 * 24 * 60 * 60 * 1000;
              return (
                <div key={l.id} className="relative">
                  <ListingCard
                    listing={l}
                    href={l.isRegional ? `/regional/${l.id}` : l.isRequest ? `/request/${l.id}` : undefined}
                    isRequest={l.isRequest}
                    linkState={{ from: "my-posts" }}
                  />
                  {l.isRegional && (
                    <span className="absolute left-3 top-12 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700 backdrop-blur">
                      <Tractor className="mr-1 inline h-3 w-3" />Regional
                    </span>
                  )}
                  {l.status === "pending" && (
                    <span className="absolute left-3 top-3 rounded-full bg-yellow-100 px-2.5 py-1 text-xs font-medium text-yellow-800 backdrop-blur">
                      Pending approval
                    </span>
                  )}
                  {l.status === "rejected" && (
                    <span className="absolute left-3 top-3 rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700 backdrop-blur">
                      Rejected
                    </span>
                  )}
                  {(expired || expiringSoon) && (
                    <span className={`absolute left-3 top-12 rounded-full px-2.5 py-1 text-xs font-medium backdrop-blur ${
                      expired ? "bg-destructive text-destructive-foreground" : "bg-background/90 text-foreground"
                    }`}>
                      {expired ? "Expired" : `Expires in ${Math.ceil((expiresAt! - now) / (24 * 60 * 60 * 1000))}d`}
                    </span>
                  )}
                  <div className="absolute bottom-3 right-3 flex gap-2">
                    {!l.isRequest && !l.isRegional && l.expires_at && (
                      <Button variant="outline" size="sm" className="bg-background" onClick={() => renew(l.id)}>
                        <RefreshCw className="h-4 w-4" /> Renew
                      </Button>
                    )}
                    <Button asChild variant="outline" size="sm" className="bg-background">
                      <Link to={l.isRegional ? `/edit-regional/${l.id}` : l.isRequest ? `/edit-request/${l.id}` : `/edit/${l.id}`}>
                        <Pencil className="h-4 w-4" /> Edit
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-background"
                      onClick={() => remove(l.id, l.isRequest, l.isRegional)}
                      disabled={deletingId === l.id}
                    >
                      {deletingId === l.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      Delete
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
};

export default MyListings;
