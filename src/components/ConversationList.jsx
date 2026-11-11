import { Plus, ChevronRight, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { safeTimeAgo } from "@/lib/helpers";
import { motion } from "framer-motion";

export default function ConversationList({ conversations, following, loading, user, activeConv, isOpen, onToggle, onSelect, onNew, onFollowClick }) {
  const getOtherName = (conv) => {
    const idx = conv.participant_emails?.indexOf(user?.email);
    const names = conv.participant_names || [];
    const emails = conv.participant_emails || [];
    const otherIdx = idx === 0 ? 1 : 0;
    return names[otherIdx] || emails[otherIdx] || "Unknown";
  };

  const followingNoConv = (following || []).filter(
    (f) => !conversations.some((c) => c.participant_emails?.includes(f.following_email))
  );

  // Collapsed: just a thin strip with toggle button
  if (!isOpen) {
    return (
      <div className="flex flex-col items-center bg-card border border-border/50 rounded-xl overflow-hidden shrink-0" style={{ width: 48 }}>
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-center py-3 hover:bg-secondary transition-colors border-b border-border/50"
          title="Open conversations"
        >
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
        {/* Mini avatars for recent convos */}
        <div className="flex flex-col items-center gap-2 py-3">
          {conversations.slice(0, 5).map((conv) => {
            const name = getOtherName(conv);
            const isActive = activeConv?.id === conv.id;
            return (
              <button
                key={conv.id}
                onClick={() => onSelect(conv)}
                title={name}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  isActive ? "bg-primary text-primary-foreground" : "bg-primary/20 text-primary hover:bg-primary/30"
                }`}
              >
                {name?.[0]?.toUpperCase()}
              </button>
            );
          })}
          <button
            onClick={onNew}
            title="New message"
            className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center hover:bg-border transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0.5 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="flex-1 md:flex-none md:!w-[240px] flex-shrink-0 flex flex-col bg-card border border-border/50 rounded-xl overflow-hidden"
    >
      <div className="flex items-center justify-between px-3 py-3 border-b border-border/50">
        <span className="text-sm font-semibold">Chats</span>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onNew}>
            <Plus className="w-3.5 h-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onToggle}>
            <ChevronLeft className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="space-y-2 p-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-12 rounded-lg bg-secondary animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {conversations.length > 0 && (
              <>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground px-3 pt-3 pb-1">Recent</p>
                {conversations.map((conv) => {
                  const isActive = activeConv?.id === conv.id;
                  const name = getOtherName(conv);
                  return (
                    <button
                      key={conv.id}
                      onClick={() => onSelect(conv)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${
                        isActive ? "bg-primary/10 border-r-2 border-primary" : "hover:bg-secondary"
                      }`}
                    >
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                        {name?.[0]?.toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-medium text-foreground truncate flex-1">{name}</p>
                          {conv.last_message_date && (
                            <span className="text-[9px] text-muted-foreground shrink-0">{safeTimeAgo(conv.last_message_date).replace("about ", "")}</span>
                          )}
                        </div>
                        {conv.last_message && (
                          <p className="text-[10px] text-muted-foreground truncate">
                            {conv.last_message_sender === user?.email ? "You: " : ""}{conv.last_message}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </>
            )}

            {followingNoConv.length > 0 && (
              <>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground px-3 pt-3 pb-1">Following</p>
                {followingNoConv.map((f) => {
                  const name = f.following_name || f.following_email;
                  return (
                    <button
                      key={f.id}
                      onClick={() => onFollowClick(f)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-secondary transition-colors"
                    >
                      <div className="w-7 h-7 rounded-full bg-secondary border border-border flex items-center justify-center text-muted-foreground font-bold text-xs shrink-0">
                        {name?.[0]?.toUpperCase()}
                      </div>
                      <p className="text-xs text-muted-foreground hover:text-foreground truncate">{name}</p>
                    </button>
                  );
                })}
              </>
            )}

            {conversations.length === 0 && (!following || following.length === 0) && (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-xs px-4 text-center">
                No conversations yet. Start one!
              </div>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}