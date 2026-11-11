import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { MessageSquare } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { showError } from "@/lib/helpers";
import ConversationList from "../components/ConversationList";
import ChatWindow from "../components/ChatWindow";
import NewMessageModal from "../components/NewMessageModal";

export default function MessagesPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [following, setFollowing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeConv, setActiveConv] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    (async () => {
      let me;
      try {
        me = await base44.auth.me();
      } catch (err) {
        showError(err, "Couldn't load messages.");
        setLoading(false);
        return;
      }
      setUser(me);
      const mine = await loadAll(me);

      const params = new URLSearchParams(window.location.search);
      const toEmail = params.get("to");
      const toName = params.get("name");
      const convId = params.get("conv");
      // Clear the query so a refresh doesn't re-trigger it
      if (toEmail || convId) navigate("/messages", { replace: true });
      if (toEmail) {
        startConversationWith(toEmail, toName || toEmail, me);
      } else if (convId) {
        const found = mine.find((c) => c.id === convId);
        if (found) setActiveConv(found);
      } else if (window.matchMedia("(min-width: 768px)").matches) {
        setSidebarOpen(true); // desktop: show the chat list by default
      } else if (!mine.length) {
        setSidebarOpen(true);
      }
    })();
  }, []);

  const fetchMyConversations = async (me) => {
    // Conversations are shared records; only keep the ones this user is part of
    const all = await base44.entities.Conversation.list("-last_message_date", 500);
    return (all || []).filter((c) => c.participant_emails?.includes(me.email));
  };

  const loadAll = async (me) => {
    try {
      const [mine, allFollows] = await Promise.all([
        fetchMyConversations(me),
        base44.entities.UserFollow.filter({ follower_email: me.email }).catch(() => []),
      ]);
      setConversations(mine);
      setFollowing(allFollows || []);
      return mine;
    } catch (err) {
      showError(err, "Couldn't load conversations.");
      return [];
    } finally {
      setLoading(false);
    }
  };

  const startConversationWith = async (toEmail, toName, me) => {
    if (!me || !toEmail) return;
    if (toEmail === me.email) {
      toast.error("You can't message yourself.");
      return;
    }
    try {
      const mine = await fetchMyConversations(me);
      const existing = mine.find(
        (c) => c.participant_emails?.length === 2 && c.participant_emails.includes(toEmail)
      );
      if (existing) {
        setConversations(mine);
        setActiveConv(existing);
        setSidebarOpen(false);
        return;
      }
      const conv = await base44.entities.Conversation.create({
        participant_emails: [me.email, toEmail],
        participant_names: [me.full_name || me.email.split("@")[0], toName || toEmail.split("@")[0]],
      });
      setConversations([conv, ...mine]);
      setActiveConv(conv);
      setSidebarOpen(false);
    } catch (err) {
      showError(err, "Couldn't start the conversation.");
    }
  };

  // Keep the chat list fresh when new messages arrive in any of my conversations
  useEffect(() => {
    if (!user) return;
    const unsub = base44.entities.Conversation.subscribe?.((event) => {
      if (event?.data?.participant_emails?.includes(user.email)) loadAll(user);
    });
    return () => { if (typeof unsub === "function") unsub(); };
  }, [user]);

  const handleNewConversation = (conv) => {
    setShowNew(false);
    loadAll(user).then(() => {
      setActiveConv(conv);
      setSidebarOpen(false);
    });
  };

  const handleFollowClick = (follow) => {
    startConversationWith(follow.following_email, follow.following_name || follow.following_email, user);
  };

  const handleSelectConv = (conv) => {
    setActiveConv(conv);
    setSidebarOpen(false);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-4 md:py-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 mb-4">
        <MessageSquare className="w-5 h-5 text-primary" />
        <h1 className="font-orbitron font-bold text-xl tracking-wide">Messages</h1>
      </motion.div>

      <div className="flex gap-3 h-[calc(100dvh-200px)] md:h-[calc(100dvh-150px)] min-h-[420px]">
        {/* Collapsible Sidebar */}
        <ConversationList
          conversations={conversations}
          following={following}
          loading={loading}
          user={user}
          activeConv={activeConv}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          onSelect={handleSelectConv}
          onNew={() => setShowNew(true)}
          onFollowClick={handleFollowClick}
        />

        {/* Chat — takes all remaining space (hidden on phones while the list is open) */}
        <div className={`flex-1 min-w-0 ${sidebarOpen ? "hidden md:block" : ""}`}>
          {activeConv ? (
            <ChatWindow
              conversation={activeConv}
              user={user}
              onUpdate={() => loadAll(user)}
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center bg-card border border-border/50 rounded-xl text-muted-foreground gap-3">
              <MessageSquare className="w-12 h-12 opacity-20" />
              <p className="text-sm">Select a conversation or start a new one</p>
              <button
                onClick={() => setSidebarOpen(true)}
                className="text-xs text-primary hover:underline"
              >
                Open conversations
              </button>
            </div>
          )}
        </div>
      </div>

      {showNew && (
        <NewMessageModal
          open={showNew}
          onClose={() => setShowNew(false)}
          user={user}
          existingConversations={conversations}
          onCreated={handleNewConversation}
        />
      )}
    </div>
  );
}