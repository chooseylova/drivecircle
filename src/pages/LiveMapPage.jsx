import { useState, useEffect, useCallback, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Radio, Users, Lock, Eye, Clock, Crosshair, MessageSquare, ShieldCheck, Car, MapPin, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { motion } from "framer-motion";
import LiveDriversMap from "../components/LiveDriversMap";
import UserAvatar from "../components/UserAvatar";
import { useLiveShare } from "@/lib/LiveShareContext";
import { distanceMiles, formatMiles, safeTimeAgo, safeFormat } from "@/lib/helpers";

const POLL_MS = 15000;

const DURATIONS = [
  { value: 60, label: "1 hour" },
  { value: 240, label: "4 hours" },
  { value: 720, label: "12 hours" },
];

function Choice({ value, current, onChange, icon: Icon, title, desc }) {
  const on = value === current;
  return (
    <button
      type="button"
      onClick={() => onChange(value)}
      className={`flex-1 text-left rounded-xl border p-3 transition-colors ${on ? "border-primary bg-primary/10" : "border-border/60 hover:border-primary/40"}`}
    >
      <div className="flex items-center gap-1.5 text-xs font-semibold">
        <Icon className={`w-3.5 h-3.5 ${on ? "text-primary" : "text-muted-foreground"}`} /> {title}
      </div>
      <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{desc}</p>
    </button>
  );
}

export default function LiveMapPage() {
  const live = useLiveShare();
  const { sharing, starting, position, settings, expiresAt, error } = live;
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [cars, setCars] = useState([]);
  const [focus, setFocus] = useState(null);
  const [draft, setDraft] = useState(settings); // settings chosen before going live
  const [showSettings, setShowSettings] = useState(false);
  const pollRef = useRef(null);

  useEffect(() => setDraft(settings), [settings]);

  const load = useCallback(async () => {
    try {
      const res = await base44.functions.invoke("getLiveLocations", {});
      setDrivers(res.data?.drivers || []);
      setLoadError(false);
    } catch (err) {
      console.error(err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // Poll while the page is visible
  useEffect(() => {
    load();
    const startPoll = () => {
      clearInterval(pollRef.current);
      pollRef.current = setInterval(load, POLL_MS);
    };
    const onVis = () => {
      if (document.visibilityState === "visible") { load(); startPoll(); }
      else clearInterval(pollRef.current);
    };
    startPoll();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(pollRef.current);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [load]);

  // The member's own cars, for the "which ride" label
  useEffect(() => {
    base44.auth.me()
      .then((me) => base44.entities.CarProfile.filter({ owner_email: me.email }, "-created_date", 20))
      .then((c) => setCars(c || []))
      .catch(() => {});
  }, []);

  const me = position ? { lat: position.lat, lng: position.lng, accuracy: position.accuracy } : null;
  const withDistance = drivers
    .map((d) => ({ ...d, _dist: me ? distanceMiles([me.lat, me.lng], [d.latitude, d.longitude]) : null }))
    .sort((a, b) => (a._dist ?? Infinity) - (b._dist ?? Infinity));

  const pickCar = (id, apply) => {
    const c = cars.find((x) => x.id === id);
    const patch = { carId: id || "", carLabel: c ? [c.year, c.make, c.model].filter(Boolean).join(" ") || c.car_name : "" };
    apply(patch);
  };

  const applyDraft = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const applyLive = (patch) => live.updateSettings(patch);
  const apply = sharing ? applyLive : applyDraft;
  const current = sharing ? settings : draft;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
            <Radio className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-orbitron font-bold text-xl tracking-wide">Live Map</h1>
            <p className="text-muted-foreground text-xs mt-0.5">See who's out driving. Only members who choose to share appear here.</p>
          </div>
        </div>
      </motion.div>

      {/* Sharing control */}
      <div className={`rounded-2xl border p-4 mb-4 ${sharing ? "border-primary/60 bg-primary/5" : "border-border/50 bg-card"}`}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px]">
            <div className="flex items-center gap-2">
              {sharing && <span className="relative flex w-2.5 h-2.5"><span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-75 animate-ping" /><span className="relative inline-flex w-2.5 h-2.5 rounded-full bg-primary" /></span>}
              <p className="font-semibold text-sm">{sharing ? "You're live" : "You're hidden"}</p>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {sharing
                ? <>Visible to {settings.visibility === "everyone" ? "all DriveCircle members" : "your followers"}{settings.precision === "approximate" ? " (approximate area)" : ""}{expiresAt ? ` · auto-off ${safeFormat(expiresAt, "h:mm a")}` : ""}</>
                : "Nobody can see your location. Turn on sharing to appear on the map."}
            </p>
            {error && sharing && <p className="text-[11px] text-amber-400 mt-1">{error}</p>}
          </div>
          <div className="flex items-center gap-2">
            {sharing && (
              <Button variant="outline" size="sm" onClick={() => setShowSettings((s) => !s)} className="text-xs">
                Settings
              </Button>
            )}
            {sharing ? (
              <Button variant="outline" onClick={() => live.stop()} className="text-xs border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive">
                Stop sharing
              </Button>
            ) : (
              <Button onClick={() => live.start(draft)} disabled={starting} className="font-orbitron text-xs tracking-wider">
                <Radio className="w-4 h-4 mr-1.5" /> {starting ? "Getting location..." : "Go live"}
              </Button>
            )}
          </div>
        </div>

        {(!sharing || showSettings) && (
          <div className="mt-4 space-y-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Who can see me</p>
              <div className="flex gap-2">
                <Choice value="followers" current={current.visibility} onChange={(v) => apply({ visibility: v })} icon={Lock} title="My followers" desc="Only members who follow you" />
                <Choice value="everyone" current={current.visibility} onChange={(v) => apply({ visibility: v })} icon={Users} title="All members" desc="Any signed-in DriveCircle member" />
              </div>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Location detail</p>
              <div className="flex gap-2">
                <Choice value="exact" current={current.precision} onChange={(v) => apply({ precision: v })} icon={Crosshair} title="Exact" desc="Your real-time GPS position" />
                <Choice value="approximate" current={current.precision} onChange={(v) => apply({ precision: v })} icon={Eye} title="Approximate" desc="Rounded to about 1 km" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1"><Clock className="w-3 h-3" /> Auto-off after</p>
                <select
                  value={current.durationMinutes}
                  onChange={(e) => apply({ durationMinutes: Number(e.target.value) })}
                  className="w-full h-9 bg-secondary border border-border/50 rounded-md px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {DURATIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1"><Car className="w-3 h-3" /> Driving</p>
                <select
                  value={current.carId}
                  onChange={(e) => pickCar(e.target.value, apply)}
                  className="w-full h-9 bg-secondary border border-border/50 rounded-md px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">Don't show a car</option>
                  {cars.map((c) => <option key={c.id} value={c.id}>{c.car_name || `${c.make} ${c.model}`}</option>)}
                </select>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Status (optional)</p>
                <Input
                  value={draft.statusNote}
                  maxLength={80}
                  placeholder="Cruising downtown 🚗"
                  onChange={(e) => applyDraft({ statusNote: e.target.value })}
                  onBlur={(e) => sharing && e.target.value !== settings.statusNote && applyLive({ statusNote: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                  className="h-9 bg-secondary border-border/50 text-xs"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs">
              <Switch checked={!!current.keepAwake} onCheckedChange={(v) => apply({ keepAwake: v })} />
              Keep screen on while sharing (more reliable updates on phones)
            </label>
          </div>
        )}

        <p className="text-[10px] text-muted-foreground mt-3 flex items-start gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-primary" />
          Your location is only sent while sharing is on, is never shown to signed-out visitors, and is erased when you stop.
          Phones may pause updates when the browser is in the background or the screen is locked.
        </p>
      </div>

      {/* Map */}
      <div className="relative">
        <LiveDriversMap drivers={drivers} me={me} focus={focus} />
        {me && (
          <Button
            size="icon"
            variant="secondary"
            onClick={() => setFocus({ lat: me.lat, lng: me.lng, key: Date.now() })}
            className="absolute bottom-4 left-4 z-[500] shadow-lg"
            title="Center on me"
          >
            <Crosshair className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Driver list */}
      <div className="mt-6">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
          Live now <span className="text-primary normal-case tracking-normal font-normal">· {drivers.length} member{drivers.length !== 1 ? "s" : ""}</span>
        </h2>
        {loadError && (
          <div className="flex items-center gap-2 text-xs text-amber-400 mb-3">
            <AlertTriangle className="w-4 h-4" /> Couldn't refresh the map. Retrying automatically…
          </div>
        )}
        {loading ? (
          <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-14 rounded-xl bg-secondary animate-pulse" />)}</div>
        ) : withDistance.length === 0 ? (
          <div className="text-center py-10 bg-card border border-border/50 rounded-xl text-sm text-muted-foreground">
            <MapPin className="w-8 h-8 mx-auto mb-2 opacity-30" />
            Nobody you can see is sharing right now.
            <p className="text-xs mt-1">Members who share with "followers only" appear once you <Link to="/" className="text-primary hover:underline">follow them</Link>.</p>
          </div>
        ) : (
          <div className="bg-card border border-border/50 rounded-xl divide-y divide-border/40">
            {withDistance.map((d) => (
              <div key={d.id} className="flex items-center gap-3 px-4 py-3">
                <button onClick={() => setFocus({ lat: d.latitude, lng: d.longitude, key: Date.now() })} title="Show on map">
                  <UserAvatar name={d.user_name} avatarUrl={d.avatar_url} size="md" />
                </button>
                <button onClick={() => setFocus({ lat: d.latitude, lng: d.longitude, key: Date.now() })} className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-medium truncate">{d.user_name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {d.car_label && <>{d.car_label} · </>}
                    {d._dist != null && <span className="text-primary">{formatMiles(d._dist)}{d.approximate ? " (approx)" : ""} · </span>}
                    {safeTimeAgo(d.updated_at)}
                  </p>
                  {d.status_note && <p className="text-[11px] text-foreground/70 italic truncate">“{d.status_note}”</p>}
                </button>
                <Link to={`/messages?to=${encodeURIComponent(d.user_email)}&name=${encodeURIComponent(d.user_name || "")}`}>
                  <Button size="icon" variant="ghost" title="Message"><MessageSquare className="w-4 h-4" /></Button>
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
