import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { ArrowLeft } from "lucide-react";
import PostCard from "../components/PostCard";

export default function PostPage() {
  const { postId } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      base44.entities.Post.get(postId).catch(() => null),
      base44.auth.me().catch(() => null),
    ]).then(([p, me]) => {
      setPost(p);
      setUser(me);
      setLoading(false);
    });
  }, [postId]);

  const goBack = () => (window.history.length > 1 ? navigate(-1) : navigate("/"));

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <button onClick={goBack} className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm mb-4 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      {loading ? (
        <div className="h-48 rounded-xl bg-secondary animate-pulse" />
      ) : !post ? (
        <div className="text-center py-20 text-muted-foreground text-sm">This post doesn't exist or was deleted.</div>
      ) : (
        <PostCard
          post={post}
          user={user}
          defaultShowComments
          onUpdate={setPost}
          onDelete={() => navigate("/")}
        />
      )}
    </div>
  );
}
