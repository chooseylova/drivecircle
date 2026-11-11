import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { showError } from "@/lib/helpers";

export default function EditProfileModal({ user, open, onClose, onSave }) {
  const [form, setForm] = useState({
    full_name: user?.full_name || "",
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const name = form.full_name.trim();
    if (!name) {
      toast.error("Display name can't be empty.");
      return;
    }
    if (name.length > 50) {
      toast.error("Display name must be 50 characters or less.");
      return;
    }
    setSaving(true);
    try {
      await base44.auth.updateMe({ full_name: name });
      toast.success("Profile updated!");
      onSave({ ...user, full_name: name });
      onClose();
    } catch (err) {
      showError(err, "Couldn't update your profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-sm w-[calc(100vw-2rem)]">
        <DialogHeader>
          <DialogTitle className="font-orbitron tracking-wide">Edit Profile</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Display Name</Label>
            <Input
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              placeholder="Your name"
              maxLength={50}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              className="bg-secondary border-border/50"
            />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Email</Label>
            <Input value={user?.email || ""} disabled className="bg-secondary border-border/50 opacity-50" />
            <p className="text-[10px] text-muted-foreground mt-1">Email cannot be changed.</p>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button className="flex-1 font-orbitron tracking-wider text-xs" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}