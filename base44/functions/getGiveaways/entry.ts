import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Lists giveaways for the current member: what's open now, whether they've entered,
// recent winners, and (for admins) giveaways that need a winner drawn.
// Entries are read with the service role so members never see each other's entries.

const publicName = (name: string, email: string) => {
  const base = (name || email.split('@')[0] || 'Member').trim();
  const parts = base.split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0];
};

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const isAdmin = user.role === 'admin';

  try {
    const sr = base44.asServiceRole.entities;
    const all = (await sr.Giveaway.list('-ends_at', 300)) || [];
    const now = Date.now();
    const t = (s: string) => Date.parse(s) || 0;

    const open = all.filter((g: any) => g.status === 'active' && t(g.starts_at) <= now && t(g.ends_at) > now);
    const upcoming = all.filter((g: any) => g.status === 'active' && t(g.starts_at) > now);
    const needsDraw = all.filter((g: any) => g.status === 'active' && t(g.ends_at) <= now);
    const drawn = all.filter((g: any) => g.status === 'drawn').sort((a: any, b: any) => t(b.drawn_at) - t(a.drawn_at));

    // Which open giveaways has this member entered?
    const myEntries = (await sr.GiveawayEntry.filter({ user_email: user.email }, '-created_date', 500)) || [];
    const enteredIds = new Set(myEntries.map((e: any) => e.giveaway_id));

    const shape = (g: any) => ({
      id: g.id,
      title: g.title,
      description: g.description || '',
      prize: g.prize,
      prize_value: g.prize_value || null,
      image_url: g.image_url || '',
      period: g.period,
      video_url: g.video_url,
      min_watch_seconds: g.min_watch_seconds || 30,
      sponsor_name: g.sponsor_name || '',
      sponsor_url: g.sponsor_url || '',
      starts_at: g.starts_at,
      ends_at: g.ends_at,
      status: g.status,
      auto_renew: !!g.auto_renew,
      rules: g.rules || '',
      entry_count: g.entry_count || 0,
      entered: enteredIds.has(g.id),
      winner_display: g.winner_email ? publicName(g.winner_name, g.winner_email) : null,
      drawn_at: g.drawn_at || null,
      // Only admins see who won by email
      ...(isAdmin ? { winner_email: g.winner_email || null } : {}),
    });

    return Response.json({
      isAdmin,
      open: open.sort((a: any, b: any) => t(a.ends_at) - t(b.ends_at)).map(shape),
      recentWinners: drawn.slice(0, 12).map(shape),
      myWins: drawn.filter((g: any) => g.winner_email === user.email).slice(0, 10).map(shape),
      ...(isAdmin
        ? {
            upcoming: upcoming.sort((a: any, b: any) => t(a.starts_at) - t(b.starts_at)).map(shape),
            needsDraw: needsDraw.map(shape),
          }
        : {}),
    });
  } catch (err) {
    console.error('getGiveaways failed', err);
    return Response.json({ error: 'Could not load giveaways' }, { status: 500 });
  }
});
