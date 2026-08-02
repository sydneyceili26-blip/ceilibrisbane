import { useEffect, useState } from "react";
import { Link, useParams, useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, MapPin, Calendar, Mail, Phone, Share2, Link as LinkIcon, MessageCircle, X, Lock, Trash2, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRoles } from "@/hooks/useUserRole";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { CATEGORY_MAP, formatPrice } from "@/lib/categories";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import FavouriteButton from "@/components/FavouriteButton";
import ReportDialog from "@/components/ReportDialog";
import BlockButton from "@/components/BlockButton";
import ChatWithPosterButton from "@/components/ChatWithPosterButton";
import { useBlockedUsers } from "@/hooks/useBlockedUsers";
import ScamWarning from "@/components/ScamWarning";
import AdBanner from "@/components/AdBanner";
import UserAvatar from "@/components/UserAvatar";
import { formatDistanceToNow } from "date-fns";
import type { Listing } from "@/components/ListingCard";

interface FullListing extends Listing {
  contact_name: string;
  owner_id: string | null;
  ticket_url: string | null;
}

interface Contact {
  contact_email: string | null;
  contact_phone: string | null;
}

const ListingDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { state: navState } = useLocation();
  const { user } = useAuth();
  const { isModerator } = useUserRoles();
  const { blockedIds, blockUser, unblockUser } = useBlockedUsers();
  const [listing, setListing] = useState<FullListing | null>(null);
  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [ownerAvatar, setOwnerAvatar] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const photos = listing
    ? (listing.image_urls && listing.image_urls.length > 0
        ? listing.image_urls
        : listing.image_url
        ? [listing.image_url]
        : [])
    : [];
  const activePhoto = photos[activeIdx];

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const shareTitle = listing?.title ?? "Céilí Brisbane listing";

  const handleShare = async () => {
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try {
        await (navigator as any).share({ title: shareTitle, url: shareUrl });
        return;
      } catch { /* user cancelled */ }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({ title: "Link copied", description: "Share it anywhere you like." });
    } catch {
      toast({ title: "Couldn't copy link", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!listing) return;
    if (!confirm(`Delete "${listing.title}"? This cannot be undone.`)) return;
    setDeleting(true);
    const { data: deleted, error } = await supabase.from("listings").delete().eq("id", listing.id).select("id");
    setDeleting(false);
    if (error) {
      console.error("Delete listing error:", error);
      toast({ title: "Couldn't delete", description: error.message, variant: "destructive" });
      return;
    }
    if (!deleted?.length) {
      toast({ title: "Couldn't delete", description: "No rows affected — check permissions", variant: "destructive" });
      return;
    }
    toast({ title: "Listing deleted" });
    navigate("/");
  };

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data } = await supabase.from("listings").select("*").eq("id", id).maybeSingle();
      if (data) {
        setListing(data as FullListing);
        document.title = `${data.title} - Céilí Brisbane`;
        if (data.owner_id) {
          const { data: prof } = await supabase
            .from("profiles").select("avatar_url").eq("id", data.owner_id).maybeSingle();
          setOwnerAvatar(prof?.avatar_url ?? null);
        }
        if (user) {
          const { data: c } = await supabase
            .from("listing_contacts")
            .select("contact_email, contact_phone")
            .eq("listing_id", id)
            .maybeSingle();
          setContact(c ?? null);
        } else {
          setContact(null);
        }
      }
      setLoading(false);
    })();
  }, [id, user]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-gradient-warm">
        <SiteHeader />
        <main className="container flex-1 py-10">
          <div className="aspect-[16/9] animate-pulse rounded-2xl bg-secondary/60" />
        </main>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="flex min-h-screen flex-col bg-gradient-warm">
        <SiteHeader />
        <main className="container flex-1 py-20 text-center">
          <h1 className="font-display text-2xl">Listing not found</h1>
          <Button asChild variant="hero" className="mt-6">
            <Link to="/">Back home</Link>
          </Button>
        </main>
      </div>
    );
  }

  const meta = CATEGORY_MAP[listing.category];
  if (!meta) {
    return (
      <div className="flex min-h-screen flex-col bg-gradient-warm">
        <SiteHeader />
        <main className="container flex-1 py-20 text-center">
          <h1 className="font-display text-2xl">Listing not found</h1>
          <Button asChild variant="hero" className="mt-6">
            <Link to="/">Back home</Link>
          </Button>
        </main>
      </div>
    );
  }
  const Icon = meta.icon;
  const price = formatPrice(listing.price, listing.category);

  return (
    <div className="flex min-h-screen flex-col bg-gradient-warm">
      <SiteHeader />

      <main className="container flex-1 py-8 md:py-10">
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
          <Link to={`/c/${listing.category}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to {meta.label.toLowerCase()}
          </Link>
        )}

        <div className="mt-6 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <button
              type="button"
              onClick={() => activePhoto && setZoom(true)}
              aria-label={activePhoto ? "View full image" : undefined}
              className="block w-full aspect-[16/10] overflow-hidden rounded-2xl border border-border shadow-card"
              style={{ backgroundColor: `hsl(var(${meta.colorVar}) / 0.08)` }}
            >
              {activePhoto ? (
                <img src={activePhoto} alt={listing.title} className={`h-full w-full cursor-zoom-in transition-smooth ${listing.category === "event" || listing.category === "job" ? "object-contain bg-secondary/40" : "object-cover hover:scale-[1.02]"}`} />
              ) : (
                <div className="grid h-full w-full place-items-center">
                  <Icon className="h-20 w-20" style={{ color: `hsl(var(${meta.colorVar}))` }} />
                </div>
              )}
            </button>

            {photos.length > 1 && (
              <div className="mt-3 grid grid-cols-5 gap-2">
                {photos.map((url, i) => (
                  <button
                    key={url}
                    type="button"
                    onClick={() => setActiveIdx(i)}
                    className={`aspect-square overflow-hidden rounded-lg border-2 transition-smooth ${
                      i === activeIdx ? "border-primary" : "border-transparent opacity-70 hover:opacity-100"
                    }`}
                  >
                    <img src={url} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            <div className="mt-6">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
                style={{ backgroundColor: `hsl(var(${meta.colorVar}) / 0.12)`, color: `hsl(var(${meta.colorVar}))` }}
              >
                <Icon className="h-3.5 w-3.5" /> {meta.short}
              </span>
              <h1 className="mt-3 font-display text-3xl font-bold leading-tight md:text-4xl">{listing.title}</h1>
              {price && <p className="mt-2 text-2xl font-semibold text-primary">{price}</p>}

              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                {listing.suburb && <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" />{listing.suburb}</span>}
                {listing.event_date && (
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {new Date(listing.event_date).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" })}
                  </span>
                )}
                <span>Posted {formatDistanceToNow(new Date(listing.created_at), { addSuffix: true })}</span>
              </div>

              {listing.ticket_url && (
                <a
                  href={listing.ticket_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  {listing.category === "event" ? "🎟 Get tickets" : "🔗 View link"}
                </a>
              )}

              <div className="prose prose-sm mt-6 max-w-none whitespace-pre-wrap text-foreground">
                {listing.description}
              </div>
            </div>
          </div>

          <aside className="h-fit rounded-2xl border border-border bg-card p-6 shadow-card lg:sticky lg:top-24">
            <h2 className="font-display text-lg font-semibold">Get in touch</h2>
            <p className="mt-1 text-sm text-muted-foreground">Reach out directly to the poster.</p>

            <div className="mt-5 space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <UserAvatar url={ownerAvatar} name={listing.contact_name} size={40} expandable />
                <span className="font-medium">{listing.contact_name}</span>
              </div>
              {!user ? (
                <div className="rounded-lg border border-border bg-secondary/40 p-3">
                  <p className="flex items-center gap-2 text-xs font-medium">
                    <Lock className="h-3.5 w-3.5" /> Sign in to view contact details
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    We hide phone and email from anonymous visitors to protect posters from spam and scrapers.
                  </p>
                  <Button asChild variant="hero" size="sm" className="mt-3">
                    <Link to="/auth">Sign in to see contact</Link>
                  </Button>
                </div>
              ) : (
                <>
                  {contact?.contact_email && (
                    <a href={`mailto:${contact.contact_email}?subject=${encodeURIComponent(listing.title)}`}
                       className="flex items-center gap-3 text-primary hover:underline">
                      <Mail className="h-4 w-4" /> {contact.contact_email}
                    </a>
                  )}
                  {contact?.contact_phone && (
                    <a href={`tel:${contact.contact_phone}`} className="flex items-center gap-3 text-primary hover:underline">
                      <Phone className="h-4 w-4" /> {contact.contact_phone}
                    </a>
                  )}
                  {!contact?.contact_email && !contact?.contact_phone && (
                    <div className="rounded-lg border border-border bg-secondary/40 p-3">
                      <p className="text-xs text-muted-foreground">
                        Contact details are only shared with the poster and people they're chatting with. Start a chat below to get in touch.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="mt-5 space-y-2">
              <ChatWithPosterButton listingId={listing.id} ownerId={listing.owner_id} />
              {user && contact?.contact_email && (
                <Button asChild variant="outline" className="w-full">
                  <a href={`mailto:${contact.contact_email}?subject=${encodeURIComponent(listing.title)}`}>
                    <Mail className="h-4 w-4" /> Send email
                  </a>
                </Button>
              )}
              <p className="text-center text-xs text-muted-foreground">
                No phone or email? Chat right here in the app.
              </p>
            </div>

            <ScamWarning variant="compact" className="mt-4" />
            <AdBanner slot="4140904024" className="mt-4" />

            <div className="mt-5 border-t border-border pt-5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Share this listing</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(`${shareTitle} - ${shareUrl}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MessageCircle className="h-4 w-4" /> WhatsApp
                  </a>
                </Button>
                <Button variant="outline" size="sm" onClick={handleShare}>
                  <Share2 className="h-4 w-4" /> Share
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(shareUrl);
                      toast({ title: "Link copied" });
                    } catch {
                      toast({ title: "Couldn't copy link", variant: "destructive" });
                    }
                  }}
                >
                  <LinkIcon className="h-4 w-4" /> Copy link
                </Button>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-5">
              <FavouriteButton listingId={listing.id} variant="full" />
              <ReportDialog listingId={listing.id} />
            </div>
            {user && listing.owner_id && user.id !== listing.owner_id && (
              <div className="mt-3">
                <BlockButton
                  blockedIds={blockedIds}
                  userId={listing.owner_id}
                  userName={listing.contact_name}
                  onBlock={blockUser}
                  onUnblock={unblockUser}
                  className="w-full"
                />
              </div>
            )}
            {(user && user.id === listing.owner_id || isModerator) && (
              <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link to={`/edit/${listing.id}`}>
                    <Pencil className="h-4 w-4" /> Edit listing
                  </Link>
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  <Trash2 className="h-4 w-4" />
                  {deleting ? "Deleting…" : "Delete listing"}
                </Button>
              </div>
            )}
          </aside>
        </div>
      </main>

      {activePhoto && (
        <Dialog open={zoom} onOpenChange={setZoom}>
          <DialogContent className="max-w-5xl border-0 bg-transparent p-0 shadow-none">
            <button
              onClick={() => setZoom(false)}
              aria-label="Close"
              className="absolute right-2 top-2 z-10 rounded-full bg-background/80 p-2 text-foreground hover:bg-background"
            >
              <X className="h-4 w-4" />
            </button>
            <img src={activePhoto} alt={listing.title} className="h-auto max-h-[85vh] w-full rounded-lg object-contain" />
          </DialogContent>
        </Dialog>
      )}

      <SiteFooter />
    </div>
  );
};

export default ListingDetail;
