import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Calendar, MapPin, Users, ArrowLeft, UserPlus, ExternalLink, Trash2, Navigation, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { safeFormat, showError, toDate, copyToClipboard } from "@/lib/helpers";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

export default function EventDetailPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [eventData, userData] = await Promise.all([
        base44.entities.CarEvent.get(eventId).catch(() => null),
        base44.auth.me().catch(() => null),
      ]);
      setEvent(eventData);
      setUser(userData);
      setLoading(false);
    }
    load();
  }, [eventId]);

  const isAttending = user && event?.attendees?.includes(user.email);

  const handleJoin = async () => {
    if (!user || joining) return;
    setJoining(true);
    try {
      // Re-read so we don't drop RSVPs made by others since the page loaded
      const fresh = (await base44.entities.CarEvent.get(event.id).catch(() => null)) || event;
      const attendees = fresh.attendees || [];
      const isJoined = attendees.includes(user.email);
      const newAttendees = isJoined
        ? attendees.filter((e) => e !== user.email)
        : [...attendees, user.email];
      await base44.entities.CarEvent.update(event.id, {
        attendees: newAttendees,
        attendee_count: newAttendees.length,
      });
      setEvent({ ...fresh, attendees: newAttendees, attendee_count: newAttendees.length });
      toast.success(isJoined ? "You left the event." : "You're going!");
    } catch (err) {
      showError(err, "Couldn't update your RSVP.");
    } finally {
      setJoining(false);
    }
  };

  const isOrganizer = user && event && (user.email === event.organizer_email || user.role === "admin");
  const isPast = toDate(event?.date) && toDate(event.date) < new Date();

  const handleDelete = async () => {
    if (!confirm("Delete this event? This can't be undone.")) return;
    try {
      await base44.entities.CarEvent.delete(event.id);
      toast.success("Event deleted.");
      navigate("/events");
    } catch (err) {
      showError(err, "Couldn't delete the event.");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!event) {
    return <div className="text-center py-20 text-muted-foreground">Event not found.</div>;
  }

  return (
    <div className="min-h-screen">
      {/* Cover */}
      {event.cover_image && (
        <div className="relative h-48 md:h-64 overflow-hidden">
          <img src={event.cover_image} alt={event.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 py-6">
        <Link to="/events" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to events
        </Link>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-orbitron font-bold text-2xl tracking-wide mb-2 break-words">{event.title}</h1>

          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-6">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              {safeFormat(event.date, "EEEE, MMM d, yyyy · h:mm a")}
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-accent" />
              {event.location_name}
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              {event.attendees?.length ?? event.attendee_count ?? 0} {isPast ? "went" : "going"}
            </div>
          </div>

          <div className="flex flex-wrap gap-3 mb-6">
            {!isPast && (
              <Button
                onClick={handleJoin}
                disabled={joining}
                variant={isAttending ? "outline" : "default"}
                className="font-orbitron tracking-wider text-xs"
              >
                <UserPlus className="w-4 h-4 mr-1" />
                {isAttending ? "Leave" : "I'm Going"}
              </Button>
            )}
            {event.latitude && event.longitude && (
              <a href={`https://www.google.com/maps/dir/?api=1&destination=${event.latitude},${event.longitude}`} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="text-xs">
                  <Navigation className="w-4 h-4 mr-1" /> Directions
                </Button>
              </a>
            )}
            <Button variant="outline" className="text-xs" onClick={() => copyToClipboard(window.location.href)}>
              <Share2 className="w-4 h-4 mr-1" /> Share
            </Button>
            {event.external_url && (
              <a href={event.external_url} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="text-xs">
                  <ExternalLink className="w-4 h-4 mr-1" /> View Original
                </Button>
              </a>
            )}
            {isOrganizer && (
              <Button variant="outline" onClick={handleDelete} className="text-xs text-destructive hover:text-destructive border-destructive/40 hover:bg-destructive/10">
                <Trash2 className="w-4 h-4 mr-1" /> Delete
              </Button>
            )}
          </div>

          {event.description && (
            <div className="mb-6">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">About</h2>
              <p className="text-foreground/90 leading-relaxed whitespace-pre-wrap">{event.description}</p>
            </div>
          )}

          {event.organizer_name && (
            <div className="mb-6">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Organized by</h2>
              {event.source === "user_created" && event.organizer_email ? (
                <Link to={`/user/${encodeURIComponent(event.organizer_email)}`} className="text-foreground hover:text-primary">{event.organizer_name}</Link>
              ) : (
                <p className="text-foreground">{event.organizer_name}</p>
              )}
            </div>
          )}

          {/* Map */}
          {event.latitude && event.longitude && (
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Location</h2>
              <div className="rounded-xl overflow-hidden border border-border/50 h-64 relative z-0">
                <MapContainer center={[event.latitude, event.longitude]} zoom={14} className="h-full w-full">
                  <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    attribution='&copy; CARTO'
                  />
                  <Marker position={[event.latitude, event.longitude]} />
                </MapContainer>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}