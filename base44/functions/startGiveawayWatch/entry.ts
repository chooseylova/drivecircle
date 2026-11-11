import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Called when a member presses play on a giveaway video.
// Records the SERVER time they started, so enterGiveaway can verify
// enough real time has passed to have watched the video.

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { giveawayId?: string } = {};
  try { body = await req.json(); } catch { /* empty */ }
  if (!body.giveawayId) return Response.json({ error: 'giveawayId is required' }, { status: 400 });

  try {
    const sr = base44.asServiceRole.entities;
    const g = await sr.Giveaway.get(body.giveawayId).catch(() => null);
    const now = Date.now();
    if (!g || g.status !== 'active' || Date.parse(g.starts_at) > now || Date.parse(g.ends_at) <= now) {
      return Response.json({ error: 'This giveaway is not open right now.' }, { status: 400 });
    }

    const already = await sr.GiveawayEntry.filter({ giveaway_id: g.id, user_email: user.email });
    if (already?.length) return Response.json({ alreadyEntered: true });

    // Reuse an existing watch session for this giveaway if there is one
    const existing = await sr.GiveawayWatch.filter({ giveaway_id: g.id, user_email: user.email }, '-created_date', 1);
    if (existing?.length && !existing[0].completed) {
      return Response.json({ watchId: existing[0].id, startedAt: existing[0].started_at, minWatchSeconds: g.min_watch_seconds || 30 });
    }

    const watch = await sr.GiveawayWatch.create({
      giveaway_id: g.id,
      user_email: user.email,
      started_at: new Date(now).toISOString(),
      completed: false,
    });
    return Response.json({ watchId: watch.id, startedAt: watch.started_at, minWatchSeconds: g.min_watch_seconds || 30 });
  } catch (err) {
    console.error('startGiveawayWatch failed', err);
    return Response.json({ error: 'Could not start the video. Please try again.' }, { status: 500 });
  }
});
