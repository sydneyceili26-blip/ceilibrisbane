import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export const usePageTracking = () => {
  const { pathname } = useLocation();
  const tracked = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (tracked.current.has(pathname)) return;
    tracked.current.add(pathname);
    supabase.from("page_views").insert({ page: pathname }).then(() => {});
  }, [pathname]);
};
