import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Gift, Clock, Users, Trophy, PlayCircle, CheckCircle2, ExternalLink, ScrollText, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { motion } from "framer-motion";
import { toast } from "sonner";
import GiveawayVideoPlayer from "../components/GiveawayVideoPlayer";
import GiveawayAdminPanel from "../components/GiveawayAdminPanel";
import { showError, safeFormat, safeTimeAgo } from "@/lib/helpers";

// ---- countdown -------------------------------------------------------------
function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

function formatCountdown(ms) {
  if (ms <= 0) return "Closed";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  return `${m}m ${sec}s`;
}

// ---- official rules --------------------------------------------------------
function RulesDialog({ open, onClose, giveaway }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-card border-border max-w-lg max-h-[85vh] overflow-y-auto w-[calc(100vw-2rem)]">
        <DialogHeader>
          <DialogTitle className="font-orbitron tracking-wide text-sm">Official Giveaway Rules</DialogTitle>
        </DialogHeader>
        <div className="text-xs text-muted-foreground space-y-2 leading-relaxed">
          <p><strong className="text-foreground">NO PURCHASE NECESSARY.</strong> A purchase will not increase your chances of winning. Watching the sponsor video is free.</p>
          <p><strong className="text-foreground">Eligibility:</strong> Open to registered DriveCircle members who are legal residents of the 50 United States and D.C. and 18 years or older. Void where prohibited. Employees of DriveCircle and the sponsor are not eligible.</p>
          <p><strong className="text-foreground">How to enter:</strong> During the entry period, watch the sponsor video and tap "Enter". Limit one (1) entry per person per giveaway. Daily giveaways run for one day and weekly giveaways run for seven days; exact start and end times are shown on each giveaway. Entries created by automated means or multiple accounts are void.</p>
          <p><strong className="text-foreground">Winner selection:</strong> One winner per giveaway is selected at random from all eligible entries after the entry period ends. Odds depend on the number of eligible entries received.</p>
          <p><strong className="text-foreground">Notification:</strong> The winner is notified by email at the address on their DriveCircle account and must respond within 7 days to claim the prize, or an alternate winner may be selected.</p>
          <p><strong className="text-foreground">Prize:</strong> As described on the giveaway. No cash substitution or transfer except at the sponsor's discretion. Winner is responsible for any applicable taxes.</p>
          <p><strong className="text-foreground">General:</strong> DriveCircle may cancel or modify a giveaway if fraud or technical problems affect its integrity. This promotion is not sponsored, endorsed or administered by Apple, Google, Facebook or YouTube.</p>
          {giveaway?.rules && (
            <p><strong className="text-foreground">Additional rules for this giveaway:</strong> {giveaway.rules}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---- watch & enter ---------------------------------------------------------
function EnterDialog({ giveaway, onClose, onEntered }) {
  const [watchId, setWatchId] = useState(null);
  const [watched, setWatched] = useState(0);
  const [duration, setDuration] = useState(null);
  const [entering, setEntering] = useState(false);
  const [done, setDone] = useState(false);

  const minSeconds = giveaway.min_watch_seconds || 30;
  // If the video is shorter than the requirement, watching the whole thing is enough
  const required = duration ? Math.min(minSeconds, Math.max(duration - 1, 1)) : minSeconds;
  const pct = Math.min(100, (watched / required) * 100);
  const ready = watched >= required && !!watchId;

  const handleStart = useCallback(async () => {
    try {
      const res = await base44.functions.invoke("startGiveawayWatch", { giveawayId: giveaway.id });
      if (res.data?.alreadyEntered) {
        toast.info("You're already entered in this giveaway.");
        onEntered(giveaway.id);
        onClose();
        return;
      }
      setWatchId(res.data?.watchId || null);
    } catch (err) {
      showError(err, "Couldn't start the video session.");
    }
  }, [giveaway.id, onClose, onEntered]);

  const handleEnter = async () => {
    setEntering(true);
    try {
      const res = await base44.functions.invoke("enterGiveaway", {
        giveawayId: giveaway.id,
        watchId,
        watchedSeconds: Math.round(watched),
      });
      setDone(true);
      onEntered(giveaway.id, res.data?.entryCount);
    } catch (err) {
      showError(err, "Couldn't enter the giveaway.");
    } finally {
      setEntering(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-card border-border max-w-2xl w-[calc(100vw-1rem)] p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="font-orbitron tracking-wide text-sm">{giveaway.title}</DialogTitle>
          <DialogDescription className="text-xs">
            {done ? "You're in!" : `Watch the video to unlock your entry for: ${giveaway.prize}`}
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <div className="text-center py-8">
            <PartyPopper className="w-12 h-12 text-primary mx-auto mb-3" />
            <p className="font-orbitron font-bold text-lg mb-1">You're entered!</p>
            <p className="text-sm text-muted-foreground mb-1">
              Winner is drawn after {safeFormat(giveaway.ends_at, "EEE, MMM d 'at' h:mm a")}.
            </p>
            <p className="text-xs text-muted-foreground mb-5">We'll email you if you win. Good luck!</p>
            <Button onClick={onClose} className="font-orbitron text-xs tracking-wider">Done</Button>
          </div>
        ) : (
          <>
            <GiveawayVideoPlayer
              url={giveaway.video_url}
              onStart={handleStart}
              onProgress={setWatched}
              onDuration={setDuration}
            />
            <div className="space-y-2">
              <div className="h-2 rounded-full bg-secondary overflow-hidden">
                <div className="h-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} />
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {watched < 1
                    ? "Press play to start"
                    : ready
                      ? "Video complete — you can enter now!"
                      : `Keep watching… ${Math.ceil(required - watched)}s to go`}
                </span>
                {giveaway.sponsor_name && (
                  <span className="truncate ml-2">
                    Sponsored by{" "}
                    {giveaway.sponsor_url ? (
                      <a href={giveaway.sponsor_url} target="_blank" rel="noopener noreferrer sponsored" className="text-primary hover:underline">{giveaway.sponsor_name}</a>
                    ) : giveaway.sponsor_name}
                  </span>
                )}
              </div>
              <Button onClick={handleEnter} disabled={!ready || entering} className="w-full h-11 font-orbitron tracking-wider">
                {entering ? "Entering..." : ready ? <><Gift className="w-4 h-4 mr-2" />Enter Giveaway</> : <><PlayCircle className="w-4 h-4 mr-2" />Watch to unlock entry</>}
              </Button>
              <p className="text-[10px] text-muted-foreground text-center">One entry per person. Skipping ahead doesn't count toward watch time.</p>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---- card ------------------------------------------------------------------
function GiveawayCard({ g, now, onEnter, onRules, index }) {
  const left = Date.parse(g.ends_at) - now;
  const closed = left <= 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className={`relative bg-card border rounded-2xl overflow-hidden ${g.entered ? "border-primary/50" : "border-border/50"}`}
    >
      <div className="relative h-36 bg-gradient-to-br from-primary/40 via-primary/10 to-card overflow-hidden">
        {g.image_url ? (
          <img src={g.image_url} alt={g.prize} className="w-full h-full object-cover" />
        ) : (
          <Gift className="absolute -right-4 -bottom-6 w-36 h-36 text-white/10" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/20 to-transparent" />
        <span className={`absolute top-3 left-3 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${
          g.period === "weekly" ? "bg-amber-500/90 text-black" : "bg-primary text-primary-foreground"
        }`}>
          {g.period === "weekly" ? "Weekly" : "Daily"}
        </span>
        {g.prize_value > 0 && (
          <span className="absolute top-3 right-3 font-orbitron text-xs font-bold bg-black/60 text-white px-2 py-1 rounded-full">
            ${Number(g.prize_value).toLocaleString()}
          </span>
        )}
      </div>
      <div className="p-4 -mt-6 relative">
        <h3 className="font-orbitron font-bold text-base leading-tight">{g.prize}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{g.title}</p>
        {g.description && <p className="text-xs text-foreground/80 mt-2 line-clamp-2">{g.description}</p>}

        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-primary" />{closed ? "Closed" : `Ends in ${formatCountdown(left)}`}</span>
          <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{g.entry_count || 0} entered</span>
        </div>

        <div className="mt-4 flex gap-2">
          {g.entered ? (
            <Button disabled variant="outline" className="flex-1 text-xs border-primary/50 text-primary opacity-100">
              <CheckCircle2 className="w-4 h-4 mr-1.5" /> You're entered
            </Button>
          ) : (
            <Button onClick={() => onEnter(g)} disabled={closed} className="flex-1 font-orbitron text-xs tracking-wider">
              <PlayCircle className="w-4 h-4 mr-1.5" /> Watch & Enter
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={() => onRules(g)} title="Official rules">
            <ScrollText className="w-4 h-4" />
          </Button>
        </div>
        {g.sponsor_name && (
          <p className="text-[10px] text-muted-foreground mt-2">
            Sponsored by{" "}
            {g.sponsor_url ? (
              <a href={g.sponsor_url} target="_blank" rel="noopener noreferrer sponsored" className="text-primary hover:underline inline-flex items-center gap-0.5">
                {g.sponsor_name} <ExternalLink className="w-2.5 h-2.5" />
              </a>
            ) : g.sponsor_name}
          </p>
        )}
      </div>
    </motion.div>
  );
}

// ---- page ------------------------------------------------------------------
export default function GiveawaysPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [entering, setEntering] = useState(null);
  const [rulesFor, setRulesFor] = useState(null);
  const now = useNow(1000);

  const load = useCallback(async () => {
    try {
      const res = await base44.functions.invoke("getGiveaways", {});
      setData(res.data || {});
    } catch (err) {
      showError(err, "Couldn't load giveaways.");
      setData({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleEntered = useCallback((id, entryCount) => {
    setData((prev) => prev && ({
      ...prev,
      open: (prev.open || []).map((g) => (g.id === id ? { ...g, entered: true, entry_count: entryCount ?? g.entry_count } : g)),
    }));
  }, []);

  const open = data?.open || [];
  const daily = open.filter((g) => g.period !== "weekly");
  const weekly = open.filter((g) => g.period === "weekly");

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
            <Gift className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-orbitron font-bold text-xl tracking-wide">Giveaways</h1>
            <p className="text-muted-foreground text-xs mt-0.5">Watch a short video, get an entry. New daily and weekly prizes.</p>
          </div>
        </div>
      </motion.div>

      {/* My wins */}
      {data?.myWins?.length > 0 && (
        <div className="mb-6 bg-gradient-to-r from-amber-500/20 to-primary/10 border border-amber-500/40 rounded-2xl p-4 flex items-center gap-3">
          <Trophy className="w-8 h-8 text-amber-400 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold">You won {data.myWins[0].prize}!</p>
            <p className="text-xs text-muted-foreground">Check your email for how to claim it (drawn {safeTimeAgo(data.myWins[0].drawn_at)}).</p>
          </div>
        </div>
      )}

      {/* How it works */}
      <div className="grid grid-cols-3 gap-2 mb-8">
        {[
          { icon: PlayCircle, t: "Watch", d: "a short sponsor video" },
          { icon: Gift, t: "Enter", d: "one tap, one entry each" },
          { icon: Trophy, t: "Win", d: "random draw when it closes" },
        ].map((s) => (
          <div key={s.t} className="bg-card border border-border/50 rounded-xl p-3 text-center">
            <s.icon className="w-5 h-5 text-primary mx-auto mb-1" />
            <p className="font-orbitron text-xs font-bold">{s.t}</p>
            <p className="text-[10px] text-muted-foreground leading-tight">{s.d}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => <div key={i} className="h-72 rounded-2xl bg-secondary animate-pulse" />)}
        </div>
      ) : open.length === 0 ? (
        <div className="text-center py-14 bg-card border border-border/50 rounded-2xl mb-8">
          <Gift className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No giveaways are open right now. Check back soon!</p>
        </div>
      ) : (
        <div className="space-y-8 mb-8">
          {daily.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-primary mb-3">Daily Giveaway{daily.length > 1 ? "s" : ""}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {daily.map((g, i) => <GiveawayCard key={g.id} g={g} now={now} index={i} onEnter={setEntering} onRules={setRulesFor} />)}
              </div>
            </section>
          )}
          {weekly.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-amber-400 mb-3">Weekly Giveaway{weekly.length > 1 ? "s" : ""}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {weekly.map((g, i) => <GiveawayCard key={g.id} g={g} now={now} index={i} onEnter={setEntering} onRules={setRulesFor} />)}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Recent winners */}
      {data?.recentWinners?.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Recent Winners</h2>
          <div className="bg-card border border-border/50 rounded-xl divide-y divide-border/40">
            {data.recentWinners.filter((g) => g.winner_display).map((g) => (
              <div key={g.id} className="flex items-center gap-3 px-4 py-3">
                <Trophy className={`w-4 h-4 shrink-0 ${g.period === "weekly" ? "text-amber-400" : "text-primary"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate"><span className="font-semibold">{g.winner_display}</span> won {g.prize}</p>
                  <p className="text-[10px] text-muted-foreground">{g.period === "weekly" ? "Weekly" : "Daily"} · {safeTimeAgo(g.drawn_at)}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <p className="text-[10px] text-muted-foreground text-center mb-8">
        No purchase necessary. 18+, US residents only. One entry per person per giveaway.{" "}
        <button onClick={() => setRulesFor({})} className="underline hover:text-foreground">Official rules</button>
      </p>

      {data?.isAdmin && <GiveawayAdminPanel data={data} onChanged={load} />}

      {entering && <EnterDialog giveaway={entering} onClose={() => setEntering(null)} onEntered={handleEntered} />}
      <RulesDialog open={!!rulesFor} onClose={() => setRulesFor(null)} giveaway={rulesFor} />
    </div>
  );
}
