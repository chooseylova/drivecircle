import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { ExternalLink, RefreshCw, Newspaper, Flag, Zap, Car, Mountain, Video, Trophy, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";

const categoryColors = {
  Motorsport: "bg-red-500/20 text-red-400",
  Formula1: "bg-red-600/20 text-red-500",
  NASCAR: "bg-yellow-500/20 text-yellow-400",
  Drift: "bg-orange-500/20 text-orange-400",
  EV: "bg-green-500/20 text-green-400",
  "Creator": "bg-purple-500/20 text-purple-400",
  "New Model": "bg-blue-500/20 text-blue-400",
  Rally: "bg-amber-500/20 text-amber-400",
};

// source.unsplash.com (used before) was shut down by Unsplash, so every image failed.
// Each category now gets its own banner gradient + icon instead.
const categoryBanner = {
  Motorsport: { icon: Flag, bg: "from-red-900/70 via-red-950/40 to-card" },
  Formula1: { icon: Trophy, bg: "from-red-800/70 via-rose-950/40 to-card" },
  NASCAR: { icon: Flag, bg: "from-yellow-800/60 via-amber-950/40 to-card" },
  Drift: { icon: Car, bg: "from-orange-800/60 via-orange-950/40 to-card" },
  EV: { icon: Zap, bg: "from-green-800/60 via-emerald-950/40 to-card" },
  Creator: { icon: Video, bg: "from-purple-800/60 via-purple-950/40 to-card" },
  "New Model": { icon: Car, bg: "from-blue-800/60 via-blue-950/40 to-card" },
  Rally: { icon: Mountain, bg: "from-amber-800/60 via-amber-950/40 to-card" },
};

// Cache results for the session so switching tabs doesn't re-run the slow AI lookup
const CACHE_KEY = "dc_news_cache_v2";
const CACHE_MS = 60 * 60 * 1000;
function readCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { at, articles } = JSON.parse(raw);
    return Date.now() - at < CACHE_MS && articles?.length ? articles : null;
  } catch {
    return null;
  }
}
function writeCache(articles) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), articles }));
  } catch {
    /* storage unavailable */
  }
}

export default function AutomotiveNews() {
  const cached = readCache();
  const [articles, setArticles] = useState(cached || []);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState(false);

  const fetchNews = async () => {
    setLoading(true);
    setError(false);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Today is ${today}. Give me 10 of the most recent and exciting automotive news articles from the past few weeks. Focus heavily on: Formula 1, NASCAR, WRC, drifting, automotive YouTube creators (like Supercar Blondie, Hoonigan, Donut Media, Throttle House), new sports car releases, and performance car culture. Only include real articles with a working link. Return JSON array with: title, summary (2 sentences), source, url (direct link to the article), category (one of: Motorsport, Formula1, NASCAR, Drift, EV, Creator, New Model, Rally).`,
        add_context_from_internet: true,
        model: "gemini_3_flash",
        response_json_schema: {
          type: "object",
          properties: {
            articles: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  summary: { type: "string" },
                  source: { type: "string" },
                  url: { type: "string" },
                  category: { type: "string" }
                },
                required: ["title", "summary", "source", "url", "category"]
              }
            }
          }
        }
      });
      const list = (result?.articles || []).filter((a) => a?.title);
      setArticles(list);
      if (list.length) writeCache(list);
      else setError(true);
    } catch (err) {
      console.error("News fetch failed", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!cached) fetchNews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Newspaper className="w-4 h-4 text-primary" />
          <span className="font-orbitron font-bold text-sm tracking-wide">Automotive News</span>
        </div>
        <button onClick={fetchNews} disabled={loading} title="Refresh news"
          className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {!loading && error && articles.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border/50 rounded-xl">
          <AlertCircle className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground mb-3">Couldn't load the news right now.</p>
          <button onClick={fetchNews} className="text-xs text-primary hover:underline">Try again</button>
        </div>
      ) : loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-card border border-border/50 rounded-xl overflow-hidden animate-pulse">
              <div className="h-28 bg-secondary" />
              <div className="p-4 space-y-2">
                <div className="h-3 bg-secondary rounded w-1/4" />
                <div className="h-4 bg-secondary rounded w-full" />
                <div className="h-3 bg-secondary rounded w-3/4" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {articles.map((article, i) => {
            const colorClass = categoryColors[article.category] || "bg-primary/20 text-primary";
            const banner = categoryBanner[article.category] || { icon: Newspaper, bg: "from-primary/40 via-primary/10 to-card" };
            const BannerIcon = banner.icon;
            // AI-provided URLs are sometimes missing/invalid; fall back to a news search for the headline
            const href = /^https?:\/\//i.test(article.url || "")
              ? article.url
              : `https://www.google.com/search?tbm=nws&q=${encodeURIComponent(article.title)}`;
            return (
              <motion.a
                key={i}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className="block bg-card border border-border/50 rounded-xl overflow-hidden hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 transition-all group"
              >
                <div className={`relative h-28 overflow-hidden bg-gradient-to-br ${banner.bg}`}>
                  <BannerIcon className="absolute -right-3 -bottom-4 w-28 h-28 text-white/10 transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-6" />
                  <span className={`absolute top-3 left-3 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${colorClass}`}>
                    {article.category}
                  </span>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-sm text-foreground leading-snug group-hover:text-primary transition-colors line-clamp-2 mb-2">
                    {article.title}
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mb-3">{article.summary}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">{article.source}</span>
                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </div>
              </motion.a>
            );
          })}
        </div>
      )}
    </div>
  );
}