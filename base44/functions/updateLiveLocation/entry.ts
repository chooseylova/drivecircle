import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Saves (or stops) the signed-in member's live location.
// Only the member themself can write their own record (keyed by their account email).
// LiveLocation should be locked to admins in the dashboard so all reads go through getLiveLocations.

const num = (v: unknown, min: number, max: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* empty */ }

  try {
    const sr = base44.asServiceRole.entities;
    const existing = (await sr.LiveLocation.filter({ user_email: user.email }, '-updated_date', 5)) || [];
    const record = existing[0];
    // Clean up accidental duplicates
    for (const extra of existing.slice(1)) await sr.LiveLocation.delete(extra.id).catch(() => {});

    const nowIso = new Date().toISOString();

    // Stop sharing: wipe the coordinates, not just hide them
    if (body.sharing === false) {
      if (record) {
        await sr.LiveLocation.update(record.id, {
          sharing: false, latitude: null, longitude: null, accuracy: null, heading: null, speed: null, updated_at: nowIso,
        });
      }
      return Response.json({ ok: true, sharing: false });
    }

    const latitude = num(body.latitude, -90, 90);
    const longitude = num(body.longitude, -180, 180);
    if (latitude === null || longitude === null) {
      return Response.json({ error: 'A valid location is required' }, { status: 400 });
    }

    // Expiry: minutes from now (max 12h). 0/absent = until stopped, but we still cap at 12h for safety.
    const minutes = num(body.durationMinutes, 1, 720) ?? 720;
    const expiresAt = new Date(Date.now() + minutes * 60000).toISOString();

    const data = {
      user_email: user.email,
      user_name: user.full_name || user.email.split('@')[0],
      avatar_url: user.avatar_url || '',
      sharing: true,
      visibility: body.visibility === 'everyone' ? 'everyone' : 'followers',
      precision: body.precision === 'approximate' ? 'approximate' : 'exact',
      latitude,
      longitude,
      accuracy: num(body.accuracy, 0, 100000),
      heading: num(body.heading, 0, 360),
      speed: num(body.speed, 0, 150),
      car_id: typeof body.carId === 'string' ? body.carId.slice(0, 64) : '',
      car_label: typeof body.carLabel === 'string' ? body.carLabel.slice(0, 80) : '',
      status_note: typeof body.statusNote === 'string' ? body.statusNote.slice(0, 80) : '',
      updated_at: nowIso,
      // keep the original expiry unless the member restarted/changed sharing
      expires_at: body.restart || !record?.expires_at || !record.sharing ? expiresAt : record.expires_at,
    };

    if (record) await sr.LiveLocation.update(record.id, data);
    else await sr.LiveLocation.create(data);

    return Response.json({ ok: true, sharing: true, expiresAt: data.expires_at });
  } catch (err) {
    console.error('updateLiveLocation failed', err);
    return Response.json({ error: 'Could not update your location' }, { status: 500 });
  }
});
