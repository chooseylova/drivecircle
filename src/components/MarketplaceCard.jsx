import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { MapPin, Tag, CheckCircle, MessageSquare, Trash2, Gauge } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { showError, safeTimeAgo } from "@/lib/helpers";

const CATEGORY_LABELS = {
  vehicle: "Vehicle", parts: "Parts", wheels_tires: "Wheels & Tires",
  audio: "Audio", exterior: "Exterior", interior: "Interior", tools: "Tools", other: "Other",
};

const CONDITION_LABELS = {
  new: "New", like_new: "Like New", good: "Good", fair: "Fair", for_parts: "For Parts",
};

export default function MarketplaceCard({ listing, index, user, onUpdate }) {
  const [marking, setMarking] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();

  const handleMessageSeller = () => {
    navigate(`/messages?to=${encodeURIComponent(listing.seller_email)}&name=${encodeURIComponent(listing.seller_name || listing.seller_email.split("@")[0])}`);
  };

  const isOwner = user?.email === listing.seller_email;
  const photo = listing.photos?.[0];

  const handleMarkSold = async () => {
    if (!confirm("Mark this listing as sold? It will be removed from the marketplace.")) return;
    setMarking(true);
    try {
      await base44.entities.MarketplaceListing.update(listing.id, { status: "sold" });
      toast.success("Marked as sold!");
      onUpdate?.();
    } catch (err) {
      showError(err, "Couldn't update the listing.");
    } finally {
      setMarking(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this listing?")) return;
    setMarking(true);
    try {
      await base44.entities.MarketplaceListing.delete(listing.id);
      toast.success("Listing deleted.");
      onUpdate?.();
    } catch (err) {
      showError(err, "Couldn't delete the listing.");
    } finally {
      setMarking(false);
    }
  };

  // contact_info can be an email or a phone number
  const contact = (listing.contact_info || "").trim();
  const contactHref = contact.includes("@")
    ? `mailto:${contact}?subject=${encodeURIComponent(`DriveCircle: ${listing.title}`)}`
    : /\d{7,}/.test(contact.replace(/\D/g, ""))
      ? `tel:${contact.replace(/[^\d+]/g, "")}`
      : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="bg-card border border-border/50 rounded-xl overflow-hidden hover:border-primary/30 transition-all"
    >
      {/* Photo */}
      <div className="aspect-[4/3] bg-secondary overflow-hidden">
        {photo ? (
          <a href={photo} target="_blank" rel="noopener noreferrer"><img src={photo} alt={listing.title} loading="lazy" className="w-full h-full object-cover" /></a>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Tag className="w-10 h-10 text-muted-foreground/30" />
          </div>
        )}
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-semibold text-sm text-foreground leading-snug line-clamp-2">{listing.title}</h3>
          <span className="font-orbitron font-bold text-primary text-sm shrink-0">{listing.price > 0 ? `$${Number(listing.price).toLocaleString()}` : "Free"}</span>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-2">
          {listing.category && (
            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/15 text-primary">
              {CATEGORY_LABELS[listing.category] || listing.category}
            </span>
          )}
          {listing.condition && (
            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
              {CONDITION_LABELS[listing.condition] || listing.condition}
            </span>
          )}
        </div>

        {listing.category === "vehicle" && (listing.year || listing.make || listing.mileage > 0) && (
          <p className="flex items-center gap-1 text-[11px] text-foreground/80 mb-2">
            {[listing.year, listing.make, listing.model].filter(Boolean).join(" ")}
            {listing.mileage > 0 && (
              <span className="flex items-center gap-1 text-muted-foreground ml-1"><Gauge className="w-3 h-3" />{Number(listing.mileage).toLocaleString()} mi</span>
            )}
          </p>
        )}

        {listing.description && (
          <p className={`text-xs text-muted-foreground mb-2 whitespace-pre-wrap break-words ${expanded ? "" : "line-clamp-2"}`}>
            {listing.description}
          </p>
        )}
        {listing.description?.length > 80 && (
          <button onClick={() => setExpanded(!expanded)} className="text-[10px] text-primary hover:underline mb-2">
            {expanded ? "Less" : "More"}
          </button>
        )}

        <div className="flex items-center justify-between mt-2">
          <div className="space-y-0.5">
            {listing.location && (
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <MapPin className="w-3 h-3" /> {listing.location}
              </div>
            )}
            <p className="text-[10px] text-muted-foreground">by {listing.seller_name || listing.seller_email.split('@')[0]} · {safeTimeAgo(listing.created_date)}</p>
          </div>
          <div className="flex flex-col gap-1 items-end">
            {contact && !isOwner && (
              contactHref ? (
                <a href={contactHref} className="text-[10px] text-primary hover:underline">{contact.includes("@") ? "Email seller" : "Call/Text seller"}</a>
              ) : (
                <span className="text-[10px] text-muted-foreground">{contact}</span>
              )
            )}
            {isOwner ? (
              <div className="flex gap-1">
                <Button size="sm" variant="outline" disabled={marking} onClick={handleMarkSold} className="text-[10px] h-6 px-2">
                  <CheckCircle className="w-3 h-3 mr-1" /> Sold
                </Button>
                <Button size="sm" variant="outline" disabled={marking} onClick={handleDelete} title="Delete listing" className="text-[10px] h-6 px-1.5 text-destructive hover:text-destructive">
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={handleMessageSeller} className="text-[10px] h-6 px-2">
                <MessageSquare className="w-3 h-3 mr-1" /> Message
              </Button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}