import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

const Support = () => {
  useEffect(() => { document.title = "Support - Céilí Brisbane"; }, []);
  return (
    <div className="flex min-h-screen flex-col bg-gradient-warm">
      <SiteHeader />
      <main className="container flex-1 py-10">
        <div className="mx-auto max-w-3xl">
          <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Home
          </Link>
          <h1 className="mt-4 font-display text-3xl font-bold md:text-4xl">Support</h1>
          <p className="mt-2 text-sm text-muted-foreground">We're here to help</p>

          <div className="prose prose-sm mt-8 max-w-none text-foreground">
            <h2>Contact Us</h2>
            <p>
              For any questions, issues, or feedback about Céilí Brisbane, please email us at{" "}
              <a href="mailto:support@ceilibrisbane.com">support@ceilibrisbane.com</a>. We aim to respond within 2 business days.
            </p>

            <h2>Frequently Asked Questions</h2>

            <h3>How do I delete my account?</h3>
            <p>
              You can delete your account from your Profile page. Tap your profile icon, scroll to the bottom, and select "Delete account". This will permanently remove your account and all associated listings.
            </p>

            <h3>How do I report a listing or user?</h3>
            <p>
              If you see a listing or message that violates our community guidelines, please email us at{" "}
              <a href="mailto:support@ceilibrisbane.com">support@ceilibrisbane.com</a> with details and we will investigate promptly.
            </p>

            <h3>My listing wasn't approved — what do I do?</h3>
            <p>
              Listings are reviewed before they go live. If yours wasn't approved, you'll receive a notification with the reason. You're welcome to edit and resubmit, or contact us if you have questions.
            </p>

            <h3>I didn't receive a confirmation email</h3>
            <p>
              Please check your spam or junk folder. If it's not there, email us at{" "}
              <a href="mailto:support@ceilibrisbane.com">support@ceilibrisbane.com</a> and we'll help you get access.
            </p>

            <h3>How do I update or remove my listing?</h3>
            <p>
              Go to "My Listings" from the navigation menu. From there you can edit or delete any of your active listings.
            </p>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
};

export default Support;
