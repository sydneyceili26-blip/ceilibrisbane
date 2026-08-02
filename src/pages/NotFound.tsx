import { useEffect } from "react";
import { useLocation, Link } from "react-router-dom";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    document.title = "Page not found - Céilí Brisbane";
  }, []);

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col bg-gradient-warm">
      <SiteHeader />
      <main className="container flex flex-1 flex-col items-center justify-center py-20 text-center">
        <p className="text-6xl">☘</p>
        <h1 className="mt-4 font-display text-4xl font-bold md:text-5xl">Page not found</h1>
        <p className="mt-4 max-w-sm text-muted-foreground">
          That page doesn't exist — it may have been removed or the link might be wrong.
        </p>
        <Link
          to="/"
          className="mt-8 inline-flex items-center rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Back to home
        </Link>
      </main>
      <SiteFooter />
    </div>
  );
};

export default NotFound;
