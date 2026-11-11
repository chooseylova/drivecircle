import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { UserPlus, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { showError } from "@/lib/helpers";

export default function FollowButton({ targetEmail, targetName, currentUser }) {
  const [followRecord, setFollowRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    if (!currentUser || currentUser.email === targetEmail) { setLoading(false); return; }
    setLoading(true);
    base44.entities.UserFollow.filter({ follower_email: currentUser.email, following_email: targetEmail })
      .then((res) => setFollowRecord(res?.[0] || null))
      .catch(() => setFollowRecord(null))
      .finally(() => setLoading(false));
  }, [currentUser, targetEmail]);

  if (!currentUser || currentUser.email === targetEmail || loading) return null;

  const isFollowing = !!followRecord;

  const handleToggle = async () => {
    setToggling(true);
    try {
      if (isFollowing) {
        await base44.entities.UserFollow.delete(followRecord.id);
        setFollowRecord(null);
      } else {
        const record = await base44.entities.UserFollow.create({
          follower_email: currentUser.email,
          follower_name: currentUser.full_name || currentUser.email.split("@")[0],
          following_email: targetEmail,
          following_name: targetName || targetEmail.split("@")[0],
        });
        setFollowRecord(record);
        toast.success(`Following ${targetName || targetEmail.split("@")[0]}`);
      }
    } catch (err) {
      showError(err, "Couldn't update follow.");
    } finally {
      setToggling(false);
    }
  };

  return (
    <Button
      size="sm"
      variant={isFollowing ? "outline" : "default"}
      onClick={handleToggle}
      disabled={toggling}
      className="text-xs font-orbitron tracking-wider"
    >
      {isFollowing ? (
        <><UserCheck className="w-3.5 h-3.5 mr-1" />Following</>
      ) : (
        <><UserPlus className="w-3.5 h-3.5 mr-1" />Follow</>
      )}
    </Button>
  );
}