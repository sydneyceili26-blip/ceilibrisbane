import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

const isNative = typeof window !== "undefined" && window.location.protocol === "capacitor:";

export const usePushNotifications = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isNative || !user) return;

    let cleanup: (() => void) | undefined;

    (async () => {
      try {
        const { PushNotifications } = await import("@capacitor/push-notifications");

        const { receive } = await PushNotifications.requestPermissions();
        if (receive !== "granted") return;

        await PushNotifications.register();

        const regListener = await PushNotifications.addListener("registration", async (token) => {
          await supabase.from("push_tokens").upsert(
            { user_id: user.id, token: token.value, platform: "ios" },
            { onConflict: "user_id,token" }
          );
        });

        const actionListener = await PushNotifications.addListener(
          "pushNotificationActionPerformed",
          (action) => {
            const data = action.notification.data as Record<string, string> | undefined;
            if (data?.conversationId) {
              navigate(`/messages/${data.conversationId}`);
            }
          }
        );

        cleanup = () => {
          regListener.remove();
          actionListener.remove();
        };
      } catch (e) {
        console.error("Push notification setup failed:", e);
      }
    })();

    return () => cleanup?.();
  }, [user, navigate]);
};
