import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Trophy, Heart, Medal } from "lucide-react";
import { motion } from "framer-motion";
import { showError } from "@/lib/helpers";

const medalColors = ["text-yellow-400", "text-slate-300", "text-amber-600"];
const medalBg = ["bg-yellow-400/10 border-yellow-400/30", "bg-slate-300/10 border-slate-300/30", "bg-amber-600/10 border-amber-600/30"];

export default function Leaderboard() {
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.CarProfile.list("-likes_count", 50)
      .then((data) => {
        setCars((data || []).filter(c => (c.likes_count || 0) > 0 || c.cover_photo || c.photos?.length > 0));
      })
      .catch((err) => showError(err, "Couldn't load the leaderboard."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="flex items-center gap-3">
          <Trophy className="w-6 h-6 text-yellow-400" />
          <div>
            <h1 className="font-orbitron font-bold text-xl tracking-wide">Leaderboard</h1>
            <p className="text-muted-foreground text-xs mt-0.5">Most liked rides in the community</p>
          </div>
        </div>
      </motion.div>

      {/* Top 3 podium */}
      {!loading && cars.length >= 3 && (
        <div className="grid grid-cols-3 gap-3 mb-8">
          {[cars[1], cars[0], cars[2]].map((car, podiumIdx) => {
            const rank = podiumIdx === 1 ? 0 : podiumIdx === 0 ? 1 : 2; // 2nd, 1st, 3rd
            const heights = ["h-28", "h-36", "h-24"];
            const photo = car.cover_photo || car.photos?.[0];
            return (
              <Link key={car.id} to={`/car/${car.id}`}>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: podiumIdx * 0.1 }}
                  className={`border rounded-xl overflow-hidden ${medalBg[rank]} ${heights[podiumIdx]} relative group`}
                >
                  {photo && <img src={photo} alt={car.car_name} loading="lazy" className="w-full h-full object-cover opacity-70 group-hover:opacity-90 transition-opacity" />}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex flex-col justify-end p-2">
                    <div className="flex items-center gap-1 mb-0.5">
                      <Medal className={`w-3.5 h-3.5 ${medalColors[rank]}`} />
                      <span className={`text-[10px] font-bold ${medalColors[rank]}`}>#{rank + 1}</span>
                    </div>
                    <p className="text-white text-xs font-bold leading-tight truncate">{car.car_name}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Heart className="w-3 h-3 text-red-400 fill-red-400" />
                      <span className="text-white text-[11px] font-semibold">{car.likes_count || 0}</span>
                    </div>
                  </div>
                </motion.div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Full list */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(8)].map((_, i) => <div key={i} className="h-20 rounded-xl bg-secondary animate-pulse" />)}
        </div>
      ) : cars.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground text-sm">No liked rides yet. Start liking!</div>
      ) : (
        <div className="space-y-3">
          {cars.map((car, i) => {
            const photo = car.cover_photo || car.photos?.[0];
            return (
              <motion.div
                key={car.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <Link to={`/car/${car.id}`} className="group flex items-center gap-4 bg-card border border-border/50 rounded-xl p-3 hover:border-primary/30 transition-all">
                  <span className={`font-orbitron font-bold text-sm w-6 text-center ${i < 3 ? medalColors[i] : "text-muted-foreground"}`}>
                    {i + 1}
                  </span>
                  <div className="w-16 h-12 rounded-lg overflow-hidden bg-secondary shrink-0">
                    {photo && <img src={photo} alt={car.car_name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors truncate">{car.car_name}</p>
                    <p className="text-xs text-muted-foreground">{car.year} {car.make} {car.model}</p>
                    {car.owner_name && <p className="text-[11px] text-primary/70">@{car.owner_name}</p>}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Heart className="w-4 h-4 text-red-400 fill-red-400" />
                    <span className="font-orbitron font-bold text-sm text-foreground">{car.likes_count || 0}</span>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}