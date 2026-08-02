import { Briefcase, Home, KeyRound, FileSignature, Tag, Wrench, PartyPopper, Building2, Car, HeartPulse, type LucideIcon } from "lucide-react";

export type CategoryKey =
  | "job"
  | "room"
  | "sublet"
  | "lease_takeover"
  | "for_sale"
  | "service"
  | "event"
  | "car"
  | "sports_wellness";

export interface CategoryMeta {
  key: CategoryKey;
  label: string;
  short: string;
  description: string;
  icon: LucideIcon;
  /** Tailwind text color token suffix (matches index.css --cat-*) */
  colorVar: string;
}

export const CATEGORIES: CategoryMeta[] = [
  { key: "room", label: "Rooms available", short: "Rooms", description: "Spare rooms in shared houses & apartments", icon: Home, colorVar: "--cat-room" },
  { key: "sublet", label: "Sublets", short: "Sublets", description: "Short-term sublets across Perth", icon: KeyRound, colorVar: "--cat-sublet" },
  { key: "lease_takeover", label: "Lease takeovers", short: "Lease takeover", description: "Take over an existing lease", icon: FileSignature, colorVar: "--cat-lease" },
  { key: "job", label: "Jobs", short: "Jobs", description: "Casual, part-time and full-time roles", icon: Briefcase, colorVar: "--cat-job" },
  { key: "for_sale", label: "Marketplace", short: "Marketplace", description: "Buy and sell furniture, appliances, and anything in between", icon: Tag, colorVar: "--cat-sale" },
  { key: "service", label: "Services", short: "Services", description: "Moving, tutoring, trades, help on offer", icon: Wrench, colorVar: "--cat-service" },
  { key: "event", label: "Events", short: "Events", description: "Events, meet ups, sessions & socials", icon: PartyPopper, colorVar: "--cat-event" },
  { key: "car", label: "Vehicles", short: "Vehicles", description: "Cars and vehicles for sale across Perth", icon: Car, colorVar: "--cat-sale" },
  { key: "sports_wellness", label: "Sports & wellness", short: "Sports & wellness", description: "GAA clubs, gyms, classes, coaches and wellbeing", icon: HeartPulse, colorVar: "--cat-wellness" },
];

export const CATEGORY_MAP: Record<CategoryKey, CategoryMeta> = Object.fromEntries(
  CATEGORIES.map((c) => [c.key, c])
) as Record<CategoryKey, CategoryMeta>;

/** Housing group - bundles rooms, sublets and lease takeovers into one top-level category. */
export const HOUSING_KEY = "housing" as const;
export type HousingSub = "room" | "sublet" | "lease_takeover";
export const HOUSING_SUBS: HousingSub[] = ["room", "sublet", "lease_takeover"];
/** Subset of housing subs shown as filter chips in the UI (rooms hidden by request). */
export const HOUSING_FILTER_SUBS: HousingSub[] = ["sublet", "lease_takeover"];

export interface GroupMeta {
  key: typeof HOUSING_KEY;
  label: string;
  short: string;
  description: string;
  icon: LucideIcon;
  colorVar: string;
  subs: HousingSub[];
}

export const HOUSING_META: GroupMeta = {
  key: HOUSING_KEY,
  label: "Housing",
  short: "Housing",
  description: "Sublets and lease takeovers across Perth",
  icon: Building2,
  colorVar: "--cat-room",
  subs: HOUSING_SUBS,
};

/** Top-level navigation categories shown on the homepage and header. */
export type TopLevelKey = typeof HOUSING_KEY | Exclude<CategoryKey, HousingSub>;

export interface TopLevelMeta {
  key: TopLevelKey;
  label: string;
  short: string;
  description: string;
  icon: LucideIcon;
  colorVar: string;
  /** Subcategory keys when this is a group. */
  subs?: HousingSub[];
}

export const TOP_LEVEL_CATEGORIES: TopLevelMeta[] = [
  HOUSING_META,
  ...(["job", "for_sale", "car", "service", "event", "sports_wellness"] as const).map((k) => CATEGORY_MAP[k] as TopLevelMeta),
];

/** Job industry sub-categories (free-form text stored in listings.job_type). */
export type JobType =
  | "construction"
  | "hospitality"
  | "retail"
  | "sales"
  | "office_admin"
  | "healthcare"
  | "science"
  | "tech"
  | "trades"
  | "education"
  | "transport"
  | "creative"
  | "other";

export interface JobTypeMeta { key: JobType; label: string }

export const JOB_TYPES: JobTypeMeta[] = [
  { key: "construction", label: "Construction" },
  { key: "hospitality", label: "Hospitality" },
  { key: "retail", label: "Retail" },
  { key: "sales", label: "Sales" },
  { key: "office_admin", label: "Office & Admin" },
  { key: "healthcare", label: "Healthcare" },
  { key: "science", label: "Science & Research" },
  { key: "tech", label: "Tech & IT" },
  { key: "trades", label: "Trades" },
  { key: "education", label: "Education" },
  { key: "transport", label: "Transport & Logistics" },
  { key: "creative", label: "Creative & Media" },
  { key: "other", label: "Other" },
];

export const JOB_TYPE_MAP: Record<JobType, JobTypeMeta> = Object.fromEntries(
  JOB_TYPES.map((j) => [j.key, j]),
) as Record<JobType, JobTypeMeta>;

/** For-sale item type sub-categories (free-form text stored in listings.item_type). */
export type ItemType =
  | "fridge"
  | "washing_machine"
  | "appliance"
  | "couch"
  | "bed"
  | "table"
  | "furniture"
  | "clothing"
  | "electronics"
  | "kitchen"
  | "bike"
  | "sports"
  | "books"
  | "other";

export interface ItemTypeMeta { key: ItemType; label: string }

export const ITEM_TYPES: ItemTypeMeta[] = [
  { key: "fridge", label: "Fridges" },
  { key: "washing_machine", label: "Washing machines" },
  { key: "appliance", label: "Other appliances" },
  { key: "couch", label: "Couches" },
  { key: "bed", label: "Beds & mattresses" },
  { key: "table", label: "Tables & chairs" },
  { key: "furniture", label: "Other furniture" },
  { key: "clothing", label: "Clothing" },
  { key: "electronics", label: "Electronics" },
  { key: "kitchen", label: "Kitchen & homeware" },
  { key: "bike", label: "Bikes" },
  { key: "sports", label: "Sports & outdoors" },
  { key: "books", label: "Books & media" },
  { key: "other", label: "Other" },
];

export const ITEM_TYPE_MAP: Record<ItemType, ItemTypeMeta> = Object.fromEntries(
  ITEM_TYPES.map((i) => [i.key, i]),
) as Record<ItemType, ItemTypeMeta>;

export const formatPrice = (price: number | null | undefined, category: CategoryKey) => {
  if (price == null) return null;
  const formatted = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(price);
  if (category === "room" || category === "sublet" || category === "lease_takeover") return `${formatted} / week`;
  if (category === "job") return `${formatted} / year`;
  return formatted;
};
