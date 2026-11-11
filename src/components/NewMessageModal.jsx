import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { showError } from "@/lib/helpers";
import UserAvatar from "./UserAvatar";

export default function NewMessageModal({ open, onClose, user, existingConversations, onCreated }) {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [starting, setStarting] = useState(null);

  const [loadingUsers, setLoadingUsers] = useState(true);

  useEffect(() => {
    // User.list() is admin-only for regular members, so use the getUsers backend function
    base44.functions.invoke("getUsers", {})
      .then((res) => setUsers((res.data?.users || []).filter((u) => u.email !== user?.email)))
      .catch((err) => showError(err, "Couldn't load members."))
      .finally(() => setLoadingUsers(false));
  }, [user?.email]);

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
  });

  const handleStart = async (targetUser) => {
    if (starting) return;
    setStarting(targetUser.email);
    try {
      // Check if conversation already exists
      const existing = existingConversations.find(
        (c) => c.participant_emails?.includes(targetUser.email) && c.participant_emails?.includes(user.email)
      );
      if (existing) {
        onCreated(existing);
        return;
      }
      const conv = await base44.entities.Conversation.create({
        participant_emails: [user.email, targetUser.email],
        participant_names: [user.full_name || user.email.split("@")[0], targetUser.full_name || targetUser.email.split("@")[0]],
      });
      onCreated(conv);
    } catch (err) {
      showError(err, "Couldn't start the conversation.");
    } finally {
      setStarting(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-sm w-[calc(100vw-2rem)]">
        <DialogHeader>
          <DialogTitle className="font-orbitron tracking-wide text-sm">New Message</DialogTitle>
        </DialogHeader>
        <div className="relative mt-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-secondary border-border/50"
            autoFocus
          />
        </div>
        <div className="space-y-1 max-h-64 overflow-y-auto mt-1">
          {loadingUsers ? (
            <div className="space-y-2 py-2">
              {[...Array(4)].map((_, i) => <div key={i} className="h-11 rounded-lg bg-secondary animate-pulse" />)}
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-6">No users found</p>
          ) : (
            filtered.map((u) => (
              <button
                key={u.id}
                onClick={() => handleStart(u)}
                disabled={starting === u.email}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-secondary transition-colors"
              >
                <UserAvatar user={u} size="md" />
                <div className="text-left min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{u.full_name || u.email}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{u.email}</p>
                </div>
                {starting === u.email && (
                  <div className="ml-auto w-4 h-4 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                )}
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}