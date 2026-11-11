import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { Link } from "react-router-dom";
import { Calendar, MapPin } from "lucide-react";
import { safeFormat } from "@/lib/helpers";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

function FitBounds({ points }) {
  const map = useMap();
  const key = points.join("|");
  useEffect(() => {
    if (points.length > 1) map.fitBounds(points, { padding: [40, 40], maxZoom: 12 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key]);
  return null;
}

export default function EventMapView({ events = [] }) {
  const validEvents = events.filter((e) => Number.isFinite(e.latitude) && Number.isFinite(e.longitude));
  const points = validEvents.map((e) => [e.latitude, e.longitude]);
  const center = validEvents.length > 0
    ? [validEvents[0].latitude, validEvents[0].longitude]
    : [39.8283, -98.5795]; // US center

  return (
    <div className="rounded-xl overflow-hidden border border-border/50 h-[500px] relative z-0">
      <MapContainer center={center} zoom={validEvents.length === 1 ? 11 : 5} className="h-full w-full" style={{ background: "hsl(220, 15%, 7%)" }}>
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        />
        <FitBounds points={points} />
        {validEvents.map((event) => (
          <Marker key={event.id} position={[event.latitude, event.longitude]}>
            <Popup>
              <div className="text-sm min-w-[180px]">
                <Link to={`/event/${event.id}`} className="font-semibold text-blue-600 hover:underline block mb-1">
                  {event.title}
                </Link>
                <div className="flex items-center gap-1 text-xs text-gray-600">
                  <Calendar className="w-3 h-3" />
                  {safeFormat(event.date, "MMM d, yyyy · h:mm a")}
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-600 mt-0.5">
                  <MapPin className="w-3 h-3" />
                  {event.location_name}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}