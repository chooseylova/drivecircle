import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Plus, List, Map as MapIcon, Search, X, Navigation, MapPin, SlidersHorizontal, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import EventCard from "../components/EventCard";
import GoogleMapView from "../components/GoogleMapView";
import DiscoverEventsModal from "../components/DiscoverEventsModal";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  showError, toDate, distanceMiles, EVENT_TYPES, geocode, getCurrentPosition,
  reverseGeocode, loadSession, saveSession,
} from "@/lib/helpers";
import { startOfDay, endOfDay, addDays, endOfMonth, isSaturday, isSunday, nextSaturday } from "date-fns";

const WHEN_OPTIONS = [
  { value: "any", label: "Any time" },
  { value: "today", label: "Today" },
  { value: "weekend", label: "This weekend" },
  { value: "7d", label: "Next 7 days" },
  { value: "30d", label: "Next 30 days" },
  { value: "month", label: "This month" },
];

const RADIUS_OPTIONS = [10, 25, 50, 100, 250];

// Returns [start, end] Date range for a "when" filter, or null for any time
function whenRange(when) {
  const now = new Date();
  switch (when) {
    case "today":
      return [startOfDay(now), endOfDay(now)];
    case "weekend": {
      // Friday 5pm through Sunday night; if it's already the weekend, start today
      if (isSaturday(now) || isSunday(now)) {
        const sunday = isSunday(now) ? now : addDays(now, 1);
        return [startOfDay(now), endOfDay(sunday)];
      }
      const sat = nextSaturday(now);
      const friEvening = new Date(addDays(startOfDay(sat), -1).getTime() + 17 * 3600 * 1000);
      return [friEvening < now ? startOfDay(now) : friEvening, endOfDay(addDays(sat, 1))];
    }
    case "7d":
      return [startOfDay(now), endOfDay(addDays(now, 7))];
    case "30d":
      return [startOfDay(now), endOfDay(addDays(now, 30))];
    case "month":
      return [startOfDay(now), endOfMonth(now)];
    default:
      return null;
  }
}

const FILTER_KEY = "dc_event_filters_v1";

export default function EventsPage() {
  const saved = loadSession(FILTER_KEY, {});
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState(saved.view || "list");
  const [showDiscover, setShowDiscover] = useState(false);
  const [user, setUser] = useState(null);

  // Filters (remembered for the browser session)
  const [query, setQuery] = useState(saved.query || "");
  const [types, setTypes] = useState(saved.types || []);
  const [when, setWhen] = useState(saved.when || "any");
  const [origin, setOrigin] = useState(saved.origin || null); // { label, coords: [lat,lng] }
  const [radius, setRadius] = useState(saved.radius || 50);
  const [sort, setSort] = useState(saved.sort || "soonest");
  const [showPast, setShowPast] = useState(false);
  const [placeInput, setPlaceInput] = useState("");
  const [locating, setLocating] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => { base44.auth.me().then(setUser).catch(() => {}); }, []);

  useEffect(() => {
    saveSession(FILTER_KEY, { view, query, types, when, origin, radius, sort });
  }, [view, query, types, when, origin, radius, sort]);

  const loadEvents = async () => {
    try {
      const data = await base44.entities.CarEvent.list("-date", 500);
      setEvents(data || []);
    } catch (err) {
      showError(err, "Couldn't load events.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const useMyLocation = async () => {
    setLocating(true);
    try {
      const coords = await getCurrentPosition();
      const label = (await reverseGeocode(coords[0], coords[1]).catch(() => "")) || "My location";
      setOrigin({ label, coords });
      if (sort === "soonest") setSort("nearest");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLocating(false);
    }
  };

  const searchPlace = async (e) => {
    e?.preventDefault();
    const q = placeInput.trim();
    if (!q) return;
    setLocating(true);
    try {
      const coords = await geocode(q);
      if (!coords) {
        toast.error(`Couldn't find "${q}". Try "City, ST" or a ZIP code.`);
        return;
      }
      setOrigin({ label: q, coords });
      setPlaceInput("");
      if (sort === "soonest") setSort("nearest");
    } catch (err) {
      showError(err, "Location search failed.");
    } finally {
      setLocating(false);
    }
  };

  const clearAll = () => {
    setQuery("");
    setTypes([]);
    setWhen("any");
    setOrigin(null);
    setSort("soonest");
  };

  const toggleType = (t) => setTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  // Annotate every event once with time + distance
  const annotated = useMemo(() => {
    return events.map((e) => {
      const t = toDate(e.date)?.getTime() ?? 0;
      const hasCoords = Number.isFinite(e.latitude) && Number.isFinite(e.longitude);
      const dist = origin && hasCoords ? distanceMiles(origin.coords, [e.latitude, e.longitude]) : null;
      return { ...e, _time: t, _distance: dist };
    });
  }, [events, origin]);

  // An event stays "upcoming" for 6 hours after it starts (meets run long)
  const cutoff = Date.now() - 6 * 60 * 60 * 1000;
  const range = whenRange(when);
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const typeLabel = Object.fromEntries(EVENT_TYPES.map((t) => [t.value, t.label.toLowerCase()]));

  const matches = (e) => {
    if (types.length && !types.includes(e.event_type || "other")) return false;
    if (range && (e._time < range[0].getTime() || e._time > range[1].getTime())) return false;
    if (origin && (e._distance == null || e._distance > radius)) return false;
    if (words.length) {
      const hay = [e.title, e.description, e.location_name, e.organizer_name, typeLabel[e.event_type]]
        .filter(Boolean).join(" ").toLowerCase();
      // every word must appear somewhere, so "drift baton rouge" works
      if (!words.every((w) => hay.includes(w))) return false;
    }
    return true;
  };

  const going = (e) => e.attendees?.length ?? e.attendee_count ?? 0;
  const sorter = {
    soonest: (a, b) => a._time - b._time,
    nearest: (a, b) => (a._distance ?? Infinity) - (b._distance ?? Infinity) || a._time - b._time,
    popular: (a, b) => going(b) - going(a) || a._time - b._time,
  }[sort] || ((a, b) => a._time - b._time);

  const upcoming = annotated.filter((e) => e._time >= cutoff && matches(e)).sort(sorter);
  const past = annotated
    .filter((e) => e._time < cutoff && matches(e))
    .sort((a, b) => b._time - a._time)
    .slice(0, 30);

  const activeFilterCount = (query ? 1 : 0) + types.length + (when !== "any" ? 1 : 0) + (origin ? 1 : 0);
  const hasFilters = activeFilterCount > 0;
  const selectCls = "h-9 bg-secondary border border-border/50 rounded-md px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary";

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="font-orbitron font-bold text-xl tracking-wide">Car Events</h1>
          <p className="text-muted-foreground text-xs mt-0.5">Meets, shows, cruises near you</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-secondary rounded-lg p-0.5">
            <button
              onClick={() => setView("list")}
              title="List view"
              className={`p-2 rounded-md transition-colors ${view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setView("map")}
              title="Map view"
              className={`p-2 rounded-md transition-colors ${view === "map" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <MapIcon className="w-4 h-4" />
            </button>
          </div>
          <Button size="sm" variant="outline" className="font-orbitron tracking-wider text-xs" onClick={() => setShowDiscover(true)}>
            <Globe className="w-4 h-4 sm:mr-1" /> <span className="hidden sm:inline">Find on web</span>
          </Button>
          <Link to="/create-event">
            <Button size="sm" className="font-orbitron tracking-wider text-xs">
              <Plus className="w-4 h-4 mr-1" /> Create
            </Button>
          </Link>
        </div>
      </motion.div>

      {/* Search + filters */}
      <div className="bg-card border border-border/50 rounded-xl p-3 mb-6 space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search events, venues, organizers..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10 pr-8 bg-secondary border-border/50 h-10"
            />
            {query && (
              <button onClick={() => setQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" title="Clear">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <Button
            variant="outline"
            onClick={() => setFiltersOpen((o) => !o)}
            className="md:hidden h-10 gap-1.5 text-xs relative"
            title="Filters"
          >
            <SlidersHorizontal className="w-4 h-4" />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-primary text-[9px] text-primary-foreground flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </Button>
        </div>

        <div className={`${filtersOpen ? "block" : "hidden"} md:block space-y-3`}>
          {/* Location / when / sort */}
          <div className="flex flex-wrap items-center gap-2">
            {origin ? (
              <div className="flex items-center gap-1.5 bg-primary/15 text-primary rounded-lg pl-3 pr-1.5 py-1.5 text-xs">
                <MapPin className="w-3.5 h-3.5" />
                <span className="max-w-[160px] truncate">{origin.label}</span>
                <button onClick={() => { setOrigin(null); if (sort === "nearest") setSort("soonest"); }} className="p-0.5 rounded hover:bg-primary/20" title="Clear location">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <form onSubmit={searchPlace} className="flex items-center gap-1.5">
                <div className="relative">
                  <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    placeholder="City or ZIP"
                    value={placeInput}
                    onChange={(e) => setPlaceInput(e.target.value)}
                    className="pl-8 bg-secondary border-border/50 h-9 w-36 text-sm"
                  />
                </div>
                <Button type="submit" size="sm" variant="outline" disabled={locating || !placeInput.trim()} className="h-9 text-xs">Go</Button>
              </form>
            )}
            <Button size="sm" variant="outline" onClick={useMyLocation} disabled={locating} className="h-9 text-xs gap-1.5">
              <Navigation className={`w-3.5 h-3.5 ${locating ? "animate-pulse" : ""}`} /> Near me
            </Button>
            {origin && (
              <select value={radius} onChange={(e) => setRadius(Number(e.target.value))} className={selectCls}>
                {RADIUS_OPTIONS.map((r) => <option key={r} value={r}>Within {r} mi</option>)}
              </select>
            )}
            <select value={when} onChange={(e) => setWhen(e.target.value)} className={selectCls}>
              {WHEN_OPTIONS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value)} className={selectCls}>
              <option value="soonest">Sort: Soonest</option>
              <option value="nearest" disabled={!origin}>Sort: Nearest{!origin ? " (set location)" : ""}</option>
              <option value="popular">Sort: Most going</option>
            </select>
            {hasFilters && (
              <button onClick={clearAll} className="flex items-center gap-1 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground">
                <X className="w-3 h-3" /> Clear all
              </button>
            )}
          </div>

          {/* Type chips */}
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 -mx-1 px-1">
            {EVENT_TYPES.map((t) => {
              const on = types.includes(t.value);
              return (
                <button
                  key={t.value}
                  onClick={() => toggleType(t.value)}
                  className={`shrink-0 text-[11px] font-medium px-3 py-1.5 rounded-full border transition-colors ${
                    on ? "bg-primary text-primary-foreground border-primary" : "border-border/60 text-muted-foreground hover:text-foreground hover:border-primary/40"
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 rounded-xl bg-secondary animate-pulse" />
          ))}
        </div>
      ) : view === "map" ? (
        <>
          <p className="text-xs text-muted-foreground mb-2">{upcoming.length} upcoming event{upcoming.length !== 1 ? "s" : ""} on the map</p>
          <GoogleMapView events={upcoming} />
        </>
      ) : (
        <div>
          <div className="mb-8">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-primary mb-3">
              Upcoming <span className="text-muted-foreground font-normal normal-case tracking-normal">· {upcoming.length} found</span>
            </h2>
            {upcoming.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {upcoming.map((event, i) => (
                  <EventCard key={event.id} event={event} index={Math.min(i, 10)} distance={event._distance} />
                ))}
              </div>
            ) : (
              <div className="text-center py-10 bg-card border border-border/50 rounded-xl">
                <p className="text-muted-foreground text-sm mb-1">
                  {hasFilters ? "No upcoming events match your search." : events.length ? "No upcoming events yet." : "No events yet. Be the first to create one!"}
                </p>
                <p className="text-muted-foreground text-xs mb-4">Search the web for meets, shows and cruises, or host your own.</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {hasFilters && (
                    <Button size="sm" variant="ghost" className="text-xs" onClick={clearAll}>
                      <X className="w-4 h-4 mr-1" /> Clear filters
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="text-xs" onClick={() => setShowDiscover(true)}>
                    <Globe className="w-4 h-4 mr-1" /> Find events on the web
                  </Button>
                  <Link to="/create-event">
                    <Button size="sm" className="text-xs"><Plus className="w-4 h-4 mr-1" /> Create one</Button>
                  </Link>
                </div>
              </div>
            )}
          </div>

          {past.length > 0 && (
            <div>
              <button onClick={() => setShowPast((s) => !s)} className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 hover:text-foreground">
                {showPast ? "Hide" : "Show"} past events ({past.length})
              </button>
              {showPast && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-60">
                  {past.map((event, i) => (
                    <EventCard key={event.id} event={event} index={Math.min(i, 10)} distance={event._distance} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {showDiscover && (
        <DiscoverEventsModal
          open={showDiscover}
          onClose={() => setShowDiscover(false)}
          onImported={() => loadEvents()}
          user={user}
          existingEvents={events}
          initialOrigin={origin}
          initialTypes={types}
        />
      )}
    </div>
  );
}
