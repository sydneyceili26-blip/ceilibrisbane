import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import UserAvatar from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";

const MAX_BYTES = 5 * 1024 * 1024; // 5MB

const Profile = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    document.title = "Your profile - Céilí Brisbane";
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/auth"); return; }
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      setDisplayName(data?.display_name ?? "");
      setAvatarUrl(data?.avatar_url ?? null);
      setLoading(false);
    })();
  }, [user, authLoading, navigate]);

  const handleFile = async (file: File) => {
    if (!user) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Please choose an image", variant: "destructive" });
      return;
    }
    if (file.size > MAX_BYTES) {
      toast({ title: "Image too large", description: "Max 5MB.", variant: "destructive" });
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("avatars")
      .upload(path, file, { cacheControl: "3600", upsert: true, contentType: file.type });

    if (upErr) {
      toast({ title: "Upload failed", description: upErr.message, variant: "destructive" });
      setUploading(false);
      return;
    }

    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
    const url = pub.publicUrl;

    const { error: dbErr } = await supabase
      .from("profiles")
      .update({ avatar_url: url })
      .eq("id", user.id);

    if (dbErr) {
      toast({ title: "Couldn't save avatar", description: dbErr.message, variant: "destructive" });
    } else {
      setAvatarUrl(url);
      toast({ title: "Profile picture updated" });
    }
    setUploading(false);
  };

  const removeAvatar = async () => {
    if (!user) return;
    setUploading(true);
    await supabase.from("profiles").update({ avatar_url: null }).eq("id", user.id);
    setAvatarUrl(null);
    setUploading(false);
    toast({ title: "Profile picture removed" });
  };

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const trimmed = displayName.trim().slice(0, 80);

    // Update both the profiles table and auth user_metadata so the header
    // and any other consumer that reads user.user_metadata stay in sync.
    const [{ error: dbErr }, { error: metaErr }] = await Promise.all([
      supabase.from("profiles").update({ display_name: trimmed || null }).eq("id", user.id),
      supabase.auth.updateUser({ data: { display_name: trimmed || null } }),
    ]);

    setSaving(false);
    if (dbErr || metaErr) {
      toast({ title: "Couldn't save", description: (dbErr ?? metaErr)!.message, variant: "destructive" });
    } else {
      toast({ title: "Profile saved" });
    }
  };

  const deleteAccount = async () => {
    if (!user) return;
    setDeleting(true);
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) { setDeleting(false); return; }
    const { error } = await supabase.functions.invoke("delete-account", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (error) {
      setDeleting(false);
      toast({ title: "Couldn't delete account", description: error.message, variant: "destructive" });
      return;
    }
    await supabase.auth.signOut();
    toast({ title: "Account deleted", description: "Your data has been removed. Take care." });
    navigate("/");
  };


  return (
    <div className="flex min-h-screen flex-col bg-gradient-warm">
      <SiteHeader />
      <main className="container flex-1 py-8 md:py-12">
        <h1 className="font-display text-3xl font-bold">Your profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your name and photo show up next to your listings and chats.
        </p>

        <div className="mt-8 max-w-xl rounded-2xl border border-border bg-card p-6 shadow-card">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <>
              <div className="flex items-center gap-5">
                <UserAvatar url={avatarUrl} name={displayName || user?.email} size={88} expandable />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="hero"
                    size="sm"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                    {avatarUrl ? "Change photo" : "Upload photo"}
                  </Button>
                  {avatarUrl && (
                    <Button type="button" variant="outline" size="sm" onClick={removeAvatar} disabled={uploading}>
                      <Trash2 className="h-4 w-4" /> Remove
                    </Button>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFile(f);
                      e.target.value = "";
                    }}
                  />
                </div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">JPG or PNG, up to 5MB.</p>

              <div className="mt-6 space-y-2">
                <Label htmlFor="display_name">Display name</Label>
                <Input
                  id="display_name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={80}
                  placeholder="How you'd like to appear"
                />
              </div>

              <Button onClick={save} variant="hero" className="mt-6" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save changes
              </Button>
            </>
          )}
        </div>

        <div className="mt-8 max-w-xl rounded-2xl border border-destructive/30 bg-card p-6 shadow-card">
          <h2 className="font-display text-lg font-semibold">Delete account</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Permanently removes your profile, listings, favourites and messages. This can't be undone.
          </p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="mt-4" disabled={deleting}>
                {deleting && <Loader2 className="h-4 w-4 animate-spin" />} Delete my account
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently removes your profile, all of your listings, your favourites,
                  and your message history. It cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={deleteAccount}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Yes, delete everything
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
};

export default Profile;
