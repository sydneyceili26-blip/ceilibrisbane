ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS job_type text;
CREATE INDEX IF NOT EXISTS listings_job_type_idx ON public.listings (job_type) WHERE job_type IS NOT NULL;