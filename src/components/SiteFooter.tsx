import { Link } from "react-router-dom";

const SiteFooter = () => (
  <footer className="border-t border-border/60 bg-secondary/40">
    <div className="container py-10 text-sm text-muted-foreground">
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <p className="font-display text-base text-foreground">Céilí Brisbane ☘</p>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Link to="/guide" className="hover:text-foreground">Newcomer's Guide</Link>
          <Link to="/categories" className="hover:text-foreground">Categories</Link>
          <Link to="/community" className="hover:text-foreground">Community Q&amp;A</Link>
          <Link to="/post" className="hover:text-foreground">Post a listing</Link>
          <Link to="/about" className="hover:text-foreground">About</Link>
          <Link to="/terms" className="hover:text-foreground">Terms</Link>
          <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
        </nav>
        <p>A welcoming noticeboard for everyone settling into Brisbane - Fáilte, welcome!</p>
      </div>
      <p className="mt-6 text-xs text-muted-foreground/60">© {new Date().getFullYear()} Céilí Brisbane™. All rights reserved.</p>
    </div>
  </footer>
);

export default SiteFooter;
