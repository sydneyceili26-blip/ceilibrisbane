import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

const Privacy = () => {
  useEffect(() => { document.title = "Privacy Policy - Céilí Brisbane"; }, []);
  return (
    <div className="flex min-h-screen flex-col bg-gradient-warm">
      <SiteHeader />
      <main className="container flex-1 py-10">
        <div className="mx-auto max-w-3xl">
          <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Home
          </Link>
          <h1 className="mt-4 font-display text-3xl font-bold md:text-4xl">Privacy Policy</h1>
          <p className="mt-2 text-sm text-muted-foreground">Last updated: 27 May 2026</p>

          <div className="prose prose-sm mt-8 max-w-none text-foreground">
            <h2>What we collect</h2>
            <ul>
              <li><strong>Account details:</strong> email address and (if you sign in with Google) your name and profile photo.</li>
              <li><strong>Profile:</strong> a display name and optional avatar you choose.</li>
              <li><strong>Listings you post:</strong> title, description, photos, suburb, price, and the contact details you choose to publish.</li>
              <li><strong>Messages:</strong> messages you send to other users via in-app chat.</li>
              <li><strong>Basic technical data:</strong> standard logs needed to run the site (IP, browser type).</li>
            </ul>

            <h2>How we use it</h2>
            <p>
              We use this information to operate the noticeboard - showing your listings to other
              users, delivering your messages, and keeping accounts secure. We do not sell your
              personal data.
            </p>

            <h2>What's public</h2>
            <p>
              Anything you put in a listing (including any contact email or phone you add) is public
              to anyone visiting the site. Your account email is <strong>not</strong> public unless
              you also enter it as a listing contact. Your display name and avatar are public.
            </p>

            <h2>Security</h2>
            <ul>
              <li>All traffic is encrypted with HTTPS / TLS.</li>
              <li>Passwords are hashed by our authentication provider - we never see or store the plain text.</li>
              <li>New passwords are checked against known-breached password lists.</li>
              <li>Email verification is required before sign-in.</li>
              <li>Database access is gated by row-level security policies.</li>
            </ul>

            <h2>Your choices</h2>
            <ul>
              <li>Edit or delete any listing you've posted from <Link to="/my-posts">My posts</Link>.</li>
              <li>Update your display name or avatar from <Link to="/profile">your profile</Link>.</li>
              <li>Delete your account and your data at any time from your profile page.</li>
            </ul>

            <h2>Deleting your account</h2>
            <p>
              When you delete your account we permanently remove your profile, listings, favourites,
              messages, and conversations. This cannot be undone. Backups are rotated on a normal
              schedule.
            </p>

            <h2>Children</h2>
            <p>
              Céilí Brisbane is not intended for anyone under 18.
            </p>

            <h2>Contact</h2>
            <p>
              For privacy questions, reach out via the <Link to="/community">community Q&amp;A</Link>.
            </p>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
};

export default Privacy;
