# AGENTS.md

# Codex Agent Instructions for WAXLIST MVP

## 1. Mission

You are building the WAXLIST MVP: a web app that connects Spotify listening data to Discogs vinyl catalogue/marketplace data and recommends records the user may want to buy.

Primary goal:

> Generate a working MVP, not a perfect collector-grade platform.

Read these files before making changes:

1. `USER_REQUIREMENTS.md`
2. `DESIGN.md`
3. `.agent/CONTINUITY.md`
4. Existing codebase files

If `.agent/CONTINUITY.md` does not exist, create it before implementation work begins using the strict continuity protocol in this file.

## 2. Non-Negotiable Rules

### Start Every Agent Response With the User's Name

For Codex/agent handoff responses, start every direct response to the user with the user's name: `Benson`.

Required pattern:

```txt
Benson, <response content>
```

Purpose:

- This is an intentional continuity canary.
- If the agent stops doing this, it may indicate that it has lost or ignored project instructions.
- This applies to agent/chat responses and session summaries.
- This does not require every product UI string inside the app to include the user's name.

Examples:

```txt
Benson, I implemented Spotify OAuth and updated .agent/CONTINUITY.md.
Benson, the build is failing because SPOTIFY_CLIENT_ID is missing from the environment.
Benson, the next best step is to add the playlist selection screen.
```

Do not remove this rule unless the user explicitly asks to remove it.

### Keep `.agent/CONTINUITY.md` Updated

Maintain a single continuity file for the current workspace:

```sh
.agent/CONTINUITY.md
```

`.agent/CONTINUITY.md` is a living document and canonical briefing designed to survive compaction.

Do not rely on earlier chat or tool output unless it is reflected there.

At the start of each assistant turn:

1. Read `.agent/CONTINUITY.md` if it exists.
2. Use it to understand current goals, decisions, and progress.
3. Update it only when there is a meaningful delta.

Update `.agent/CONTINUITY.md` after any big or meaningful change, including:

- Feature implemented.
- Bug fixed.
- API behaviour researched.
- Architecture decision made.
- Files created, renamed, deleted, or substantially edited.
- Tests added or changed.
- Build/check commands run with useful results.
- Blocker discovered.
- Scope changed.
- Design direction changed.

Do not leave the project in a state where the next agent has to infer what happened.

### Strict `.agent/CONTINUITY.md` Format

Update `.agent/CONTINUITY.md` only when there is a meaningful delta in:

- `[PLANS]`
  - Plans Log.
  - A guide for the next contributor and a checklist for current work.

- `[DECISIONS]`
  - Decisions Log.
  - Records decisions made and why.

- `[PROGRESS]`
  - Progress Log.
  - Records course changes during implementation.

- `[DISCOVERIES]`
  - Discoveries Log.
  - Records bugs, performance trade-offs, unexpected behaviour, or important repo findings.
  - Include short evidence snippets where useful.

- `[OUTCOMES]`
  - Outcomes Log.
  - Summarises what was achieved, what remains, and lessons learned.

### Continuity Anti-Drift / Anti-Bloat Rules

Facts only.

No transcripts.

No raw logs.

Every entry must include:

- ISO timestamp.
  - Example: `2026-01-13T09:42Z`.

- Provenance tag:
  - `[USER]`
  - `[CODE]`
  - `[TOOL]`
  - `[ASSUMPTION]`

If unknown, write `UNCONFIRMED`.

Never guess.

If something changes, supersede it explicitly. Do not silently rewrite history.

Keep the file bounded, short, and high-signal.

If sections become bloated, compress older items into `[MILESTONE]` bullets.

### No Secret Leakage

Never hardcode secrets.

Never commit:

- Spotify client secret.
- Spotify refresh token.
- Discogs token.
- `.env.local`.
- Real user tokens.
- Private API responses containing user data.

Use environment variables and provide `.env.example` only.

### Do Not Depend on Spotify Recommendations Endpoint

The MVP must not depend on Spotify's recommendations endpoint.

Build recommendations from user-owned or user-authorized Spotify data such as:

- Playlists.
- Saved albums.
- Top artists/tracks where available.
- Recently played tracks where available.

### Server-Side API Access

Spotify and Discogs API calls that require secrets must happen server-side.

Do not expose API tokens or secrets in client-side React components.

### Respect API Rate Limits

Implement local throttling and caching for Discogs.

Do not brute-force Discogs with one request per track if the playlist can be grouped by unique album/artist.

### Prioritise Working MVP Over Fancy Extras

Build in this order:

1. Spotify OAuth.
2. Playlist import.
3. Track/album normalisation.
4. Discogs search.
5. Vinyl match scoring.
6. Results UI.
7. Wishlist.
8. Caching/rate limiting hardening.
9. Polish.

### Design Spec Is Binding

`DESIGN.md` is the visual source of truth.

Before implementing or editing any UI, read `DESIGN.md` and follow it strictly. In particular:

- The landing page must use the WAXLIST identity.
- The landing page H1 must be exactly `WAXLIST`.
- The H1 must use an italic serif type treatment.
- The landing page must use the provided `LiquidGradientCanvas` background pattern.
- The `Connect Spotify` button must appear directly beneath the supporting hero copy.
- Do not copy Suno assets or text; use Suno only as broad inspiration for a dark, immersive music-product aesthetic.

If a UI implementation conflicts with `DESIGN.md`, treat the implementation as wrong unless the user explicitly changes the design direction.

## 3. Red Herrings and Explicit Non-Goals

These are traps. Do not implement them unless the user explicitly changes scope.

Do not build:

- Checkout.
- Payment processing.
- Discogs purchasing automation.
- Seller messaging.
- Native mobile app.
- Social network.
- AI chatbot.
- Music playback.
- Full marketplace clone.
- High-volume crawler.
- Scraper.
- Email alert system.
- Price tracker.
- Public profile pages.
- Full pressing comparison matrix.

Do not over-personalise the app UI by mechanically prefixing every app label, button, toast, or empty state with `Benson`.

The `Benson,` rule is for agent/user responses only.

## 4. Working Method

Use this loop:

1. Read `.agent/CONTINUITY.md` if it exists.
2. Read `USER_REQUIREMENTS.md` and `DESIGN.md`.
3. Inspect existing files.
4. Identify the smallest useful next step.
5. Make focused changes.
6. Run relevant checks.
7. Append meaningful deltas to `.agent/CONTINUITY.md` using the strict section format.
8. Summarise what changed and what remains.

Avoid large rewrites unless necessary.

Prefer small, composable modules over large files.

## 5. Required `.agent/CONTINUITY.md` Skeleton

Use this structure:

```md
# CONTINUITY.md

Maintain a single continuity file for the current workspace: `.agent/CONTINUITY.md`.

This is the canonical briefing for WAXLIST and is designed to survive compaction.

Do not rely on earlier chat or tool output unless it is reflected here.

## [PLANS]

- `YYYY-MM-DDTHH:mmZ` `[PROVENANCE]` Current plan/checklist.

## [DECISIONS]

- `YYYY-MM-DDTHH:mmZ` `[PROVENANCE]` Decision and reason.

## [PROGRESS]

- `YYYY-MM-DDTHH:mmZ` `[PROVENANCE]` Implementation progress or course change.

## [DISCOVERIES]

- `YYYY-MM-DDTHH:mmZ` `[PROVENANCE]` Bug, trade-off, unexpected behaviour, or repo finding. Evidence: `short snippet`.

## [OUTCOMES]

- `YYYY-MM-DDTHH:mmZ` `[PROVENANCE]` What was achieved, what remains, and lessons learned.
```

## 6. Continuity Append Examples

Good entries:

```md
## [DECISIONS]

- `2026-06-29T13:13Z` `[USER]` Supersedes earlier root `CONTINUITY.md` convention: canonical continuity path is now `.agent/CONTINUITY.md` so the handoff survives compaction and is isolated from product docs.

## [PROGRESS]

- `2026-06-29T13:13Z` `[CODE]` Added Spotify OAuth callback route and session cookie handling. Files: `src/app/api/spotify/callback/route.ts`, `src/lib/spotify/auth.ts`.

## [DISCOVERIES]

- `2026-06-29T13:13Z` `[TOOL]` Build fails because `SPOTIFY_REDIRECT_URI` is missing. Evidence: `Missing environment variable: SPOTIFY_REDIRECT_URI`.
```

Bad entries:

```md
- Worked on stuff.
- The user said a lot of things about Spotify.
- Full pasted terminal logs.
- I think the API probably works like this.
```

## 7. Implementation Guidelines

### TypeScript

Use TypeScript for all app code.

Prefer explicit types for external API responses, even if partial.

Create provider-specific types:

```txt
src/types/spotify.ts
src/types/discogs.ts
src/types/recommendation.ts
```

### API Clients

Create dedicated API client modules:

```txt
src/lib/spotify/client.ts
src/lib/spotify/auth.ts
src/lib/discogs/client.ts
src/lib/discogs/rateLimiter.ts
```

Do not scatter raw `fetch` calls throughout UI components.

### Matching Logic

Keep matching logic isolated:

```txt
src/lib/matching/matchDiscogsRelease.ts
src/lib/matching/scoreRecommendation.ts
```

The UI should consume already-scored results.

### Caching

Cache by stable keys.

Examples:

```txt
spotify:playlist:{playlistId}:{snapshotId}
discogs:search:{normalisedArtist}:{normalisedAlbum}
discogs:release:{releaseId}
discogs:marketplace:{releaseId}
```

Cache implementation may start simple, but the interface should allow replacing it later.

### Error Handling

Return structured errors from API routes/services.

Avoid throwing raw provider errors into the UI.

Show friendly user-facing messages.

### Styling

Use Tailwind CSS.

Follow `DESIGN.md` for all visual decisions.

Required initial UI direction:

- Product display name: `WAXLIST`.
- Landing hero H1: `WAXLIST`.
- H1 style: italic serif, oversized, editorial.
- Background: liquid gradient using `LiquidGradientCanvas`.
- Primary CTA: `Connect Spotify`.
- Overall aesthetic: dark, immersive, music-first, premium, Suno-inspired without copying Suno.

Prefer clean, responsive layouts.

Prioritise readability over decorative animation.

## 8. Suggested Build Order

### Phase 1 — Project Foundation

- Confirm app runs locally.
- Add `.env.example`.
- Add basic layout.
- Add landing page.
- Add `USER_REQUIREMENTS.md`, `DESIGN.md`, `AGENTS.md`, and `.agent/CONTINUITY.md` if missing.
- Add `LiquidGradientCanvas` at `src/components/ui/liquid-gradient.tsx` if missing.
- Implement the WAXLIST landing hero exactly as specified in `DESIGN.md`.

### Phase 2 — Spotify OAuth

- Add Spotify login route.
- Add callback route.
- Store session/token safely.
- Add logout/disconnect.
- Fetch user profile as a smoke test.

### Phase 3 — Playlist Import

- Fetch user's playlists.
- Show playlist picker.
- Fetch selected playlist tracks.
- Normalize tracks/albums.
- Group by unique album/artist.

### Phase 4 — Discogs Search

- Add Discogs client.
- Add required `User-Agent`.
- Add local rate limiter.
- Search by artist + album.
- Filter for vinyl.
- Cache responses.

### Phase 5 — Matching and Ranking

- Implement confidence score.
- Implement recommendation score.
- Show why a match was recommended.
- Separate strong matches from possible matches.

### Phase 6 — Results UI

- Display vinyl crate.
- Add filters/sort.
- Add Discogs external links.
- Add loading/progress states.

### Phase 7 — Wishlist

- Save record.
- Remove record.
- Persist wishlist.
- Add wishlist page.

### Phase 8 — Hardening

- Handle expired Spotify token.
- Handle Discogs `429`.
- Improve empty states.
- Add basic tests.
- Run build/lint/typecheck.

## 9. Acceptance Criteria for Agent Work

Before marking a task complete, verify:

- The app still starts.
- TypeScript passes where configured.
- No secrets are committed.
- New env vars are added to `.env.example`.
- User-facing errors are understandable.
- `.agent/CONTINUITY.md` is updated when there is a meaningful delta.
- The implementation matches `USER_REQUIREMENTS.md`.
- UI changes match `DESIGN.md`.
- The WAXLIST landing page has the required italic serif H1, liquid gradient background, and `Connect Spotify` CTA.
- Red herrings were not implemented.

## 10. Recommended Final Response Format

Every final coding-session response must start with `Benson,`.

Use:

```md
Benson, here is what changed.

## Completed

- ...

## Changed Files

- `...`

## Checks Run

- `...`

## Continuity

- Updated `.agent/CONTINUITY.md` with meaningful deltas.

## Notes

- ...

## Next Step

- ...
```

Keep the response practical. Do not over-explain.

## 11. Research Instructions

When researching API details:

- Prefer official Spotify Developer docs.
- Prefer official Discogs Developer docs and Discogs support docs.
- Record findings in `.agent/CONTINUITY.md` under `[DISCOVERIES]` or `[DECISIONS]` as appropriate.
- Include the date the research was checked.
- Treat API limits and endpoint availability as changeable.

Do not assume old blog posts, Stack Overflow answers, or AI memory are current.

## 12. Code Quality Preferences

- Keep components small.
- Keep provider logic outside UI components.
- Use clear names.
- Avoid premature abstraction.
- Avoid unnecessary dependencies.
- Prefer server-side secrets.
- Prefer deterministic matching over AI matching for MVP.
- Add comments only where they clarify non-obvious logic.

## 13. Definition of Done for MVP

The MVP is done when a user can:

1. See the WAXLIST landing page matching `DESIGN.md`.
2. Connect Spotify.
3. Select a playlist.
4. Generate vinyl recommendations.
5. See ranked Discogs vinyl matches.
6. Understand why each match appeared.
7. Open a Discogs link.
8. Save/remove wishlist items.
9. Use the app without exposing secrets or breaking rate limits.
