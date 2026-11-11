import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Upload, X, Car } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { uploadFiles, showError } from "@/lib/helpers";

export default function EditCarPage() {
  const { carId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    car_name: "",
    year: "",
    make: "",
    model: "",
    bio: "",
    youtube_playlist_url: "",
    mods: "",
    horsepower: "",
    color: "",
  });

  useEffect(() => {
    async function load() {
      const [car, me] = await Promise.all([
        base44.entities.CarProfile.get(carId).catch(() => null),
        base44.auth.me().catch(() => null),
      ]);
      if (!car) {
        toast.error("Ride not found.");
        navigate("/garage");
        return;
      }
      if (me?.email !== car.owner_email && me?.role !== "admin") {
        toast.error("You can only edit your own rides.");
        navigate(`/car/${carId}`);
        return;
      }
      setForm({
        car_name: car.car_name || "",
        year: car.year || "",
        make: car.make || "",
        model: car.model || "",
        bio: car.bio || "",
        youtube_playlist_url: car.youtube_playlist_url || "",
        mods: car.mods || "",
        horsepower: car.horsepower || "",
        color: car.color || "",
      });
      setPhotos(car.photos || []);
      setLoading(false);
    }
    load();
  }, [carId]);

  const handleChange = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    setUploading(true);
    const uploaded = await uploadFiles(base44, files);
    setPhotos((prev) => [...prev, ...uploaded.map((u) => u.url)]);
    setUploading(false);
  };

  const makeCover = (index) => {
    setPhotos((prev) => [prev[index], ...prev.filter((_, i) => i !== index)]);
  };

  const removePhoto = (index) => setPhotos((prev) => prev.filter((_, i) => i !== index));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!String(form.car_name).trim() || !String(form.make).trim() || !String(form.model).trim()) {
      toast.error("Please fill in car name, make, and model.");
      return;
    }
    if (uploading) {
      toast.error("Please wait for photos to finish uploading.");
      return;
    }
    setSaving(true);
    try {
      await base44.entities.CarProfile.update(carId, {
        ...form,
        // null (not undefined) so clearing a field actually clears it
        year: form.year ? Number(form.year) : null,
        horsepower: form.horsepower ? Number(form.horsepower) : null,
        photos,
        cover_photo: photos[0] || "",
      });
      toast.success("Ride updated!");
      navigate(`/car/${carId}`);
    } catch (err) {
      showError(err, "Couldn't save changes.");
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Car className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-orbitron font-bold text-xl tracking-wide">Edit Ride</h1>
            <p className="text-muted-foreground text-xs">Update your build details.</p>
          </div>
        </div>
      </motion.div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Photos */}
        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Photos</Label>
          <div className="grid grid-cols-3 gap-2">
            {photos.map((url, i) => (
              <div key={i} className="relative aspect-square rounded-lg overflow-hidden group">
                <img src={url} alt="" className="w-full h-full object-cover" />
                {i !== 0 && (
                  <button
                    type="button"
                    onClick={() => makeCover(i)}
                    className="absolute bottom-1 left-1 text-[9px] bg-black/60 hover:bg-primary px-1.5 py-0.5 rounded text-white font-medium md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                  >
                    Set cover
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => removePhoto(i)}
                  className="absolute top-1 right-1 p-1 rounded-full bg-black/60 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
                {i === 0 && (
                  <span className="absolute bottom-1 left-1 text-[9px] bg-primary px-1.5 py-0.5 rounded text-primary-foreground font-medium">Cover</span>
                )}
              </div>
            ))}
            <label className="aspect-square rounded-lg border-2 border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center cursor-pointer transition-colors">
              {uploading ? (
                <div className="w-5 h-5 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
              ) : (
                <>
                  <Upload className="w-5 h-5 text-muted-foreground mb-1" />
                  <span className="text-[10px] text-muted-foreground">Upload</span>
                </>
              )}
              <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} disabled={uploading} />
            </label>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Car Name *</Label>
            <Input placeholder="e.g. Midnight Runner" value={form.car_name} onChange={(e) => handleChange("car_name", e.target.value)} className="bg-secondary border-border/50" />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Year</Label>
            <Input type="number" placeholder="2024" value={form.year} onChange={(e) => handleChange("year", e.target.value)} className="bg-secondary border-border/50" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Make *</Label>
            <Input placeholder="e.g. BMW" value={form.make} onChange={(e) => handleChange("make", e.target.value)} className="bg-secondary border-border/50" />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Model *</Label>
            <Input placeholder="e.g. M3" value={form.model} onChange={(e) => handleChange("model", e.target.value)} className="bg-secondary border-border/50" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Horsepower</Label>
            <Input type="number" placeholder="450" value={form.horsepower} onChange={(e) => handleChange("horsepower", e.target.value)} className="bg-secondary border-border/50" />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Color</Label>
            <Input placeholder="e.g. Matte Black" value={form.color} onChange={(e) => handleChange("color", e.target.value)} className="bg-secondary border-border/50" />
          </div>
        </div>

        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Bio / Story</Label>
          <Textarea placeholder="Tell the story of your build..." value={form.bio} onChange={(e) => handleChange("bio", e.target.value)} rows={4} className="bg-secondary border-border/50 resize-none" />
        </div>

        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Modifications</Label>
          <Textarea placeholder="List your mods..." value={form.mods} onChange={(e) => handleChange("mods", e.target.value)} rows={3} className="bg-secondary border-border/50 resize-none" />
        </div>

        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">YouTube / YouTube Music URL</Label>
          <Input placeholder="https://music.youtube.com/watch?v=... or playlist link" value={form.youtube_playlist_url} onChange={(e) => handleChange("youtube_playlist_url", e.target.value)} className="bg-secondary border-border/50" />
          <p className="text-[10px] text-muted-foreground mt-1">Paste a YouTube Music song or playlist link — auto-plays when someone views your profile.</p>
        </div>

        <div className="flex gap-3">
          <Button type="button" variant="outline" className="flex-1" onClick={() => navigate(-1)}>Cancel</Button>
          <Button type="submit" disabled={saving || uploading} className="flex-1 h-11 font-orbitron tracking-wider">
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}