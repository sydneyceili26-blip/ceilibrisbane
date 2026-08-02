import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

const About = () => {
  useEffect(() => { document.title = "About - Céilí Brisbane"; }, []);

  return (
    <div className="flex min-h-screen flex-col bg-gradient-warm">
      <SiteHeader />
      <main className="container flex-1 py-10 md:py-16">
        <div className="mx-auto max-w-2xl">
          <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Home
          </Link>

          <h1 className="mt-6 font-display text-4xl font-bold md:text-5xl">About us</h1>

          <div className="mt-8 space-y-5 text-base leading-relaxed text-muted-foreground">
            <p>
              Céilí was created by Liam and James, two Irish lads who made the move to Australia and quickly
              realised how tough it can be to get set up when you first arrive in a new city.
            </p>
            <p>
              When we landed, there was no one place to find what you actually need — housing, cars, jobs,
              furniture, or even clubs and events to meet people. We found ourselves endlessly scrolling
              through different pages, chasing posts that were already snapped up or weeks out of date.
            </p>
            <p className="font-medium text-foreground">It was a bit of a nightmare, to be honest.</p>
            <p className="font-semibold text-foreground">So we decided to build something better.</p>
            <p>
              Céilí brings everything together in one place, making it easier, quicker, and far less
              stressful to get yourself sorted in Perth. No more wasting time trawling through endless
              posts — just the things you need, when you need them.
            </p>
            <p>
              Whether you're looking for a place to live, a car to get around, a job to get started, or
              just a way to meet people and get involved, Céilí's here to help you settle in and get stuck
              into the good life.
            </p>
          </div>

          <div className="mt-10 overflow-hidden rounded-2xl border border-border shadow-card">
            <img src="/team.jpeg" alt="Lossy and Pom" className="w-full object-cover" />
            <div className="flex justify-around bg-card px-4 py-3 text-sm text-muted-foreground">
              <span>← Lossy</span>
              <span>Pom →</span>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-card">
            <p className="font-display text-lg font-semibold">☘ Fáilte — you're in the right place.</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Built by Irish people, for anyone making Perth home.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link to="/categories" className="text-sm font-medium text-primary underline-offset-4 hover:underline">Browse categories</Link>
              <Link to="/post" className="text-sm font-medium text-primary underline-offset-4 hover:underline">Make a post</Link>
              <Link to="/community" className="text-sm font-medium text-primary underline-offset-4 hover:underline">Ask the community</Link>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
};

export default About;
