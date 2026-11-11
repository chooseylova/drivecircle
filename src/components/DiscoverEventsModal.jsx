import { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, MapPin, Calendar, ExternalLink, Plus, Check, Navigation, Globe } from "lucide-react";
import {
  safeFormat, showError, toDate, distanceMiles, formatMiles, EVENT_TYPES,
  geocode, getCurrentPosition, reverseGeocode,
} from "@/lib/helpers";
import { toast } from "sonner";
import { addDays } from "date-fns";

const VALID_TYPES = EVENT_TYPES.map((t) => t.value);
const TYPE_LABEL = Object.fromEntries(EVENT_TYPES.map((t) => [t.value, t.label]));

const RANGE_OPTIONS = [
  { value: 7, label: "Next 7 days" },
  { value: 14, label: "Next 2 weeks" },
  { value: 30, label: "Next 30 days" },
  { value: 90, label: "Next 3 months" },
];

const normalize = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

// Drop AI results that would crash the UI or fail to save (bad dates / coordinates)
function cleanEvents(list, endDate) {
  const earliest = Date.now() - 6 * 60 * 60 * 1000;
  const latest = endDate ? endDate.getTime() + 24 * 3600 * 1000 : Infinity;
  const seen = new Set();
  return (Array.isArray(list) ? list : [])
    .filter((e) => {
      const d = toDate(e?.date);
      const lat = Number(e?.latitude);
      const lng = Number(e?.longitude);
      if (!e?.title || !d || d.getTime() < earliest || d.getTime() > latest) return false;
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180 || (lat === 0 && lng === 0)) return false;
      const key = normalize(e.title) + d.toDateString();
      if (seen.has(key)) return false; // the AI sometimes repeats an event
      seen.add(key);
      return true;
    })
    .map((e) => ({
      ...e,
      title: String(e.title).trim(),
      latitude: Number(e.latitude),
      longitude: Number(e.longitude),
      date: toDate(e.date).toISOString(),
      event_type: VALID_TYPES.includes(e.event_type) ? e.event_type : "other",
      external_url: /^https?:\/\//i.test(e.external_url || "") ? e.external_url : "",
    }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

export default function DiscoverEventsModal({ open, onClose, onImported, user, existingEvents = [], initialOrigin = null, initialTypes = [] }) {
  const [location, setLocation] = useState(initialOrigin?.label || "");
  const [center, setCenter] = useState(initialOrigin?.coords || null); // coords used for distances
  const [radius, setRadius] = useState("50");
  const [rangeDays, setRangeDays] = useState(30);
  const [types, setTypes] = useState(initialTypes);
  const [keywords, setKeywords] = useState("");
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [events, setEvents] = useState([]);
  const [imported, setImported] = useState(new Set());
  const [importing, setImporting] = useState(null);
  const [addingAll, setAddingAll] = useState(false);
  const [searched, setSearched] = useState(false);

  // Fast lookup of events already in DriveCircle (same title on the same day)
  const existingKeys = useMemo(() => {
    const keys = new Set();
    existingEvents.forEach((e) => {
      const d = toDate(e.date);
      if (d) keys.add(normalize(e.title) + d.toDateString());
    });
    return keys;
  }, [existingEvents]);
  const keyOf = (e) => normalize(e.title) + toDate(e.date)?.toDateString();
  const isAdded = (e) => imported.has(keyOf(e)) || existingKeys.has(keyOf(e));

  const useMyLocation = async () => {
    setLocating(true);
    try {
      const coords = await getCurrentPosition();
      setCenter(coords);
      const name = await reverseGeocode(coords[0], coords[1]).catch(() => "");
      setLocation(name || `${coords[0].toFixed(3)}, ${coords[1].toFixed(3)}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLocating(false);
    }
  };

  const toggleType = (t) => setTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const handleSearch = async () => {
    const where = location.trim();
    if (!where) { toast.error("Enter a city, ZIP, or use your location"); return; }
    setLoading(true);
    setSearched(true);
    setEvents([]);
    const endDate = addDays(new Date(), rangeDays);
    try {
      // Resolve the search center (for distances) in parallel with the web search
      const centerPromise = center ? Promise.resolve(center) : geocode(where).catch(() => null);
      const [res, resolvedCenter] = await Promise.all([
        base44.functions.invoke(
          "discoverEvents",
          {
            location: where,
            latitude: center?.[0],
            longitude: center?.[1],
            radius: Number(radius) || 50,
            keywords: keywords.trim() || undefined,
            eventTypes: types.length ? types : undefined,
            startDate: new Date().toISOString().slice(0, 10),
            endDate: endDate.toISOString().slice(0, 10),
          },
          { timeout: 120000 }
        ),
        centerPromise,
      ]);
      if (resolvedCenter) setCenter(resolvedCenter);
      let found = cleanEvents(res.data?.events, endDate);
      if (types.length) found = found.filter((e) => types.includes(e.event_type));
      // Attach distance and drop anything far outside the radius (AI isn't always precise)
      if (resolvedCenter) {
        found = found
          .map((e) => ({ ...e, _distance: distanceMiles(resolvedCenter, [e.latitude, e.longitude]) }))
          .filter((e) => e._distance <= (Number(radius) || 50) * 1.5);
      }
      setEvents(found);
      if (!found.length) toast.info("No events found. Try a bigger radius, a longer date range, or fewer filters.");
    } catch (err) {
      showError(err, "Event search failed. Please try again in a moment.");
    } finally {
      setLoading(false);
    }
  };

  const saveEvent = async (event) => {
    // Double-check the server in case someone else added it since the page loaded
    const existing = await base44.entities.CarEvent.filter({ title: event.title }).catch(() => []);
    if (existing?.some((x) => toDate(x.date)?.toDateString() === toDate(event.date)?.toDateString())) {
      return "duplicate";
    }
    await base44.entities.CarEvent.create({
      title: event.title,
      description: event.description || "",
      date: event.date,
      location_name: event.location_name,
      latitude: event.latitude,
      longitude: event.longitude,
      event_type: event.event_type || "other",
      external_url: event.external_url || "",
      organizer_email: user?.email,
      organizer_name: event.organizer_name || "Discovered event",
      source: "external",
      attendees: [],
      attendee_count: 0,
    });
    return "added";
  };

  const handleImport = async (event) => {
    setImporting(keyOf(event));
    try {
      const result = await saveEvent(event);
      setImported((prev) => new Set([...prev, keyOf(event)]));
      if (result === "duplicate") toast.info(`"${event.title}" is already on DriveCircle.`);
      else {
        toast.success(`"${event.title}" added!`);
        onImported?.();
      }
    } catch (err) {
      showError(err, "Couldn't add that event.");
    } finally {
      setImporting(null);
    }
  };

  const handleAddAll = async () => {
    const toAdd = events.filter((e) => !isAdded(e));
    if (!toAdd.length) return;
    setAddingAll(true);
    let added = 0;
    for (const e of toAdd) {
      try {
        const result = await saveEvent(e);
        if (result === "added") added++;
        setImported((prev) => new Set([...prev, keyOf(e)]));
      } catch (err) {
        console.error("Add failed", e.title, err);
      }
    }
    setAddingAll(false);
    toast.success(`Added ${added} event${added !== 1 ? "s" : ""} to DriveCircle`);
    if (added) onImported?.();
  };

  const notAddedCount = events.filter((e) => !isAdded(e)).length;
  const selectCls = "h-9 bg-secondary border border-border/50 rounded-md px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] flex flex-col w-[calc(100vw-1rem)] p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="font-orbitron tracking-wide flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary" /> Find Car Events on the Web
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={(e) => { e.preventDefault(); handleSearch(); }} className="space-y-2 mt-1">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="City, state or ZIP (e.g. Baton Rouge, LA)"
                value={location}
                onChange={(e) => { setLocation(e.target.value); setCenter(null); }}
                className="pl-9 bg-secondary border-border/50"
              />
            </div>
            <Button type="button" variant="outline" size="icon" onClick={useMyLocation} disabled={locating} title="Use my location" className="shrink-0">
              <Navigation className={`w-4 h-4 ${locating ? "animate-pulse" : ""}`} />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <select value={radius} onChange={(e) => setRadius(e.target.value)} className={selectCls}>
              {[10, 25, 50, 100, 200].map((r) => <option key={r} value={r}>Within {r} mi</option>)}
            </select>
            <select value={rangeDays} onChange={(e) => setRangeDays(Number(e.target.value))} className={selectCls}>
              {RANGE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <Input
              placeholder="Keywords: JDM, Mustang, Cars & Coffee..."
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              className="bg-secondary border-border/50 h-9 flex-1 min-w-[180px] text-sm"
            />
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {EVENT_TYPES.map((t) => (
              <button
                type="button"
                key={t.value}
                onClick={() => toggleType(t.value)}
                className={`shrink-0 text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                  types.includes(t.value) ? "bg-primary text-primary-foreground border-primary" : "border-border/60 text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <Button type="submit" disabled={loading} className="w-full font-orbitron text-xs tracking-wider">
            <Search className="w-4 h-4 mr-1.5" />
            {loading ? "Searching the web..." : "Search"}
          </Button>
        </form>
        <p className="text-[10px] text-muted-foreground">Searches Facebook Events, Eventbrite, Cars & Coffee, club sites and more. Always confirm details on the source page.</p>

        {events.length > 0 && !loading && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{events.length} event{events.length !== 1 ? "s" : ""} found</span>
            {notAddedCount > 1 && (
              <Button size="sm" variant="outline" onClick={handleAddAll} disabled={addingAll} className="h-7 text-xs">
                <Plus className="w-3 h-3 mr-1" /> {addingAll ? "Adding..." : `Add all ${notAddedCount}`}
              </Button>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-[120px]">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground text-center">Searching the web for events near <span className="text-foreground font-medium">{location}</span>...</p>
              <p className="text-xs text-muted-foreground">This can take up to a minute. Hang tight!</p>
            </div>
          )}

          {!loading && events.length === 0 && (
            <div className="text-center py-10 text-muted-foreground text-sm">
              {searched ? "No events found. Try another city, a bigger radius, or fewer filters." : "Enter a city (or tap the location button) and hit Search."}
            </div>
          )}

          {!loading && events.map((event, i) => {
            const added = isAdded(event);
            const isImporting = importing === keyOf(event);
            return (
              <div key={`${keyOf(event)}-${i}`} className="bg-secondary border border-border/50 rounded-xl p-4 flex flex-col sm:flex-row gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-semibold text-sm text-foreground leading-snug">{event.title}</h3>
                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/20 text-primary shrink-0">
                      {TYPE_LABEL[event.event_type] || "Other"}
                    </span>
                  </div>
                  <div className="space-y-1 mb-2">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      {safeFormat(event.date, "EEE, MMM d, yyyy · h:mm a")}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
                      <MapPin className="w-3 h-3 shrink-0" />
                      <span className="truncate">{event.location_name}</span>
                      {event._distance != null && <span className="text-primary shrink-0">· {formatMiles(event._distance)}</span>}
                    </div>
                  </div>
                  {event.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{event.description}</p>
                  )}
                  {event.external_url && (
                    <a href={event.external_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary flex items-center gap-1 mt-1 hover:underline w-fit">
                      <ExternalLink className="w-3 h-3" /> View source
                    </a>
                  )}
                </div>
                <div className="flex sm:flex-col justify-end sm:justify-center">
                  <Button
                    size="sm"
                    variant={added ? "outline" : "default"}
                    disabled={added || isImporting || addingAll}
                    onClick={() => handleImport(event)}
                    className="text-xs w-24"
                  >
                    {added ? <><Check className="w-3 h-3 mr-1" />On app</> :
                      isImporting ? "Adding..." :
                      <><Plus className="w-3 h-3 mr-1" />Add</>}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
