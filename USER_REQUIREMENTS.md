# USER_REQUIREMENTS.md

# WAXLIST Vinyl Discovery MVP — User Requirements

## 1. Product Summary

Build an MVP web application that connects a user's Spotify listening data to Discogs vinyl catalogue and marketplace data.

The product should help users answer:

> “Which records should I buy on vinyl based on the music I already listen to?”

Primary product/display name:

- `WAXLIST`

Former/alternate brainstorm names, now deprecated unless the user reopens naming:

- Crateify
- VinylMatch
- Spinlist
- Wax Radar

Use `WAXLIST` for the UI, documentation, and MVP identity.

## 2. Core Product Hypothesis

People who already listen to music on Spotify may want to start or improve a vinyl collection, but they do not know which albums are worth buying, which pressings exist, or what is actually available.

The MVP should turn a Spotify playlist, saved albums, or top listening data into a ranked “vinyl crate” of Discogs records.

## 3. Target User

Primary user:

- Spotify user who likes music and is curious about buying vinyl.
- May not know Discogs deeply.
- Wants simple, practical buying suggestions rather than a collector-grade database UI.

Secondary user:

- Existing vinyl buyer who wants to discover records from their own listening habits.
- Wants useful filters such as price, country/region, condition, and availability.

## 4. MVP Scope

The MVP must support:

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
- Full pressing comparison engine.
- Scraping Discogs pages.
- Importing every playlist automatically without user selection.
- Large-scale background crawling.
- Email notifications or price alerts.
- Public user profiles.
- Prefixing every in-app product UI label/message with the user's name.

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

As a user, I want to save records I might buy later.

Acceptance criteria:

- User can save a result to wishlist.
- User can remove a result from wishlist.
- Wishlist persists for the current user/session.
- Wishlist includes the Discogs ID/link and the Spotify source context.

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
- Supabase/Postgres for persistence if database setup is needed.
- Environment variables for API credentials.
- Optional local JSON/file cache only during early prototyping.

## 13. Suggested Project Structure

```txt
src/
  app/
    page.tsx
    playlists/page.tsx
    crate/page.tsx
    wishlist/page.tsx
    api/
      spotify/
      discogs/
  components/
    ui/
      liquid-gradient.tsx
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
  types/
    spotify.ts
    discogs.ts
    recommendation.ts
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

