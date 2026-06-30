# USER_REQUIREMENTS.md

# WAXLIST Vinyl Collection Workspace — User Requirements

## 1. Product Summary

Build WAXLIST as a vinyl collection workspace. The first-stage MVP connects a user's Spotify listening data to Discogs vinyl catalogue/marketplace data and recommends records the user may want to buy. The next stage expands WAXLIST into a fast personal collection layer for collectors who want Discogs data, local/offline utility, smarter wantlist management, and in-shop decision support.

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

## 2. Core Product Hypothesis

People who already listen to music on Spotify may want to start or improve a vinyl collection, but they do not know which albums are worth buying, which pressings exist, or what is actually available.

The MVP should turn a Spotify playlist, saved albums, or top listening data into a ranked “vinyl crate” of Discogs records.

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

The existing Spotify-to-vinyl MVP must support:

1. User connects Spotify.
2. User selects one Spotify playlist or imports recent/top listening data where supported.
3. App extracts tracks, artists, and album metadata.
4. App deduplicates tracks by album and artist.
5. App searches Discogs for vinyl releases matching those albums/artists.
6. App ranks candidate vinyl records by match confidence and practical buyability.
7. App displays a “vinyl crate” of recommended records.
8. User can save records to a local wishlist.
9. App caches Spotify and Discogs results to reduce API usage.
10. App clearly shows uncertainty when a Discogs match is not reliable.

The next implementation stage must support or prepare for:

1. Authenticated app shell/workspace after connection or import.
2. Discogs collection and wantlist import where API access allows it.
3. Local-first collection cache for fast search and record-shop use.
4. Global collection search by artist, title, label, barcode/catalog number where available, and Discogs identifiers.
5. Digging mode for quick ownership/wantlist/duplicate checks while shopping.
6. Smart wantlist fields: priority, tags, price ceiling, shipping ceiling, condition preference, seller/region filters, and ignored/relist state.
7. Shelf/location fields such as room, unit, shelf, slot, and notes.
8. Collection health summaries: duplicates, high-value records, recent additions, unplayed/not-recently-listened records, and missing albums from artists the user collects or streams.
9. A persistent record inspector for selected record details and actions.
10. Focused overlays only for review/edit tasks, not as the main app structure.

## 5. Design Requirements

The app must follow `DESIGN.md`.

Landing page requirements are strict:

- Product display name: `WAXLIST`.
- H1 text: exactly `WAXLIST`.
- H1 style: italic serif, oversized, editorial.
- Background: dark liquid animated gradient using the provided `LiquidGradientCanvas` component.
- CTA: `Connect Spotify` directly underneath the supporting hero line.
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
- Email notifications or price alerts.
- Public user profiles.
- Prefixing every in-app product UI label/message with the user's name.

Pressing comparison/family-tree views are allowed as a later product direction, but do not build a collector-grade pressing matrix until the collection browser, digging mode, and wantlist manager are useful.

Important exception: Codex/agent responses to the user should intentionally start with `Benson,` as a continuity canary. This is an agent behaviour requirement, not an app UI requirement.

## 7. Important API Constraints

### Spotify

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

### Discogs

Use official Discogs API access only.

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

As a user, I want a simple list of recommended vinyl records to buy.

Acceptance criteria:

- Results are sorted by recommendation score.
- Each result shows:
  - Spotify source album/track.
  - Discogs release/master title.
  - Artist.
  - Format.
  - Year if available.
  - Match confidence.
  - Why it was recommended.
  - Discogs link where available.
  - Marketplace availability where available.
- User can filter or sort by:
  - Confidence.
  - Availability.
  - Estimated price where available.
  - Artist.
  - Album.

### Wishlist

As a user, I want to save records I might buy later and manage them with practical buying rules.

Acceptance criteria:

- User can save a result to wishlist.
- User can remove a result from wishlist.
- Wishlist persists for the current user/session.
- Wishlist includes the Discogs ID/link and the Spotify source context.
- User can assign priority, tags, notes, and optional price/shipping ceilings.
- User can mark a listing/seller/relist pattern as ignored where marketplace data supports it.

### App Shell / Collector Workspace

As a connected user, I want WAXLIST to open into a persistent workspace rather than a sequence of modal overlays.

Acceptance criteria:

- App shell includes durable navigation for Dashboard, Collection, Wantlist, Digging, Shelf, and Insights/Health.
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
- Record rows/cards show owned/wanted state, duplicate count, shelf location, estimated value/median price where available, and last sync status.

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

- User can assign location fields such as room, unit, shelf, slot, and freeform notes.
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
- Prompt user to connect Spotify.
- Establish the WAXLIST visual identity.

Must include exactly as specified in `DESIGN.md`:

- Liquid gradient background.
- Eyebrow: `Spotify-powered vinyl discovery`.
- H1: `WAXLIST`.
- H1 style: italic serif.
- Supporting line: `Turn your Spotify taste into a vinyl crate worth collecting.`
- Primary CTA: `Connect Spotify`.
- Privacy reassurance: `We only use your Spotify data to build your crate. You can disconnect anytime.`

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

- Left or top navigation for Dashboard, Collection, Wantlist, Digging, Shelf, and Insights/Health.
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

- Locate physical records.

Must include:

- Room/unit/shelf/slot fields.
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
      shelf/page.tsx
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
- `room`
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
2. Connect Spotify.
3. Select a playlist.
4. Generate vinyl suggestions.
5. View Discogs matches with confidence scores.
6. Open a Discogs link for a recommended record.
7. Save at least one record to wishlist.
8. Return to wishlist later in the same account/session.

## 21. Manual QA Checklist

- Spotify OAuth works.
- Spotify OAuth failure is handled.
- Playlist list loads.
- Empty playlist is handled.
- Playlist with 100+ tracks does not spam Discogs.
- Discogs search works with user-agent header.
- Discogs rate limit headers are read/logged safely.
- Results are cached.
- Weak matches are not shown as strong matches.
- Wishlist add/remove works.
- Secrets are not exposed to client bundle.
- App works on mobile viewport.
- External links open safely.
## Agent Continuity Requirement

Codex/agent work must maintain a canonical living handoff file at:

```sh
.agent/CONTINUITY.md
```

Agents must read `.agent/CONTINUITY.md` at the start of each assistant turn when it exists, and append only meaningful deltas to the relevant sections: `[PLANS]`, `[DECISIONS]`, `[PROGRESS]`, `[DISCOVERIES]`, and `[OUTCOMES]`.

Every continuity entry must include an ISO timestamp and provenance tag (`[USER]`, `[CODE]`, `[TOOL]`, `[ASSUMPTION]`, or `UNCONFIRMED`). Facts only; no transcripts, raw logs, or guesses.
