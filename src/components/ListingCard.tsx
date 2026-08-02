import { useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { CATEGORY_MAP, JOB_TYPE_MAP, ITEM_TYPE_MAP, formatPrice, type CategoryKey, type JobType, type ItemType } from "@/lib/categories";
import { formatDistanceToNow } from "date-fns";
import FavouriteButton from "@/components/FavouriteButton";

export interface Listing {
  id: string;
  category: CategoryKey;
  title: string;
  description: string;
  price: number | null;
  suburb: string | null;
  image_url: string | null;
  image_urls?: string[] | null;
  event_date: string | null;
  created_at: string;
  expires_at?: string | null;
  job_type?: string | null;
  item_type?: string | null;
  status?: string | null;
}

const ListingCard = ({ listing, href, isRequest, linkState }: { listing: Listing; href?: string; isRequest?: boolean; linkState?: Record<string, unknown> }) => {
  const [photoIdx, setPhotoIdx] = useState(0);

  const meta = CATEGORY_MAP[listing.category];
  if (!meta) return null;
  const Icon = meta.icon;
  const price = formatPrice(listing.price, listing.category);

  const photos = (listing.image_urls?.filter(Boolean).length
    ? listing.image_urls!.filter(Boolean)
    : listing.image_url
    ? [listing.image_url]
    : []) as string[];
  const photoCount = photos.length;
  const cover = photos[photoIdx] ?? null;

  const goPrev = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setPhotoIdx(i => (i - 1 + photoCount) % photoCount);
  };

  const goNext = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setPhotoIdx(i => (i + 1) % photoCount);
  };

  return (
    <Link
      to={href ?? `/listing/${listing.id}`}
      state={linkState}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-gradient-card shadow-soft transition-smooth hover:-translate-y-0.5 hover:shadow-card"
    >
      <div
        className="relative aspect-[4/3] overflow-hidden bg-secondary"
        style={{ backgroundColor: `hsl(var(${meta.colorVar}) / 0.08)` }}
      >
        {cover ? (
          <img
            src={cover}
            alt={listing.title}
            loading="lazy"
            className={`h-full w-full transition-smooth ${listing.category === "event" || listing.category === "job" ? "object-contain bg-secondary/40" : "object-cover"}`}
          />
        ) : (
          <div className="grid h-full w-full place-items-center">
            <Icon className="h-12 w-12" style={{ color: `hsl(var(${meta.colorVar}))` }} />
          </div>
        )}
        {photoCount > 1 && (
          <>
            <button
              onClick={goPrev}
              aria-label="Previous photo"
              className="absolute left-1.5 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/40 p-1 text-white backdrop-blur-sm transition-opacity"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={goNext}
              aria-label="Next photo"
              className="absolute right-1.5 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/40 p-1 text-white backdrop-blur-sm transition-opacity"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-1">
              {photos.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 w-1.5 rounded-full ${i === photoIdx ? "bg-white" : "bg-white/45"}`}
                />
              ))}
            </div>
          </>
        )}
        <span
          className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-background/90 px-2.5 py-1 text-xs font-medium backdrop-blur"
          style={{ color: `hsl(var(${meta.colorVar}))` }}
        >
          <Icon className="h-3.5 w-3.5" />
          {meta.short}
        </span>
        {isRequest && (
          <span className="absolute right-3 top-3 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700 backdrop-blur">
            Wanted
          </span>
        )}
        {listing.category === "job" && listing.job_type && JOB_TYPE_MAP[listing.job_type as JobType] && (
          <span className="absolute right-3 top-3 rounded-full bg-background/90 px-2.5 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            {JOB_TYPE_MAP[listing.job_type as JobType].label}
          </span>
        )}
        {listing.category === "for_sale" && listing.item_type && ITEM_TYPE_MAP[listing.item_type as ItemType] && (
          <span className="absolute right-3 top-3 rounded-full bg-background/90 px-2.5 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            {ITEM_TYPE_MAP[listing.item_type as ItemType].label}
          </span>
        )}
        <FavouriteButton listingId={listing.id} className="absolute bottom-3 right-3" />
      </div>

      <div className="relative flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 font-display text-lg font-semibold leading-snug">{listing.title}</h3>
        {price && <p className="font-semibold text-primary">{price}</p>}
        <p className="line-clamp-2 text-sm text-muted-foreground">{listing.description}</p>

        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 text-xs text-muted-foreground">
          {listing.suburb && (
            <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{listing.suburb}</span>
          )}
          {listing.category === "event" && listing.event_date && (
            <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />
              {new Date(listing.event_date).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
            </span>
          )}
          <span className="ml-auto">{formatDistanceToNow(new Date(listing.created_at), { addSuffix: true })}</span>
        </div>
      </div>
    </Link>
  );
};

export default ListingCard;
