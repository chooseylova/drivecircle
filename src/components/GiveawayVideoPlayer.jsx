import { useEffect, useRef, useState } from "react";

/**
 * Plays a sponsor video and reports how many seconds were ACTUALLY watched.
 * - Skipping/seeking ahead doesn't count (only small forward steps while playing are credited).
 * - Supports YouTube links (via the YouTube IFrame API) and direct video files (MP4/WebM).
 *
 * Props:
 *   url            video link
 *   onStart()      first time playback starts
 *   onProgress(s)  called with total watched seconds
 *   onDuration(s)  called once the video length is known
 */

export function getYouTubeId(url) {
  if (!url) return null;
  const m = String(url).match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

let ytApiPromise = null;
function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(window.YT);
    };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.async = true;
    s.onerror = () => {
      ytApiPromise = null;
      reject(new Error("Couldn't load the YouTube player"));
    };
    document.head.appendChild(s);
  });
  return ytApiPromise;
}

export default function GiveawayVideoPlayer({ url, onStart, onProgress, onDuration }) {
  const ytId = getYouTubeId(url);
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const watched = useRef(0);
  const lastTime = useRef(null);
  const started = useRef(false);
  const maxReached = useRef(0);
  const [error, setError] = useState("");

  // keep latest callbacks without re-creating players
  const cb = useRef({ onStart, onProgress, onDuration });
  cb.current = { onStart, onProgress, onDuration };

  const credit = (current) => {
    if (lastTime.current != null) {
      const delta = current - lastTime.current;
      // Only credit normal playback (not seeks); 0 < delta <= 2s per tick
      if (delta > 0 && delta <= 2) {
        watched.current += delta;
        cb.current.onProgress?.(watched.current);
      }
    }
    lastTime.current = current;
    maxReached.current = Math.max(maxReached.current, current);
  };

  const markStarted = () => {
    if (!started.current) {
      started.current = true;
      cb.current.onStart?.();
    }
  };

  // ---- YouTube ----
  useEffect(() => {
    if (!ytId) return;
    let player;
    let timer;
    let cancelled = false;
    loadYouTubeApi()
      .then((YT) => {
        if (cancelled || !containerRef.current) return;
        // YouTube replaces the target element with an iframe, so give it a child
        // React doesn't manage (otherwise React errors when the dialog closes).
        const target = document.createElement("div");
        target.style.width = "100%";
        target.style.height = "100%";
        containerRef.current.innerHTML = "";
        containerRef.current.appendChild(target);
        player = new YT.Player(target, {
          videoId: ytId,
          width: "100%",
          height: "100%",
          playerVars: { rel: 0, modestbranding: 1, playsinline: 1, disablekb: 1, fs: 0 },
          events: {
            onReady: (e) => {
              const d = e.target.getDuration?.();
              if (d) cb.current.onDuration?.(d);
            },
            onStateChange: (e) => {
              clearInterval(timer);
              if (e.data === YT.PlayerState.PLAYING) {
                markStarted();
                const d = e.target.getDuration?.();
                if (d) cb.current.onDuration?.(d);
                lastTime.current = e.target.getCurrentTime();
                timer = setInterval(() => credit(e.target.getCurrentTime()), 500);
              } else {
                lastTime.current = null;
              }
            },
            onError: () => setError("This video can't be played. The sponsor video may be private or removed."),
          },
        });
      })
      .catch((err) => setError(err.message));
    return () => {
      cancelled = true;
      clearInterval(timer);
      try { player?.destroy(); } catch { /* ignore */ }
    };
  }, [ytId]);

  // ---- Direct video file: block skipping ahead past what's been watched ----
  const onSeeking = () => {
    const v = videoRef.current;
    if (v && v.currentTime > maxReached.current + 1) v.currentTime = maxReached.current;
    lastTime.current = null;
  };

  if (error) {
    return (
      <div className="aspect-video rounded-lg bg-secondary flex items-center justify-center text-center p-6 text-sm text-muted-foreground">
        {error}
      </div>
    );
  }

  if (ytId) {
    return (
      <div className="aspect-video rounded-lg overflow-hidden bg-black">
        <div ref={containerRef} className="w-full h-full" />
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      src={url}
      controls
      controlsList="nodownload noplaybackrate"
      disablePictureInPicture
      playsInline
      className="w-full aspect-video rounded-lg bg-black"
      onPlay={() => { markStarted(); lastTime.current = videoRef.current?.currentTime ?? 0; }}
      onPause={() => { lastTime.current = null; }}
      onTimeUpdate={() => !videoRef.current?.paused && credit(videoRef.current.currentTime)}
      onSeeking={onSeeking}
      onRateChange={() => { if (videoRef.current && videoRef.current.playbackRate > 1) videoRef.current.playbackRate = 1; }}
      onLoadedMetadata={() => videoRef.current?.duration && cb.current.onDuration?.(videoRef.current.duration)}
      onError={() => setError("This video can't be played.")}
    />
  );
}
