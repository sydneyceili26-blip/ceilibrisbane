import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export type AdminAction =
  | "report_dismissed"
  | "listing_removed"
  | "question_removed"
  | "regional_post_removed"
  | "role_granted"
  | "role_revoked"
  | "post_approved"
  | "post_rejected";

export type AdminTargetType = "report" | "listing" | "request" | "question" | "regional_post" | "user";

export const logAdminAction = async (
  actor: User,
  action: AdminAction,
  targetType: AdminTargetType,
  targetId: string,
  details?: Record<string, unknown>,
) => {
  await supabase.from("admin_activity_log").insert({
    actor_id: actor.id,
    actor_name: (actor.user_metadata?.display_name as string) || actor.email || null,
    action,
    target_type: targetType,
    target_id: targetId,
    details: (details ?? null) as never,
  });
};
