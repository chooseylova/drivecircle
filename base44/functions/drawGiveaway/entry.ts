import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Picks a random winner for a giveaway and emails them.
//
// Two ways to call it:
//  1. An admin clicks "Draw winner" in the app:   { giveawayId, redraw? }
//  2. A scheduled automation (e.g. every hour):  { runAll: true, secret: <GIVEAWAY_CRON_SECRET> }
//     -> draws every giveaway that has ended, and creates the next day's/week's
//        giveaway for ones marked auto_renew.

const PERIOD_MS: Record<string, number> = { daily: 86400000, weekly: 7 * 86400000 };

function randomIndex(n: number) {
  // Cryptographically random, unbiased pick
  const max = Math.floor(0xffffffff / n) * n;
  const buf = new Uint32Array(1);
  do { crypto.getRandomValues(buf); } while (buf[0] >= max);
  return buf[0] % n;
}

async function drawOne(base44: any, g: any, opts: { redraw?: boolean } = {}) {
  const sr = base44.asServiceRole.entities;
  const excluded = new Set<string>(g.previous_winner_emails || []);
  if (opts.redraw && g.winner_email) excluded.add(g.winner_email);

  const entries = ((await sr.GiveawayEntry.filter({ giveaway_id: g.id }, 'created_date', 10000)) || [])
    // one entry per person, even if a duplicate slipped in
    .filter((e: any, i: number, arr: any[]) => arr.findIndex((x) => x.user_email === e.user_email) === i)
    .filter((e: any) => !excluded.has(e.user_email));

  if (!entries.length) {
    await sr.Giveaway.update(g.id, { status: 'drawn', drawn_at: new Date().toISOString(), entry_count: 0, winner_email: '', winner_name: '' });
    return { giveawayId: g.id, winner: null, entries: 0 };
  }

  const winner = entries[randomIndex(entries.length)];
  await sr.Giveaway.update(g.id, {
    status: 'drawn',
    winner_email: winner.user_email,
    winner_name: winner.user_name || '',
    drawn_at: new Date().toISOString(),
    previous_winner_emails: [...excluded],
  });

  try {
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: winner.user_email,
      subject: `🏆 You won the DriveCircle ${g.period} giveaway!`,
      body:
        `Hi ${winner.user_name || 'there'},\n\n` +
        `Congratulations — you were randomly selected as the winner of "${g.title}"!\n\n` +
        `Prize: ${g.prize}\n\n` +
        `Reply to this email within 7 days to claim your prize. ` +
        `If we don't hear back, a new winner may be drawn.\n\n` +
        `Thanks for being part of DriveCircle!\n— The DriveCircle team`,
    });
  } catch (err) {
    console.error('Winner email failed', err);
  }

  return { giveawayId: g.id, winner: { email: winner.user_email, name: winner.user_name }, entries: entries.length };
}

async function renew(base44: any, g: any) {
  if (!g.auto_renew) return null;
  const sr = base44.asServiceRole.entities;
  const len = PERIOD_MS[g.period] || PERIOD_MS.daily;
  let start = Date.parse(g.ends_at);
  // If the cycle fell behind, jump forward to the current period
  while (start + len <= Date.now()) start += len;
  const startIso = new Date(start).toISOString();
  // Don't create a duplicate if one already exists for that slot
  const same = await sr.Giveaway.filter({ title: g.title, starts_at: startIso });
  if (same?.length) return null;
  return sr.Giveaway.create({
    title: g.title, description: g.description, prize: g.prize, prize_value: g.prize_value,
    image_url: g.image_url, period: g.period, video_url: g.video_url,
    min_watch_seconds: g.min_watch_seconds, sponsor_name: g.sponsor_name, sponsor_url: g.sponsor_url,
    rules: g.rules, auto_renew: true, status: 'active', entry_count: 0,
    starts_at: startIso, ends_at: new Date(start + len).toISOString(),
  });
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  let body: { giveawayId?: string; redraw?: boolean; runAll?: boolean; secret?: string; force?: boolean } = {};
  try { body = await req.json(); } catch { /* empty */ }

  const user = await base44.auth.me().catch(() => null);
  const cronSecret = Deno.env.get('GIVEAWAY_CRON_SECRET');
  const isAdmin = user?.role === 'admin';
  const isCron = !!cronSecret && body.secret === cronSecret;
  if (!isAdmin && !isCron) return Response.json({ error: 'Admins only' }, { status: 403 });

  try {
    const sr = base44.asServiceRole.entities;

    if (body.runAll) {
      const all = (await sr.Giveaway.filter({ status: 'active' }, 'ends_at', 200)) || [];
      const ended = all.filter((g: any) => Date.parse(g.ends_at) <= Date.now());
      const results = [];
      for (const g of ended) {
        results.push(await drawOne(base44, g));
        await renew(base44, g);
      }
      return Response.json({ ok: true, drawn: results });
    }

    if (!body.giveawayId) return Response.json({ error: 'giveawayId is required' }, { status: 400 });
    const g = await sr.Giveaway.get(body.giveawayId).catch(() => null);
    if (!g) return Response.json({ error: 'Giveaway not found' }, { status: 404 });
    if (g.status === 'cancelled') return Response.json({ error: 'This giveaway was cancelled' }, { status: 400 });
    if (g.status === 'drawn' && !body.redraw) return Response.json({ error: 'A winner was already drawn. Use re-draw.' }, { status: 400 });
    if (Date.parse(g.ends_at) > Date.now() && !body.force) {
      return Response.json({ error: 'This giveaway is still open. End it first or wait until it closes.' }, { status: 400 });
    }

    const result = await drawOne(base44, g, { redraw: !!body.redraw });
    if (!body.redraw) await renew(base44, g);
    return Response.json({ ok: true, ...result });
  } catch (err) {
    console.error('drawGiveaway failed', err);
    return Response.json({ error: 'Could not draw a winner. Please try again.' }, { status: 500 });
  }
});
