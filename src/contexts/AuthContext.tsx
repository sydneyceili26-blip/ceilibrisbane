import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthCtx {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isPasswordRecovery: boolean;
  clearPasswordRecovery: () => void;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({ user: null, session: null, loading: true, isPasswordRecovery: false, clearPasswordRecovery: () => {}, signOut: async () => {} });

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('type') === 'recovery' || window.location.hash.includes('type=recovery');
  });

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (
        data.session &&
        localStorage.getItem("ceili_no_persist") === "1" &&
        !sessionStorage.getItem("ceili_session_active")
      ) {
        await supabase.auth.signOut();
        localStorage.removeItem("ceili_no_persist");
        setSession(null);
      } else {
        setSession(data.session);
      }
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "PASSWORD_RECOVERY") setIsPasswordRecovery(true);
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <Ctx.Provider value={{ session, user: session?.user ?? null, loading, isPasswordRecovery, clearPasswordRecovery: () => setIsPasswordRecovery(false), signOut: async () => { await supabase.auth.signOut(); } }}>
      {children}
    </Ctx.Provider>
  );
};

export const useAuth = () => useContext(Ctx);
