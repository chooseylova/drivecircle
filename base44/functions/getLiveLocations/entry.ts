import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Returns the members the signed-in viewer is allowed to see on the Live Map:
//  - only members who switched sharing ON, updated in the last 10 minutes, and not expired
//  - visibility "everyone"  -> any signed-in member can see them
//  - visibility "followers" -> only members who follow them can see them
//  - precision "approximate" -> position rounded to ~1 km, no speed/heading
// Signed-out visitors get nothing.

const STALE_MS = 10 * 60 * 1000;

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const sr = base44.asServiceRole.entities;
    const [all, iFollow] = await Promise.all([
      sr.LiveLocation.filter({ sharing: true }, '-updated_at', 1000),
      sr.UserFollow.filter({ follower_email: user.email }, '-created_date', 5000),
    ]);
    const following = new Set((iFollow || []).map((f: any) => f.following_email));
    const now = Date.now();

    let me = null;
    const drivers = [];
    for (const loc of all || []) {
      const fresh = now - (Date.parse(loc.updated_at) || 0) < STALE_MS;
      const notExpired = !loc.expires_at || Date.parse(loc.expires_at) > now;
      if (loc.user_email === user.email) {
        me = { sharing: loc.sharing && notExpired, visibility: loc.visibility, precision: loc.precision, expires_at: loc.expires_at, updated_at: loc.updated_at };
        continue;
      }
      if (!fresh || !notExpired || !Number.isFinite(loc.latitude) || !Number.isFinite(loc.longitude)) continue;
      const allowed = loc.visibility === 'everyone' || following.has(loc.user_email);
      if (!allowed) continue;

      const approx = loc.precision === 'approximate';
      drivers.push({
        id: loc.id,
        user_email: loc.user_email,
        user_name: loc.user_name,
        avatar_url: loc.avatar_url || '',
        latitude: approx ? Math.round(loc.latitude * 100) / 100 : loc.latitude,
        longitude: approx ? Math.round(loc.longitude * 100) / 100 : loc.longitude,
        approximate: approx,
        accuracy: approx ? 1000 : loc.accuracy,
        heading: approx ? null : loc.heading,
        speed: approx ? null : loc.speed,
        car_label: loc.car_label || '',
        car_id: loc.car_id || '',
        status_note: loc.status_note || '',
        updated_at: loc.updated_at,
        is_following: following.has(loc.user_email),
      });
    }

    return Response.json({ me, drivers });
  } catch (err) {
    console.error('getLiveLocations failed', err);
    return Response.json({ error: 'Could not load the live map' }, { status: 500 });
  }
});
