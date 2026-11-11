import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Heart, ThumbsDown, MessageCircle, Share2, Send, FileText, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import UserAvatar from "./UserAvatar";
import { toast } from "sonner";
import { safeTimeAgo, showError, copyToClipboard, nameFromEmail } from "@/lib/helpers";

export default function PostCard({ post, user, onUpdate, onDelete, defaultShowComments = false }) {
  const [showComments, setShowComments] = useState(defaultShowComments);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [busy, setBusy] = useState(false);

  const isLiked = user && post.liked_by?.includes(user.email);
  const isDisliked = user && post.disliked_by?.includes(user.email);
  const isOwner = user && user.email === post.author_email;

  // Re-read the post before changing array fields so we don't overwrite
  // likes/comments another user added since this page loaded.
  const getFresh = async () => {
    try {
      return (await base44.entities.Post.get(post.id)) || post;
    } catch {
      return post;
    }
  };

  const handleReaction = async (type) => {
    if (!user || busy) return;
    setBusy(true);
    try {
      const fresh = await getFresh();
      let likedBy = fresh.liked_by || [];
      let dislikedBy = fresh.disliked_by || [];
      if (type === "like") {
        dislikedBy = dislikedBy.filter((e) => e !== user.email);
        likedBy = likedBy.includes(user.email) ? likedBy.filter((e) => e !== user.email) : [...likedBy, user.email];
      } else {
        likedBy = likedBy.filter((e) => e !== user.email);
        dislikedBy = dislikedBy.includes(user.email) ? dislikedBy.filter((e) => e !== user.email) : [...dislikedBy, user.email];
      }
      const changes = {
        liked_by: likedBy,
        likes_count: likedBy.length,
        disliked_by: dislikedBy,
        dislikes_count: dislikedBy.length,
      };
      await base44.entities.Post.update(post.id, changes);
      onUpdate?.({ ...fresh, ...changes });
    } catch (err) {
      showError(err, "Couldn't save your reaction.");
    } finally {
      setBusy(false);
    }
  };

  const handleShare = async () => {
    const shared = await copyToClipboard(`${window.location.origin}/post/${post.id}`);
    if (!shared) return;
    const shares = (post.shares_count || 0) + 1;
    onUpdate?.({ ...post, shares_count: shares });
    base44.entities.Post.update(post.id, { shares_count: shares }).catch(() => {});
  };

  const handleComment = async () => {
    if (!commentText.trim() || !user || submitting) return;
    setSubmitting(true);
    try {
      const fresh = await getFresh();
      const newComment = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        author_email: user.email,
        author_name: user.full_name || nameFromEmail(user.email),
        author_avatar_url: user.avatar_url || "",
        content: commentText.trim(),
        created_date: new Date().toISOString(),
      };
      const updatedComments = [...(fresh.comments || []), newComment];
      await base44.entities.Post.update(post.id, { comments: updatedComments });
      onUpdate?.({ ...fresh, comments: updatedComments });
      setCommentText("");
    } catch (err) {
      showError(err, "Couldn't post your comment.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    try {
      const fresh = await getFresh();
      const updatedComments = (fresh.comments || []).filter((c) => c.id !== commentId);
      await base44.entities.Post.update(post.id, { comments: updatedComments });
      onUpdate?.({ ...fresh, comments: updatedComments });
    } catch (err) {
      showError(err, "Couldn't delete comment.");
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this post?")) return;
    try {
      await base44.entities.Post.delete(post.id);
      toast.success("Post deleted");
      onDelete?.(post.id);
    } catch (err) {
      showError(err, "Couldn't delete post.");
    }
  };

  const authorName = post.author_name || nameFromEmail(post.author_email);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border/50 rounded-xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center gap-3 p-4 pb-3">
        <Link to={`/user/${encodeURIComponent(post.author_email)}`}>
          <UserAvatar name={authorName} avatarUrl={post.author_avatar_url} size="md" />
        </Link>
        <div className="flex-1 min-w-0">
          <Link to={`/user/${encodeURIComponent(post.author_email)}`} className="font-semibold text-sm text-foreground hover:text-primary transition-colors">{authorName}</Link>
          <Link to={`/post/${post.id}`} className="block text-[11px] text-muted-foreground hover:underline">
            {safeTimeAgo(post.created_date)}
          </Link>
        </div>
        {isOwner && onDelete && (
          <button onClick={handleDelete} title="Delete post"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Content */}
      {post.content && (
        <p className="px-4 pb-3 text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap break-words">{post.content}</p>
      )}

      {/* Photos */}
      {post.photos?.length > 0 && (
        <div className={`grid gap-1 mb-1 ${post.photos.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
          {post.photos.slice(0, 4).map((url, i) => (
            <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="relative block">
              <img src={url} alt="" loading="lazy" className={`w-full object-cover ${post.photos.length === 1 ? "max-h-[28rem]" : "h-48"}`} />
              {i === 3 && post.photos.length > 4 && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <span className="text-white font-bold text-xl">+{post.photos.length - 4}</span>
                </div>
              )}
            </a>
          ))}
        </div>
      )}

      {/* Files */}
      {post.files?.length > 0 && (
        <div className="px-4 pb-3 space-y-1">
          {post.files.map((file, i) => (
            <a key={i} href={file.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 bg-secondary rounded-lg px-3 py-2 text-xs text-foreground hover:bg-secondary/80 transition-colors">
              <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="truncate">{file.name || "Attachment"}</span>
            </a>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 px-3 py-2 border-t border-border/30">
        <button onClick={() => handleReaction("like")} disabled={busy}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${isLiked ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}>
          <Heart className={`w-4 h-4 ${isLiked ? "fill-primary" : ""}`} />
          {post.likes_count || 0}
        </button>
        <button onClick={() => handleReaction("dislike")} disabled={busy}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${isDisliked ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}>
          <ThumbsDown className={`w-4 h-4 ${isDisliked ? "fill-foreground" : ""}`} />
          {post.dislikes_count || 0}
        </button>
        <button onClick={() => setShowComments(!showComments)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
          <MessageCircle className="w-4 h-4" />
          {post.comments?.length || 0}
          {showComments ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
        <button onClick={handleShare}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors ml-auto">
          <Share2 className="w-4 h-4" />
          {post.shares_count || 0}
        </button>
      </div>

      {/* Comments */}
      <AnimatePresence>
        {showComments && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="border-t border-border/30 overflow-hidden">
            <div className="p-3 space-y-3 max-h-80 overflow-y-auto">
              {(post.comments || []).map((c) => (
                <div key={c.id} className="flex gap-2 group">
                  <Link to={`/user/${encodeURIComponent(c.author_email)}`}>
                    <UserAvatar name={c.author_name || c.author_email} avatarUrl={c.author_avatar_url} size="sm" />
                  </Link>
                  <div className="bg-secondary rounded-xl px-3 py-2 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Link to={`/user/${encodeURIComponent(c.author_email)}`} className="text-[11px] font-semibold text-foreground hover:text-primary">
                        {c.author_name || nameFromEmail(c.author_email)}
                      </Link>
                      <span className="text-[10px] text-muted-foreground">{safeTimeAgo(c.created_date)}</span>
                      {(user?.email === c.author_email || isOwner) && (
                        <button onClick={() => handleDeleteComment(c.id)} title="Delete comment"
                          className="ml-auto text-muted-foreground hover:text-destructive md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-foreground/80 whitespace-pre-wrap break-words">{c.content}</p>
                  </div>
                </div>
              ))}
              {!post.comments?.length && (
                <p className="text-xs text-muted-foreground text-center py-2">No comments yet</p>
              )}
            </div>
            {user && (
              <form onSubmit={(e) => { e.preventDefault(); handleComment(); }} className="flex gap-2 px-3 pb-3">
                <Input
                  placeholder="Write a comment..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  className="bg-secondary border-border/50 text-sm h-8"
                />
                <Button type="submit" size="icon" className="h-8 w-8 shrink-0" disabled={submitting || !commentText.trim()}>
                  <Send className="w-3.5 h-3.5" />
                </Button>
              </form>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
