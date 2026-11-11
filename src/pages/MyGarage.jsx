import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Plus, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import CarCard from "../components/CarCard";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { showError } from "@/lib/helpers";

export default function MyGarage() {
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const me = await base44.auth.me();
        setUser(me);
        const data = await base44.entities.CarProfile.filter({ owner_email: me.email }, "-created_date", 100);
        setCars(data || []);
      } catch (err) {
        showError(err, "Couldn't load your garage.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleDelete = async (carId) => {
    if (!confirm("Remove this car from your garage?")) return;
    try {
      await base44.entities.CarProfile.delete(carId);
      setCars((prev) => prev.filter((c) => c.id !== carId));
      toast.success("Car removed.");
    } catch (err) {
      showError(err, "Couldn't remove this car.");
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-orbitron font-bold text-xl tracking-wide">My Garage</h1>
          <p className="text-muted-foreground text-xs mt-0.5">{cars.length} ride{cars.length !== 1 ? "s" : ""}</p>
        </div>
        <Link to="/create-car">
          <Button size="sm" className="font-orbitron tracking-wider text-xs">
            <Plus className="w-4 h-4 mr-1" /> Add Ride
          </Button>
        </Link>
      </motion.div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="aspect-[16/10] rounded-xl bg-secondary animate-pulse" />
          ))}
        </div>
      ) : cars.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-muted-foreground mb-4">Your garage is empty.</p>
          <Link to="/create-car">
            <Button className="font-orbitron tracking-wider">
              <Plus className="w-4 h-4 mr-2" /> Add your first ride
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cars.map((car, i) => (
            <div key={car.id} className="relative group">
              <CarCard car={car} index={i} />
              {/* Always visible on touch screens; hover-reveal on desktop */}
              <div className="absolute top-3 right-3 flex gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                <Link to={`/edit-car/${car.id}`} title="Edit" className="p-2 rounded-lg bg-black/60 hover:bg-primary">
                  <Pencil className="w-4 h-4 text-white" />
                </Link>
                <button
                  onClick={() => handleDelete(car.id)}
                  title="Remove"
                  className="p-2 rounded-lg bg-black/60 hover:bg-destructive"
                >
                  <Trash2 className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}