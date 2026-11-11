import { useState, useMemo } from "react";
import { GoogleMap, Marker, InfoWindow } from "@react-google-maps/api";
import { Link } from "react-router-dom";
import { Calendar, MapPin, Users } from "lucide-react";
import { safeFormat } from "@/lib/helpers";
import { WithGoogleMaps, darkMapStyles as mapStyles } from "@/lib/googleMaps";
import EventMapView from "./EventMapView";

const containerStyle = { width: "100%", height: "100%" };

// Uses Google Maps when a key is configured, otherwise the free OpenStreetMap view
export default function GoogleMapView({ events = [] }) {
  return (
    <WithGoogleMaps fallback={<EventMapView events={events} />}>
      <EventsGoogleMap events={events} />
    </WithGoogleMaps>
  );
}

function EventsGoogleMap({ events }) {
  const [selected, setSelected] = useState(null);

  const validEvents = events.filter((e) => Number.isFinite(e.latitude) && Number.isFinite(e.longitude));
  const first = validEvents[0];
  // Memoized so opening an info window doesn't snap the map back to the center
  const center = useMemo(
    () => (first ? { lat: first.latitude, lng: first.longitude } : { lat: 39.8283, lng: -98.5795 }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [first?.id]
  );

  const fitToEvents = (map) => {
    if (validEvents.length < 2 || !window.google) return;
    const bounds = new window.google.maps.LatLngBounds();
    validEvents.forEach((e) => bounds.extend({ lat: e.latitude, lng: e.longitude }));
    map.fitBounds(bounds, 48);
  };

  return (
    <div className="rounded-xl overflow-hidden border border-border/50 h-[500px]">
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={center}
          onLoad={fitToEvents}
          zoom={validEvents.length === 1 ? 11 : 5}
          options={{ styles: mapStyles, disableDefaultUI: false, zoomControl: true, streetViewControl: false, mapTypeControl: false, fullscreenControl: true }}
        >
          {validEvents.map((event) => (
            <Marker
              key={event.id}
              position={{ lat: event.latitude, lng: event.longitude }}
              onClick={() => setSelected(event)}
              icon={{
                path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
                fillColor: "hsl(210, 100%, 55%)",
                fillOpacity: 1,
                strokeColor: "#fff",
                strokeWeight: 1,
                scale: 1.4,
                anchor: { x: 12, y: 24 },
              }}
            />
          ))}

          {selected && (
            <InfoWindow
              position={{ lat: selected.latitude, lng: selected.longitude }}
              onCloseClick={() => setSelected(null)}
            >
              <div className="text-sm min-w-[200px] max-w-[240px] p-1">
                <Link
                  to={`/event/${selected.id}`}
                  className="font-semibold text-blue-600 hover:underline block mb-1 leading-tight"
                >
                  {selected.title}
                </Link>
                <div className="flex items-center gap-1 text-xs text-gray-500 mb-0.5">
                  <Calendar className="w-3 h-3" />
                  {safeFormat(selected.date, "MMM d, yyyy · h:mm a")}
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-500 mb-0.5">
                  <MapPin className="w-3 h-3" />
                  {selected.location_name}
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <Users className="w-3 h-3" />
                  {selected.attendees?.length ?? selected.attendee_count ?? 0} going
                </div>
                {selected.external_url && (
                  <a href={selected.external_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline mt-1 block">
                    View original →
                  </a>
                )}
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
    </div>
  );
}