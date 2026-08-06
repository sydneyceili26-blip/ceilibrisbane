import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Mail, MessageCircle, Trash2, FileX, RefreshCw } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

const faqs = [
  {
    icon: Trash2,
    question: "How do I delete my account?",
    answer: "Go to your Profile page, scroll to the bottom, and tap \"Delete account\". This permanently removes your account and all your listings.",
  },
  {
    icon: FileX,
    question: "My listing wasn't approved — what do I do?",
    answer: "You'll receive a notification with the reason. You're welcome to edit and resubmit, or reply to that message if you think it was declined in error.",
  },
  {
    icon: MessageCircle,
    question: "How do I report a listing or user?",
    answer: "Email us at support@ceilibrisbane.com with details and we'll investigate promptly. Include the listing title or username if you can.",
  },
  {
    icon: Mail,
    question: "I didn't receive a confirmation email",
    answer: "Check your spam or junk folder first. If it's not there, email us and we'll get you sorted.",
  },
  {
    icon: RefreshCw,
    question: "How do I update or remove my listing?",
    answer: "Go to \"My Listings\" from the navigation menu. From there you can edit or delete any of your active listings.",
  },
];

const Support = () => {
  useEffect(() => { document.title = "Support - Céilí Brisbane"; }, []);
  return (
    <div className="flex min-h-screen flex-col bg-gradient-warm">
      <SiteHeader />
      <main className="container flex-1 py-10 md:py-16">
        <div className="mx-auto max-w-2xl">
          <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Home
          </Link>

          <h1 className="mt-6 font-display text-4xl font-bold md:text-5xl">Support</h1>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            Need a hand? We're here to help.
          </p>

          <div className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-card">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Mail className="h-5 w-5" />
              </div>
              <div>
                <p className="font-display text-lg font-semibold">Get in touch</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Email us at{" "}
                  <a href="mailto:support@ceilibrisbane.com" className="font-medium text-primary underline-offset-4 hover:underline">
                    support@ceilibrisbane.com
                  </a>{" "}
                  and we'll get back to you within 2 business days.
                </p>
              </div>
            </div>
          </div>

          <h2 className="mt-10 font-display text-2xl font-bold">Common questions</h2>

          <div className="mt-4 space-y-3">
            {faqs.map(({ icon: Icon, question, answer }) => (
              <div key={question} className="rounded-2xl border border-border bg-card p-5 shadow-card">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{question}</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{answer}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-card">
            <p className="font-display text-lg font-semibold">☘ Still stuck?</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Drop us an email and we'll sort it out.{" "}
              <a href="mailto:support@ceilibrisbane.com" className="font-medium text-primary underline-offset-4 hover:underline">
                support@ceilibrisbane.com
              </a>
            </p>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
};

export default Support;
