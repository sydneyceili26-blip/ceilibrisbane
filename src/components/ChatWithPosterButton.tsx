import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRoles } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

interface Props {
  listingId: string;
  ownerId: string | null;
}

const ChatWithPosterButton = ({ listingId, ownerId }: Props) => {
  const { user } = useAuth();
  const { isModerator } = useUserRoles();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  // Anonymous listing — only mods can initiate contact
  if (!ownerId && !isModerator) return null;

  if (user && ownerId && user.id === ownerId) {
    return (
      <div className="rounded-md border border-dashed border-border bg-secondary/40 p-3 text-center text-xs text-muted-foreground">
        This is your own listing - buyers will see a "Chat with poster" button here.
      </div>
    );
  }

  const start = async () => {
    if (!user) {
      navigate("/auth");
      return;
    }
    setLoading(true);
    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .eq("listing_id", listingId)
      .eq("starter_id", user.id)
      .maybeSingle();

    if (existing?.id) {
      navigate(`/messages/${existing.id}`);
      setLoading(false);
      return;
    }

    const { data: created, error } = await supabase
      .from("conversations")
      .insert({ listing_id: listingId, starter_id: user.id, owner_id: ownerId })
      .select("id")
      .single();

    if (error || !created) {
      toast({ title: "Couldn't start chat", description: error?.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    navigate(`/messages/${created.id}`);
    setLoading(false);
  };

  return (
    <Button onClick={start} variant="hero" className="w-full" disabled={loading}>
      <MessageCircle className="h-4 w-4" /> {ownerId ? "Chat with poster" : "Message poster (admin)"}
    </Button>
  );
};

export default ChatWithPosterButton;
