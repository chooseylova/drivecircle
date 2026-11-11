import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Search, X, Tag, MapPin, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import MarketplaceCard from "../components/MarketplaceCard";
import CreateListingModal from "../components/CreateListingModal";
import { toast } from "sonner";
import { showError, getCurrentPosition, reverseGeocode } from "@/lib/helpers";

const CATEGORIES = [
  { value: "", label: "All" },
  { value: "vehicle", label: "Vehicles" },
  { value: "parts", label: "Parts" },
  { value: "wheels_tires", label: "Wheels & Tires" },
  { value: "audio", label: "Audio" },
  { value: "exterior", label: "Exterior" },
  { value: "interior", label: "Interior" },
  { value: "tools", label: "Tools" },
  { value: "other", label: "Other" },
];

const CONDITIONS = [
  { value: "", label: "Any Condition" },
  { value: "new", label: "New" },
  { value: "like_new", label: "Like New" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
  { value: "for_parts", label: "For Parts" },
];

export default function Marketplace() {
  const [user, setUser] = useState(null);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [condition, setCondition] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [location, setLocation] = useState("");
  const [detectingLocation, setDetectingLocation] = useState(false);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
    loadListings();
  }, []);

  const loadListings = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.MarketplaceListing.filter({ status: "active" }, "-created_date", 200);
      setListings(data || []);
    } catch (err) {
      showError(err, "Couldn't load listings.");
    } finally {
      setLoading(false);
    }
  };

  const detectLocation = async () => {
    setDetectingLocation(true);
    try {
      const [lat, lon] = await getCurrentPosition();
      const place = await reverseGeocode(lat, lon);
      if (place) setLocation(place);
    } catch (err) {
      toast.error(err.message || "Couldn't detect your location.");
    } finally {
      setDetectingLocation(false);
    }
  };

  const filtered = listings.filter((l) => {
    if (category && l.category !== category) return false;
    if (condition && l.condition !== condition) return false;
    if (maxPrice && l.price > Number(maxPrice)) return false;
    if (location) {
      const locQuery = location.toLowerCase();
      const listingLoc = l.location?.toLowerCase() || "";
      // Match by city (first part before comma) to handle "Austin, Texas" vs "Austin, TX"
      const queryCity = locQuery.split(",")[0].trim();
      const listingCity = listingLoc.split(",")[0].trim();
      if (!listingLoc.includes(locQuery) && queryCity && !listingCity.includes(queryCity)) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      return (
        l.title?.toLowerCase().includes(q) ||
        l.description?.toLowerCase().includes(q) ||
        l.make?.toLowerCase().includes(q) ||
        l.model?.toLowerCase().includes(q) ||
        l.location?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const clearFilters = () => {
    setSearch("");
    setCategory("");
    setCondition("");
    setMaxPrice("");
    setLocation("");
  };

  const hasFilters = search || category || condition || maxPrice || location;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-orbitron font-bold text-xl tracking-wide flex items-center gap-2">
            <Tag className="w-5 h-5 text-primary" /> Marketplace
          </h1>
          <p className="text-muted-foreground text-xs mt-0.5">Buy and sell cars, parts, and gear</p>
        </div>
        <Button size="sm" className="font-orbitron tracking-wider text-xs" onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-1" /> Sell
        </Button>
      </motion.div>

      {/* Search + Filters */}
      <div className="space-y-3 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search listings, makes, models..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-secondary border-border/50 h-11"
          />
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="bg-secondary border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <select
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
            className="bg-secondary border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {CONDITIONS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <div className="relative flex-1 min-w-[160px] sm:flex-none">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Location (city, state...)"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="pl-9 bg-secondary border-border/50 w-full sm:w-48 h-9"
            />
          </div>
          <button
            onClick={detectLocation}
            disabled={detectingLocation}
            title="Use my location"
            className="flex items-center gap-1.5 px-3 py-2 text-xs text-muted-foreground hover:text-primary rounded-lg hover:bg-secondary transition-colors border border-border/50"
          >
            <Navigation className={`w-3.5 h-3.5 ${detectingLocation ? "animate-spin" : ""}`} />
            {detectingLocation ? "Detecting..." : "Near me"}
          </button>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
            <Input
              type="number"
              placeholder="Max price"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              className="pl-6 bg-secondary border-border/50 w-32 h-9"
            />
          </div>
          {hasFilters && (
            <button onClick={clearFilters} className="flex items-center gap-1 px-3 py-2 text-xs text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary transition-colors">
              <X className="w-3 h-3" /> Clear
            </button>
          )}
          <span className="ml-auto text-xs text-muted-foreground">{filtered.length} listing{filtered.length !== 1 ? "s" : ""}</span>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-64 rounded-xl bg-secondary animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-muted-foreground mb-4">{hasFilters ? "No listings match your filters." : "No listings yet. Be the first to sell something!"}</p>
          {!hasFilters && (
            <Button className="font-orbitron tracking-wider text-xs" onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4 mr-1" /> Post a Listing
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((listing, i) => (
            <MarketplaceCard key={listing.id} listing={listing} index={i} user={user} onUpdate={loadListings} />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateListingModal
          open={showCreate}
          onClose={() => setShowCreate(false)}
          user={user}
          onCreated={() => { setShowCreate(false); loadListings(); }}
        />
      )}
    </div>
  );
}