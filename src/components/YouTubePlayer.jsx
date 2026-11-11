import { useState } from "react";
import { Music, Volume2, VolumeX } from "lucide-react";

function extractPlaylistId(url) {
  if (!url) return null;
  const match = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

function extractVideoId(url) {
  if (!url) return null;
  // Handle YouTube Music and regular YouTube URLs
  const patterns = [
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export default function YouTubePlayer({ url }) {
  const [muted, setMuted] = useState(false);
  const [visible, setVisible] = useState(true);

  if (!url) return null;

  const playlistId = extractPlaylistId(url);
  const videoId = extractVideoId(url);

  let embedUrl;
  if (playlistId) {
    embedUrl = `https://www.youtube.com/embed/videoseries?list=${playlistId}&autoplay=1&mute=${muted ? 1 : 0}&loop=1&enablejsapi=1`;
  } else if (videoId) {
    embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=${muted ? 1 : 0}&loop=1&playlist=${videoId}&enablejsapi=1`;
  } else {
    return null;
  }

  if (!visible) {
    return (
      <button
        onClick={() => setVisible(true)}
        title="Show music player"
        className="fixed bottom-24 right-4 md:bottom-6 md:right-6 z-40 w-12 h-12 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/30 hover:scale-110 transition-transform"
      >
        <Music className="w-5 h-5 text-primary-foreground" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-24 right-4 md:bottom-6 md:right-6 z-40">
      <div className="bg-card border border-border rounded-xl p-3 shadow-2xl shadow-primary/10 w-64 sm:w-72">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Music className="w-4 h-4 text-primary" />
            <span className="text-xs font-medium text-foreground">Now Playing</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setMuted(!muted)}
              className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
            >
              {muted ? <VolumeX className="w-3.5 h-3.5 text-muted-foreground" /> : <Volume2 className="w-3.5 h-3.5 text-primary" />}
            </button>
            <button
              onClick={() => setVisible(false)}
              className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-secondary transition-colors"
            >
              Hide
            </button>
          </div>
        </div>
        <div className="rounded-lg overflow-hidden aspect-video">
          <iframe
            src={embedUrl}
            width="100%"
            height="100%"
            title="Car soundtrack"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            className="border-0"
          />
        </div>
      </div>
    </div>
  );
}