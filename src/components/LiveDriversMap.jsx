import { useEffect, useMemo, useRef, useState } from "react";
import { GoogleMap, Marker, InfoWindow, Circle as GCircle } from "@react-google-maps/api";
import { MapContainer, TileLayer, Marker as LMarker, Popup, Circle as LCircle, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Link } from "react-router-dom";
import { WithGoogleMaps, darkMapStyles } from "@/lib/googleMaps";
import { safeTimeAgo } from "@/lib/helpers";

/**
 * Map of members currently sharing their location.
 * drivers: [{ id, user_email, user_name, avatar_url, latitude, longitude, approximate, car_label, status_note, updated_at, speed }]
 * me:      { lat, lng, accuracy } | null  (your own position, only shown to you)
 * focus:   { lat, lng, key } — pan here whenever `key` changes
 */

const US_CENTER = { lat: 39.8283, lng: -98.5795 };
// Letters/digits only — these go into SVG/HTML markup
const initials = (name) =>
  ((name || "").split(/\s+/).map((w) => w.replace(/[^A-Za-z0-9]/g, "")[0] || "").join("").slice(0, 2).toUpperCase()) || "?";
const mph = (mps) => (Number.isFinite(mps) && mps > 0.5 ? `${Math.round(mps * 2.237)} mph` : null);

function svgPin(text, { fill = "#22a32b", ring = "#ffffff", size = 40 } = {}) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 40 40">
    <circle cx="20" cy="20" r="17" fill="${fill}" stroke="${ring}" stroke-width="3"/>
    <text x="20" y="25" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" font-weight="700" fill="#fff">${text}</text>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function DriverPopup({ d }) {
  return (
    <div className="text-sm min-w-[180px] max-w-[230px] text-gray-800">
      <p className="font-semibold leading-tight">{d.user_name}</p>
      {d.car_label && <p className="text-xs text-gray-600">🚗 {d.car_label}</p>}
      {d.status_note && <p className="text-xs text-gray-600 italic">“{d.status_note}”</p>}
      <p className="text-[11px] text-gray-500 mt-0.5">
        {d.approximate ? "Approximate area · " : ""}
        {mph(d.speed) ? `${mph(d.speed)} · ` : ""}
        updated {safeTimeAgo(d.updated_at)}
      </p>
      <div className="flex gap-3 mt-1.5 text-xs">
        <Link to={`/user/${encodeURIComponent(d.user_email)}`} className="text-blue-600 hover:underline">Profile</Link>
        <Link to={`/messages?to=${encodeURIComponent(d.user_email)}&name=${encodeURIComponent(d.user_name || "")}`} className="text-blue-600 hover:underline">Message</Link>
        <a href={`https://www.google.com/maps/dir/?api=1&destination=${d.latitude},${d.longitude}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Directions</a>
      </div>
    </div>
  );
}

// ---------------- Google ----------------
function GoogleLiveMap({ drivers, me, focus, heightClass }) {
  const [selected, setSelected] = useState(null);
  const mapRef = useRef(null);
  const initialCenter = useMemo(
    () => (me ? { lat: me.lat, lng: me.lng } : drivers[0] ? { lat: drivers[0].latitude, lng: drivers[0].longitude } : US_CENTER),
    // only on first render; afterwards the user controls the map
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useEffect(() => {
    if (focus && mapRef.current) {
      mapRef.current.panTo({ lat: focus.lat, lng: focus.lng });
      if (mapRef.current.getZoom() < 12) mapRef.current.setZoom(13);
    }
  }, [focus?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedDriver = selected && drivers.find((d) => d.id === selected);

  return (
    <div className={`rounded-xl overflow-hidden border border-border/50 ${heightClass}`}>
      <GoogleMap
        mapContainerStyle={{ width: "100%", height: "100%" }}
        center={initialCenter}
        zoom={me || drivers.length ? 11 : 4}
        onLoad={(m) => { mapRef.current = m; }}
        onClick={() => setSelected(null)}
        options={{ styles: darkMapStyles, streetViewControl: false, mapTypeControl: false, fullscreenControl: true, clickableIcons: false, gestureHandling: "greedy" }}
      >
        {me && (
          <>
            <Marker
              position={{ lat: me.lat, lng: me.lng }}
              icon={{ url: svgPin("ME", { fill: "#2563eb" }), scaledSize: new window.google.maps.Size(34, 34), anchor: new window.google.maps.Point(17, 17) }}
              zIndex={1000}
              title="You"
            />
            {me.accuracy > 30 && me.accuracy < 2000 && (
              <GCircle center={{ lat: me.lat, lng: me.lng }} radius={me.accuracy}
                options={{ fillColor: "#2563eb", fillOpacity: 0.08, strokeColor: "#2563eb", strokeOpacity: 0.3, strokeWeight: 1, clickable: false }} />
            )}
          </>
        )}
        {drivers.map((d) => (
          <Marker
            key={d.id}
            position={{ lat: d.latitude, lng: d.longitude }}
            onClick={() => setSelected(d.id)}
            title={d.user_name}
            icon={{
              url: svgPin(initials(d.user_name), { fill: d.approximate ? "#64748b" : "#22a32b" }),
              scaledSize: new window.google.maps.Size(40, 40),
              anchor: new window.google.maps.Point(20, 20),
            }}
          />
        ))}
        {selectedDriver && (
          <InfoWindow position={{ lat: selectedDriver.latitude, lng: selectedDriver.longitude }} onCloseClick={() => setSelected(null)}>
            <DriverPopup d={selectedDriver} />
          </InfoWindow>
        )}
      </GoogleMap>
    </div>
  );
}

// ---------------- Leaflet fallback ----------------
function leafletIcon(d, isMe = false) {
  const bg = isMe ? "#2563eb" : d.approximate ? "#64748b" : "#22a32b";
  // avatar_url is user-controlled and goes into raw HTML here, so only allow plain https URLs
  const safeAvatar = /^https:\/\/[^\s"'<>]+$/i.test(d.avatar_url || "") ? d.avatar_url : "";
  const inner = !isMe && safeAvatar
    ? `<img src="${safeAvatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%" />`
    : `<span style="color:#fff;font:700 12px Arial">${isMe ? "ME" : initials(d.user_name)}</span>`;
  return L.divIcon({
    className: "",
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    html: `<div style="width:38px;height:38px;border-radius:50%;background:${bg};border:3px solid #fff;display:flex;align-items:center;justify-content:center;overflow:hidden;box-shadow:0 2px 6px rgba(0,0,0,.5)">${inner}</div>`,
  });
}

function LeafletFocus({ focus }) {
  const map = useMap();
  useEffect(() => {
    if (focus) map.flyTo([focus.lat, focus.lng], Math.max(map.getZoom(), 13), { duration: 0.6 });
  }, [focus?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function LeafletLiveMap({ drivers, me, focus, heightClass }) {
  const initialCenter = useMemo(
    () => (me ? [me.lat, me.lng] : drivers[0] ? [drivers[0].latitude, drivers[0].longitude] : [US_CENTER.lat, US_CENTER.lng]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  return (
    <div className={`rounded-xl overflow-hidden border border-border/50 relative z-0 ${heightClass}`}>
      <MapContainer center={initialCenter} zoom={me || drivers.length ? 11 : 4} className="h-full w-full" style={{ background: "hsl(220, 15%, 7%)" }}>
        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution='&copy; <a href="https://carto.com/">CARTO</a> &copy; OpenStreetMap' />
        <LeafletFocus focus={focus} />
        {me && (
          <>
            <LMarker position={[me.lat, me.lng]} icon={leafletIcon({}, true)} zIndexOffset={1000} />
            {me.accuracy > 30 && me.accuracy < 2000 && (
              <LCircle center={[me.lat, me.lng]} radius={me.accuracy} pathOptions={{ color: "#2563eb", weight: 1, fillOpacity: 0.08 }} />
            )}
          </>
        )}
        {drivers.map((d) => (
          <LMarker key={d.id} position={[d.latitude, d.longitude]} icon={leafletIcon(d)}>
            <Popup><DriverPopup d={d} /></Popup>
          </LMarker>
        ))}
      </MapContainer>
    </div>
  );
}

export default function LiveDriversMap(props) {
  const p = { heightClass: "h-[55vh] min-h-[340px]", ...props };
  return (
    <WithGoogleMaps fallback={<LeafletLiveMap {...p} />} spinnerClass={p.heightClass}>
      <GoogleLiveMap {...p} />
    </WithGoogleMaps>
  );
}
