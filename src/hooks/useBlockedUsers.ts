import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export const useBlockedUsers = () => {
  const { user } = useAuth();
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    supabase
      .from("blocked_users")
      .select("blocked_id")
      .eq("blocker_id", user.id)
      .then(({ data }) => {
        setBlockedIds(new Set((data ?? []).map((r: any) => r.blocked_id)));
      });
  }, [user]);

  const blockUser = useCallback(async (blockedId: string, name?: string) => {
    if (!user) return;
    const { error } = await supabase
      .from("blocked_users")
      .insert({ blocker_id: user.id, blocked_id: blockedId });
    if (error) { toast.error("Couldn't block user"); return; }
    setBlockedIds(prev => new Set([...prev, blockedId]));
    toast.success(`${name ?? "User"} blocked — their content will no longer appear for you.`);
  }, [user]);

  const unblockUser = useCallback(async (blockedId: string) => {
    if (!user) return;
    await supabase
      .from("blocked_users")
      .delete()
      .eq("blocker_id", user.id)
      .eq("blocked_id", blockedId);
    setBlockedIds(prev => { const s = new Set(prev); s.delete(blockedId); return s; });
    toast.success("User unblocked.");
  }, [user]);

  return { blockedIds, blockUser, unblockUser };
};
