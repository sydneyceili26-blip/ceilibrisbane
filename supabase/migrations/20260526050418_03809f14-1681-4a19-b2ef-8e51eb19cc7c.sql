DROP POLICY IF EXISTS "Starter can create conversation" ON public.conversations;

CREATE POLICY "Starter can create conversation"
ON public.conversations
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = starter_id
  AND starter_id <> owner_id
  AND EXISTS (
    SELECT 1 FROM public.listings l
    WHERE l.id = listing_id
      AND l.owner_id = conversations.owner_id
      AND l.owner_id IS NOT NULL
  )
);