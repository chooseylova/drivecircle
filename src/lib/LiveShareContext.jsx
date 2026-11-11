import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { distanceMiles } from "@/lib/helpers";

/**
 * App-wide live location sharing.
 * Lives above the routes so sharing keeps running while the member browses other pages.
 *
 * Privacy rules:
 * - Nothing is sent unless the member explicitly turns sharing on.
 * - Sharing auto-stops at the chosen time (max 12h, enforced on the server too).
 * - Turning it off wipes the coordinates on the server.
 */

const LiveShareContext = createContext(null);
const STORE_KEY = "dc_live_share_v1";
const SEND_EVERY_MS = 15000;     // at most one update per 15s while moving
const HEARTBEAT_MS = 60000;      // and at least one per minute while parked
const MOVE_THRESHOLD_MI = 0.03;  // ~50 m

export const DEFAULT_SETTINGS = {
  visibility: "followers",   // "everyone" | "followers"
  precision: "exact",        // "exact" | "approximate"
  durationMinutes: 60,       // 60 | 240 | 720
  carId: "",
  carLabel: "",
  statusNote: "",
  keepAwake: false,
};

function readStore() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || "null");
  } catch {
    return null;
  }
}
function writeStore(v) {
  try {
    if (v) localStorage.setItem(STORE_KEY, JSON.stringify(v));
    else localStorage.removeItem(STORE_KEY);
  } catch {
    /* ignore */
  }
}

export function LiveShareProvider({ children }) {
  const stored = readStore();
  const [settings, setSettings] = useState({ ...DEFAULT_SETTINGS, ...(stored?.settings || {}) });
  const [sharing, setSharing] = useState(false);
  const [starting, setStarting] = useState(false);
  const [position, setPosition] = useState(null); // { lat, lng, accuracy, heading, speed, at }
  const [expiresAt, setExpiresAt] = useState(null);
  const [error, setError] = useState("");
  const [lastSentAt, setLastSentAt] = useState(null);

  const watchId = useRef(null);
  const lastSent = useRef({ at: 0, coords: null });
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const sendingRef = useRef(false);
  const wakeLock = useRef(null);
  const expiryTimer = useRef(null);
  const heartbeat = useRef(null);
  const latestPos = useRef(null);

  const send = useCallback(async (pos, { force = false, restart = false } = {}) => {
    if (!pos || sendingRef.current) return;
    const now = Date.now();
    const moved = lastSent.current.coords ? distanceMiles(lastSent.current.coords, [pos.lat, pos.lng]) : Infinity;
    const due =
      force ||
      (now - lastSent.current.at >= SEND_EVERY_MS && moved >= MOVE_THRESHOLD_MI) ||
      now - lastSent.current.at >= HEARTBEAT_MS;
    if (!due) return;
    sendingRef.current = true;
    const s = settingsRef.current;
    try {
      const res = await base44.functions.invoke("updateLiveLocation", {
        latitude: pos.lat,
        longitude: pos.lng,
        accuracy: pos.accuracy,
        heading: pos.heading,
        speed: pos.speed,
        visibility: s.visibility,
        precision: s.precision,
        durationMinutes: s.durationMinutes,
        carId: s.carId,
        carLabel: s.carLabel,
        statusNote: s.statusNote,
        restart,
      });
      lastSent.current = { at: Date.now(), coords: [pos.lat, pos.lng] };
      setLastSentAt(Date.now());
      if (res.data?.expiresAt) setExpiresAt(res.data.expiresAt);
      setError("");
    } catch (err) {
      console.error("Live location update failed", err);
      setError("Couldn't update your location. Retrying…");
    } finally {
      sendingRef.current = false;
    }
  }, []);

  const releaseWakeLock = () => {
    try { wakeLock.current?.release(); } catch { /* ignore */ }
    wakeLock.current = null;
  };

  const requestWakeLock = async () => {
    if (!settingsRef.current.keepAwake || !("wakeLock" in navigator)) return;
    try {
      wakeLock.current = await navigator.wakeLock.request("screen");
    } catch {
      /* not allowed (e.g. battery saver) */
    }
  };

  const clearLocalTracking = () => {
    if (watchId.current != null) navigator.geolocation?.clearWatch(watchId.current);
    watchId.current = null;
    clearTimeout(expiryTimer.current);
    clearInterval(heartbeat.current);
    releaseWakeLock();
  };

  const stop = useCallback(async ({ silent = false, reason = "" } = {}) => {
    clearLocalTracking();
    setSharing(false);
    setExpiresAt(null);
    writeStore({ settings: settingsRef.current, active: false });
    try {
      await base44.functions.invoke("updateLiveLocation", { sharing: false });
    } catch (err) {
      console.error("Stop sharing failed", err);
    }
    if (!silent) toast.success(reason || "Live location sharing stopped.");
  }, []);

  const begin = useCallback((untilMs, { resume = false } = {}) => {
    if (!navigator.geolocation) {
      toast.error("Location isn't supported on this device.");
      return;
    }
    setStarting(true);
    setError("");
    let first = true;
    watchId.current = navigator.geolocation.watchPosition(
      (p) => {
        const pos = {
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          accuracy: p.coords.accuracy,
          heading: Number.isFinite(p.coords.heading) ? p.coords.heading : null,
          speed: Number.isFinite(p.coords.speed) ? p.coords.speed : null,
          at: Date.now(),
        };
        latestPos.current = pos;
        setPosition(pos);
        if (first) {
          first = false;
          setStarting(false);
          setSharing(true);
          send(pos, { force: true, restart: !resume });
          if (!resume) toast.success("You're live on the map.");
        } else {
          send(pos);
        }
      },
      (err) => {
        setStarting(false);
        if (err.code === err.PERMISSION_DENIED) {
          toast.error("Location permission is blocked. Allow location for this site in your browser settings.");
          stop({ silent: true });
        } else {
          setError("Waiting for a GPS signal…");
        }
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 }
    );
    // Heartbeat keeps you "fresh" on the map while parked
    heartbeat.current = setInterval(() => latestPos.current && send(latestPos.current), HEARTBEAT_MS);
    // Auto-stop at expiry
    const ms = untilMs - Date.now();
    expiryTimer.current = setTimeout(() => stop({ reason: "Live sharing ended (time limit reached)." }), Math.max(ms, 1000));
    requestWakeLock();
  }, [send, stop]);

  const start = useCallback((newSettings) => {
    const s = { ...settingsRef.current, ...(newSettings || {}) };
    setSettings(s);
    settingsRef.current = s;
    clearLocalTracking();
    lastSent.current = { at: 0, coords: null };
    const until = Date.now() + s.durationMinutes * 60000;
    writeStore({ settings: s, active: true, until });
    begin(until);
  }, [begin]);

  // Update settings while live (pushes immediately)
  const updateSettings = useCallback((patch) => {
    const next = { ...settingsRef.current, ...patch };
    settingsRef.current = next;
    setSettings(next);
    writeStore({ ...(readStore() || {}), settings: next });
    if ("keepAwake" in patch && sharing) {
      if (patch.keepAwake) requestWakeLock();
      else releaseWakeLock();
    }
    if (sharing && latestPos.current) {
      setTimeout(() => send(latestPos.current, { force: true, restart: "durationMinutes" in patch }), 0);
      if ("durationMinutes" in patch) {
        const until = Date.now() + patch.durationMinutes * 60000;
        clearTimeout(expiryTimer.current);
        expiryTimer.current = setTimeout(() => stop({ reason: "Live sharing ended (time limit reached)." }), until - Date.now());
        const store = readStore() || {};
        writeStore({ ...store, until });
      }
    }
  }, [sharing, send, stop]);

  // Resume after a page reload if sharing was on and hasn't expired (only if permission is already granted, no prompt)
  useEffect(() => {
    const s = readStore();
    if (!s?.active || !s.until || s.until <= Date.now()) {
      if (s?.active) writeStore({ settings: s.settings, active: false });
      return;
    }
    const resume = () => begin(s.until, { resume: true });
    if (navigator.permissions?.query) {
      navigator.permissions.query({ name: "geolocation" }).then((p) => {
        if (p.state === "granted") resume();
        else writeStore({ settings: s.settings, active: false });
      }).catch(() => {});
    }
    return () => clearLocalTracking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-acquire the wake lock and push a fresh update when the tab comes back to the foreground
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && sharing) {
        requestWakeLock();
        if (latestPos.current) send(latestPos.current, { force: true });
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharing, send]);

  return (
    <LiveShareContext.Provider
      value={{ sharing, starting, position, settings, expiresAt, error, lastSentAt, start, stop, updateSettings }}
    >
      {children}
    </LiveShareContext.Provider>
  );
}

export function useLiveShare() {
  const ctx = useContext(LiveShareContext);
  if (!ctx) throw new Error("useLiveShare must be used inside LiveShareProvider");
  return ctx;
}
