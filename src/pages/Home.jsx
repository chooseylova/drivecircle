import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Search, Flame, Rss, Newspaper, LayoutGrid, Bell } from "lucide-react";
import { Input } from "@/components/ui/input";
import CarCard from "../components/CarCard";
import CreatePost from "../components/CreatePost";
import { Link } from "react-router-dom";
import UserAvatar from "../components/UserAvatar";
import PostCard from "../components/PostCard";
import AutomotiveNews from "../components/AutomotiveNews";
import { motion } from "framer-motion";
import { showError, nameFromEmail } from "@/lib/helpers";

const TABS = [
  { id: "feed", label: "Feed", icon: Rss },
  { id: "discover", label: "Discover", icon: LayoutGrid },
  { id: "community", label: "Community", icon: Flame },
  { id: "news", label: "News", icon: Newspaper },

];

export default function Home() {
  const [tab, setTab] = useState("feed");
  const [user, setUser] = useState(null);

  // Feed state
  const [feedPosts, setFeedPosts] = useState([]);
  const [communityPosts, setCommunityPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [followingEmails, setFollowingEmails] = useState([]);
  const [activityNotifs, setActivityNotifs] = useState([]);

  // Discover state
  const [cars, setCars] = useState([]);
  const [users, setUsers] = useState([]);
  const [carsLoading, setCarsLoading] = useState(false);
  const [discoverLoaded, setDiscoverLoaded] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadFeed();
  }, []);

  // Load Discover data the first time the tab is opened
  useEffect(() => {
    if (tab !== "discover" || discoverLoaded) return;
    setDiscoverLoaded(true);
    setCarsLoading(true);
    Promise.all([
      base44.entities.CarProfile.list("-created_date", 100),
      base44.functions.invoke("getUsers", {}).catch(() => ({ data: { users: [] } })),
    ])
      .then(([carsData, usersRes]) => {
        setCars(carsData || []);
        setUsers(usersRes?.data?.users || []);
      })
      .catch((err) => {
        showError(err, "Couldn't load rides.");
      })
      .finally(() => setCarsLoading(false));
  }, [tab, discoverLoaded]);

  const loadFeed = async () => {
    setPostsLoading(true);
    try {
      const me = await base44.auth.me();
      setUser(me);
      const [allPosts, myFollows] = await Promise.all([
        base44.entities.Post.list("-created_date", 100),
        base44.entities.UserFollow.filter({ follower_email: me.email }),
      ]);

      const followEmails = myFollows.map(f => f.following_email);
      setFollowingEmails(followEmails);

      // Feed: only posts of type "feed" from followed users + own posts
      const myFeedPosts = allPosts.filter(p => p.post_type !== "community").filter(p =>
        followEmails.includes(p.author_email) || p.author_email === me?.email
      );
      setFeedPosts(myFeedPosts);

      // Community: only posts of type "community"
      const communityOnly = allPosts.filter(p => p.post_type === "community");
      setCommunityPosts(communityOnly);

      // Activity notifications: events that users I follow are attending
      if (followEmails.length > 0 && me) {
        const events = await base44.entities.CarEvent.list("-created_date", 20);
        const notifs = [];
        events.forEach(event => {
          const attendees = event.attendees || [];
          const followedAttendees = attendees.filter(e => followEmails.includes(e));
          if (followedAttendees.length > 0 && new Date(event.date) >= new Date()) {
            const followNames = myFollows.filter(f => followedAttendees.includes(f.following_email)).map(f => f.following_name || nameFromEmail(f.following_email));
            const who = followNames.slice(0, 2).join(", ") + (followNames.length > 2 ? ` +${followNames.length - 2} others` : "");
            notifs.push({
              id: event.id,
              text: `${who} ${followedAttendees.length === 1 ? "is" : "are"} attending ${event.title}`,
              date: event.date,
              eventId: event.id,
            });
          }
        });
        setActivityNotifs(notifs.slice(0, 3));
      }
    } catch (err) {
      showError(err, "Couldn't load your feed.");
    } finally {
      setPostsLoading(false);
    }
  };

  const handleDeletePost = (postId) => {
    setFeedPosts(prev => prev.filter(p => p.id !== postId));
    setCommunityPosts(prev => prev.filter(p => p.id !== postId));
  };

  const handleNewFeedPost = (post) => {
    setFeedPosts(prev => [post, ...prev]);
  };

  const handleNewCommunityPost = (post) => {
    setCommunityPosts(prev => [post, ...prev]);
  };

  const handleUpdateFeedPost = (updated) => {
    setFeedPosts(prev => prev.map(p => p.id === updated.id ? updated : p));
  };

  const handleUpdateCommunityPost = (updated) => {
    setCommunityPosts(prev => prev.map(p => p.id === updated.id ? updated : p));
  };

  const filteredCars = cars.filter((car) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return car.car_name?.toLowerCase().includes(q) || car.make?.toLowerCase().includes(q) ||
      car.model?.toLowerCase().includes(q) || car.owner_name?.toLowerCase().includes(q);
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Hero */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="font-orbitron font-bold text-2xl md:text-3xl tracking-wide">
          <span className="text-primary">Drive</span>Circle
        </h1>
        <p className="text-muted-foreground text-sm mt-1">The car community, redefined.</p>
      </motion.div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-secondary p-1 rounded-xl mb-6 w-fit max-w-full overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              tab === t.id ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* FEED TAB */}
      {tab === "feed" && (
        <div className="max-w-2xl">
            {/* Activity Notifications */}
            {activityNotifs.length > 0 && (
              <div className="mb-4 space-y-2">
                {activityNotifs.map((n) => (
                  <Link key={n.id} to={`/event/${n.eventId}`} className="flex items-center gap-3 bg-primary/10 border border-primary/20 rounded-xl px-4 py-2.5 hover:bg-primary/15 transition-colors">
                    <Bell className="w-4 h-4 text-primary shrink-0" />
                    <p className="text-xs text-foreground/90">{n.text}</p>
                  </Link>
                ))}
              </div>
            )}

            {/* Create Post */}
            <CreatePost user={user} onPost={handleNewFeedPost} postType="feed" />



            {/* Posts */}
            {postsLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-40 rounded-xl bg-secondary animate-pulse" />
                ))}
              </div>
            ) : feedPosts.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground text-sm">
                {followingEmails.length === 0 ? "Follow people to see their posts here." : "No posts from people you follow yet."}
              </div>
            ) : (
              <div className="space-y-4">
                {feedPosts.map((post) => (
                  <PostCard key={post.id} post={post} user={user} onUpdate={handleUpdateFeedPost} onDelete={handleDeletePost} />
                ))}
              </div>
            )}
        </div>
      )}

      {/* DISCOVER TAB */}
      {tab === "discover" && (
        <div>
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search cars, makes, users..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 bg-secondary border-border/50 h-11"
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Flame className="w-4 h-4 text-accent" />
              <span>{cars.length} rides</span>
            </div>
          </div>

          {/* User results */}
          {search && (() => {
            const q = search.toLowerCase();
            const matchedUsers = users.filter(u =>
              u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
            );
            if (matchedUsers.length === 0) return null;
            return (
              <div className="mb-6">
                <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-3 font-semibold">People</h3>
                <div className="flex flex-wrap gap-3">
                  {matchedUsers.map(u => (
                    <Link key={u.id} to={`/user/${u.email}`} className="flex items-center gap-3 bg-card border border-border/50 rounded-xl px-4 py-3 hover:border-primary/30 transition-all">
                      <UserAvatar user={u} size="sm" />
                      <div>
                        <p className="text-sm font-medium text-foreground">{u.full_name || nameFromEmail(u.email)}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Car results */}
          {search && <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-3 font-semibold">Rides</h3>}
          {carsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => <div key={i} className="aspect-[16/10] rounded-xl bg-secondary animate-pulse" />)}
            </div>
          ) : filteredCars.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">No rides found.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCars.map((car, i) => <CarCard key={car.id} car={car} index={i} />)}
            </div>
          )}
        </div>
      )}

      {/* NEWS TAB */}
      {tab === "news" && <AutomotiveNews />}



      {/* COMMUNITY TAB */}
      {tab === "community" && (
        <div className="max-w-2xl mx-auto">
          <CreatePost user={user} onPost={handleNewCommunityPost} postType="community" />
          <div className="mt-4 space-y-4">
            {postsLoading ? (
              [...Array(3)].map((_, i) => (
                <div key={i} className="h-40 rounded-xl bg-secondary animate-pulse" />
              ))
            ) : communityPosts.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground text-sm">
                No community posts yet. Be the first!
              </div>
            ) : (
              communityPosts.map((post) => (
                <PostCard key={post.id} post={post} user={user} onUpdate={handleUpdateCommunityPost} onDelete={handleDeletePost} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}