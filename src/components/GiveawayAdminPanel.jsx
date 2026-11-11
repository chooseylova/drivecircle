import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Shield, Plus, Upload, Trophy, Square, Ban, RotateCcw, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { startOfDay, addDays, startOfWeek } from "date-fns";
import { showError, safeFormat, safeTimeAgo } from "@/lib/helpers";
import { getYouTubeId } from "./GiveawayVideoPlayer";

// Admin-only tools: create giveaways, draw winners, end/cancel, re-draw.

function toLocalInput(d) {
  const x = new Date(d);
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 16);
}

function defaultWindow(period) {
  const now = new Date();
  const start = period === "weekly" ? startOfWeek(now, { weekStartsOn: 1 }) : startOfDay(now);
  const end = addDays(start, period === "weekly" ? 7 : 1);
  return { starts_at: toLocalInput(start), ends_at: toLocalInput(end) };
}

const EMPTY = {
  title: "", prize: "", prize_value: "", description: "", period: "daily",
  video_url: "", min_watch_seconds: "30", sponsor_name: "", sponsor_url: "",
  image_url: "", rules: "", auto_renew: true,
};

export default function GiveawayAdminPanel({ data, onChanged }) {
  const [form, setForm] = useState({ ...EMPTY, ...defaultWindow("daily") });
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setPeriod = (p) => setForm((f) => ({ ...f, period: p, ...defaultWindow(p) }));

  const upload = async (e, field) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(field);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      set(field, file_url);
      toast.success("Uploaded");
    } catch (err) {
      showError(err, "Upload failed.");
    } finally {
      setUploading(null);
    }
  };

  const create = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.prize.trim() || !form.video_url.trim()) {
      toast.error("Title, prize and video are required.");
      return;
    }
    const isYt = !!getYouTubeId(form.video_url);
    const isFile = /^https?:\/\/.+/i.test(form.video_url);
    if (!isYt && !isFile) {
      toast.error("Video must be a YouTube link or an uploaded video file.");
      return;
    }
    const start = new Date(form.starts_at);
    const end = new Date(form.ends_at);
    if (isNaN(start) || isNaN(end) || end <= start) {
      toast.error("End time must be after start time.");
      return;
    }
    setSaving(true);
    try {
      await base44.entities.Giveaway.create({
        title: form.title.trim(),
        prize: form.prize.trim(),
        prize_value: form.prize_value ? Number(form.prize_value) : null,
        description: form.description.trim(),
        period: form.period,
        video_url: form.video_url.trim(),
        min_watch_seconds: Math.max(5, Number(form.min_watch_seconds) || 30),
        sponsor_name: form.sponsor_name.trim(),
        sponsor_url: form.sponsor_url.trim(),
        image_url: form.image_url,
        rules: form.rules.trim(),
        auto_renew: !!form.auto_renew,
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        status: "active",
        entry_count: 0,
      });
      toast.success("Giveaway created!");
      setForm({ ...EMPTY, ...defaultWindow(form.period), period: form.period });
      setShowForm(false);
      onChanged();
    } catch (err) {
      showError(err, "Couldn't create giveaway (check that your account is an admin).");
    } finally {
      setSaving(false);
    }
  };

  const draw = async (g, opts = {}) => {
    const verb = opts.redraw ? "Re-draw a new winner (the current winner will be excluded)?" : `Draw a winner for "${g.title}" now?`;
    if (!confirm(verb)) return;
    setBusyId(g.id);
    try {
      const res = await base44.functions.invoke("drawGiveaway", { giveawayId: g.id, ...opts });
      const w = res.data?.winner;
      toast.success(w ? `Winner: ${w.name || w.email} (${res.data.entries} entries). They've been emailed.` : "No eligible entries. The giveaway was closed with no winner.");
      onChanged();
    } catch (err) {
      showError(err, "Draw failed.");
    } finally {
      setBusyId(null);
    }
  };

  const endNow = async (g) => {
    if (!confirm(`End "${g.title}" now? No more entries will be accepted.`)) return;
    setBusyId(g.id);
    try {
      await base44.entities.Giveaway.update(g.id, { ends_at: new Date().toISOString() });
      onChanged();
    } catch (err) {
      showError(err, "Couldn't end the giveaway.");
    } finally {
      setBusyId(null);
    }
  };

  const cancel = async (g) => {
    if (!confirm(`Cancel "${g.title}"? It will be hidden and no winner will be drawn.`)) return;
    setBusyId(g.id);
    try {
      await base44.entities.Giveaway.update(g.id, { status: "cancelled", auto_renew: false });
      onChanged();
    } catch (err) {
      showError(err, "Couldn't cancel.");
    } finally {
      setBusyId(null);
    }
  };

  const Row = ({ g, children }) => (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
      <div className="flex-1 min-w-[180px]">
        <p className="text-sm font-medium truncate">
          {g.title} <span className="text-[10px] uppercase text-muted-foreground">· {g.period}</span>
          {g.auto_renew && <Repeat className="inline w-3 h-3 ml-1 text-primary" title="Auto-renews" />}
        </p>
        <p className="text-[10px] text-muted-foreground">
          {safeFormat(g.starts_at, "MMM d h:mm a")} → {safeFormat(g.ends_at, "MMM d h:mm a")} · {g.entry_count || 0} entries
          {g.winner_email && <> · Winner: <span className="text-foreground">{g.winner_email}</span> ({safeTimeAgo(g.drawn_at)})</>}
        </p>
      </div>
      <div className="flex gap-1.5">{children}</div>
    </div>
  );

  const fieldCls = "bg-secondary border-border/50";
  const labelCls = "text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block";

  return (
    <section className="border border-amber-500/40 rounded-2xl p-4 bg-amber-500/5 mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-orbitron text-sm font-bold flex items-center gap-2">
          <Shield className="w-4 h-4 text-amber-400" /> Admin: Manage Giveaways
        </h2>
        <Button size="sm" onClick={() => setShowForm((s) => !s)} className="text-xs">
          <Plus className="w-4 h-4 mr-1" /> {showForm ? "Close" : "New giveaway"}
        </Button>
      </div>

      {showForm && (
        <form onSubmit={create} className="space-y-3 bg-card border border-border/50 rounded-xl p-4 mb-4">
          <div className="flex gap-2">
            {["daily", "weekly"].map((p) => (
              <button type="button" key={p} onClick={() => setPeriod(p)}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider border ${form.period === p ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}>
                {p}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className={labelCls}>Title *</Label>
              <Input className={fieldCls} placeholder="Daily Gas Card Giveaway" value={form.title} onChange={(e) => set("title", e.target.value)} />
            </div>
            <div>
              <Label className={labelCls}>Prize *</Label>
              <Input className={fieldCls} placeholder="$25 Shell gift card" value={form.prize} onChange={(e) => set("prize", e.target.value)} />
            </div>
            <div>
              <Label className={labelCls}>Prize value ($)</Label>
              <Input className={fieldCls} type="number" min="0" placeholder="25" value={form.prize_value} onChange={(e) => set("prize_value", e.target.value)} />
            </div>
            <div>
              <Label className={labelCls}>Required watch time (seconds)</Label>
              <Input className={fieldCls} type="number" min="5" value={form.min_watch_seconds} onChange={(e) => set("min_watch_seconds", e.target.value)} />
            </div>
          </div>

          <div>
            <Label className={labelCls}>Sponsor video * (YouTube link or upload a video file)</Label>
            <div className="flex gap-2">
              <Input className={fieldCls} placeholder="https://youtube.com/watch?v=..." value={form.video_url} onChange={(e) => set("video_url", e.target.value)} />
              <label className="shrink-0 inline-flex items-center gap-1 px-3 rounded-md border border-border text-xs cursor-pointer hover:border-primary/50">
                <Upload className="w-3.5 h-3.5" /> {uploading === "video_url" ? "..." : "Upload"}
                <input type="file" accept="video/mp4,video/webm,video/quicktime" className="hidden" onChange={(e) => upload(e, "video_url")} disabled={!!uploading} />
              </label>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">YouTube videos must be Public or Unlisted with embedding allowed.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className={labelCls}>Sponsor name</Label>
              <Input className={fieldCls} placeholder="Joe's Tire & Auto" value={form.sponsor_name} onChange={(e) => set("sponsor_name", e.target.value)} />
            </div>
            <div>
              <Label className={labelCls}>Sponsor website</Label>
              <Input className={fieldCls} placeholder="https://..." value={form.sponsor_url} onChange={(e) => set("sponsor_url", e.target.value)} />
            </div>
            <div>
              <Label className={labelCls}>Starts</Label>
              <Input className={fieldCls} type="datetime-local" value={form.starts_at} onChange={(e) => set("starts_at", e.target.value)} />
            </div>
            <div>
              <Label className={labelCls}>Ends (winner drawn after)</Label>
              <Input className={fieldCls} type="datetime-local" value={form.ends_at} onChange={(e) => set("ends_at", e.target.value)} />
            </div>
          </div>

          <div>
            <Label className={labelCls}>Prize image (optional)</Label>
            <div className="flex items-center gap-2">
              {form.image_url && <img src={form.image_url} alt="" className="w-12 h-12 rounded object-cover" />}
              <label className="inline-flex items-center gap-1 px-3 py-2 rounded-md border border-border text-xs cursor-pointer hover:border-primary/50">
                <Upload className="w-3.5 h-3.5" /> {uploading === "image_url" ? "Uploading..." : form.image_url ? "Replace" : "Upload image"}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => upload(e, "image_url")} disabled={!!uploading} />
              </label>
            </div>
          </div>

          <div>
            <Label className={labelCls}>Description</Label>
            <Textarea className={`${fieldCls} resize-none`} rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} />
          </div>
          <div>
            <Label className={labelCls}>Extra rules (optional)</Label>
            <Textarea className={`${fieldCls} resize-none`} rows={2} placeholder="e.g. Gift card mailed within 14 days" value={form.rules} onChange={(e) => set("rules", e.target.value)} />
          </div>

          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={form.auto_renew} onChange={(e) => set("auto_renew", e.target.checked)} className="accent-[hsl(var(--primary))]" />
            Auto-renew: start the next {form.period === "weekly" ? "week's" : "day's"} giveaway automatically after the draw
          </label>

          <Button type="submit" disabled={saving || !!uploading} className="w-full font-orbitron text-xs tracking-wider">
            {saving ? "Creating..." : "Create giveaway"}
          </Button>
        </form>
      )}

      <div className="space-y-4">
        {data.needsDraw?.length > 0 && (
          <div>
            <h3 className="text-[10px] uppercase tracking-wider text-amber-400 mb-1.5">Ended: ready to draw</h3>
            <div className="bg-card border border-border/50 rounded-xl divide-y divide-border/40">
              {data.needsDraw.map((g) => (
                <Row key={g.id} g={g}>
                  <Button size="sm" disabled={busyId === g.id} onClick={() => draw(g)} className="h-7 text-xs">
                    <Trophy className="w-3.5 h-3.5 mr-1" /> Draw winner
                  </Button>
                </Row>
              ))}
            </div>
          </div>
        )}

        {data.open?.length > 0 && (
          <div>
            <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Open now</h3>
            <div className="bg-card border border-border/50 rounded-xl divide-y divide-border/40">
              {data.open.map((g) => (
                <Row key={g.id} g={g}>
                  <Button size="sm" variant="outline" disabled={busyId === g.id} onClick={() => endNow(g)} className="h-7 text-xs" title="End now">
                    <Square className="w-3 h-3 mr-1" /> End
                  </Button>
                  <Button size="sm" variant="outline" disabled={busyId === g.id} onClick={() => cancel(g)} className="h-7 text-xs text-destructive" title="Cancel">
                    <Ban className="w-3 h-3" />
                  </Button>
                </Row>
              ))}
            </div>
          </div>
        )}

        {data.upcoming?.length > 0 && (
          <div>
            <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Scheduled</h3>
            <div className="bg-card border border-border/50 rounded-xl divide-y divide-border/40">
              {data.upcoming.map((g) => (
                <Row key={g.id} g={g}>
                  <Button size="sm" variant="outline" disabled={busyId === g.id} onClick={() => cancel(g)} className="h-7 text-xs text-destructive" title="Cancel">
                    <Ban className="w-3 h-3" />
                  </Button>
                </Row>
              ))}
            </div>
          </div>
        )}

        {data.recentWinners?.length > 0 && (
          <div>
            <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Drawn</h3>
            <div className="bg-card border border-border/50 rounded-xl divide-y divide-border/40">
              {data.recentWinners.map((g) => (
                <Row key={g.id} g={g}>
                  {g.winner_email && (
                    <Button size="sm" variant="outline" disabled={busyId === g.id} onClick={() => draw(g, { redraw: true })} className="h-7 text-xs" title="Winner didn't claim? Pick someone else">
                      <RotateCcw className="w-3 h-3 mr-1" /> Re-draw
                    </Button>
                  )}
                </Row>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
