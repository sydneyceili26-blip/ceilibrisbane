import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Plus } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { JOB_TYPES, ITEM_TYPES, TOP_LEVEL_CATEGORIES } from "@/lib/categories";

const Categories = () => {
  useEffect(() => {
    document.title = "Browse categories - Céilí Brisbane";
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-gradient-warm">
      <SiteHeader />

      <main className="flex-1">
        <section className="container py-10 md:py-14">
          <div className="mb-8 max-w-2xl">
            <h1 className="font-display text-3xl font-bold md:text-4xl">Browse by category</h1>
            <p className="mt-2 text-muted-foreground">
              Pick what you're looking for - housing, jobs, marketplace, services, vehicles or events.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TOP_LEVEL_CATEGORIES.map((c) => (
              <Link
                key={c.key}
                to={`/c/${c.key}`}
                className="group flex flex-col gap-3 rounded-2xl border border-border bg-card p-6 shadow-soft transition-smooth hover:-translate-y-0.5 hover:shadow-card"
              >
                <span
                  className="grid h-12 w-12 place-items-center rounded-xl transition-smooth group-hover:scale-110"
                  style={{
                    backgroundColor: `hsl(var(${c.colorVar}) / 0.12)`,
                    color: `hsl(var(${c.colorVar}))`,
                  }}
                >
                  <c.icon className="h-6 w-6" />
                </span>
                <div>
                  <h2 className="font-display text-lg font-semibold">{c.label}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{c.description}</p>
                </div>
                {c.subs && (
                  <p className="text-xs text-muted-foreground">
                    Includes: {c.subs.filter((s) => s !== "room").map((s) => ({ sublet: "Sublets", lease_takeover: "Lease takeovers" }[s as "sublet" | "lease_takeover"])).join(" · ")}
                  </p>
                )}
                {c.key === "job" && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {JOB_TYPES.slice(0, 6).map((j) => j.label).join(" · ")} · …
                  </p>
                )}
                {c.key === "for_sale" && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {ITEM_TYPES.slice(0, 6).map((i) => i.label).join(" · ")} · …
                  </p>
                )}
                <span className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-primary">
                  Browse <ArrowRight className="h-4 w-4 transition-smooth group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-dashed border-border bg-card/50 p-6">
            <div>
              <p className="font-display text-lg">Got something to share?</p>
              <p className="text-sm text-muted-foreground">Posting takes under a minute - no account required.</p>
            </div>
            <Button asChild variant="hero">
              <Link to="/post"><Plus className="h-4 w-4" /> Post a listing</Link>
            </Button>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
};

export default Categories;
