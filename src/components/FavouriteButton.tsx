import { Heart, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  listingId: string;
  variant?: "icon" | "full";
  className?: string;
}

const FavouriteButton = ({ listingId, variant = "icon", className }: Props) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [favId, setFavId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) { setFavId(null); return; }
    supabase.from("favourites").select("id").eq("user_id", user.id).eq("listing_id", listingId).maybeSingle()
      .then(({ data }) => setFavId(data?.id ?? null));
  }, [user, listingId]);

  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) { toast("Sign in to save favourites"); navigate("/auth"); return; }
    setBusy(true);
    if (favId) {
      const { error } = await supabase.from("favourites").delete().eq("id", favId);
      setBusy(false);
      if (error) return toast.error("Couldn't remove favourite");
      setFavId(null);
    } else {
      const { data, error } = await supabase.from("favourites").insert({ user_id: user.id, listing_id: listingId }).select("id").single();
      setBusy(false);
      if (error) return toast.error("Couldn't save");
      setFavId(data.id);
    }
  };

  const active = !!favId;

  if (variant === "full") {
    return (
      <Button variant="outline" size="sm" onClick={toggle} disabled={busy} className={className}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Heart className={cn("h-4 w-4", active && "fill-primary text-primary")} />}
        {active ? "Saved" : "Save"}
      </Button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-label={active ? "Remove from favourites" : "Save to favourites"}
      className={cn(
        "grid h-9 w-9 place-items-center rounded-full bg-background/90 shadow-soft backdrop-blur transition-smooth hover:scale-105",
        className,
      )}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Heart className={cn("h-4 w-4", active ? "fill-primary text-primary" : "text-muted-foreground")} />}
    </button>
  );
};

export default FavouriteButton;
