import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Bell, MessageSquare, Heart, UserPlus, MessageCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { safeTimeAgo, nameFromEmail } from "@/lib/helpers";
import { motion } from "framer-motion";

export default function NotificationsTab({ user }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadNotifications();
  }, [user]);

  const loadNotifications = async () => {
    setLoading(true);

    const [conversations, followers, myPosts] = await Promise.all([
      base44.entities.Conversation.list("-last_message_date", 200).catch(() => []),
      base44.entities.UserFollow.filter({ following_email: user.email }, "-created_date", 30).catch(() => []),
      base44.entities.Post.filter({ author_email: user.email }, "-created_date", 50).catch(() => []),
    ]);

    const notifs = [];

    // Unread messages
    const myConvs = conversations.filter(c => c.participant_emails?.includes(user.email));
    myConvs.forEach(conv => {
      if (conv.last_message_sender && conv.last_message_sender !== user.email && conv.last_message) {
        const otherName = conv.participant_names?.find((_, i) => conv.participant_emails?.[i] !== user.email) || conv.last_message_sender;
        notifs.push({
          id: `msg-${conv.id}`,
          type: "message",
          icon: MessageSquare,
          iconColor: "text-blue-400",
          bgColor: "bg-blue-500/10",
          text: `${otherName} sent you a message`,
          preview: conv.last_message?.slice(0, 60) + (conv.last_message?.length > 60 ? "..." : ""),
          date: conv.last_message_date,
          link: `/messages?conv=${conv.id}`,
        });
      }
    });

    // New followers
    followers.forEach(follow => {
      notifs.push({
        id: `follow-${follow.id}`,
        type: "follow",
        icon: UserPlus,
        iconColor: "text-green-400",
        bgColor: "bg-green-500/10",
        text: `${follow.follower_name || nameFromEmail(follow.follower_email)} started following you`,
        date: follow.created_date,
        link: `/user/${encodeURIComponent(follow.follower_email)}`,
      });
    });

    // Likes on my posts
    myPosts.forEach(post => {
      const likeCount = post.likes_count || 0;
      if (likeCount > 0 && post.liked_by?.length > 0) {
        const latestLiker = nameFromEmail(post.liked_by[post.liked_by.length - 1]);
        const others = likeCount - 1;
        notifs.push({
          id: `like-${post.id}`,
          type: "like",
          icon: Heart,
          iconColor: "text-primary",
          bgColor: "bg-primary/10",
          text: others > 0
            ? `${latestLiker} and ${others} other${others > 1 ? "s" : ""} liked your post`
            : `${latestLiker} liked your post`,
          preview: post.content ? post.content.slice(0, 60) + (post.content.length > 60 ? "..." : "") : "",
          date: post.updated_date,
          link: `/post/${post.id}`,
        });
      }
    });

    // Replies/comments on my posts
    myPosts.forEach(post => {
      const comments = (post.comments || []).filter(c => c.author_email !== user.email);
      if (comments.length > 0) {
        const latest = comments[comments.length - 1];
        notifs.push({
          id: `comment-${post.id}`,
          type: "comment",
          icon: MessageCircle,
          iconColor: "text-accent",
          bgColor: "bg-accent/10",
          text: `${latest.author_name || nameFromEmail(latest.author_email)} commented on your post`,
          preview: latest.content?.slice(0, 60),
          date: latest.created_date,
          link: `/post/${post.id}`,
        });
      }
    });

    // Sort by date, newest first
    notifs.sort((a, b) => (new Date(b.date).getTime() || 0) - (new Date(a.date).getTime() || 0));
    setNotifications(notifs.slice(0, 30));
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="max-w-2xl space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 rounded-xl bg-secondary animate-pulse" />
        ))}
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="max-w-2xl text-center py-20">
        <Bell className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
        <p className="text-muted-foreground text-sm">No notifications yet.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-2">
      {notifications.map((n, i) => {
        const Icon = n.icon;
        return (
          <motion.div
            key={n.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
          >
            <Link
              to={n.link}
              className="flex items-start gap-3 bg-card border border-border/50 rounded-xl px-4 py-3 hover:border-primary/30 transition-all"
            >
              <div className={`p-2 rounded-lg shrink-0 ${n.bgColor}`}>
                <Icon className={`w-4 h-4 ${n.iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground leading-snug">{n.text}</p>
                {n.preview && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{n.preview}</p>
                )}
              </div>
              <span className="text-[10px] text-muted-foreground shrink-0 mt-1">
                {safeTimeAgo(n.date)}
              </span>
            </Link>
          </motion.div>
        );
      })}
    </div>
  );
}