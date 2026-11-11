import { Link } from "react-router-dom";
import { Calendar, MapPin, Users, ExternalLink } from "lucide-react";
import { safeFormat, formatMiles } from "@/lib/helpers";
import { motion } from "framer-motion";

const eventTypeLabels = {
  car_meet: "Car Meet",
  car_show: "Car Show",
  cruise: "Cruise",
  drag_race: "Drag Race",
  drift_event: "Drift Event",
  auction: "Auction",
  swap_meet: "Swap Meet",
  other: "Other",
};

const eventTypeColors = {
  car_meet: "bg-primary/20 text-primary",
  car_show: "bg-accent/20 text-accent",
  cruise: "bg-chart-3/20 text-chart-3",
  drag_race: "bg-destructive/20 text-destructive",
  drift_event: "bg-chart-4/20 text-chart-4",
  auction: "bg-chart-5/20 text-chart-5",
  swap_meet: "bg-chart-2/20 text-chart-2",
  other: "bg-muted text-muted-foreground",
};

export default function EventCard({ event, index = 0, distance = null }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      <Link to={`/event/${event.id}`} className="group block">
        <div className="bg-card border border-border/50 rounded-xl overflow-hidden hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5">
          {event.cover_image && (
            <div className="aspect-[2.5/1] overflow-hidden">
              <img src={event.cover_image} alt={event.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
            </div>
          )}
          <div className="p-4">
            <div className="flex items-center gap-2 mb-2">
              {event.event_type && (
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${eventTypeColors[event.event_type] || eventTypeColors.other}`}>
                  {eventTypeLabels[event.event_type] || event.event_type}
                </span>
              )}
              {(event.source === "facebook" || event.source === "external") && (
                <span className="text-[10px] font-medium text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded-full">{event.source === "facebook" ? "Facebook" : "Discovered"}</span>
              )}
            </div>
            <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">{event.title}</h3>
            <div className="mt-2 space-y-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="w-3.5 h-3.5" />
                {safeFormat(event.date, "EEE, MMM d, yyyy · h:mm a")}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{event.location_name}</span>
                {distance != null && (
                  <span className="shrink-0 text-primary font-medium">· {formatMiles(distance)}</span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Users className="w-3.5 h-3.5" />
                {event.attendees?.length ?? event.attendee_count ?? 0} going
              </div>
            </div>
            {event.external_url && (
              <div className="mt-2 flex items-center gap-1 text-xs text-primary">
                <ExternalLink className="w-3 h-3" />
                External event
              </div>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}