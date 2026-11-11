import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

/** Parse anything date-like; returns a valid Date or null. */
export function toDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

/** date-fns format that never throws on bad/missing dates. */
export function safeFormat(value, pattern, fallback = "TBD") {
  const d = toDate(value);
  return d ? format(d, pattern) : fallback;
}

/** "3 hours ago" that never throws. */
export function safeTimeAgo(value) {
  const d = toDate(value);
  return d ? formatDistanceToNow(d, { addSuffix: true }) : "";
}

/** Friendly display name from a user object or email. */
export function displayNameFor(user) {
  if (!user) return "";
  return user.full_name || user.email?.split("@")[0] || "";
}

export function nameFromEmail(email) {
  return email ? email.split("@")[0] : "";
}

/** Log + show a toast for a failed request. */
export function showError(err, fallback = "Something went wrong. Please try again.") {
  console.error(err);
  const msg = err?.response?.data?.message || err?.data?.message || err?.message;
  toast.error(msg && msg.length < 140 ? msg : fallback);
}

/** Upload a list of files, returning their URLs; failed uploads are reported and skipped. */
export async function uploadFiles(base44, files) {
  const urls = [];
  for (const file of files) {
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      urls.push({ url: file_url, name: file.name });
    } catch (err) {
      showError(err, `Couldn't upload ${file.name}`);
    }
  }
  return urls;
}

/** Copy text to clipboard, with fallback for non-secure contexts. */
export async function copyToClipboard(text) {
  try {
    if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) {
      await navigator.share({ url: text });
      return true;
    }
    await navigator.clipboard.writeText(text);
    toast.success("Link copied!");
    return true;
  } catch (err) {
    if (err?.name === "AbortError") return false; // user closed share sheet
    toast.error("Couldn't copy link");
    return false;
  }
}

/** Reverse-geocode coordinates to "City, State" via OpenStreetMap. */
export async function reverseGeocode(lat, lon) {
  const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
  if (!res.ok) throw new Error("Location lookup failed");
  const data = await res.json();
  const city = data.address?.city || data.address?.town || data.address?.village || data.address?.county || "";
  const state = data.address?.state || "";
  return city ? `${city}${state ? `, ${state}` : ""}` : state;
}

/** Forward-geocode an address/place name to [lat, lng] via OpenStreetMap. */
export async function geocode(query) {
  const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error("Location lookup failed");
  const data = await res.json();
  if (!data?.length) return null;
  return [Number(data[0].lat), Number(data[0].lon)];
}

/** Browser geolocation as a promise. */
export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("Location isn't supported on this device"));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve([pos.coords.latitude, pos.coords.longitude]),
      () => reject(new Error("Couldn't get your location — check location permissions")),
      { timeout: 15000 }
    );
  });
}

/** Great-circle distance in miles between two [lat, lng] points. */
export function distanceMiles(a, b) {
  if (!a || !b) return null;
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 3958.8;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatMiles(mi) {
  if (mi == null || !Number.isFinite(mi)) return "";
  if (mi < 0.1) return "nearby";
  if (mi < 10) return `${mi.toFixed(1)} mi`;
  return `${Math.round(mi)} mi`;
}

export const EVENT_TYPES = [
  { value: "car_meet", label: "Car Meet" },
  { value: "car_show", label: "Car Show" },
  { value: "cruise", label: "Cruise" },
  { value: "drag_race", label: "Drag Race" },
  { value: "drift_event", label: "Drift Event" },
  { value: "auction", label: "Auction" },
  { value: "swap_meet", label: "Swap Meet" },
  { value: "other", label: "Other" },
];

/** Session-scoped storage helpers (never throw). */
export function loadSession(key, fallback = null) {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
export function saveSession(key, value) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}
