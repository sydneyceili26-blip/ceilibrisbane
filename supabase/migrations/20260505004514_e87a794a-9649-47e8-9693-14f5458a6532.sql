CREATE TABLE public.questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  author_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  body text NOT NULL,
  author_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX answers_question_id_idx ON public.answers(question_id);
CREATE INDEX questions_created_at_idx ON public.questions(created_at DESC);

ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view questions" ON public.questions FOR SELECT USING (true);
CREATE POLICY "Anyone can create questions" ON public.questions FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can view answers" ON public.answers FOR SELECT USING (true);
CREATE POLICY "Anyone can create answers" ON public.answers FOR INSERT WITH CHECK (true);