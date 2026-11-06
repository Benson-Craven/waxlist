# USER_REQUIREMENTS.md

# WAXLIST Vinyl Collection Workspace — User Requirements

## 1. Product Summary

Build WAXLIST as a Spotify-first, invite-only vinyl collection workspace with
ListenBrainz as an alternative and individual YouTube links as a beta source.
All sources normalize album evidence, resolve physical catalogue identities,
and surface albums missing from WAXLIST-native collection state.

The product should help users answer:

> "Which records should I buy, do I already own this, where is it on my shelf, and what should I watch for next?"

Primary product/display name:

- `WAXLIST`

Former/alternate brainstorm names, now deprecated unless the user reopens naming:

- Crateify
- VinylMatch
- Spinlist
- Wax Radar

Use `WAXLIST` for the UI, documentation, and product identity.

## 1.1 Disabled-by-default Pressing-Proof Wedge

The 2026-07-30 implementation adds an invite-beta vertical slice around:

> Prove the pressing—do not guess.

This wedge targets growing collectors who need guided help distinguishing
versions. It does not supersede the current Spotify-first landing hierarchy
until moderated validation succeeds. `WAXLIST_ENABLE_PRESSING_PROOF` must
default to `false`.

The shared public `/identify` and authenticated Digging surface must:

1. Start with camera barcode capture or manual artist, title, barcode,
   catalogue number, or Discogs release ID.
2. Treat barcode as release-family discovery, never proof by itself.
3. Ask one useful discriminator at a time in collector-effort order.
4. Return only `exact`, `shortlist`, or `unknown`.
5. Show matched, conflicting, and unavailable evidence without probability
   percentages.
6. Never eliminate a candidate only because Discogs metadata is missing.
7. Never return `exact` from truncated, failed, or partially loaded candidate
   comparisons.
8. Allow one anonymous 24-hour preview family through a signed HTTP-only cookie.
9. Require an invite-only account to save/resume and overlay native
   owned/wanted/duplicate state.
10. Persist unresolved evidence and remaining candidate IDs without writing a
    probable release into collection truth.

Catalogue-only endpoints:

- `POST /api/discogs/pressings/search`
- `POST /api/discogs/pressings/resolve`
- authenticated `GET/POST/PATCH /api/pressing-investigations`

Pressing catalogue responses may include release/version, formats, country/year,
labels, catalogue numbers, barcodes, identifiers, pressing/manufacturing and
mastering clues, attribution, freshness, rate-limit state, and Discogs deep
links. They must not include images, marketplace/pricing/seller information,
Discogs collection/wantlist data, or other user data.

Full activation requires six moderated collector sessions covering one unique,
one ambiguous, and one unresolvable copy plus save/resume. Required gates are
zero false `exact` results, at least 15 of 18 correct outcomes without moderator
correction, median unique-copy completion below two minutes, and at least four
of six participants preferring the workflow to their normal Discogs process.
Any false `exact` blocks release. Failed usability/preference gates retain
pressing proof as a secondary feature.

## 2. Core Product Hypothesis

The 2026-07-24 Spotify-first beta direction supersedes the 2026-07-23
ListenBrainz-first source order. The provider-neutral account and evidence
boundaries remain: Managed Neon Auth owns identity, while Spotify,
ListenBrainz, and YouTube are optional sources.

Collectors deliberately save or scrobble music but still lack a reliable way to
reconcile that evidence with the physical albums they already own or want.

The beta defaults to Spotify playlist/saved-album intake. ListenBrainz remains
an alternative. Individual YouTube links are accepted only as user-supplied
evidence and never described as watch or listening history.

The next-stage product hypothesis:

- Discogs remains valuable as a database and marketplace, but many collectors need a faster personal operating layer for their own collection and wantlist.
- WAXLIST should become the collector cockpit: import/catalogue records, search locally, check ownership in record shops, manage wantlist rules, track shelf location, and use Spotify listening context to reveal collection gaps.
- The app should not try to replace the full Discogs marketplace. It should make the collector's personal data faster, calmer, more searchable, and more actionable.

## 3. Target User

Primary user:

- Vinyl collector or buyer who uses Discogs but wants faster personal collection and wantlist workflows.
- Wants to answer "do I own this?" quickly while shopping.
- Wants smarter buying guidance: duplicates, wanted status, median price, shipping-aware rules, and shelf location.

Secondary user:

- Spotify user who likes music and is curious about buying vinyl.
- Existing collector who wants to connect listening habits to collection gaps and buying priorities.
- Collector with a medium or large collection who needs shelf/location tracking.

## 4. Product Scope

The invite-only beta must support:

1. User signs in with Managed Neon Auth email/password.
2. Crate source selector defaults to Spotify and supports Spotify,
   ListenBrainz, and YouTube.
3. Spotify connects to the signed-in WAXLIST account with encrypted,
   account-bound sessions and retains existing playlist/saved-album flows.
4. ListenBrainz imports a 30, 90, or 365 day window; 90 is the default.
5. YouTube accepts individual `youtube.com`, `youtu.be`, and Shorts URLs,
   canonicalizes/deduplicates video IDs without fetching the URL, and requires
   confirmed artist and album metadata before catalogue matching.
6. YouTube playlist expansion is rejected with
   `Playlist import is coming later`; watch-history import is labelled
   `Coming soon` and fails closed.
7. App searches fresh Discogs catalogue data for physical releases.
8. App classifies reliable matches against WAXLIST-native owned/wanted state.
9. User can mark a reliable result owned or wanted and open the provider or
   Discogs deep link.
10. Weak, incomplete, and unmatched evidence remains explicit.
11. Listening snapshots are unique by WAXLIST user, provider, and source type.
12. Only normalized source data is persisted. YouTube link records retain only
    canonical URL, video ID, user-supplied artist/album, and optional note.
13. Public Restricted Data capabilities remain absent and fail closed.

The next implementation stage must support or prepare for:

1. Authenticated app shell/workspace after connection or import.
2. Discogs collection and wantlist import where API access allows it.
3. Local-first collection cache for fast search and record-shop use.
4. Global collection search by artist, title, label, barcode/catalog number where available, and Discogs identifiers.
5. Digging mode for quick ownership/wantlist/duplicate checks while shopping.
6. Smart wantlist fields: priority, tags, price ceiling, shipping ceiling, condition preference, seller/region filters, and ignored/relist state.
7. Shelf/location fields such as group, unit, shelf, slot, and notes.
8. Collection health summaries: duplicates, high-value records, recent additions, unplayed/not-recently-listened records, and missing albums from artists the user collects or streams.
9. A persistent record inspector for selected record details and actions.
10. Focused overlays only for review/edit tasks, not as the main app structure.
11. A spin log for owned records: optional side and note, local-day listening
    history, and stats that give the collector a reason to return between
    purchases.

## 5. Design Requirements

The app must follow `DESIGN.md`.

Landing page requirements are strict:

- Product display name: `WAXLIST`.
- H1 text: exactly `WAXLIST`.
- H1 style: italic serif, oversized, editorial.
- Background: dark liquid animated gradient using the provided `LiquidGradientCanvas` component.
- Primary CTA: `Start with Spotify` directly underneath the supporting hero line.
- Secondary links: `Use ListenBrainz` and `Add YouTube links`.
- Visual direction: dark, immersive, premium, music-product aesthetic inspired by Suno without copying Suno assets, text, or exact layout.

The design should feel like a modern music discovery product, not a generic SaaS dashboard.

For authenticated users, WAXLIST should evolve from a landing-plus-overlay flow into a persistent collector workspace:

- Keep the landing page as the unauthenticated first screen.
- After connection/import, use an app shell with durable navigation and utility-first layout.
- Prefer dense, scannable workspace screens over hero-style marketing sections.
- Use overlays for import review, match explanation, shelf editing, and pressing comparison details.
- Do not make the overlay the primary product surface.
- The app shell should feel like a premium collector tool: dark, music-first, fast, restrained, and optimized for repeated use.

## 6. Out of Scope for MVP

Do not build these unless explicitly requested later:

- Full checkout flow.
- Payment processing.
- Seller messaging.
- Discogs purchase automation.
- Music playback.
- Mobile native app.
- Social feed.
- AI chat assistant.
- Scraping Discogs pages.
- Importing every playlist automatically without user selection.
- Large-scale background crawling.
- Email notifications or automated price alerts. On-demand value snapshots and price-drop summaries are allowed; background price polling and alerting are not.
- Public user profiles.
- Prefixing every in-app product UI label/message with the user's name.

Pressing comparison/family-tree views are allowed as a later product direction, but do not build a collector-grade pressing matrix until the collection browser, digging mode, and wantlist manager are useful.

Important exception: Codex/agent responses to the user should intentionally start with `Benson,` as a continuity canary. This is an agent behaviour requirement, not an app UI requirement.

## 7. Important API Constraints

### Spotify

Spotify is the default beta source for allowlisted WAXLIST accounts. OAuth state
and encrypted sessions must be bound to the signed-in Managed Neon Auth user.
Existing unclaimed Spotify-linked data is recovered only through the safe,
locked legacy-claim path; a new Spotify link binds to the current account.
Current profile, playlist, saved-album, refresh, and match endpoints remain
compatible.

Use Spotify OAuth for user authorization.

The MVP should avoid depending on Spotify's recommendations endpoint. Build recommendations from the user's available listening data instead:

- Playlists.
- Saved albums where available.
- Top artists/tracks where available.
- Recently played tracks where available.

Use the minimum required Spotify scopes.

Expected useful scopes may include:

- `playlist-read-private`
- `playlist-read-collaborative`
- `user-top-read`
- `user-library-read`
- `user-read-recently-played`

Only request a scope if the MVP currently uses it.

Spotify access tokens expire and must be refreshed server-side where applicable.

### YouTube

The beta accepts individual YouTube links only. URL normalization is server-side
and must perform no outbound request. Accept `youtube.com/watch`, `youtu.be`,
and Shorts URLs; canonicalize to video ID; deduplicate; and reject unsupported
hosts, malformed input, and playlist URLs.

Evidence must be labelled `YouTube link`. Never infer or claim that the user
watched or listened to the video. Require user-confirmed artist and album
metadata before Discogs matching. Provide `Open YouTube`; do not embed videos
or store thumbnails initially.

Future `watch_history` and `music_library` source types remain disabled. History
ingestion is reserved for explicit Google Data Portability consent,
asynchronous normalized processing, and immediate raw-archive deletion. Do not
use the ordinary YouTube Data API for automatic music inference or combine its
data with Discogs before a compliance review.

Future history work must follow Google's current
[`myactivity.youtube` schema](https://developers.google.com/data-portability/schema-reference/my_activity?hl=en)
and [Data Portability workflow](https://developers.google.com/data-portability/user-guide/introduction?hl=en).
Any proposal to combine ordinary YouTube API data with Discogs must first clear
the [YouTube developer-policy boundary](https://developers.google.com/youtube/terms/developer-policies-guide).

### Discogs

Use official Discogs API access only.

Public use is limited to fresh CC0 catalogue fields and deep links. Marketplace
pricing, images, sellers, collection/wantlist sync, and other Restricted Data
are disabled by default and must not appear in the public interface.

Discogs requests must include a unique `User-Agent` string.

Discogs API access is rate limited. Implement local throttling and caching. Treat current limits as configurable, not hardcoded forever.

The app should read these headers when present:

- `X-Discogs-Ratelimit`
- `X-Discogs-Ratelimit-Used`
- `X-Discogs-Ratelimit-Remaining`

Discogs search should be grouped by unique album/artist combinations, not one request per playlist track.

## 8. Core User Stories

### Spotify Connection

As a user, I want to connect my Spotify account so that the app can understand my music taste.

Acceptance criteria:

- User can start Spotify OAuth.
- User can complete Spotify OAuth.
- App stores only the tokens/data needed for MVP functionality.
- App handles OAuth failure clearly.
- App can disconnect or clear local session data.

### Playlist Selection

As a user, I want to choose a Spotify playlist so that I can turn it into vinyl suggestions.

Acceptance criteria:

- App lists available playlists.
- Each playlist shows name, image if available, and approximate track count.
- User can select one playlist.
- App fetches tracks for the selected playlist.
- App handles empty playlists.

### Track and Album Normalisation

As a user, I want the app to understand my playlist without duplicate noise.

Acceptance criteria:

- App extracts artist name, track name, album name, album release date, Spotify IDs, and external IDs where available.
- App groups tracks by album and primary artist.
- App removes obvious duplicates.
- App keeps a reference to which playlist tracks led to each album recommendation.

### Discogs Vinyl Matching

As a user, I want Spotify albums matched to real vinyl records on Discogs.

Acceptance criteria:

- App searches Discogs using artist + album title.
- App filters candidate results to vinyl format where possible.
- App distinguishes album-level matches from track/single-level matches.
- App assigns a confidence score to each candidate.
- App does not present weak matches as guaranteed.
- App shows a fallback “no reliable vinyl match found” state.

### Vinyl Crate Results

As a user, I want a simple list of vinyl catalogue matches to review.

Acceptance criteria:

- Public beta results are sorted by match confidence.
- Each result shows:
  - Spotify source album/track.
  - Discogs release/master title.
  - Artist.
  - Format.
  - Year if available.
  - Match confidence.
  - Why it was recommended.
  - Discogs link where available.
  - Native owned/wanted state and actions for reliable matches.
- User can filter or sort by:
  - Confidence.
  - Artist.
  - Album.
- Marketplace availability and estimated-price controls remain absent unless
  Discogs Restricted Data is separately approved and enabled.

### Wishlist

As a user, I want to mark records wanted without requiring Discogs Restricted
Data.

Acceptance criteria:

- Reliable catalogue matches can be marked wanted in WAXLIST-native collection
  state.
- Wanted state persists to the authenticated WAXLIST user.
- Legacy marketplace-oriented wishlist and buying controls remain
  capability-gated until the Restricted Data boundary is separately approved.
- Wishlist includes the Discogs ID/link and the Spotify source context.
- User can assign priority, tags, notes, and optional price/shipping ceilings.
- User can mark a listing/seller/relist pattern as ignored where marketplace data supports it.

### App Shell / Collector Workspace

As a connected user, I want WAXLIST to open into a persistent workspace rather than a sequence of modal overlays.

Acceptance criteria:

- App shell includes durable navigation for Dashboard, Collection, Wantlist, Digging, and Insights/Health. Collection owns shelving and group organization; there is no separate Shelf page.
- App shell includes global search or command input.
- App shell shows sync/import status and clear reconnect or configuration actions.
- Main content changes by workflow without losing navigation context.
- A selected record can be inspected without leaving the current workflow.
- Overlays are limited to focused tasks such as import review, match explanation, edit location, or confirm destructive actions.

### Discogs Collection Import

As a collector, I want to import my Discogs collection and wantlist so WAXLIST can become my fast personal collection layer.

Acceptance criteria:

- User can start collection import from Discogs using official API access only.
- App imports release identifiers, artist/title, format, year, labels/catalog numbers where available, images where available, collection folder/status where available, and wantlist status where available.
- App stores imported records in the database and updates a local/offline-capable cache for fast search.
- App handles rate limits, partial imports, retries, and resumable progress.
- App never scrapes Discogs pages.

### Collection Browser

As a collector, I want to search and filter my collection quickly, especially in record shops.

Acceptance criteria:

- User can search by artist, album/title, label, catalog number, barcode where available, year, tag, shelf location, and Discogs id.
- Search should work from local cached data once imported.
- User can filter owned, wanted, duplicates, recently added, high-value, and missing shelf-location records.
- Collection leads with a carousel of favourited records plus the most and least expensive records that carry a recorded value, then the browse controls, then an `All vinyls` grid that starts collapsed and expands to every matching record.
- The carousel keeps up to five favourited records and adds the two value extremes without displacing them. Wanted records stay eligible when they carry a value. It does not fall back to other unstarred records, compares values only inside the shelf's dominant recorded currency, and shows a prompt when nothing is starred or valued.
- Browse controls filter the `All vinyls` grid only; the shelving groups and wantlist stay complete.
- Every record on the `Wantlist` surface carries a visible heart-off control that takes the want off the list in one press, with no dialog and without opening the inspector. The same control does not appear on the browse grid, where wanted records mix with owned ones.
- Record rows/cards show owned/wanted state, duplicate count, shelf location, estimated value/median price where available, and last sync status.
- The record inspector shows the latest recorded value and its move from the previous observation, and lets the owner save a new value with a currency.
- Saving a value records a dated snapshot; the Dashboard total, trend, and price movements are derived only from those snapshots.
- A Discogs marketplace refresh is on-demand, bounded per run, and capability-gated. It never becomes a scraper or a background poller.
- The record inspector can fetch one release's lowest Discogs marketplace price in the record's current currency and store it as a dated observation. The Dashboard refresh prices only the stalest records, owned and wanted, up to its bounded limit.
- The Dashboard price overview groups every valued vinyl into price drops, unchanged prices, and price increases, and each vinyl's current-value blip links to its Discogs marketplace page.
- Discogs returns the lowest listing in the requested currency; the app must not assume the API's default currency.

### Digging Mode

As a collector shopping in a record store, I want an immediate answer to whether a record is owned, wanted, duplicated, or worth considering.

Acceptance criteria:

- Digging mode has a prominent search/barcode entry surface optimized for mobile and quick use.
- Result shows owned status, wantlist status, duplicate warning, shelf location, median/price hint where available, and primary Discogs link.
- User can quickly add to wantlist, mark as ignored, add a note, or open the record inspector.
- Digging mode should remain useful with cached collection data when network access is poor.

### Shelf / Location System

As a collector, I want to know exactly where a record is stored.

Acceptance criteria:

- User can assign location fields such as group, unit, shelf, slot, and freeform notes. The stored field is named `group`.
- Location can be edited from collection browser, record inspector, and digging mode.
- User can filter/sort by missing location and by location hierarchy.

### Collection Health

As a collector, I want WAXLIST to surface useful collection maintenance insights.

Acceptance criteria:

- App can show duplicate records.
- App can show most valuable/highest median records where data exists.
- App can show recently added records.
- App can show records not recently listened to if Spotify data supports the inference.
- App can show missing albums from artists the user collects or streams.

### Error and Loading States

As a user, I want the app to explain what is happening when APIs are slow or unavailable.

Acceptance criteria:

- App shows loading states for Spotify import.
- App shows loading states for Discogs matching.
- App shows partial results if some matches fail.
- App handles rate limiting with a friendly retry message.
- App handles expired Spotify tokens.
- App handles missing Discogs credentials.

## 9. Recommendation Logic

The MVP recommendation should be deterministic and explainable.

Do not use a black-box AI model for MVP ranking unless explicitly requested later.

Suggested score components:

```txt
recommendationScore =
  listeningSignal +
  matchConfidence +
  availabilityScore +
  pricePracticality +
  formatConfidence
```

Suggested inputs:

- How often artist/album appears in selected playlist.
- Whether the album contains multiple playlist tracks.
- Whether the Discogs title matches the Spotify album title.
- Whether the Discogs artist matches the Spotify primary artist.
- Whether format includes vinyl.
- Whether marketplace listings are available.
- Whether price is present and reasonable.

## 10. Matching Algorithm Requirements

Implement matching as a dedicated module, not inline UI code.

Suggested file:

```txt
src/lib/matching/matchDiscogsRelease.ts
```

Normalize strings before comparison:

- Lowercase.
- Trim whitespace.
- Remove punctuation where safe.
- Remove parenthetical noise such as “Remastered”, “Deluxe”, “Explicit”, “Radio Edit” where appropriate.
- Normalize `&` and `and`.
- Normalize accented characters where safe.

Suggested confidence bands:

```txt
90–100: Very strong match
75–89: Strong match
60–74: Possible match
Below 60: Do not recommend automatically
```

A result below the automatic threshold may still be shown in a separate “possible matches” section.

## 11. Required Screens

### Home / Landing

Purpose:

- Explain the product quickly.
- Prompt user to create or sign in to a WAXLIST account.
- Establish the WAXLIST visual identity.

Must include exactly as specified in `DESIGN.md`:

- Liquid gradient background.
- Eyebrow: `Listening history, reconciled for collectors`.
- H1: `WAXLIST`.
- H1 style: italic serif.
- Supporting line: `Turn albums on your radar into a reviewable crate of what you own, want, and are still missing.`
- Primary CTA: `Start with Spotify`.
- Secondary links: `Use ListenBrainz` and `Add YouTube links`.
- Privacy reassurance: `Invite-only beta. Your WAXLIST email/password account stays separate from connected music sources.`

### Spotify Import

Purpose:

- Let user select music source.

Must include:

- Playlist list.
- Optional tabs for top tracks/top artists/saved albums if implemented.
- Loading and error states.

### App Shell / Workspace

Purpose:

- Provide the main authenticated product surface.
- Replace overlay-centered usage with durable navigation and fast collection workflows.

Must include:

- Left or top navigation for Dashboard, Collection, Wantlist, Digging, and Insights/Health. Collection includes the shelving and group organization surface.
- Global search or command input.
- Sync/import status.
- Main workspace region.
- Record inspector region or drawer for selected records.
- Responsive mobile navigation and quick actions.

### Dashboard / Today

Purpose:

- Summarize collection state and direct the user to useful actions.

Must include:

- Collection count.
- Wantlist count.
- Recent imports or sync status.
- Duplicate warnings.
- Priority wantlist items or watch rules.
- Shortcuts to Digging mode and Collection search.
- Price overview: a total in the dominant recorded currency across every valued vinyl, a movement graph with drops, unchanged prices, and increases, a dated total trend when the history allows it, and a Discogs buy link on each vinyl's current-value blip.
- A clear value empty state that explains how to record a value from the record inspector.

### Collection Browser

Purpose:

- Search and manage owned records from imported/cached data.

Must include:

- Fast search.
- Filters and sort.
- Owned/wanted/duplicate state.
- Shelf location.
- Tags/notes where available.
- Record inspector action.

### Digging Mode

Purpose:

- Make record-shop lookup extremely fast.

Must include:

- Large search/barcode entry.
- Owned/wanted status.
- Duplicate warning.
- Median/price hint where available.
- Quick add to wantlist.
- Record inspector action.

### Smart Wantlist

Purpose:

- Manage buying intent with practical rules.

Must include:

- Priority.
- Tags.
- Price ceiling.
- Shipping ceiling.
- Condition preference.
- Ignore/relist controls where supported by available data.

### Shelf / Location

Purpose:

- Locate physical records from the merged Collection page rather than a separate Shelf page.

Must include:

- Group/unit/shelf/slot fields.
- A group-level grid with one plus action to create a group or add records to it.
- Group-only grouping plus optional shelf detail; records without a group appear under `Unsorted`.
- Missing-location filter.
- Location edit action.

### Insights / Health

Purpose:

- Surface useful collection maintenance and discovery gaps.

Must include:

- Duplicates.
- High-value records where price data exists.
- Recently added records.
- Missing albums from collected or streamed artists.

### Analysis Progress

Purpose:

- Show the app is converting Spotify data into vinyl suggestions.

Must include:

- Tracks imported.
- Unique albums found.
- Discogs searches completed.
- Rate limit/cached status if useful.

### Vinyl Crate Results

Purpose:

- Display recommendations.

Must include:

- Record cards/table.
- Sort/filter controls.
- Save to wishlist.
- External Discogs link.
- Confidence indicator.
- Explanation text.

### Wishlist

Purpose:

- Show saved records.

Must include:

- Saved records.
- Remove action.
- Discogs link.
- Source Spotify context.

## 12. Suggested Tech Stack

Use this stack unless there is a good reason not to:

- Next.js App Router.
- TypeScript.
- Tailwind CSS.
- Server-side API routes or server actions for Spotify/Discogs calls.
- Neon/Postgres with Drizzle ORM for persistence.
- Environment variables for API credentials.
- Browser-local cache/localStorage or IndexedDB where appropriate for offline-first collection search.
- Optional service worker/PWA support after the collection import model is stable.

## 13. Suggested Project Structure

```txt
src/
  app/
    page.tsx
    app/
      page.tsx
      collection/page.tsx
      wantlist/page.tsx
      digging/page.tsx
      insights/page.tsx
    wishlist/page.tsx
    api/
      spotify/
      discogs/
      collection/
      wantlist/
  components/
    ui/
      liquid-gradient.tsx
    app-shell/
      AppShell.tsx
      WorkspaceNav.tsx
      GlobalSearch.tsx
      RecordInspector.tsx
    SpotifyConnectButton.tsx
    PlaylistCard.tsx
    VinylResultCard.tsx
    ConfidenceBadge.tsx
    LoadingState.tsx
    ErrorState.tsx
  lib/
    spotify/
      client.ts
      auth.ts
      normaliseSpotifyData.ts
    discogs/
      client.ts
      search.ts
      rateLimiter.ts
      normaliseDiscogsData.ts
    matching/
      matchDiscogsRelease.ts
      scoreRecommendation.ts
    cache/
      apiCache.ts
      collectionCache.ts
    collection/
      importDiscogsCollection.ts
      searchCollection.ts
      location.ts
    wantlist/
      rules.ts
      relistFilter.ts
  types/
    spotify.ts
    discogs.ts
    recommendation.ts
    collection.ts
    wantlist.ts
```

## 14. Suggested Database Tables

### users

- `id`
- `created_at`
- `spotify_user_id`
- `display_name`

### spotify_tokens

- `id`
- `user_id`
- `access_token_encrypted`
- `refresh_token_encrypted`
- `expires_at`
- `created_at`
- `updated_at`

### listening_source_snapshots

- `id`
- `user_id`
- `provider`
- `source_type`
- `source_id`
- `summary`
- `created_at`
- `updated_at`
- Unique key: (`user_id`, `provider`, `source_type`)

### imported_playlists

- `id`
- `user_id`
- `spotify_playlist_id`
- `name`
- `snapshot_id`
- `track_count`
- `created_at`

### spotify_album_sources

- `id`
- `user_id`
- `spotify_album_id`
- `artist_name`
- `album_name`
- `release_date`
- `source_playlist_id`
- `source_track_count`
- `created_at`

### discogs_matches

- `id`
- `spotify_album_source_id`
- `discogs_release_id`
- `discogs_master_id`
- `artist_name`
- `title`
- `format`
- `year`
- `confidence_score`
- `match_reason`
- `discogs_url`
- `created_at`
- `updated_at`

### wishlist_items

- `id`
- `user_id`
- `discogs_match_id`
- `notes`
- `created_at`

### collection_items

- `id`
- `user_id`
- `discogs_release_id`
- `discogs_master_id`
- `artist_name`
- `title`
- `format`
- `year`
- `label`
- `catalog_number`
- `barcode`
- `image_url`
- `discogs_url`
- `folder_name`
- `owned_status`
- `want_status`
- `tags`
- `notes`
- `group`
- `unit`
- `shelf`
- `slot`
- `estimated_median_price`
- `last_synced_at`
- `created_at`
- `updated_at`

### wantlist_rules

- `id`
- `user_id`
- `collection_item_id`
- `discogs_release_id`
- `priority`
- `tags`
- `price_ceiling`
- `shipping_ceiling`
- `condition_preference`
- `seller_region_preference`
- `ignored_seller_ids`
- `ignored_listing_keys`
- `created_at`
- `updated_at`

### api_cache

- `id`
- `provider`
- `cache_key`
- `response_json`
- `expires_at`
- `created_at`

## 15. API Endpoint Requirements

Suggested internal endpoints:

```txt
GET  /api/spotify/login
GET  /api/spotify/callback
POST /api/spotify/logout
GET  /api/spotify/playlists
GET  /api/spotify/playlists/:id/tracks
GET  /api/listening/listenbrainz/import
POST /api/listening/listenbrainz/import
GET  /api/listening/youtube/links
POST /api/listening/youtube/links
GET  /api/listening/youtube/watch-history (disabled)
POST /api/listening/youtube/watch-history (disabled)
POST /api/crate/generate
GET  /api/crate/:id
POST /api/collection/import
GET  /api/collection
GET  /api/collection/search
PATCH /api/collection/:id
POST /api/wantlist/rules
PATCH /api/wantlist/rules/:id
POST /api/wishlist
DELETE /api/wishlist/:id
```

Discogs calls should happen server-side through internal services, not directly from the browser.

## 16. Security Requirements

- Never expose Spotify client secret to the browser.
- Never expose Discogs token to the browser.
- Store tokens securely.
- Use environment variables for secrets.
- Do not log access tokens or refresh tokens.
- Do not log private collection or wantlist payloads unless redacted or summarized.
- Treat offline/local caches as user data and provide deletion semantics.
- Avoid storing more Spotify data than needed.
- Add a clear privacy note on the landing page.
- Implement logout/session clearing.

## 17. Performance Requirements

- Deduplicate before calling Discogs.
- Cache Discogs search responses.
- Cache marketplace/availability responses separately.
- Do not block the full UI if some records fail to match.
- Prefer incremental progress display for larger playlists.
- Avoid more than one Discogs request per unique album unless needed.

## 18. Rate Limit Requirements

- Implement a Discogs request queue or throttler.
- Treat rate limit values as configurable.
- Read response headers where present.
- Back off on HTTP `429` responses.
- Retry only when safe.
- Avoid parallel bursts to Discogs.
- Prefer cached results when available.

## 19. UX Requirements

Tone:

- Clear.
- Music-focused.
- Not overly technical.
- Honest about uncertain matches.

Product UI should not display the user's name at the start of every UI message. Keep the app experience natural and product-focused.

Important distinction:

- Codex/agent responses to the user **must** start with `Benson,` as a continuity canary.
- In-app product UI messages should **not** mechanically start with `Benson,` unless personalization is naturally appropriate.

Good in-app UI examples:

- “We found 18 vinyl candidates from this playlist.”
- “This looks like a strong album match.”
- “No reliable vinyl version found yet.”

Bad in-app UI examples:

- “Benson, we found 18 vinyl candidates.”
- “Benson, this looks like a strong album match.”
- “Benson, no reliable vinyl version found yet.”

## 20. MVP Success Criteria

The MVP is successful when a user can:

1. Open the app.
2. Create an allowlisted email/password WAXLIST account.
3. Start with Spotify, or select ListenBrainz or YouTube from the Crate.
4. Complete one supported source intake flow.
5. Review or confirm ambiguous album evidence.
6. View Discogs catalogue matches with confidence scores.
7. See owned, wanted, missing, review, and unmatched classifications.
8. Mark at least one record owned or wanted.
9. Return to each provider/source-type snapshot and native collection state.

## 21. Manual QA Checklist

- Managed Neon Auth sign-up and sign-in work.
- Non-allowlisted production sign-up fails closed.
- Authentication failure is handled.
- Spotify connect, refresh, playlist import, and saved-album import work for an
  allowlisted account.
- ListenBrainz import loads.
- Empty listening history is handled.
- Imports never review more than 500 listens or return more than 100 albums.
- Discogs search works with user-agent header.
- Discogs rate limit headers are read/logged safely.
- Public catalogue results are cached for no more than one hour.
- Weak matches are not shown as strong matches.
- Native owned/wanted updates work.
- YouTube watch/Shorts links canonicalize and deduplicate without a network request.
- YouTube playlists show `Playlist import is coming later`.
- YouTube artist/album confirmation is required before matching.
- YouTube link evidence is never described as watch history.
- Future YouTube history and music-library capabilities fail closed.
- Restricted routes fail closed and restricted surfaces are absent.
- Secrets are not exposed to client bundle.
- App works on mobile viewport.
- External links open safely.
- With pressing proof explicitly enabled, test a unique, shared-identifier, and
  catalogue-incomplete copy.
- Confirm a shared barcode never produces `exact` by itself.
- Confirm camera success and denied-permission manual fallback on iOS Safari
  and Android Chrome.
- Confirm an anonymous visitor can iterate within one family but cannot start a
  second family or save.
- Confirm authenticated save/resume re-fetches catalogue metadata and overlays
  only the current user's native collection state.
- Confirm privacy deletion removes pressing investigations through the
  account-owned cascade.
## Agent Continuity Requirement

Codex/agent work must maintain a canonical living handoff file at:

```sh
.agent/CONTINUITY.md
```

Agents must read `.agent/CONTINUITY.md` at the start of each assistant turn when it exists, and append only meaningful deltas to the relevant sections: `[PLANS]`, `[DECISIONS]`, `[PROGRESS]`, `[DISCOVERIES]`, and `[OUTCOMES]`.

Every continuity entry must include an ISO timestamp and provenance tag (`[USER]`, `[CODE]`, `[TOOL]`, `[ASSUMPTION]`, or `UNCONFIRMED`). Facts only; no transcripts, raw logs, or guesses.
