import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Upload, X, MapPin, Navigation } from "lucide-react";
import { toast } from "sonner";
import { uploadFiles, showError, getCurrentPosition, reverseGeocode } from "@/lib/helpers";

const CATEGORIES = [
  { value: "vehicle", label: "Vehicle" },
  { value: "parts", label: "Parts" },
  { value: "wheels_tires", label: "Wheels & Tires" },
  { value: "audio", label: "Audio" },
  { value: "exterior", label: "Exterior" },
  { value: "interior", label: "Interior" },
  { value: "tools", label: "Tools" },
  { value: "other", label: "Other" },
];

const CONDITIONS = [
  { value: "new", label: "New" },
  { value: "like_new", label: "Like New" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
  { value: "for_parts", label: "For Parts" },
];

export default function CreateListingModal({ open, onClose, user, onCreated }) {
  const [form, setForm] = useState({
    title: "", description: "", price: "", category: "parts",
    condition: "good", location: "", contact_info: "",
    year: "", make: "", model: "", mileage: "",
  });
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detectingLoc, setDetectingLoc] = useState(false);

  const detectLocation = async () => {
    setDetectingLoc(true);
    try {
      const [lat, lon] = await getCurrentPosition();
      const place = await reverseGeocode(lat, lon);
      if (place) set("location", place);
    } catch (err) {
      toast.error(err.message || "Couldn't detect your location.");
    } finally {
      setDetectingLoc(false);
    }
  };

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    setUploading(true);
    const uploaded = await uploadFiles(base44, files);
    setPhotos((p) => [...p, ...uploaded.map((u) => u.url)]);
    setUploading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const price = Number(form.price);
    if (!form.title.trim() || form.price === "" || !form.category) {
      toast.error("Please fill in title, price, and category.");
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      toast.error("Please enter a valid price.");
      return;
    }
    if (!form.location.trim()) {
      toast.error("Please add a location so buyers know where the item is.");
      return;
    }
    if (uploading) {
      toast.error("Please wait for photos to finish uploading.");
      return;
    }
    setSaving(true);
    try {
      const me = user || (await base44.auth.me());
      const payload = {
        ...form,
        title: form.title.trim(),
        location: form.location.trim(),
        price,
        photos,
        seller_email: me.email,
        seller_name: me.full_name || me.email.split("@")[0],
        status: "active",
      };
      // Only send vehicle fields when they're filled in (avoids sending "" to number fields)
      if (isVehicle && form.year) payload.year = Number(form.year); else delete payload.year;
      if (isVehicle && form.mileage) payload.mileage = Number(form.mileage); else delete payload.mileage;
      if (!isVehicle) { delete payload.make; delete payload.model; }
      await base44.entities.MarketplaceListing.create(payload);
      toast.success("Listing posted!");
      onCreated?.();
    } catch (err) {
      showError(err, "Couldn't post your listing.");
      setSaving(false);
    }
  };

  const isVehicle = form.category === "vehicle";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-lg max-h-[85vh] overflow-y-auto w-[calc(100vw-2rem)]">
        <DialogHeader>
          <DialogTitle className="font-orbitron tracking-wide text-sm">Post a Listing</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Photos */}
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Photos</Label>
            <div className="flex flex-wrap gap-2">
              {photos.map((url, i) => (
                <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))}
                    className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-black/60">
                    <X className="w-2.5 h-2.5 text-white" />
                  </button>
                </div>
              ))}
              <label className="w-16 h-16 rounded-lg border-2 border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center cursor-pointer transition-colors">
                {uploading ? <div className="w-4 h-4 border-2 border-primary/20 border-t-primary rounded-full animate-spin" /> : <Upload className="w-4 h-4 text-muted-foreground" />}
                <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />
              </label>
            </div>
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">Title *</Label>
            <Input placeholder="e.g. OEM Lip Kit, 18&quot; Enkei Wheels..." value={form.title} onChange={(e) => set("title", e.target.value)} className="bg-secondary border-border/50" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">Category *</Label>
              <select value={form.category} onChange={(e) => set("category", e.target.value)}
                className="w-full bg-secondary border border-border/50 rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">Condition</Label>
              <select value={form.condition} onChange={(e) => set("condition", e.target.value)}
                className="w-full bg-secondary border border-border/50 rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                {CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">Price * ($)</Label>
            <Input type="number" min="0" step="1" inputMode="decimal" placeholder="0" value={form.price} onChange={(e) => set("price", e.target.value)} className="bg-secondary border-border/50" />
          </div>

          {isVehicle && (
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">Year</Label>
                <Input type="number" placeholder="2020" value={form.year} onChange={(e) => set("year", e.target.value)} className="bg-secondary border-border/50" />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">Make</Label>
                <Input placeholder="Honda" value={form.make} onChange={(e) => set("make", e.target.value)} className="bg-secondary border-border/50" />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">Model</Label>
                <Input placeholder="Civic" value={form.model} onChange={(e) => set("model", e.target.value)} className="bg-secondary border-border/50" />
              </div>
            </div>
          )}

          {isVehicle && (
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">Mileage</Label>
              <Input type="number" placeholder="45000" value={form.mileage} onChange={(e) => set("mileage", e.target.value)} className="bg-secondary border-border/50" />
            </div>
          )}

          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">Description</Label>
            <Textarea placeholder="Describe your item..." value={form.description} onChange={(e) => set("description", e.target.value)} rows={3} className="bg-secondary border-border/50 resize-none" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">Location *</Label>
              <div className="flex gap-1.5">
                <div className="relative flex-1">
                  <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input placeholder="City, State" value={form.location} onChange={(e) => set("location", e.target.value)} className="bg-secondary border-border/50 pl-8" />
                </div>
                <button type="button" onClick={detectLocation} disabled={detectingLoc} title="Use my location"
                  className="px-2 rounded-md border border-border/50 bg-secondary hover:border-primary/50 hover:text-primary text-muted-foreground transition-colors">
                  <Navigation className={`w-3.5 h-3.5 ${detectingLoc ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">Contact</Label>
              <Input placeholder="Email or phone" value={form.contact_info} onChange={(e) => set("contact_info", e.target.value)} className="bg-secondary border-border/50" />
            </div>
          </div>

          <Button type="submit" disabled={saving || uploading} className="w-full font-orbitron tracking-wider">
            {saving ? "Posting..." : "Post Listing"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}