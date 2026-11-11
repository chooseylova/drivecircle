import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Calendar as CalendarIcon, Upload, Search, Navigation } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import { geocode, getCurrentPosition, reverseGeocode, showError } from "@/lib/helpers";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

function LocationPicker({ position, setPosition }) {
  useMapEvents({
    click(e) {
      setPosition([e.latlng.lat, e.latlng.lng]);
    },
  });
  return position ? <Marker position={position} /> : null;
}

// Pans the map whenever `target` changes (after a search / "use my location")
function FlyTo({ target }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo(target, 14, { duration: 0.8 });
  }, [target, map]);
  return null;
}

// Value for <input type="datetime-local" min> in the user's local time
function localNowForInput() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export default function CreateEventPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [saving, setSaving] = useState(false);
  const [position, setPosition] = useState(null);
  const [coverImage, setCoverImage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [flyTarget, setFlyTarget] = useState(null);
  const [locating, setLocating] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    date: "",
    location_name: "",
    event_type: "car_meet",
  });

  useEffect(() => {
    base44.auth.me().then(setUser);
  }, []);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setCoverImage(file_url);
    } catch (err) {
      showError(err, "Couldn't upload image.");
    } finally {
      setUploading(false);
    }
  };

  const findOnMap = async () => {
    if (!form.location_name.trim()) {
      toast.error("Type a location name or address first.");
      return;
    }
    setLocating(true);
    try {
      const coords = await geocode(form.location_name.trim());
      if (!coords) {
        toast.error("Couldn't find that place — try adding a city, or tap the map.");
        return;
      }
      setPosition(coords);
      setFlyTarget(coords);
    } catch (err) {
      showError(err, "Location search failed — tap the map instead.");
    } finally {
      setLocating(false);
    }
  };

  const useMyLocation = async () => {
    setLocating(true);
    try {
      const coords = await getCurrentPosition();
      setPosition(coords);
      setFlyTarget(coords);
      if (!form.location_name.trim()) {
        const name = await reverseGeocode(coords[0], coords[1]).catch(() => "");
        if (name) handleChange("location_name", name);
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLocating(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.date || !form.location_name.trim() || !position) {
      toast.error("Please fill in all required fields and pick a location on the map.");
      return;
    }
    // datetime-local gives "2026-11-15T19:00" with no timezone; convert to a real ISO timestamp
    const when = new Date(form.date);
    if (isNaN(when.getTime())) {
      toast.error("Please enter a valid date and time.");
      return;
    }
    setSaving(true);
    try {
      const me = user || (await base44.auth.me());
      await base44.entities.CarEvent.create({
        ...form,
        title: form.title.trim(),
        location_name: form.location_name.trim(),
        date: when.toISOString(),
        latitude: position[0],
        longitude: position[1],
        cover_image: coverImage,
        organizer_email: me.email,
        organizer_name: me.full_name || me.email.split("@")[0],
        source: "user_created",
        attendees: [me.email],
        attendee_count: 1,
      });
      toast.success("Event created!");
      navigate("/events");
    } catch (err) {
      showError(err, "Couldn't create the event.");
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
            <CalendarIcon className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h1 className="font-orbitron font-bold text-xl tracking-wide">Create Event</h1>
            <p className="text-muted-foreground text-xs">Host a car meet, show, or cruise.</p>
          </div>
        </div>
      </motion.div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Cover Image */}
        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Cover Image</Label>
          {coverImage ? (
            <div className="relative aspect-[2.5/1] rounded-lg overflow-hidden">
              <img src={coverImage} alt="" className="w-full h-full object-cover" />
              <button type="button" onClick={() => setCoverImage("")} className="absolute top-2 right-2 px-2 py-1 rounded bg-black/60 text-white text-xs hover:bg-black/80">Remove</button>
            </div>
          ) : (
            <label className="aspect-[2.5/1] rounded-lg border-2 border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center cursor-pointer transition-colors">
              {uploading ? (
                <div className="w-5 h-5 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
              ) : (
                <>
                  <Upload className="w-6 h-6 text-muted-foreground mb-1" />
                  <span className="text-xs text-muted-foreground">Upload cover</span>
                </>
              )}
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            </label>
          )}
        </div>

        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Title *</Label>
          <Input placeholder="e.g. Sunday Night Car Meet" value={form.title} onChange={(e) => handleChange("title", e.target.value)} className="bg-secondary border-border/50" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">{"Date & Time *"}</Label>
            <Input type="datetime-local" min={localNowForInput()} value={form.date} onChange={(e) => handleChange("date", e.target.value)} className="bg-secondary border-border/50" />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Event Type</Label>
            <Select value={form.event_type} onValueChange={(v) => handleChange("event_type", v)}>
              <SelectTrigger className="bg-secondary border-border/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="car_meet">Car Meet</SelectItem>
                <SelectItem value="car_show">Car Show</SelectItem>
                <SelectItem value="cruise">Cruise</SelectItem>
                <SelectItem value="drag_race">Drag Race</SelectItem>
                <SelectItem value="drift_event">Drift Event</SelectItem>
                <SelectItem value="auction">Auction</SelectItem>
                <SelectItem value="swap_meet">Swap Meet</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Location Name *</Label>
          <div className="flex gap-2">
            <Input
              placeholder="e.g. 123 Main St, Baton Rouge, LA"
              value={form.location_name}
              onChange={(e) => handleChange("location_name", e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); findOnMap(); } }}
              className="bg-secondary border-border/50"
            />
            <Button type="button" variant="outline" onClick={findOnMap} disabled={locating} className="shrink-0 gap-1.5 text-xs">
              <Search className="w-3.5 h-3.5" /> Find
            </Button>
            <Button type="button" variant="outline" size="icon" onClick={useMyLocation} disabled={locating} title="Use my location" className="shrink-0">
              <Navigation className={`w-4 h-4 ${locating ? "animate-pulse" : ""}`} />
            </Button>
          </div>
        </div>

        {/* Map Picker */}
        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block flex items-center gap-1">
            <MapPin className="w-3 h-3" /> Pin Location on Map * <span className="normal-case tracking-normal">(search above or tap the map)</span>
          </Label>
          <div className="rounded-xl overflow-hidden border border-border/50 h-64 relative z-0">
            <MapContainer center={[39.8283, -98.5795]} zoom={4} className="h-full w-full">
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                attribution="CARTO"
              />
              <LocationPicker position={position} setPosition={setPosition} />
              <FlyTo target={flyTarget} />
            </MapContainer>
          </div>
          {position && (
            <p className="text-[10px] text-muted-foreground mt-1">
              Location: {position[0].toFixed(4)}, {position[1].toFixed(4)}
            </p>
          )}
        </div>

        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Description</Label>
          <Textarea placeholder="What is the event about?" value={form.description} onChange={(e) => handleChange("description", e.target.value)} rows={3} className="bg-secondary border-border/50 resize-none" />
        </div>

        <Button type="submit" disabled={saving || uploading} className="w-full h-11 font-orbitron tracking-wider">
          {saving ? "Creating..." : "Create Event"}
        </Button>
      </form>
    </div>
  );
}