import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Heart, Wrench, Gauge, Palette, ArrowLeft, Share2, Pencil } from "lucide-react";
import FollowButton from "../components/FollowButton";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import PhotoGallery from "../components/PhotoGallery";
import YouTubePlayer from "../components/YouTubePlayer";
import { motion } from "framer-motion";
import { showError, copyToClipboard } from "@/lib/helpers";

export default function CarProfilePage() {
  const { carId } = useParams();
  const navigate = useNavigate();
  const [car, setCar] = useState(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [liking, setLiking] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [carData, userData] = await Promise.all([
        base44.entities.CarProfile.get(carId).catch(() => null),
        base44.auth.me().catch(() => null),
      ]);
      setCar(carData);
      setUser(userData);
      setLoading(false);
    }
    load();
  }, [carId]);

  const handleLike = async () => {
    if (!user || liking) return;
    setLiking(true);
    try {
      // Re-read so we don't wipe out likes added by others since the page loaded
      const fresh = (await base44.entities.CarProfile.get(car.id).catch(() => null)) || car;
      const likedBy = fresh.liked_by || [];
      const isLiked = likedBy.includes(user.email);
      const newLikedBy = isLiked
        ? likedBy.filter((e) => e !== user.email)
        : [...likedBy, user.email];
      await base44.entities.CarProfile.update(car.id, {
        liked_by: newLikedBy,
        likes_count: newLikedBy.length,
      });
      setCar({ ...fresh, liked_by: newLikedBy, likes_count: newLikedBy.length });
    } catch (err) {
      showError(err, "Couldn't save your like.");
    } finally {
      setLiking(false);
    }
  };

  const isOwner = user && car && user.email === car.owner_email;
  const goBack = () => (window.history.length > 1 ? navigate(-1) : navigate("/"));

  const isLiked = user && car?.liked_by?.includes(user.email);

  const handleShare = () => copyToClipboard(window.location.href);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!car) {
    return (
      <div className="text-center py-20 text-muted-foreground">Car not found.</div>
    );
  }

  const coverPhoto = car.cover_photo || car.photos?.[0] || "https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=1200&q=80";

  return (
    <div className="min-h-screen">
      {/* Hero Cover */}
      <div className="relative h-64 md:h-80 overflow-hidden">
        <img src={coverPhoto} alt={car.car_name} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
        <div className="absolute top-4 left-4 right-4 flex justify-between">
          <Button variant="ghost" size="icon" onClick={goBack} className="bg-black/30 backdrop-blur-sm hover:bg-black/50 text-white">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex gap-2">
            {isOwner && (
              <Link to={`/edit-car/${car.id}`}>
                <Button variant="ghost" size="icon" title="Edit ride" className="bg-black/30 backdrop-blur-sm hover:bg-black/50 text-white">
                  <Pencil className="w-5 h-5" />
                </Button>
              </Link>
            )}
            <Button variant="ghost" size="icon" title="Share" className="bg-black/30 backdrop-blur-sm hover:bg-black/50 text-white" onClick={handleShare}>
              <Share2 className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 -mt-16 relative z-10">
        {/* Title Section */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <h1 className="font-orbitron font-bold text-2xl md:text-3xl text-foreground tracking-wide break-words">
                {car.car_name}
              </h1>
              <p className="text-muted-foreground mt-1">
                {car.year} {car.make} {car.model}
              </p>
              {car.owner_name && (
                <Link to={`/user/${encodeURIComponent(car.owner_email)}`} className="text-primary text-sm mt-1 hover:underline block w-fit">by @{car.owner_name}</Link>
              )}
              <div className="mt-2">
                <FollowButton targetEmail={car.owner_email} targetName={car.owner_name || car.owner_email} currentUser={user} />
              </div>
            </div>
            <Button
              variant={isLiked ? "default" : "outline"}
              size="sm"
              onClick={handleLike}
              disabled={liking}
              className={isLiked ? "bg-red-500 hover:bg-red-600 border-red-500" : ""}
            >
              <Heart className={`w-4 h-4 mr-1 ${isLiked ? "fill-white" : ""}`} />
              {car.likes_count || 0}
            </Button>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8"
        >
          {car.horsepower > 0 && (
            <div className="bg-card border border-border/50 rounded-xl p-4 text-center">
              <Gauge className="w-5 h-5 text-accent mx-auto mb-1" />
              <p className="font-orbitron font-bold text-lg text-foreground">{car.horsepower}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Horsepower</p>
            </div>
          )}
          {car.color && (
            <div className="bg-card border border-border/50 rounded-xl p-4 text-center">
              <Palette className="w-5 h-5 text-primary mx-auto mb-1" />
              <p className="font-semibold text-foreground">{car.color}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Color</p>
            </div>
          )}
          <div className="bg-card border border-border/50 rounded-xl p-4 text-center">
            <Heart className="w-5 h-5 text-red-400 mx-auto mb-1" />
            <p className="font-orbitron font-bold text-lg text-foreground">{car.likes_count || 0}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Likes</p>
          </div>
        </motion.div>

        {/* Bio */}
        {car.bio && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="mb-8">
            <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-3">About this ride</h2>
            <p className="text-foreground/90 leading-relaxed whitespace-pre-wrap">{car.bio}</p>
          </motion.div>
        )}

        {/* Mods */}
        {car.mods && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="mb-8">
            <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
              <Wrench className="w-4 h-4" /> Modifications
            </h2>
            <div className="bg-card border border-border/50 rounded-xl p-4">
              <p className="text-foreground/90 leading-relaxed whitespace-pre-wrap">{car.mods}</p>
            </div>
          </motion.div>
        )}

        {/* Photos */}
        {car.photos?.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }} className="mb-8">
            <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-3">Gallery</h2>
            <PhotoGallery photos={car.photos} />
          </motion.div>
        )}
      </div>

      {/* YouTube Player */}
      {car.youtube_playlist_url && <YouTubePlayer url={car.youtube_playlist_url} />}
    </div>
  );
}