import { Link, NavLink, useNavigate } from "react-router-dom";
import { Plus, Menu, User as UserIcon, Heart, LogOut, ListChecks, ChevronDown, Map as MapIcon, ShieldCheck, MessageCircle, UserCircle, Tractor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CATEGORY_MAP, HOUSING_FILTER_SUBS, TOP_LEVEL_CATEGORIES } from "@/lib/categories";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRoles } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import UserAvatar from "@/components/UserAvatar";
import NotificationBell from "@/components/NotificationBell";

const SiteHeader = () => {
  const [open, setOpen] = useState(false);
  const [housingOpen, setHousingOpen] = useState(false);
  const { user, signOut } = useAuth();
  const { isModerator } = useUserRoles();
  const navigate = useNavigate();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const displayName = (user?.user_metadata?.display_name as string | undefined) || user?.email || "";

  useEffect(() => {
    if (!user) { setAvatarUrl(null); return; }
    let cancelled = false;
    supabase
      .from("profiles")
      .select("avatar_url")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => { if (!cancelled) setAvatarUrl(data?.avatar_url ?? null); });
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    if (!isModerator) { setPendingCount(0); return; }
    let cancelled = false;
    (async () => {
      const [a, b, c, d] = await Promise.all([
        supabase.from("listings").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("questions").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("regional_posts").select("id", { count: "exact", head: true }).eq("status", "pending"),
      ]);
      if (!cancelled) setPendingCount((a.count ?? 0) + (b.count ?? 0) + (c.count ?? 0) + (d.count ?? 0));
    })();
    return () => { cancelled = true; };
  }, [isModerator]);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="container flex h-16 items-center gap-3">
        <Link to="/" className="flex items-center gap-2 font-display text-xl font-bold tracking-tight">
          <img src="/favicon.png" alt="Céilí Brisbane logo - serif C with shamrock" width={36} height={36} className="h-9 w-9 object-contain" />
          <span><span className="text-primary">Céilí</span> Perth</span>
        </Link>

        <nav className="ml-6 hidden items-center gap-1 md:flex">
          <NavLink
            to="/categories"
            className={({ isActive }) =>
              `rounded-full px-3 py-1.5 text-sm font-medium transition-smooth hover:bg-secondary ${
                isActive ? "bg-secondary text-foreground" : "text-muted-foreground"
              }`
            }
          >
            Categories
          </NavLink>
          <NavLink
            to="/community"
            className={({ isActive }) =>
              `rounded-full px-3 py-1.5 text-sm font-medium transition-smooth hover:bg-secondary ${
                isActive ? "bg-secondary text-foreground" : "text-muted-foreground"
              }`
            }
          >
            Community
          </NavLink>
          <NavLink
            to="/map"
            className={({ isActive }) =>
              `rounded-full px-3 py-1.5 text-sm font-medium transition-smooth hover:bg-secondary ${
                isActive ? "bg-secondary text-foreground" : "text-muted-foreground"
              }`
            }
          >
            Map
          </NavLink>
          <NavLink
            to="/regional"
            className={({ isActive }) =>
              `rounded-full px-3 py-1.5 text-sm font-medium transition-smooth hover:bg-secondary ${
                isActive ? "bg-secondary text-foreground" : "text-muted-foreground"
              }`
            }
          >
            Regional
          </NavLink>
          <NavLink
            to="/guide"
            className={({ isActive }) =>
              `rounded-full px-3 py-1.5 text-sm font-medium transition-smooth hover:bg-secondary ${
                isActive ? "bg-secondary text-foreground" : "text-muted-foreground"
              }`
            }
          >
            Guide
          </NavLink>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Button asChild variant="hero" size="sm" className="hidden sm:inline-flex">
            <Link to="/post"><Plus className="h-4 w-4" /> Make a post</Link>
          </Button>
          <NotificationBell />
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Account" className="rounded-full">
                  <UserAvatar url={avatarUrl} name={displayName} size={32} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate">{user.user_metadata?.display_name || user.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/profile")}><UserCircle className="h-4 w-4" /> Edit profile</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/messages")}><MessageCircle className="h-4 w-4" /> Messages</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/favourites")}><Heart className="h-4 w-4" /> Favourites</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/my-posts")}><ListChecks className="h-4 w-4" /> My posts</DropdownMenuItem>
                {isModerator && (
                  <DropdownMenuItem onClick={() => navigate("/admin")}>
                    <ShieldCheck className="h-4 w-4" /> Moderation
                    {pendingCount > 0 && (
                      <span className="ml-auto rounded-full bg-yellow-500 px-1.5 py-0.5 text-xs font-bold text-white leading-none">
                        {pendingCount}
                      </span>
                    )}
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={async () => { await signOut(); navigate("/"); }}><LogOut className="h-4 w-4" /> Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link to="/auth"><UserIcon className="h-4 w-4" /> Sign in</Link>
            </Button>
          )}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <div className="mt-8 flex flex-col gap-1">
                {TOP_LEVEL_CATEGORIES.map((c) => (
                  <div key={c.key} className="flex flex-col">
                    {c.subs ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setHousingOpen((v) => !v)}
                          aria-expanded={housingOpen}
                          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-smooth hover:bg-secondary/60"
                        >
                          <c.icon className="h-4 w-4" />
                          {c.label}
                          <ChevronDown className={`ml-auto h-4 w-4 transition-transform ${housingOpen ? "rotate-180" : ""}`} />
                        </button>
                        {housingOpen && (
                          <div className="ml-9 mt-1 flex flex-col gap-0.5">
                            {HOUSING_FILTER_SUBS.map((s) => {
                              const m = CATEGORY_MAP[s];
                              return (
                                <Link
                                  key={s}
                                  to={`/c/housing?sub=${s}`}
                                  onClick={() => setOpen(false)}
                                  className="rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                                >
                                  {m.short}
                                </Link>
                              );
                            })}
                          </div>
                        )}
                      </>
                    ) : (
                      <NavLink
                        to={`/c/${c.key}`}
                        onClick={() => setOpen(false)}
                        className={({ isActive }) =>
                          `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-smooth ${
                            isActive ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60"
                          }`
                        }
                      >
                        <c.icon className="h-4 w-4" />
                        {c.label}
                      </NavLink>
                    )}
                  </div>
                ))}
                <NavLink
                  to="/community"
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-smooth ${
                      isActive ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60"
                    }`
                  }
                >
                  Community Q&amp;A
                </NavLink>
                <NavLink
                  to="/regional"
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-smooth ${
                      isActive ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60"
                    }`
                  }
                >
                  <Tractor className="h-4 w-4" /> Regional Work
                </NavLink>
                <NavLink
                  to="/guide"
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-smooth ${
                      isActive ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60"
                    }`
                  }
                >
                  Newcomer's Guide
                </NavLink>
                <NavLink
                  to="/map"
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-smooth ${
                      isActive ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60"
                    }`
                  }
                >
                  <MapIcon className="h-4 w-4" /> Map view
                </NavLink>
                {user ? (
                  <>
                    <Link to="/profile" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-secondary/60"><UserCircle className="h-4 w-4" /> Edit profile</Link>
                    <Link to="/messages" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-secondary/60"><MessageCircle className="h-4 w-4" /> Messages</Link>
                    <Link to="/favourites" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-secondary/60"><Heart className="h-4 w-4" /> Favourites</Link>
                    <Link to="/my-posts" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-secondary/60"><ListChecks className="h-4 w-4" /> My posts</Link>
                    {isModerator && (
                      <Link to="/admin" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-secondary/60">
                        <ShieldCheck className="h-4 w-4" /> Moderation
                        {pendingCount > 0 && (
                          <span className="ml-auto rounded-full bg-yellow-500 px-1.5 py-0.5 text-xs font-bold text-white leading-none">
                            {pendingCount}
                          </span>
                        )}
                      </Link>
                    )}
                  </>
                ) : (
                  <Link to="/auth" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-secondary/60"><UserIcon className="h-4 w-4" /> Sign in</Link>
                )}
                <Button asChild variant="hero" className="mt-4">
                  <Link to="/post" onClick={() => setOpen(false)}>
                    <Plus className="h-4 w-4" /> Make a post
                  </Link>
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
};

export default SiteHeader;
