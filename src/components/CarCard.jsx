import { Link, useNavigate } from "react-router-dom";
import { Heart } from "lucide-react";
import { motion } from "framer-motion";

export default function CarCard({ car, index = 0 }) {
  const navigate = useNavigate();
  const coverPhoto = car.cover_photo || car.photos?.[0] || "https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=600&q=80";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
    >
      <Link to={`/car/${car.id}`} className="group block">
        <div className="relative overflow-hidden rounded-xl bg-card border border-border/50 transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
          {/* Image */}
          <div className="aspect-[16/10] overflow-hidden">
            <img
              src={coverPhoto}
              alt={car.car_name}
              loading="lazy"
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
          </div>

          {/* Info Overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <div className="flex items-end justify-between">
              <div className="min-w-0">
                <h3 className="truncate font-orbitron font-bold text-white text-sm tracking-wide">
                  {car.car_name || `${car.make} ${car.model}`}
                </h3>
                <p className="text-white/70 text-xs mt-0.5">
                  {car.year} {car.make} {car.model}
                </p>
                {car.owner_name && (
                  // A <Link> can't be nested inside the card's <Link>, so use a span that navigates
                  <span
                    role="link"
                    tabIndex={0}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate(`/user/${encodeURIComponent(car.owner_email)}`); }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); navigate(`/user/${encodeURIComponent(car.owner_email)}`); } }}
                    className="text-primary text-xs mt-1 hover:underline block w-fit cursor-pointer"
                  >
                    {car.owner_name}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {car.horsepower > 0 && (
                  <span className="text-accent text-xs font-bold">{car.horsepower}HP</span>
                )}
                <div className="flex items-center gap-1 text-white/70">
                  <Heart className="w-3.5 h-3.5" />
                  <span className="text-xs">{car.likes_count || 0}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}