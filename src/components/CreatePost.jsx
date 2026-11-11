import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Image, Paperclip, X, Send } from "lucide-react";
import { toast } from "sonner";
import UserAvatar from "./UserAvatar";
import { uploadFiles, showError, nameFromEmail } from "@/lib/helpers";

export default function CreatePost({ user, onPost, postType = "feed" }) {
  const [content, setContent] = useState("");
  const [photos, setPhotos] = useState([]);
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting] = useState(false);

  const handlePhotoUpload = async (e) => {
    const selected = Array.from(e.target.files || []);
    e.target.value = ""; // allow re-selecting the same file
    if (!selected.length) return;
    setUploading(true);
    const uploaded = await uploadFiles(base44, selected);
    setPhotos((prev) => [...prev, ...uploaded.map((u) => u.url)]);
    setUploading(false);
  };

  const handleFileUpload = async (e) => {
    const selected = Array.from(e.target.files || []);
    e.target.value = "";
    if (!selected.length) return;
    setUploading(true);
    const uploaded = await uploadFiles(base44, selected);
    setFiles((prev) => [...prev, ...uploaded]);
    setUploading(false);
  };

  const handlePost = async () => {
    if (!content.trim() && photos.length === 0 && files.length === 0) return;
    setPosting(true);
    try {
      const post = await base44.entities.Post.create({
        author_email: user.email,
        author_name: user.full_name || nameFromEmail(user.email),
        author_avatar_url: user.avatar_url || "",
        content: content.trim(),
        post_type: postType,
        photos,
        files,
        likes_count: 0,
        liked_by: [],
        dislikes_count: 0,
        disliked_by: [],
        comments: [],
        shares_count: 0,
      });
      setContent("");
      setPhotos([]);
      setFiles([]);
      toast.success("Posted!");
      onPost?.(post);
    } catch (err) {
      showError(err, "Couldn't publish your post.");
    } finally {
      setPosting(false);
    }
  };

  if (!user) return null;

  return (
    <div className="bg-card border border-border/50 rounded-xl p-4 mb-4">
      <div className="flex gap-3">
        <UserAvatar user={user} size="md" />
        <div className="flex-1">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={postType === "community" ? "Post something to the community..." : "Share something with your followers..."}
            rows={3}
            className="w-full bg-secondary border border-border/50 rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
          />

          {/* Photo previews */}
          {photos.length > 0 && (
            <div className="flex gap-2 mt-2 flex-wrap">
              {photos.map((url, i) => (
                <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden group">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => setPhotos(p => p.filter((_, j) => j !== i))}
                    className="absolute inset-0 bg-black/50 md:opacity-0 md:group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* File previews */}
          {files.length > 0 && (
            <div className="mt-2 space-y-1">
              {files.map((f, i) => (
                <div key={i} className="flex items-center justify-between bg-secondary rounded-lg px-3 py-1.5 text-xs">
                  <span className="text-foreground/80 truncate">{f.name}</span>
                  <button type="button" onClick={() => setFiles(fl => fl.filter((_, j) => j !== i))}>
                    <X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 mt-3">
            <label className="cursor-pointer p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
              <Image className="w-4 h-4" />
              <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />
            </label>
            <label className="cursor-pointer p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
              <Paperclip className="w-4 h-4" />
              <input type="file" multiple className="hidden" onChange={handleFileUpload} />
            </label>
            <Button size="sm" className="ml-auto font-orbitron text-xs tracking-wider h-8"
              onClick={handlePost} disabled={posting || uploading || (!content.trim() && photos.length === 0 && files.length === 0)}>
              {posting || uploading ? (
                <div className="w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              ) : (
                <><Send className="w-3.5 h-3.5 mr-1" />Post</>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}