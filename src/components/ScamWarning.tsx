import { ShieldAlert } from "lucide-react";

interface Props {
  variant?: "default" | "compact";
  className?: string;
}

/**
 * Plain-English safety reminder shown wherever users contact each other.
 * Keep it short, friendly, and visible - never make it look like a system error.
 */
const ScamWarning = ({ variant = "default", className = "" }: Props) => {
  if (variant === "compact") {
    return (
      <div
        className={`flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-foreground ${className}`}
        role="note"
      >
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <p>
          Stay safe: <strong>never send money upfront</strong> for a room, job or item you haven't seen.
          Meet in person, in a public place.
        </p>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 ${className}`}
      role="note"
    >
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="space-y-1 text-sm">
          <p className="font-semibold text-foreground">Stay safe out there</p>
          <ul className="ml-4 list-disc space-y-1 text-muted-foreground">
            <li><strong>Never send money or bond upfront</strong> before you've seen the place or item in person.</li>
            <li>Be wary of deals that seem too good to be true - especially cheap rentals.</li>
            <li>Meet in a public place. Bring a friend if you can.</li>
            <li>Céilí Brisbane does not verify users - you deal with other people at your own risk.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ScamWarning;
