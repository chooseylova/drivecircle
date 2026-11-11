import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { LogOut, Car, Calendar, Pencil, Upload, Users } from "lucide-react";
import UserAvatar from "../components/UserAvatar";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import CarCard from "../components/CarCard";
import { motion } from "framer-motion";
import EditProfileModal from "../components/EditProfileModal";
import { showError } from "@/lib/helpers";
import { useLiveShare } from "@/lib/LiveShareContext";

export default function ProfilePage() {
  const live = useLiveShare();
  const [user, setUser] = useState(null);
  const [cars, setCars] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [followCounts, setFollowCounts] = useState({ followers: 0, following: 0 });

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    setUploadingAvatar(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.auth.updateMe({ avatar_url: file_url });
      setUser(prev => ({ ...prev, avatar_url: file_url }));
      toast.success("Profile picture updated!");
    } catch (err) {
      showError(err, "Couldn't update your profile picture.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  useEffect(() => {
    async function load() {
      try {
        const me = await base44.auth.me();
        setUser(me);
        const [carData, eventData, followers, following] = await Promise.all([
          base44.entities.CarProfile.filter({ owner_email: me.email }, "-created_date", 50).catch(() => []),
          base44.entities.CarEvent.filter({ organizer_email: me.email, source: "user_created" }, "-date", 50).catch(() => []),
          base44.entities.UserFollow.filter({ following_email: me.email }).catch(() => []),
          base44.entities.UserFollow.filter({ follower_email: me.email }).catch(() => []),
        ]);
        setCars(carData || []);
        setEvents(eventData || []);
        setFollowCounts({ followers: followers?.length || 0, following: following?.length || 0 });
      } catch (err) {
        showError(err, "Couldn't load your profile.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleLogout = async () => {
    if (!confirm("Log out of DriveCircle?")) return;
    // Make sure nobody keeps seeing you on the Live Map after you log out
    if (live.sharing) await live.stop({ silent: true });
    base44.auth.logout(window.location.origin);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        {/* Profile Header */}
        <div className="bg-card border border-border/50 rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-4 min-w-0">
              <div className="relative group">
                <UserAvatar user={user} size="xl" />
                <span className="md:hidden absolute -bottom-0.5 -right-0.5 p-1 rounded-full bg-primary border-2 border-card pointer-events-none">
                  <Upload className="w-3 h-3 text-primary-foreground" />
                </span>
                <label title="Change profile picture" className={`absolute inset-0 bg-black/50 rounded-full flex items-center justify-center cursor-pointer transition-opacity ${uploadingAvatar ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                  {uploadingAvatar ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Upload className="w-5 h-5 text-white" />
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                </label>
              </div>
              <div className="min-w-0">
                <h1 className="font-orbitron font-bold text-xl tracking-wide truncate">{user?.full_name || "Rider"}</h1>
                <p className="text-muted-foreground text-sm truncate">{user?.email}</p>
                {user?.email && (
                  <Link to={`/user/${encodeURIComponent(user.email)}`} className="text-xs text-primary hover:underline">View public profile</Link>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" title="Edit profile" onClick={() => setEditOpen(true)} className="text-muted-foreground hover:text-primary">
                <Pencil className="w-5 h-5" />
              </Button>
              <Button variant="ghost" size="icon" title="Log out" onClick={handleLogout} className="text-muted-foreground hover:text-destructive">
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-6">
            <div className="bg-secondary rounded-xl p-4 text-center">
              <Car className="w-5 h-5 text-primary mx-auto mb-1" />
              <p className="font-orbitron font-bold text-lg">{cars.length}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Rides</p>
            </div>
            <div className="bg-secondary rounded-xl p-4 text-center">
              <Calendar className="w-5 h-5 text-accent mx-auto mb-1" />
              <p className="font-orbitron font-bold text-lg">{events.length}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Events</p>
            </div>
            <div className="bg-secondary rounded-xl p-4 text-center">
              <Users className="w-5 h-5 text-primary mx-auto mb-1" />
              <p className="font-orbitron font-bold text-lg">{followCounts.followers}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Followers</p>
            </div>
          </div>
        </div>

        {/* My Cars */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">My Rides</h2>
            <Link to="/garage" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          {cars.length === 0 ? (
            <div className="bg-card border border-border/50 rounded-xl p-8 text-center">
              <p className="text-muted-foreground text-sm mb-3">No rides yet</p>
              <Link to="/create-car">
                <Button size="sm" className="font-orbitron tracking-wider text-xs">Add your first ride</Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {cars.slice(0, 4).map((car, i) => (
                <CarCard key={car.id} car={car} index={i} />
              ))}
            </div>
          )}
        </div>
      </motion.div>

      {editOpen && (
        <EditProfileModal
          user={user}
          open={editOpen}
          onClose={() => setEditOpen(false)}
          onSave={(updated) => setUser(updated)}
        />
      )}
    </div>
  );
}