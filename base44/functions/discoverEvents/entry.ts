import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const VALID_TYPES = ['car_meet', 'car_show', 'cruise', 'drag_race', 'drift_event', 'auction', 'swap_meet', 'other'];
const TYPE_WORDS: Record<string, string> = {
  car_meet: 'car meets / Cars and Coffee',
  car_show: 'car shows',
  cruise: 'cruises / cruise-ins',
  drag_race: 'drag racing / test-and-tune nights',
  drift_event: 'drift events',
  auction: 'car auctions',
  swap_meet: 'swap meets / parts swaps',
  other: 'other automotive events (track days, autocross, rallies)',
};

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  let body: {
    location?: string; radius?: number; keywords?: string; eventTypes?: string[];
    startDate?: string; endDate?: string; latitude?: number; longitude?: number;
  } = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const location = String(body.location || '').trim().slice(0, 120);
  if (!location) return Response.json({ error: 'Location is required' }, { status: 400 });
  const radius = Math.min(Math.max(Number(body.radius) || 50, 5), 300);
  const keywords = String(body.keywords || '').trim().slice(0, 120);
  const types = (Array.isArray(body.eventTypes) ? body.eventTypes : []).filter((t) => VALID_TYPES.includes(t));

  const today = new Date();
  const start = body.startDate && !isNaN(Date.parse(body.startDate)) ? new Date(body.startDate) : today;
  const maxEnd = new Date(today.getTime() + 180 * 86400000);
  let end = body.endDate && !isNaN(Date.parse(body.endDate)) ? new Date(body.endDate) : new Date(today.getTime() + 30 * 86400000);
  if (end > maxEnd) end = maxEnd;

  const coordsHint = Number.isFinite(Number(body.latitude)) && Number.isFinite(Number(body.longitude))
    ? ` (approximately ${Number(body.latitude).toFixed(3)}, ${Number(body.longitude).toFixed(3)})`
    : '';
  const typeClause = types.length
    ? ` Only include these kinds of events: ${types.map((t) => TYPE_WORDS[t]).join('; ')}.`
    : ' Include car meets, Cars and Coffee, car shows, cruise-ins, drag/test-and-tune nights, drift events, autocross, track days, auctions and swap meets.';
  const keywordsClause = keywords ? ` Prioritize events matching these keywords: "${keywords}".` : '';

  const prompt = `Today's date is ${isoDay(today)}.
Search the web for REAL automotive events happening between ${isoDay(start)} and ${isoDay(end)} within ${radius} miles of "${location}"${coordsHint}.${typeClause}${keywordsClause}
Check Facebook Events, Eventbrite, AllEvents, carsandcoffeeevents.com, CarShowFinder, MotorsportReg, local car club and track websites, and local news calendars.
Recurring events (e.g. a monthly Cars and Coffee) count — list the next occurrence inside the date range.
Rules:
- Only include events whose date and venue you actually found on a web page. Never invent events, dates, or links.
- date: full ISO 8601 date-time with the local timezone offset (e.g. 2026-11-21T08:00:00-06:00). If no time is listed, use 09:00 local.
- latitude/longitude: coordinates of the venue itself.
- location_name: venue name plus street address and city.
- external_url: the page where you found the event.
- event_type: one of ${VALID_TYPES.join(', ')}.
- description: 1-2 sentences.
Return up to 15 events, soonest first.`;

  let result;
  try {
    result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: true,
      model: "gemini_3_flash",
      response_json_schema: {
        type: "object",
        properties: {
          events: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                description: { type: "string" },
                date: { type: "string" },
                location_name: { type: "string" },
                latitude: { type: "number" },
                longitude: { type: "number" },
                event_type: { type: "string" },
                external_url: { type: "string" },
                organizer_name: { type: "string" }
              },
              required: ["title", "date", "location_name", "latitude", "longitude"]
            }
          }
        }
      }
    });
  } catch (err) {
    console.error('discoverEvents LLM call failed', err);
    return Response.json({ error: 'Event search is temporarily unavailable. Please try again.' }, { status: 502 });
  }

  // Server-side cleanup: valid dates inside the window, valid coordinates, no duplicates
  const startMs = start.getTime() - 86400000;
  const endMs = end.getTime() + 86400000;
  const seen = new Set<string>();
  const events = (Array.isArray(result?.events) ? result.events : [])
    .filter((e: any) => {
      const t = Date.parse(e?.date);
      const lat = Number(e?.latitude);
      const lng = Number(e?.longitude);
      if (!e?.title || isNaN(t) || t < startMs || t > endMs) return false;
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return false;
      const key = String(e.title).toLowerCase().replace(/[^a-z0-9]/g, '') + new Date(t).toDateString();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a: any, b: any) => Date.parse(a.date) - Date.parse(b.date))
    .slice(0, 15);

  return Response.json({ events });
});
