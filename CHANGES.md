# DriveCircle — new features (round 2)

## ⚙️ Setup checklist (do this in the Base44 dashboard after syncing)
1. **Entity permissions:** these new entities must be readable and writable **only by admins**. The app reads and writes them through backend functions that enforce the rules:
   - `LiveLocation`: otherwise anyone could read everyone's location straight from the API.
   - `GiveawayEntry` and `GiveawayWatch`: otherwise people could create fake entries.
   - `Giveaway`: **read** for all users, **create/update/delete** for admins only.
2. **Admins:** set `role = admin` on your account (Users screen). The giveaway admin panel only appears for admins.
3. **Google Maps:** set the `GOOGLE_MAPS_API_KEY` secret (Maps JavaScript API enabled, billing on). Without it, every map automatically uses the free OpenStreetMap version.
4. **Automatic daily/weekly draws (optional but recommended):**
   - Set a secret named `GIVEAWAY_CRON_SECRET` to any long random string.
   - Create a scheduled automation that runs the `drawGiveaway` function **every hour** with the body `{ "runAll": true, "secret": "<same string>" }`.
   - Each run draws winners for giveaways that have ended, emails them, and starts the next day's or week's giveaway for any marked *Auto-renew*. Without it, an admin clicks **Draw winner** on the Giveaways page.
5. **Legal:** the built-in Official Rules cover the usual basics: no purchase necessary, 18+, US only, one entry per person, random draw, and a 7-day claim window. Have someone qualified review them before running prizes. A few states (e.g. NY and FL) require registration for prizes over $5,000.

## 1. Better event search (Events page)
- **Search box:** matches title, description, venue, organizer and event type. Every word must match, so "drift baton rouge" works.
- **Near me / City or ZIP:** distance radius (10–250 mi), and every card shows its distance.
- **When:** today, this weekend, the next 7 or 30 days, this month.
- **Type chips:** car meet, show, cruise, drag, drift, auction, swap meet.
- **Sort:** soonest, nearest or most going.
- Filters are remembered for the session. On phones they fold behind a filter button that shows a count.
- The map view shows exactly the filtered results.
- Past events are collapsed behind "Show past events".
- When nothing matches, the page offers to clear filters, search the web, or create an event.

**"Find on web" (AI web search) was rebuilt:**
- "Use my location" button, a date range (7 days to 3 months) and type filters.
- The server tells the AI today's date and the exact date window, and requires real source links.
- Results are validated (date, coordinates) and de-duplicated on both server and client, sorted by date, and dropped if far outside the radius. Each shows its distance.
- Events already on DriveCircle are marked **"On app"** instead of being added twice. **"Add all"** imports the rest in one click.

## 2. Giveaways (`/giveaways`)
- **Daily and weekly** giveaways, each with a prize, an optional image, a sponsor name and link, and a live countdown.
- **Watch to enter:** members watch the sponsor video (YouTube link or uploaded MP4) before **Enter** unlocks.
  - Skipping or seeking ahead doesn't count, and MP4 playback can't be sped up.
  - The server records when the video started and refuses entries before the required watch time has really passed.
  - One entry per person per giveaway.
- **Winners:** cryptographically random draw, and the winner is emailed automatically. The public "Recent winners" list shows first name + last initial only. Winners see a "You won!" banner.
- **Admin panel** (admins only, on the same page):
  - Create a giveaway. Daily or weekly sets the time window automatically.
  - Upload the video or paste a YouTube link, and set the required watch seconds.
  - Turn on *Auto-renew*.
  - End early, cancel, draw a winner, or **re-draw** if the winner doesn't claim (the previous winner is excluded).
- **Official rules** dialog on every giveaway.
- New entities: `Giveaway`, `GiveawayEntry`, `GiveawayWatch`.
- New functions: `getGiveaways`, `startGiveawayWatch`, `enterGiveaway`, `drawGiveaway`.

*Ads:* this uses sponsor videos that you upload or link, so you can sell sponsor slots directly. Plugging in a paid video-ad network (e.g. Google IMA/AdSense video) needs an approved ad account. It can replace the video player later without changing the entry and draw system.

## 3. Live Map (`/live`)
- Members tap **Go live** to share their location in real time, and **Stop sharing** to wipe it from the server.
- **Opt-in only.** Nothing is sent until a member turns it on. Signed-out visitors can never see anything (every request checks the login).
- **Who can see me:** *My followers* (default) or *All members*. Enforced on the server, not just hidden in the app.
- **Location detail:** *Exact* or *Approximate* (rounded to about 1 km, with no speed or heading).
- **Auto-off** after 1, 4 or 12 hours (the server caps it at 12 hours too). Members who stop updating disappear after 10 minutes.
- **Optional extras:**
  - Show which car from your garage you're driving.
  - A short status, e.g. "Heading to Cars & Coffee".
  - "Keep screen on" for more reliable updates on phones.
- Sharing keeps running while you browse other pages. A pulsing **LIVE** pill in the header shows it's on, with a one-tap Stop. Sharing resumes after a page reload until its time is up, and logging out stops it.
- **The map:** Google Maps with name markers, falling back to OpenStreetMap with avatar markers when there's no key. It refreshes every 15 seconds. Tapping a driver opens Profile, Message or Google Maps directions to them. There's a "Live now" list sorted by distance, plus "Center on me".
- New entity: `LiveLocation`. New functions: `updateLiveLocation`, `getLiveLocations`.
- *Why not "Google Maps location sharing"?* Google doesn't offer any way for other apps to read or show people's Google location sharing. This is DriveCircle's own sharing, displayed on Google Maps.
- *Limitation:* this is a web app, so phones pause GPS updates when the browser is in the background or the screen locks. Sharing that keeps going in the background would need a native app wrapper (e.g. Capacitor).

## Other changes this round
- The nav was reorganized for the 10 sections. On desktop it shows Feed, Events, Live Map, Giveaways, Market and Messages, plus a **More** menu. Phones show Feed, Events, Live and Chat, plus **More**.
- `src/lib/googleMaps.jsx` is a shared Google Maps loader for every map, with automatic fallback (including when Google rejects the key).
- Fixed: on the Events map, opening a marker's info window snapped the map back to its starting position.

---

# DriveCircle — round 1: bug fixes & polish

All changes compile cleanly (every file was bundle-checked with esbuild and linted for undefined references). The code hasn't been run against the live Base44 backend yet, so give each area a quick click-through after you deploy.

## Bugs that broke things outright

| Area | Problem | Fix |
|---|---|---|
| **Whole app** | No toast messages ever appeared ("Posted!", "Car added", every error). Every page calls `toast` from **sonner**, but only the unrelated Radix `<Toaster/>` was mounted. | Mounted sonner's `<Toaster/>` in `App.jsx`. |
| **Whole app** | `index.html` had `<title>Drive Circle</title>Base44 APP</title>`. The stray text could show up on the page, and the tab icon was the Base44 logo. | Fixed the title and used the DriveCircle logo as the favicon. |
| **Home → Discover tab** | Data was loaded by calling `setState` *during render*, which triggers React warnings and can double-fetch. The feed was also loaded twice on every visit. | Moved loading into a `useEffect` and removed the duplicate `loadFeed()`. |
| **Events** | Dates from `datetime-local` were saved without a timezone, so times could show shifted by hours for other users. | Dates are now saved as real ISO timestamps. Past dates can't be picked. |
| **Events / Discover** | One AI-found event with a malformed date crashed the whole modal or page (`format(new Date(bad))` throws). | Added `safeFormat()` everywhere. Discover results are validated (date, lat/lng, type, URL) before they're shown or saved. |
| **Messages → New Message** | Used `User.list()`, which is admin-only, so regular members saw "No users found." | Now uses the existing `getUsers` backend function. |
| **Events → Map view** | Without a Google Maps key (or if Google failed to load), the map spun forever. | Falls back to the free OpenStreetMap/Leaflet map (`EventMapView`, which existed but was never used). |
| **Everywhere** | No error handling. Any failed request left spinners running and "Saving…" buttons stuck forever. | Wrapped every save, load and upload in try/catch with a friendly error toast (`showError` helper). Text in a failed chat message is restored so it isn't lost. |
| **News tab** | Images came from `source.unsplash.com`, which Unsplash shut down, so every card fell back to the same photo. The slow AI lookup re-ran on every tab switch and spun forever if it failed. | Each category now gets its own banner graphic. Results are cached for an hour. Added an error/retry state, and dead article links fall back to a news search. |

## Data & logic bugs
- **Likes, dislikes, comments, RSVPs and car likes overwrote each other.** These are arrays stored on the record, so when two people acted at about the same time, one person's change was lost. The code now re-reads the latest record before every change.
- **Anyone could edit anyone's car** by visiting `/edit-car/<id>`. That page now redirects non-owners.
- **Share buttons on posts copied the home page URL.** Added a real `/post/:postId` page, and Share links to it (on phones it uses the native share sheet).
- **Notifications** linked likes and comments to `/`, showed raw emails for likers, and read a `follower_name` field that was never saved. They now link to the post, show names, and `FollowButton` saves `follower_name` (also added to the `UserFollow` schema).
- **Upcoming events** showed the furthest-away event first. They're now sorted soonest-first, past events newest-first, and an event counts as upcoming until 6 hours after it starts.
- **Editing a car couldn't clear year or horsepower** (`undefined` is ignored on update, so it now sends `null`). A horsepower of `0` also rendered a stray "0".
- **`User` schema required `avatar_url`**, which new users don't have. That could make profile updates fail validation, so the requirement was removed.
- **`getUsers` sent every user's full record** (role and so on) to every browser. It now returns only id, email, name and avatar.
- **`discoverEvents` function** now validates its input, tells the AI today's date (so it stops returning past events), and returns a clean error if the AI call fails.
- **Messages** only looked at the 50 newest conversations site-wide, so users could "lose" chats as the app grew. That limit is now 500. Also: no more self-messaging, duplicate chats are avoided, `?to=` is cleared after use, and the chat list updates when new messages arrive.
- **Marketplace "Contact"** always made a `mailto:` link, even for phone numbers. It now makes `mailto:` or `tel:` as appropriate. Listings require a location (the form already marked it as required), prices are validated, and vehicle-only fields are only sent for vehicles.
- **CarCard** had a `<Link>` inside a `<Link>`, which is invalid HTML and triggers React warnings.
- **Leaflet maps scrolled over the sticky header and bottom nav.** Maps now get their own stacking context.

## Mobile / UX polish
- The bottom nav had 8 items that overflowed narrow phones. They now share the width evenly, with shorter labels ("Top", "Chat") and iPhone safe-area padding. The desktop nav shows icons only on mid-size screens.
- The nav highlights the right section on sub-pages, e.g. "Events" on `/event/123`. Pages scroll to the top on navigation.
- Hover-only buttons (garage edit/delete, photo remove) are now always visible on touch screens.
- Messages on a phone: the chat list opens full width instead of squeezing the chat.
- **Create Event:** type an address and hit **Find** (or tap 📍 for your location) to drop the pin, instead of hunting on a zoomed-out US map.
- **Event page:** added Directions, Share, and Delete (organizer only). The RSVP button is hidden for past events.
- **Post owners** can delete their posts. Comment authors and post owners can delete comments, and comments show timestamps.
- **Marketplace:** sellers can delete listings, "Sold" asks for confirmation, and vehicle year, make and mileage are shown.
- **Profiles:**
  - Profile pages show followers, the user's avatar and their posts.
  - "Edit your profile" and "View public profile" links were added.
  - The profile-picture upload is tappable on phones.
  - Logout asks for confirmation.
- **Cars:**
  - Car photos can be reordered with "Set cover".
  - The car page has an Edit button for the owner, and Back goes back instead of always going to the home page.
- The 404 page now matches the dark theme.
- The YouTube player also accepts `/shorts/` and `/live/` links.

## New files
- `src/lib/helpers.js`: shared helpers for safe date formatting, error toasts, uploads, clipboard/share and geocoding.
- `src/pages/PostPage.jsx`: single-post page (`/post/:postId`).

## Worth checking in the Base44 dashboard (not fixable from code)
- **Entity permissions / row-level security:** Likes and comments work by updating the post itself, so other users must be able to update `Post`, `CarEvent` and `CarProfile`. That also means a determined user could edit someone else's content through the API. For real protection, move likes, comments and RSVPs into their own entities (e.g. `PostLike`, `Comment`, `EventRsvp`) and lock the parent records to their owners.
- **`GOOGLE_MAPS_API_KEY` secret:** if it isn't set, the Events map now uses OpenStreetMap automatically.
- **Name changes:** posts store the author's name when they're created, so changing your display name doesn't update older posts.
