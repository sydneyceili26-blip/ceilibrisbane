import { useEffect, useState } from "react";
import { useParams, Link, useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, MapPin, Loader2, Lock, Pencil, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRoles } from "@/hooks/useUserRole";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { CATEGORY_MAP, type CategoryKey } from "@/lib/categories";
import { Button } from "@/components/ui/button";
import ChatWithPosterButton from "@/components/ChatWithPosterButton";
import ScamWarning from "@/components/ScamWarning";
import UserAvatar from "@/components/UserAvatar";
import { toast } from "sonner";

const RequestDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { isModerator } = useUserRoles();
  const navigate = useNavigate();
  const { state: navState } = useLocation();
  const [request, setRequest] = useState<any>(null);
  const [ownerAvatar, setOwnerAvatar] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!request) return;
    if (!confirm(`Delete "${request.title}"? This cannot be undone.`)) return;
    setDeleting(true);
    const { error } = await supabase.from("requests").delete().eq("id", request.id);
    setDeleting(false);
    if (error) { toast.error("Couldn't delete. Try again."); return; }
    toast.success("Request deleted");
    navigate(`/c/${request.category}`);
  };

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("requests").select("*").eq("id", id!).maybeSingle();
      setRequest(data);
      if (data) {
        document.title = `${data.title} - Céilí Brisbane`;
        if (data.owner_id) {
          const { data: prof } = await supabase
            .from("profiles").select("avatar_url").eq("id", data.owner_id).maybeSingle();
          setOwnerAvatar(prof?.avatar_url ?? null);
        }
      }
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-gradient-warm">
        <SiteHeader />
        <main className="container flex-1 py-16 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></main>
        <SiteFooter />
      </div>
    );
  }

  if (!request) {
    return (
      <div className="flex min-h-screen flex-col bg-gradient-warm">
        <SiteHeader />
        <main className="container flex-1 py-16 text-center text-muted-foreground">Request not found.</main>
        <SiteFooter />
      </div>
    );
  }

  const meta = CATEGORY_MAP[request.category as CategoryKey];
  const Icon = meta?.icon;

  return (
    <div className="flex min-h-screen flex-col bg-gradient-warm">
      <SiteHeader />
      <main className="container flex-1 py-8 md:py-12">
        <div className="mx-auto max-w-4xl">
          {navState?.from === "admin" ? (
            <Link to="/admin" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Back to moderation
            </Link>
          ) : navState?.from === "my-posts" ? (
            <Link to="/my-posts" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> My posts
            </Link>
          ) : navState?.from === "messages" ? (
            <Link to={`/messages/${navState.conversationId}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Back to chat
            </Link>
          ) : (
            <Link to={`/c/${request.category}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Back to {meta?.label.toLowerCase() ?? "category"}
            </Link>
          )}

          <div className="mt-6 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
            {/* Main content */}
            <div className="rounded-2xl border border-border bg-card p-6 shadow-card md:p-8">
              <div className="flex flex-wrap items-center gap-2">
                {meta && (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-medium"
                    style={{ color: `hsl(var(${meta.colorVar}))` }}
                  >
                    {Icon && <Icon className="h-3.5 w-3.5" />}
                    {meta.short}
                  </span>
                )}
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
                  Wanted
                </span>
              </div>

              <h1 className="mt-4 font-display text-2xl font-bold md:text-3xl">{request.title}</h1>

              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                {request.suburb && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />{request.suburb}
                  </span>
                )}
                <span>{formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}</span>
              </div>

              <p className="mt-6 whitespace-pre-line text-sm leading-relaxed">{request.description}</p>

              {request.link_url && (
                <a href={request.link_url} target="_blank" rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
                  🔗 View link
                </a>
              )}

              {(() => {
                const imgs = request.image_urls?.length ? request.image_urls : request.image_url ? [request.image_url] : [];
                return imgs.length > 0 ? (
                  <div className="mt-6 grid gap-2 grid-cols-2 sm:grid-cols-3">
                    {imgs.map((url: string, i: number) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                        <img src={url} alt={`Photo ${i + 1}`} className="aspect-square w-full rounded-xl object-cover hover:opacity-90 transition-opacity" />
                      </a>
                    ))}
                  </div>
                ) : null;
              })()}
            </div>

            {/* Sidebar */}
            <aside className="h-fit rounded-2xl border border-border bg-card p-6 shadow-card lg:sticky lg:top-24">
              <h2 className="font-display text-lg font-semibold">Get in touch</h2>
              <p className="mt-1 text-sm text-muted-foreground">Send a message to the person looking.</p>

              <div className="mt-5 flex items-center gap-3">
                <UserAvatar url={ownerAvatar} name={request.contact_name} size={40} expandable />
                <span className="font-medium">{request.contact_name}</span>
              </div>

              <div className="mt-5 space-y-2">
                {!user ? (
                  <div className="rounded-lg border border-border bg-secondary/40 p-3">
                    <p className="flex items-center gap-2 text-xs font-medium">
                      <Lock className="h-3.5 w-3.5" /> Sign in to send a message
                    </p>
                    <Button asChild variant="hero" size="sm" className="mt-3 w-full">
                      <Link to="/auth">Sign in</Link>
                    </Button>
                  </div>
                ) : (
                  // Reuse ChatWithPosterButton — request.id acts as the listingId since
                  // conversations.listing_id has no FK constraint, so any UUID works.
                  <ChatWithPosterButton listingId={request.id} ownerId={request.owner_id} />
                )}
              </div>

              <ScamWarning variant="compact" className="mt-4" />

              {(user && user.id === request.owner_id || isModerator) && (
                <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
                  <Button asChild variant="outline" size="sm" className="w-full">
                    <Link to={`/edit-request/${request.id}`}>
                      <Pencil className="h-4 w-4" /> Edit request
                    </Link>
                  </Button>
                  <Button variant="destructive" size="sm" className="w-full" onClick={handleDelete} disabled={deleting}>
                    <Trash2 className="h-4 w-4" />
                    {deleting ? "Deleting…" : "Delete request"}
                  </Button>
                </div>
              )}
            </aside>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
};

export default RequestDetail;
