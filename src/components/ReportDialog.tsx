import { useState } from "react";
import { Flag, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const REASONS = [
  { v: "scam", l: "Looks like a scam" },
  { v: "spam", l: "Spam or duplicate" },
  { v: "inappropriate", l: "Inappropriate content" },
  { v: "wrong_category", l: "Wrong category" },
  { v: "other", l: "Other" },
];

const ReportDialog = ({ listingId }: { listingId: string }) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!reason) return toast.error("Please pick a reason");
    setBusy(true);
    const { error } = await supabase.from("reports").insert({
      listing_id: listingId, reason, details: details || null, reporter_id: user?.id ?? null,
    });
    setBusy(false);
    if (error) return toast.error("Couldn't submit report");
    toast.success("Thanks - we'll take a look");
    setOpen(false); setReason(""); setDetails("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground"><Flag className="h-4 w-4" /> Report</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report this listing</DialogTitle>
          <DialogDescription>Help keep Céilí Brisbane safe - tell us what's wrong.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger><SelectValue placeholder="Select a reason" /></SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => <SelectItem key={r.v} value={r.v}>{r.l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="rdetails">Details (optional)</Label>
            <Textarea id="rdetails" rows={4} value={details} onChange={(e) => setDetails(e.target.value)} maxLength={1000} />
          </div>
          <Button onClick={submit} variant="hero" className="w-full" disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Submit report
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReportDialog;
