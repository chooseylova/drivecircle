import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { ArrowLeft, MessageSquare, Car, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import CarCard from "../components/CarCard";
import FollowButton from "../components/FollowButton";
import UserAvatar from "../components/UserAvatar";
import PostCard from "../components/PostCard";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

export default function UserProfilePage() {
  const { email } = useParams();
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [profileUser, setProfileUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [followerCount, setFollowerCount] = useState(0);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [me, allCars, usersRes, posts, followers] = await Promise.all([
        base44.auth.me().catch(() => null),
        base44.entities.CarProfile.filter({ owner_email: email }, "-created_date", 50).catch(() => []),
        base44.functions.invoke('getUsers', {}).catch(() => null),
        base44.entities.Post.filter({ author_email: email }, "-created_date", 30).catch(() => []),
        base44.entities.UserFollow.filter({ following_email: email }).catch(() => []),
      ]);
      const allUsers = usersRes?.data?.users || [];
      setCurrentUser(me);
      setCars(allCars || []);
      // Show their own feed posts + community posts
      setPosts(posts || []);
      setFollowerCount(followers?.length || 0);
      const found = allUsers.find((u) => u.email === email);
      setProfileUser(found || null);
      setDisplayName(found?.full_name || allCars?.[0]?.owner_name || email.split("@")[0]);
      setLoading(false);
    }
    load();
  }, [email]);

  const handleMessage = () => {
    navigate(`/messages?to=${encodeURIComponent(email)}&name=${encodeURIComponent(displayName)}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const isMe = currentUser?.email === email;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <button onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/"))} className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm mb-4 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="bg-card border border-border/50 rounded-2xl p-6 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-4 min-w-0">
              <UserAvatar name={displayName} avatarUrl={profileUser?.avatar_url} size="lg" />
              <div className="min-w-0">
                <h1 className="font-orbitron font-bold text-xl tracking-wide truncate">{displayName}</h1>
                {isMe && <Link to="/profile" className="text-xs text-primary hover:underline">Edit your profile</Link>}
              </div>
            </div>
            {!isMe && (
              <div className="flex items-center gap-2">
                <FollowButton targetEmail={email} targetName={displayName} currentUser={currentUser} />
                <Button size="sm" variant="outline" onClick={handleMessage} className="gap-1.5">
                  <MessageSquare className="w-4 h-4" /> Message
                </Button>
              </div>
            )}
          </div>

          <div className="mt-4 flex gap-3">
            <div className="bg-secondary rounded-xl p-4 flex items-center gap-3">
              <Car className="w-5 h-5 text-primary" />
              <div>
                <p className="font-orbitron font-bold text-lg">{cars.length}</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Rides</p>
              </div>
            </div>
            <div className="bg-secondary rounded-xl p-4 flex items-center gap-3">
              <Users className="w-5 h-5 text-primary" />
              <div>
                <p className="font-orbitron font-bold text-lg">{followerCount}</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Followers</p>
              </div>
            </div>
          </div>
        </div>

        <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-3">Rides</h2>
        {cars.length === 0 ? (
          <div className="bg-card border border-border/50 rounded-xl p-8 text-center text-muted-foreground text-sm">
            No rides yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {cars.map((car, i) => <CarCard key={car.id} car={car} index={i} />)}
          </div>
        )}

        {posts.length > 0 && (
          <>
            <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground mt-8 mb-3">Posts</h2>
            <div className="space-y-4 max-w-2xl">
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  user={currentUser}
                  onUpdate={(u) => setPosts((prev) => prev.map((p) => (p.id === u.id ? u : p)))}
                  onDelete={(id) => setPosts((prev) => prev.filter((p) => p.id !== id))}
                />
              ))}
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}