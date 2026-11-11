import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Enters the member into a giveaway after they've watched the sponsor video.
// Checks (server side): giveaway is open, member hasn't entered yet, and enough
// real time has passed since they started the video. One entry per member per giveaway.

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { giveawayId?: string; watchId?: string; watchedSeconds?: number } = {};
  try { body = await req.json(); } catch { /* empty */ }
  if (!body.giveawayId || !body.watchId) {
    return Response.json({ error: 'Please watch the video first.' }, { status: 400 });
  }

  try {
    const sr = base44.asServiceRole.entities;
    const g = await sr.Giveaway.get(body.giveawayId).catch(() => null);
    const now = Date.now();
    if (!g || g.status !== 'active' || Date.parse(g.starts_at) > now || Date.parse(g.ends_at) <= now) {
      return Response.json({ error: 'This giveaway is closed.' }, { status: 400 });
    }

    const already = await sr.GiveawayEntry.filter({ giveaway_id: g.id, user_email: user.email });
    if (already?.length) return Response.json({ ok: true, alreadyEntered: true, entryCount: g.entry_count || 0 });

    const watch = await sr.GiveawayWatch.get(body.watchId).catch(() => null);
    if (!watch || watch.user_email !== user.email || watch.giveaway_id !== g.id) {
      return Response.json({ error: 'Please watch the video first.' }, { status: 400 });
    }

    const required = Math.max(Number(g.min_watch_seconds) || 30, 5);
    const elapsed = (now - Date.parse(watch.started_at)) / 1000;
    // Allow a little slack for network delay
    if (elapsed < required - 2) {
      const left = Math.ceil(required - elapsed);
      return Response.json({ error: `Keep watching — about ${left}s to go.` }, { status: 400 });
    }

    await sr.GiveawayEntry.create({
      giveaway_id: g.id,
      user_email: user.email,
      user_name: user.full_name || user.email.split('@')[0],
      watched_seconds: Math.round(Number(body.watchedSeconds) || elapsed),
    });
    await sr.GiveawayWatch.update(watch.id, { completed: true }).catch(() => {});

    // Recount rather than increment, so simultaneous entries can't skew the number
    const entries = await sr.GiveawayEntry.filter({ giveaway_id: g.id }, '-created_date', 10000);
    const entryCount = entries?.length || 0;
    await sr.Giveaway.update(g.id, { entry_count: entryCount }).catch(() => {});

    return Response.json({ ok: true, entryCount });
  } catch (err) {
    console.error('enterGiveaway failed', err);
    return Response.json({ error: 'Could not enter the giveaway. Please try again.' }, { status: 500 });
  }
});
