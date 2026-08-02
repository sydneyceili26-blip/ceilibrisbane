import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MessageCircle, Plus, Search, ArrowLeft } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Question {
  id: string;
  title: string;
  body: string;
  author_name: string | null;
  created_at: string;
  answer_count: number;
  latest_answer?: { body: string; author_name: string | null; created_at: string } | null;
}

const Community = () => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    document.title = "Community Q&A - Céilí Brisbane";
    (async () => {
      const { data: qs } = await supabase
        .from("questions")
        .select("*")
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(200);
      const ids = (qs ?? []).map((x: any) => x.id);
      let counts: Record<string, number> = {};
      let latest: Record<string, { body: string; author_name: string | null; created_at: string }> = {};
      if (ids.length) {
        const { data: ans } = await supabase
          .from("answers")
          .select("question_id, body, author_name, created_at")
          .in("question_id", ids)
          .order("created_at", { ascending: false });
        for (const a of (ans ?? []) as any[]) {
          counts[a.question_id] = (counts[a.question_id] ?? 0) + 1;
          if (!latest[a.question_id]) {
            latest[a.question_id] = { body: a.body, author_name: a.author_name, created_at: a.created_at };
          }
        }
      }
      setQuestions(((qs ?? []) as any[]).map((x) => ({ ...x, answer_count: counts[x.id] ?? 0, latest_answer: latest[x.id] ?? null })));
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return questions;
    return questions.filter((x) =>
      [x.title, x.body].some((s) => s.toLowerCase().includes(term)),
    );
  }, [questions, q]);

  return (
    <div className="flex min-h-screen flex-col bg-gradient-warm">
      <SiteHeader />
      <main className="flex-1">
        <section className="border-b border-border/60 bg-secondary/40">
          <div className="container py-10 md:py-14">
            <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Home
            </Link>
            <div className="mt-4 flex items-start gap-4">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/15 text-primary">
                <MessageCircle className="h-7 w-7" />
              </span>
              <div className="flex-1">
                <h1 className="font-display text-3xl font-bold md:text-4xl">Community Q&amp;A</h1>
                <p className="mt-1 text-muted-foreground">
                  Ask the Perth community anything - visas, suburbs, jobs, banks, the lot.
                </p>
              </div>
              <Button asChild variant="hero" className="hidden sm:inline-flex">
                <Link to="/community/ask"><Plus className="h-4 w-4" /> Ask</Link>
              </Button>
            </div>

            <div className="mt-6 flex items-center gap-2 rounded-full border border-border bg-background p-1.5 shadow-soft">
              <Search className="ml-3 h-4 w-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search questions…"
                className="border-0 bg-transparent shadow-none focus-visible:ring-0"
              />
            </div>
          </div>
        </section>

        <section className="container py-8 md:py-10">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {loading ? "Loading…" : `${filtered.length} question${filtered.length === 1 ? "" : "s"}`}
            </p>
            <Button asChild variant="hero" size="sm" className="sm:hidden">
              <Link to="/community/ask"><Plus className="h-4 w-4" /> Ask</Link>
            </Button>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-2xl bg-secondary/60" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
              <p className="font-display text-lg">No questions yet - be the first to ask!</p>
              <Button asChild variant="hero" className="mt-5">
                <Link to="/community/ask"><Plus className="h-4 w-4" /> Ask a question</Link>
              </Button>
            </div>
          ) : (
            <ul className="space-y-3">
              {filtered.map((qu) => (
                <li key={qu.id}>
                  <Link
                    to={`/community/${qu.id}`}
                    className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-5 shadow-soft transition-smooth hover:-translate-y-0.5 hover:shadow-card"
                  >
                    <h2 className="font-display text-lg font-semibold leading-snug">{qu.title}</h2>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>by {qu.author_name?.trim() || "Anonymous"}</span>
                      <span>·</span>
                      <span>{formatDistanceToNow(new Date(qu.created_at), { addSuffix: true })}</span>
                      <span className="ml-auto inline-flex items-center gap-1 font-medium text-primary">
                        <MessageCircle className="h-3.5 w-3.5" />
                        {qu.answer_count} {qu.answer_count === 1 ? "reply" : "replies"}
                      </span>
                    </div>
                    {qu.latest_answer && (
                      <div className="mt-1 rounded-xl border-l-2 border-primary/40 bg-secondary/40 px-3 py-2">
                        <p className="text-xs font-medium text-muted-foreground">
                          Latest reply by {qu.latest_answer.author_name?.trim() || "Anonymous"} · {formatDistanceToNow(new Date(qu.latest_answer.created_at), { addSuffix: true })}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-sm text-foreground/90">{qu.latest_answer.body}</p>
                      </div>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
};

export default Community;
