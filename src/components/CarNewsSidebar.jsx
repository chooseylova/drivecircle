import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { ExternalLink, Newspaper, RefreshCw, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";

export default function CarNewsSidebar() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchNews = async () => {
    setLoading(true);
    setError(false);
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: "Give me 8 recent car and automotive news articles from 2025-2026. Include news about new car releases, motorsports, EV updates, car culture, and auto shows. Return a JSON array of objects with fields: title (string), summary (string, 1-2 sentences), source (string, e.g. MotorTrend), url (string), category (string, e.g. EV, Motorsport, New Model). Keep summaries short.",
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
                required: ["title", "summary", "source"]
              }
            }
          }
        }
      });
      setArticles(result?.articles || []);
    } catch (e) {
      setError(true);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchNews();
  }, []);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Newspaper className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm text-foreground">Car News</span>
        </div>
        <button
          onClick={fetchNews}
          disabled={loading}
          className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="space-y-3">
        {loading ? (
          [...Array(5)].map((_, i) => (
            <div key={i} className="bg-card border border-border/50 rounded-xl p-3 animate-pulse">
              <div className="h-3 bg-secondary rounded w-3/4 mb-2" />
              <div className="h-2 bg-secondary rounded w-full mb-1" />
              <div className="h-2 bg-secondary rounded w-2/3" />
            </div>
          ))
        ) : error ? (
          <div className="bg-card border border-border/50 rounded-xl p-4 text-center">
            <AlertCircle className="w-5 h-5 text-muted-foreground mx-auto mb-2" />
            <p className="text-xs text-muted-foreground mb-2">Couldn't load news right now.</p>
            <button onClick={fetchNews} className="text-xs text-primary hover:underline">Try again</button>
          </div>
        ) : (
          articles.map((article, i) => (
            <motion.a
              key={i}
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="block bg-card border border-border/50 rounded-xl p-3 hover:border-primary/30 hover:bg-card/80 transition-all group"
            >
              {article.category && (
                <span className="text-[9px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded mb-1.5 inline-block">
                  {article.category}
                </span>
              )}
              <h4 className="text-xs font-semibold text-foreground leading-snug group-hover:text-primary transition-colors line-clamp-2 mb-1">
                {article.title}
              </h4>
              <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2 mb-2">
                {article.summary}
              </p>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">{article.source}</span>
                <ExternalLink className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </motion.a>
          ))
        )}
      </div>
    </div>
  );
}