-- Fix: add columns that exist in Sydney's database but were never migrated to Melbourne

-- 1. ticket_url on listings (for event ticket links)
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS ticket_url TEXT;

-- 2. updated_at on listings (used by admin edit flow)
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- 3. expiry_notified_at on listings (used by notify-expiring-posts function)
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS expiry_notified_at TIMESTAMPTZ;

-- 4. image_url + image_urls + link_url on requests table
ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS image_url TEXT;

ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS image_urls TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS link_url TEXT;
