import { useState } from "react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

interface Props {
  url?: string | null;
  name?: string | null;
  size?: number;
  className?: string;
  expandable?: boolean;
}

const UserAvatar = ({ url, name, size = 36, className, expandable = false }: Props) => {
  const [open, setOpen] = useState(false);
  const initial = (name?.trim()?.[0] ?? "?").toUpperCase();
  const label = name ?? "User";

  const content = url ? (
    <img src={url} alt={label} className="h-full w-full object-cover" style={{ imageRendering: "auto" }} />
  ) : (
    initial
  );

  const baseClass = cn(
    "inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-secondary text-sm font-semibold text-foreground",
    className,
  );
  const style = { width: size, height: size, fontSize: Math.max(12, size * 0.4) };

  if (!expandable || !url) {
    return (
      <span className={baseClass} style={style} aria-label={label}>
        {content}
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); setOpen(true); }}
        className={cn(baseClass, "cursor-zoom-in transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2")}
        style={style}
        aria-label={`View ${label}'s profile picture`}
      >
        {content}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm border-0 bg-transparent p-0 shadow-none sm:max-w-md">
          <VisuallyHidden>
            <DialogTitle>{label}'s profile picture</DialogTitle>
            <DialogDescription>Enlarged view of the profile picture.</DialogDescription>
          </VisuallyHidden>
          <img src={url} alt={label} className="h-auto w-full rounded-2xl object-contain" />
        </DialogContent>
      </Dialog>
    </>
  );
};

export default UserAvatar;
