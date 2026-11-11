import { useEffect, useState } from "react";
import { useJsApiLoader } from "@react-google-maps/api";
import { base44 } from "@/api/base44Client";

// Shared Google Maps setup for every map in the app.
// - The API key comes from the `getConfig` backend function (GOOGLE_MAPS_API_KEY secret).
// - If there's no key, the script fails, or Google rejects the key, `fallback` is rendered
//   (the free OpenStreetMap/Leaflet version) so maps never get stuck on a spinner.

let cachedKey = null;
let keyPromise = null;
let authFailed = false;

if (typeof window !== "undefined") {
  // Google calls this global when the key is invalid / billing is off
  window.gm_authFailure = () => {
    authFailed = true;
    window.dispatchEvent(new Event("dc-gmaps-auth-failure"));
  };
}

export function useMapsKey() {
  const [key, setKey] = useState(cachedKey);
  useEffect(() => {
    if (cachedKey !== null) return;
    keyPromise ||= base44.functions
      .invoke("getConfig", {})
      .then((r) => r.data?.googleMapsApiKey || "")
      .catch(() => "");
    keyPromise.then((k) => {
      cachedKey = k;
      setKey(k);
    });
  }, []);
  return key;
}

export const darkMapStyles = [
  { elementType: "geometry", stylers: [{ color: "#1a1f2e" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1a1f2e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8a9bb0" }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#334155" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#2d3748" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#1e3a5f" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#5b8ccc" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0d1b2e" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#4a6fa5" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

export function MapSpinner({ className = "h-[500px]" }) {
  return (
    <div className={`rounded-xl border border-border/50 flex items-center justify-center bg-card ${className}`}>
      <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );
}

function Loader({ apiKey, children, fallback, spinnerClass }) {
  const { isLoaded, loadError } = useJsApiLoader({ id: "google-map-script", googleMapsApiKey: apiKey });
  const [failed, setFailed] = useState(authFailed);
  useEffect(() => {
    const onFail = () => setFailed(true);
    window.addEventListener("dc-gmaps-auth-failure", onFail);
    return () => window.removeEventListener("dc-gmaps-auth-failure", onFail);
  }, []);
  if (loadError || failed) return fallback;
  if (!isLoaded) return <MapSpinner className={spinnerClass} />;
  return children;
}

/** Renders children once Google Maps is ready; otherwise renders `fallback`. */
export function WithGoogleMaps({ children, fallback, spinnerClass }) {
  const key = useMapsKey();
  if (key === null) return <MapSpinner className={spinnerClass} />;
  if (!key) return fallback;
  return <Loader apiKey={key} fallback={fallback} spinnerClass={spinnerClass}>{children}</Loader>;
}
