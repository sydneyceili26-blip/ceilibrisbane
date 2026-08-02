CREATE POLICY "Anyone can delete questions" ON public.questions FOR DELETE TO public USING (true);
CREATE POLICY "Anyone can delete answers" ON public.answers FOR DELETE TO public USING (true);