# CONTINUITY.md

Maintain a single continuity file for the current workspace: `.agent/CONTINUITY.md`.

This is the canonical briefing for WAXLIST and is designed to survive compaction.

Do not rely on earlier chat or tool output unless it is reflected here.

Facts only. No transcripts. No raw logs. Every entry must include an ISO timestamp and provenance tag: `[USER]`, `[CODE]`, `[TOOL]`, `[ASSUMPTION]`, or `UNCONFIRMED`.

If something changes, supersede it explicitly. Do not silently rewrite history.

Keep this file bounded, short, and high-signal. If sections become bloated, compress older items into `[MILESTONE]` bullets.

## [PLANS]

- `2026-06-29T13:13Z` `[USER]` Next contributor must use `.agent/CONTINUITY.md` as the canonical continuity file. At the start of each assistant turn, read it if it exists; update it only for meaningful deltas.
- `2026-06-29T13:12Z` `[USER]` Build WAXLIST MVP: Spotify OAuth -> playlist import -> album/artist grouping -> Discogs vinyl search -> match scoring -> vinyl crate results -> wishlist.
- `2026-06-29T13:12Z` `[USER]` Implement the landing page from `DESIGN.md`: dark liquid-gradient background, oversized italic serif `WAXLIST` H1, supporting copy, and `Connect Spotify` CTA directly beneath.
- `2026-06-29T13:12Z` `[ASSUMPTION]` Superseded by `2026-06-29T13:32Z` `[TOOL]`: a Next.js app now exists in the repository.

## [DECISIONS]

- `2026-06-29T13:13Z` `[USER]` Supersedes earlier root `CONTINUITY.md` convention: canonical continuity path is `.agent/CONTINUITY.md`, not root `CONTINUITY.md`, so the handoff survives compaction and remains isolated from product docs.
- `2026-06-29T13:13Z` `[USER]` `.agent/CONTINUITY.md` must use section headings `[PLANS]`, `[DECISIONS]`, `[PROGRESS]`, `[DISCOVERIES]`, and `[OUTCOMES]`; meaningful deltas must be appended under the relevant section.
- `2026-06-29T13:13Z` `[USER]` Every continuity entry must include ISO timestamp and provenance tag. Allowed provenance tags: `[USER]`, `[CODE]`, `[TOOL]`, `[ASSUMPTION]`; if unknown, write `UNCONFIRMED`.
- `2026-06-29T13:13Z` `[USER]` Continuity anti-bloat rules: facts only, no transcripts, no raw logs, never guess, explicitly supersede changed decisions, compress old sections into `[MILESTONE]` bullets when bloated.
- `2026-06-29T13:12Z` `[USER]` Product/display name is `WAXLIST`.
- `2026-06-29T13:12Z` `[USER]` Agent/user responses must start with `Benson,` as a continuity canary; this does not require every in-app product UI string to include the user name.
- `2026-06-29T13:12Z` `[USER]` `DESIGN.md` is binding for UI work.
- `2026-06-29T13:12Z` `[USER]` Do not depend on Spotify's recommendations endpoint. Generate recommendations from user-authorized Spotify data such as playlists, saved albums, top artists/tracks, and recently played tracks where available.
- `2026-06-29T13:12Z` `[USER]` Main purchasable matching target should be album/release-level vinyl matches from Discogs; song-level data should explain why the record was suggested.
- `2026-06-29T13:12Z` `[USER]` Spotify and Discogs API calls requiring secrets must be server-side. Never expose tokens/secrets in client components.
- `2026-06-29T13:32Z` `[CODE]` Project uses root-level `app/`, `components/ui/`, and `lib/` instead of `src/`; this follows the existing project convention and is allowed by `DESIGN.md`.
- `2026-06-29T13:32Z` `[CODE]` The landing CTA points to `/api/auth/spotify/login` as a future OAuth entry path, but no OAuth route or auth library has been implemented.
- `2026-06-29T13:35Z` `[USER]` User requested reverting the superficial homepage design to its pre-stabilization appearance while keeping all other foundation changes.
- `2026-06-29T13:37Z` `[USER]` User requested adding the Spotify logo to the Connect Spotify button and applying an aesthetic sans-serif font to pair with the serif H1.
- `2026-06-29T13:43Z` `[USER]` User requested minimal Spotify OAuth login/callback setup using npm, no database storage, clear env validation, existing landing design, and verification with lint, build, and curl against `localhost:3000`.
- `2026-06-29T13:46Z` `[USER]` User reported that clicking Connect Spotify showed raw JSON when Spotify client env vars were missing.
- `2026-06-29T13:50Z` `[USER]` User reported Spotify dashboard error `redirect_uri: Insecure`.
- `2026-06-29T13:54Z` `[USER]` User requested a logout/session-clear route to clear the temporary Spotify session cookie and recover from bad or expired tokens.
- `2026-06-29T14:01Z` `[USER]` User reported generic Spotify connection failure after approving the Spotify authorization popup.
- `2026-06-29T14:49Z` `[USER]` User reported Next.js dev warning blocking cross-origin dev resource `/_next/webpack-hmr` from `127.0.0.1` and instructing to add `allowedDevOrigins`.
- `2026-06-29T14:52Z` `[USER]` User shared browser `ERR_TOO_MANY_REDIRECTS` after clicking Spotify button from `127.0.0.1`.
- `2026-06-29T14:56Z` `[USER]` User requested Sign Out functionality once Spotify is connected.
- `2026-06-29T14:59Z` `[USER]` User reported no Sign Out button rendered at `http://localhost:3000/?spotify=connected`.
- `2026-06-29T15:08Z` `[USER]` User requested minimal Spotify profile and playlist fetching routes using npm, no database storage, clear env validation, current landing design preservation, and verification with lint, build, and `curl localhost:3000`.
- `2026-06-29T15:15Z` `[USER]` User requested rendering Spotify profile UI, playlist picker UI, and component consumption of the new Spotify profile/playlists endpoints.
- `2026-06-29T16:37Z` `[USER]` User reported the connected workspace loaded a generic Spotify data error with `Failed to execute 'json' on 'Response': Unexpected end of JSON input`.
- `2026-06-29T15:41Z` `[USER]` User reported a server runtime error in playlist normalization: `Cannot read properties of undefined (reading 'total')` at `lib/spotify/workspace.ts`.
- `2026-06-29T15:46Z` `[USER]` User reported connected playlists rendered but all showed `0 tracks`.
- `2026-06-29T15:47Z` `[USER]` User reported playlist cards still showed `0 tracks` after the first fallback fix.
- `2026-06-29T15:51Z` `[USER]` User reported playlist cards still showed `0 tracks` after the paged item-counting fix.

## [PROGRESS]

- `2026-06-29T13:13Z` `[CODE]` Updated project documentation to instruct agents to read, maintain, and append meaningful deltas to `.agent/CONTINUITY.md` using strict canonical sections.
- `2026-06-29T13:12Z` `[CODE]` Created/updated documentation set: `USER_REQUIREMENTS.md`, `AGENTS.md`, `DESIGN.md`, and continuity guidance.
- `2026-06-29T13:12Z` `[CODE]` Added design direction: WAXLIST landing page with liquid gradient background, italic serif H1, and Spotify connect CTA.
- `2026-06-29T13:32Z` `[CODE]` Added canonical root `.agent/CONTINUITY.md` after discovering prior continuity content was under `lib/.agent/CONTINUITY.md`.
- `2026-06-29T13:32Z` `[CODE]` Stabilized landing page copy, accessibility labels, responsive layout, overlay/vignette treatment, and future Spotify auth CTA path without adding OAuth.
- `2026-06-29T13:32Z` `[CODE]` Added `.env.example`, `lib/constants.ts`, `lib/config.ts`, and updated `README.md` for current setup.
- `2026-06-29T13:32Z` `[CODE]` Updated App Router metadata from Create Next App defaults to WAXLIST title and landing tagline.
- `2026-06-29T13:33Z` `[CODE]` Removed noncanonical `lib/.agent/CONTINUITY.md` after migrating continuity content to root `.agent/CONTINUITY.md`.
- `2026-06-29T13:35Z` `[CODE]` Reverted homepage visual styling toward the prior simple treatment: sunset liquid preset, black overlay only, earlier H1 scale, white text treatment, and simpler CTA styling; retained constants, metadata, env/docs, continuity, and future Spotify auth link.
- `2026-06-29T13:37Z` `[CODE]` Switched the global sans font variable to `Instrument_Sans` via `next/font/google` and added an inline Spotify brand mark to the Connect Spotify button.
- `2026-06-29T13:43Z` `[CODE]` Added minimal Spotify OAuth route handlers at `app/api/auth/spotify/login/route.ts` and `app/api/auth/spotify/callback/route.ts`; no database logic or auth library was added.
- `2026-06-29T13:43Z` `[CODE]` Added server-side Spotify OAuth helpers in `lib/spotify/oauth.ts` and clear env validation in `lib/config.ts` for `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, and `SPOTIFY_REDIRECT_URI`.
- `2026-06-29T13:46Z` `[CODE]` Changed missing Spotify OAuth env handling to redirect back to the landing page with an inline configuration notice instead of returning raw JSON to browser clicks.
- `2026-06-29T13:50Z` `[CODE]` Updated `.env.example` and `README.md` local OAuth examples from `localhost` to `127.0.0.1` so Spotify accepts the redirect URI and the browser origin can match the callback host.
- `2026-06-29T13:54Z` `[CODE]` Added `POST /api/auth/spotify/logout` to clear the temporary Spotify session cookie and any stale OAuth state cookie.
- `2026-06-29T14:01Z` `[CODE]` Updated Spotify login route to redirect onto the configured `SPOTIFY_REDIRECT_URI` origin before setting OAuth state, preventing localhost/127.0.0.1 state-cookie mismatch.
- `2026-06-29T14:01Z` `[CODE]` Callback redirects now include a `reason` query param for recoverable OAuth failures; landing page shows specific guidance for invalid state and token exchange failure.
- `2026-06-29T14:49Z` `[CODE]` Added `allowedDevOrigins: ["127.0.0.1"]` to `next.config.ts` so Next dev resources are allowed when testing OAuth on `http://127.0.0.1:3000`.
- `2026-06-29T14:52Z` `[CODE]` Fixed OAuth login canonicalization to compare the actual request `Host` header with the configured Spotify redirect host, preventing self-redirect loops on `127.0.0.1`.
- `2026-06-29T14:56Z` `[CODE]` Landing page now reads the HTTP-only Spotify session cookie server-side and shows a POST Sign Out button when connected.
- `2026-06-29T14:56Z` `[CODE]` `POST /api/auth/spotify/logout` now clears Spotify cookies and redirects to `/?spotify=disconnected` for browser form submissions.
- `2026-06-29T14:59Z` `[CODE]` Landing page now shows Sign Out when either the Spotify session cookie exists or `?spotify=connected` is present, covering immediate callback state and host-specific cookie mismatch during local testing.
- `2026-06-29T15:08Z` `[CODE]` Added `GET /api/spotify/profile` and `GET /api/spotify/playlists` route handlers plus server-only Spotify API helpers; routes use the temporary HTTP-only session cookie, refresh tokens when possible, and do not write database data.
- `2026-06-29T15:15Z` `[CODE]` Added connected-state Spotify workspace UI: profile panel, playlist picker cards, selected-playlist local state, loading/error states, and endpoint consumption from `components/spotify/connected-workspace.tsx`.
- `2026-06-29T16:37Z` `[CODE]` Replaced the server-side workspace bootstrap with direct Spotify API loading from the session cookie and hardened the client fallback fetch to tolerate empty or non-JSON responses.
- `2026-06-29T15:41Z` `[CODE]` Made playlist normalization defensive by treating a missing `tracks` object as `0` tracks instead of throwing during server render.
- `2026-06-29T15:46Z` `[CODE]` Updated playlist normalization to resolve missing track counts from each playlist's `tracks.href` endpoint before falling back to an inline or zero count.
- `2026-06-29T15:47Z` `[CODE]` Switched playlist count resolution to page through each playlist's tracks endpoint and count items when the inline total is missing or unusable.
- `2026-06-29T15:51Z` `[CODE]` Updated playlist count resolution to prefer the documented `total` field from the playlist tracks response and only fall back to page item counting when necessary.
- `2026-06-29T20:08Z` `[CODE]` Added playlist picker pagination UI using the existing `/api/spotify/playlists` `limit` and `offset` query parameters; no new route handlers or database storage were added.
- `2026-06-29T20:29Z` `[CODE]` Added selected-playlist import summary review before Discogs matching: album candidates are grouped by album plus primary artist with source tracks, duplicate counts, compilation notes, and low-quality playlist reasons.
- `2026-06-29T20:32Z` `[CODE]` Converted the selected-playlist import summary from inline content to a portal-rendered modal overlay that darkens the page and closes via backdrop, close button, or Escape.
- `2026-06-29T20:34Z` `[CODE]` Fixed stale `localhost/?spotify=connected` rendering by requiring the real Spotify session cookie for connected workspace UI and redirecting cookie-less connected URLs to the configured Spotify OAuth origin.
- `2026-06-29T20:36Z` `[CODE]` Removed the Spotify playlist tracks endpoint `fields` projection from import summary loading because selected playlist track fetches were failing while playlist listing still worked.
- `2026-06-29T20:39Z` `[CODE]` Selected playlist import route now propagates Spotify playlist import HTTP status and error message instead of collapsing all failures into a generic fetch message.
- `2026-06-29T20:41Z` `[CODE]` Spotify playlist import 403 handling now checks missing granted scopes and the connected UI shows a `Reconnect Spotify` action on import errors.
- `2026-06-29T20:44Z` `[CODE]` After user confirmed reconnect still produced Spotify 403, import error copy now treats granted-scope 403 as a playlist-specific access limitation and stops showing the reconnect button.
- `2026-06-29T20:54Z` `[CODE]` Added saved albums as a second Spotify source mode with `user-library-read`, `GET /api/spotify/albums`, saved-album pagination cards, and album import summaries using album track paging.
- `2026-06-29T20:57Z` `[CODE]` Fixed connected workspace hydration mismatch by delaying portal-rendered selected-source bars and import summary modal until after client mount via `useSyncExternalStore`.
- `2026-06-29T20:59Z` `[CODE]` Saved-albums source now renders album load errors even when zero albums are loaded and clarifies that Spotify saved albums do not include liked songs.
- `2026-06-29T21:01Z` `[CODE]` Connected workspace now defaults the source toggle to Saved albums and loads the first saved-albums page on mount.
- `2026-06-29T21:06Z` `[CODE]` Import review modal now uses a WAXLIST-styled dark editorial surface with gradient color treatment, serif album title, stat strip, candidate rows, and per-candidate individual source track lists.
- `2026-06-29T21:09Z` `[CODE]` Import review summaries now carry Spotify album cover URLs into album candidates and render a featured cover beside the modal title, a strongest-signal panel, and candidate-row cover thumbnails.
- `2026-06-29T21:15Z` `[CODE]` Shared button primitive now applies `cursor-pointer` to enabled buttons and the connected-workspace source toggle/backdrop controls were updated to match.
- `2026-06-29T21:18Z` `[CODE]` Import review summaries now resolve Spotify primary artist images server-side and render artist portraits in the modal header cover stack and candidate rows.
- `2026-06-29T21:26Z` `[CODE]` Added normalized Discogs search units to Spotify import summaries so each album/artist group becomes one Discogs search unit before matching.
- `2026-06-29T21:26Z` `[CODE]` Added server-side `POST /api/discogs/match` with Discogs env validation, serial one-request-per-search-unit processing, rate-limit header capture, deterministic candidate ranking, and no database writes.
- `2026-06-29T21:26Z` `[CODE]` Import review modal now includes a `Match to Discogs` action and compact match results sourced from normalized album search units.
- `2026-06-30T06:48Z` `[CODE]` Import review overlay now locks background page scrolling while open, preserves the prior scroll position, and restores it when the overlay closes.
- `2026-06-30T06:50Z` `[CODE]` Fixed import review artist-image loading by treating missing Spotify track `type` as a playable track and using saved-album album artists as the artist-image source.
- `2026-06-30T06:53Z` `[CODE]` Added Spotify artist-search fallback for import review artist images; artist images are now cached by both Spotify artist ID and normalized artist name.
- `2026-06-30T06:59Z` `[CODE]` Added vinyl crate results inside the import review flow: ranked records now show recommendation score, confidence, availability, price hint, "why this" evidence, local-only save action, Discogs open action, availability filter, and sort controls. Files: `components/spotify/connected-workspace.tsx`, `lib/matching/match-discogs-release.ts`.
- `2026-06-30T06:59Z` `[CODE]` Discogs match route now enriches the preliminary best match for each search unit with marketplace stats before final ranking, using existing server-side env validation and bounded request spacing. Files: `app/api/discogs/match/route.ts`, `lib/discogs/client.ts`.
- `2026-06-30T07:03Z` `[CODE]` Tightened Discogs match scoring to split separated Discogs titles into artist and release sides, require side-aware artist/title token coverage, and penalize separated titles with no side match. Fix targets false positives such as Spotify `Milky - Star` incorrectly matching Discogs `Flaming Star - Milky Bar Kids`. File: `lib/matching/match-discogs-release.ts`.
- `2026-06-30T07:07Z` `[CODE]` Added subtle fade/translate entrance and delayed fade/translate exit animations to the import review overlay while preserving scroll lock and Escape/backdrop/close-button behavior. File: `components/spotify/connected-workspace.tsx`.
- `2026-06-30T07:11Z` `[CODE]` Upgraded local wishlist storage from saved IDs to browser-local record snapshots and added a Wishlist panel under the profile `Open Spotify` CTA. Files: `components/spotify/connected-workspace.tsx`.
- `2026-06-30T07:14Z` `[CODE]` Fixed wishlist save timing by moving localStorage writes and custom event dispatch out of the `setWishlistIds` state updater; `VinylCrateResults` now syncs saved IDs from wishlist change events. File: `components/spotify/connected-workspace.tsx`.
- `2026-06-30T07:50Z` `[CODE]` Added Spotify playback/open controls without database storage: normalized track and album Spotify URLs now flow through import summaries and Discogs search units; import review shows `Play` per source track and `Play album` per candidate; vinyl crate and local wishlist can open the matched Spotify album. Files: `lib/spotify/workspace.ts`, `lib/matching/discogs-search-units.ts`, `components/spotify/connected-workspace.tsx`.
- `2026-06-30T07:56Z` `[CODE]` Added reusable status badge primitives and connected-workspace online/syncing/degraded/offline status indicators under the connected header area; wishlist remains browser-local and its left-column SVG header treatment was tightened. Files: `components/ui/status.tsx`, `components/spotify/connected-workspace.tsx`.
- `2026-06-30T07:59Z` `[CODE]` Added browser-local saved-album search in the album source section. Search filters the currently loaded saved-albums page by album, artist, release date, and album type; the query persists in `localStorage` under `waxlist:saved-album-search:v1`. File: `components/spotify/connected-workspace.tsx`.

## [DISCOVERIES]

- `2026-06-29T13:12Z` `[TOOL]` Uploaded liquid-gradient instructions provide a WebGL2 `LiquidGradientCanvas` component intended for `/components/ui/liquid-gradient.tsx` in a shadcn/Tailwind/TypeScript structure. Evidence: component file name `liquid-gradient.tsx` and exported `LiquidGradientCanvas`.
- `2026-06-29T13:12Z` `[ASSUMPTION]` Font setup remains undecided. Acceptable H1 candidates: `Cormorant Garamond`, `Playfair Display`, Georgia, or `ui-serif` fallback, provided the H1 is italic serif and aesthetically premium.
- `2026-06-29T13:12Z` `[ASSUMPTION]` External API behaviour must be re-checked against official Spotify and Discogs docs during implementation because limits and endpoint availability can change.
- `2026-06-29T13:32Z` `[TOOL]` App Router is in use via `app/layout.tsx` and `app/page.tsx`; no `pages/` directory is present.
- `2026-06-29T13:32Z` `[TOOL]` Tailwind CSS v4 is configured through `app/globals.css`, `postcss.config.mjs`, and package dependencies `tailwindcss` plus `@tailwindcss/postcss`.
- `2026-06-29T13:32Z` `[TOOL]` shadcn/ui is configured by `components.json`; aliases map `ui` to `@/components/ui`, and existing UI components are in `components/ui`.
- `2026-06-29T13:32Z` `[TOOL]` `LiquidGradientCanvas` exists at `components/ui/liquid-gradient.tsx` and supports reduced motion, offscreen pause, hidden-tab pause, fallback color, and WebGL2 rendering.
- `2026-06-29T13:33Z` `[TOOL]` `npm run lint` and `npm run build` pass on Next.js 16.2.9.
- `2026-06-29T13:33Z` `[TOOL]` Existing dev server at `http://localhost:3000` returns HTTP 200 and rendered markup includes WAXLIST metadata, hero copy, liquid-gradient canvas, privacy note, and CTA link.
- `2026-06-29T13:43Z` `[TOOL]` `npm run lint` and `npm run build` pass after adding Spotify OAuth routes; build lists `/api/auth/spotify/login` and `/api/auth/spotify/callback` as dynamic routes.
- `2026-06-29T13:43Z` `[TOOL]` `curl http://localhost:3000` returns HTTP 200 and rendered markup keeps the landing page CTA linked to `/api/auth/spotify/login`.
- `2026-06-29T13:46Z` `[TOOL]` `curl -I http://localhost:3000/api/auth/spotify/login` returns 307 to `/?spotify=configuration_error&missing=SPOTIFY_CLIENT_ID%2CSPOTIFY_CLIENT_SECRET` when credentials are missing.
- `2026-06-29T13:46Z` `[TOOL]` `npm run lint`, `npm run build`, and `curl http://localhost:3000` pass after the missing-env browser UX fix.
- `2026-06-29T13:50Z` `[ASSUMPTION]` For local Spotify OAuth, use `http://127.0.0.1:3000` in the browser, `.env.local`, and Spotify dashboard redirect URI; mixing `localhost` and `127.0.0.1` can break the OAuth state cookie.
- `2026-06-29T13:56Z` `[TOOL]` `npm run lint` and `npm run build` pass after adding `POST /api/auth/spotify/logout`; build output lists `/api/auth/spotify/logout` as a dynamic route.
- `2026-06-29T13:56Z` `[TOOL]` Live curl smoke test for the logout API route could not complete due connection failures to API-route URLs in the shell environment, while `curl -I http://localhost:3000` returned HTTP 200.
- `2026-06-29T14:02Z` `[TOOL]` `npm run lint` and `npm run build` pass after OAuth origin canonicalization.
- `2026-06-29T14:02Z` `[TOOL]` `curl -I http://localhost:3000/api/auth/spotify/login` returns 307 to `http://127.0.0.1:3000/api/auth/spotify/login`, confirming state cookie will be set on the callback origin.
- `2026-06-29T14:52Z` `[TOOL]` `npm run lint` and `npm run build` pass after fixing OAuth self-redirect loop.
- `2026-06-29T14:52Z` `[TOOL]` Live curl verification against `localhost:3000` and `127.0.0.1:3000` could not complete because the dev server was not reachable from the shell.
- `2026-06-29T14:58Z` `[TOOL]` `npm run lint` and `npm run build` pass after adding connected-state Sign Out UI and logout redirect behavior.
- `2026-06-29T14:58Z` `[TOOL]` Live curl verification for Sign Out could not complete because another Next dev server was already running on port 3000 and shell curl could not connect to the available dev-server port.
- `2026-06-29T15:01Z` `[TOOL]` `npm run lint` and `npm run build` pass after fixing Sign Out rendering for `?spotify=connected`.
- `2026-06-29T15:01Z` `[TOOL]` `curl -L http://localhost:3000/?spotify=connected` returns HTTP 200 markup containing the Sign Out form, `/api/auth/spotify/logout` action, and connected status message.
- `2026-06-29T15:08Z` `[TOOL]` `npm run lint` and `npm run build` pass after adding Spotify profile/playlists fetching; build lists `/api/spotify/profile` and `/api/spotify/playlists` as dynamic routes.
- `2026-06-29T15:08Z` `[TOOL]` `curl -I http://localhost:3000` returns HTTP 200 after Spotify profile/playlists route work.
- `2026-06-29T15:15Z` `[TOOL]` `npm run lint` and `npm run build` pass after adding profile and playlist picker UI.
- `2026-06-29T15:15Z` `[TOOL]` `curl -I http://localhost:3000` returns HTTP 200; quoted `curl -L 'http://localhost:3000/?spotify=connected'` returns HTTP 200 markup with connected workspace shell, Sign Out form, loading panels, and `ConnectedWorkspace` client component references.
- `2026-06-29T15:15Z` `[TOOL]` In-app browser `iab` was unavailable, so screenshot/visual inspection could not be completed in this session.
- `2026-06-29T16:37Z` `[TOOL]` `npm run lint` and `npm run build` pass after replacing the workspace bootstrap path and hardening client JSON parsing.
- `2026-06-29T15:41Z` `[TOOL]` `npm run lint`, `npm run build`, and `curl -I http://localhost:3000` pass after making playlist normalization defensive.
- `2026-06-29T15:46Z` `[TOOL]` `npm run lint`, `npm run build`, and `curl -I http://localhost:3000` pass after restoring playlist count resolution.
- `2026-06-29T15:47Z` `[TOOL]` `npm run lint` and `npm run build` pass after switching playlist counts to paged item counting.
- `2026-06-29T15:51Z` `[TOOL]` `npm run lint` and `npm run build` pass after preferring the playlist tracks `total` field.
- `2026-06-29T20:08Z` `[TOOL]` `npm run lint`, `npm run build`, and escalated `curl http://localhost:3000` pass after playlist pagination UI; non-escalated full curl to loopback failed with sandbox `Operation not permitted`.
- `2026-06-29T20:29Z` `[TOOL]` `npm run lint`, `npm run build`, and `curl -L http://localhost:3000` pass after adding import summary review; curl returned the existing WAXLIST landing hero and Connect Spotify CTA.
- `2026-06-29T20:32Z` `[TOOL]` `npm run lint`, `npm run build`, and `curl -L http://localhost:3000` pass after converting import summary review to a modal overlay.
- `2026-06-29T20:34Z` `[TOOL]` `npm run lint` and `npm run build` pass after connected-host fix; `curl -I 'http://localhost:3000/?spotify=connected'` returns 307 to `http://127.0.0.1:3000/?spotify=connected`.
- `2026-06-29T20:36Z` `[TOOL]` `npm run lint`, `npm run build`, and `curl -L http://localhost:3000` pass after removing the playlist tracks field projection.
- `2026-06-29T20:39Z` `[TOOL]` `npm run lint`, `npm run build`, and `curl -L http://localhost:3000` pass after exposing Spotify import errors; authenticated playlist import could not be reproduced from shell because the Spotify session cookie is browser-scoped.
- `2026-06-29T20:41Z` `[TOOL]` `npm run lint`, `npm run build`, and `curl -L http://localhost:3000` pass after adding 403 reconnect recovery UI.
- `2026-06-29T20:44Z` `[TOOL]` `npm run lint`, `npm run build`, and `curl -L http://localhost:3000` pass after replacing the persistent 403 reconnect prompt with playlist-specific guidance.
- `2026-06-29T20:54Z` `[TOOL]` `npm run lint`, `npm run build`, and `curl -L http://localhost:3000` pass after adding the saved-albums source mode; build lists `/api/spotify/albums` as a dynamic route.
- `2026-06-29T20:57Z` `[TOOL]` `npm run lint`, `npm run build`, and `curl -L http://localhost:3000` pass after portal hydration fix.
- `2026-06-29T20:59Z` `[TOOL]` `npm run lint`, `npm run build`, and `curl -L http://localhost:3000` pass after saved-albums error/empty-state fix.
- `2026-06-29T21:01Z` `[TOOL]` `npm run lint`, `npm run build`, and `curl -L http://localhost:3000` pass after making Saved albums the default source mode.
- `2026-06-29T21:06Z` `[TOOL]` `npm run lint`, `npm run build`, and `curl -L http://localhost:3000` pass after import review modal redesign; no browser screenshot inspection was performed.
- `2026-06-29T21:09Z` `[TOOL]` `npm run lint`, `npm run build`, and `curl -L http://localhost:3000` pass after adding cover-art UI to the import review overlay; no browser screenshot inspection was performed.
- `2026-06-29T21:15Z` `[TOOL]` `npm run lint`, `npm run build`, and `curl -L http://localhost:3000` pass after pointer-cursor updates for interactive buttons.
- `2026-06-29T21:18Z` `[TOOL]` `npm run lint`, `npm run build`, and `curl -L http://localhost:3000` pass after adding artist-image data and overlay UI.
- `2026-06-29T21:26Z` `[TOOL]` `npm run lint`, `npm run build`, and `curl -L http://localhost:3000` pass after Discogs search-unit matching work; build lists `/api/discogs/match` as a dynamic route.
- `2026-06-29T21:26Z` `[TOOL]` `curl -I http://localhost:3000/api/discogs/match` returns HTTP 405, confirming the existing dev server has the new POST-only route; shell POST smoke test returned curl code 7 and no route payload.
- `2026-06-30T06:48Z` `[TOOL]` `npm run lint`, `npm run build`, and `curl -L http://localhost:3000` pass after adding import overlay background scroll lock.
- `2026-06-30T06:50Z` `[TOOL]` `npm run lint`, `npm run build`, and `curl -L http://localhost:3000` pass after fixing artist-image lookup for import review summaries.
- `2026-06-30T06:53Z` `[TOOL]` `npm run lint`, `npm run build`, and `curl -L http://localhost:3000` pass after adding the Spotify artist-search image fallback.
- `2026-06-30T06:59Z` `[TOOL]` `npm run lint`, `npm run build`, and `curl -L http://localhost:3000` pass after adding vinyl crate ranked results. Curl returned the existing landing hero with `WAXLIST` and `Connect Spotify`; no browser screenshot inspection was performed.
- `2026-06-30T07:03Z` `[TOOL]` `npm run lint`, `npm run build`, and `curl -L http://localhost:3000` pass after tightening Discogs side-aware match scoring. Curl returned the existing landing hero with `WAXLIST` and `Connect Spotify`; no browser screenshot inspection was performed.
- `2026-06-30T07:07Z` `[TOOL]` `npm run lint`, `npm run build`, and `curl -L http://localhost:3000` pass after adding import overlay entrance/exit animations. Curl returned the existing landing hero with `WAXLIST` and `Connect Spotify`; no browser screenshot inspection was performed.
- `2026-06-30T07:11Z` `[TOOL]` `npm run lint`, `npm run build`, and `curl -L http://localhost:3000` pass after adding the local Wishlist panel. Curl returned the existing landing hero with `WAXLIST` and `Connect Spotify`; no browser screenshot inspection was performed.
- `2026-06-30T07:14Z` `[TOOL]` `npm run lint`, `npm run build`, and `curl -L http://localhost:3000` pass after fixing the React wishlist cross-component update warning. Curl returned the existing landing hero with `WAXLIST` and `Connect Spotify`; no browser screenshot inspection was performed.
- `2026-06-30T07:50Z` `[TOOL]` `npm run lint`, `npm run build`, and `curl -L http://localhost:3000` pass after adding Spotify playback/open controls. Curl returned the existing landing hero with `WAXLIST`, liquid-gradient canvas markup, and `Connect Spotify`; no browser screenshot inspection was performed.
- `2026-06-30T07:56Z` `[TOOL]` `npm run lint`, `npm run build`, and `curl -L http://localhost:3000` pass after adding status indicators. Curl returned the unauthenticated WAXLIST landing hero with liquid-gradient canvas markup and `Connect Spotify`; no browser screenshot inspection was performed.
- `2026-06-30T07:59Z` `[TOOL]` `npm run lint`, `npm run build`, and `curl -L http://localhost:3000` pass after saved-album search. Curl returned the unauthenticated WAXLIST landing hero with liquid-gradient canvas markup and `Connect Spotify`; no browser screenshot inspection was performed.

## [OUTCOMES]

- `2026-06-29T13:13Z` `[CODE]` Outcome: documentation now requires `.agent/CONTINUITY.md` as the canonical, living handoff file. Remaining: when a real repo is created, create the `.agent/` directory and copy this continuity file there.
- `2026-06-29T13:12Z` `[CODE]` Outcome: MVP specification and design brief exist. Remaining: create the actual Next.js app, add `.env.example`, integrate `LiquidGradientCanvas`, and implement the landing page.
- `2026-06-29T13:33Z` `[CODE]` Outcome: MVP foundation audit and landing stabilization are implemented and verified with lint, build, and HTTP render check. Remaining: implement Spotify OAuth route in a later scoped task.
- `2026-06-29T13:43Z` `[CODE]` Outcome: Spotify OAuth start/callback setup is implemented with state validation, token exchange, and temporary HTTP-only MVP session cookie. Remaining: add logout/session clearing and playlist import in later scoped tasks.
- `2026-06-29T13:46Z` `[CODE]` Outcome: Missing Spotify credentials now produce a landing-page setup notice instead of raw JSON. Remaining: add real Spotify app credentials to `.env.local` and registered redirect URI before end-to-end OAuth testing.
- `2026-06-29T13:50Z` `[CODE]` Outcome: Local OAuth setup docs now use Spotify-accepted loopback redirect `http://127.0.0.1:3000/api/auth/spotify/callback`. Remaining: update `.env.local` with the same URI and restart the dev server.
- `2026-06-29T13:54Z` `[CODE]` Outcome: Logout/session-clear route exists. Remaining: wire a UI control to call it after connected-state UI is added.
- `2026-06-29T14:02Z` `[CODE]` Outcome: OAuth login now canonicalizes host before setting state. Remaining: user should retry from `http://127.0.0.1:3000` after restarting dev server if env vars changed.
- `2026-06-29T14:52Z` `[CODE]` Outcome: OAuth login self-redirect loop is fixed in code. Remaining: restart dev server and clear existing `127.0.0.1` cookies if browser cached the old redirect loop.
- `2026-06-29T14:58Z` `[CODE]` Outcome: Connected landing state now exposes Sign Out and logout POST redirects to disconnected state. Remaining: manual browser check after restarting the active dev server.
- `2026-06-29T15:01Z` `[CODE]` Outcome: `http://localhost:3000/?spotify=connected` now renders the Sign Out button even when the temporary Spotify session cookie is not present on the `localhost` host.
- `2026-06-29T15:08Z` `[CODE]` Outcome: Spotify profile and playlist fetching endpoints exist without database persistence. Remaining: wire playlist picker UI and selected-playlist track import in later scoped tasks.
- `2026-06-29T15:15Z` `[CODE]` Outcome: Connected users now get profile and playlist picker UI backed by the new Spotify endpoints. Remaining: browser visual QA with a real Spotify session and selected-playlist track import.
- `2026-06-29T16:37Z` `[CODE]` Outcome: connected workspace bootstrap no longer depends on round-tripping through the app's own endpoints, reducing the chance of empty-response JSON parse errors. Remaining: confirm in a real browser session that Spotify auth cookies are present on `127.0.0.1:3000` and the playlist cards render.
- `2026-06-29T15:41Z` `[CODE]` Outcome: connected workspace no longer crashes when Spotify omits `playlist.tracks`; playlists fall back to `0` tracks. Remaining: confirm with a real Spotify session that playlist cards still render with accurate counts.
- `2026-06-29T15:46Z` `[CODE]` Outcome: connected workspace now attempts to derive playlist counts from Spotify's playlist tracks endpoint when the inline count is missing. Remaining: confirm with a real Spotify session that the counts match Spotify and that the extra per-playlist requests are acceptable.
- `2026-06-29T15:47Z` `[CODE]` Outcome: connected workspace now counts playlist items from the tracks endpoint when Spotify omits or underreports `tracks.total`. Remaining: confirm with a real Spotify session that the counts now render correctly and that performance is acceptable.
- `2026-06-29T15:51Z` `[CODE]` Outcome: playlist counts now come from the tracks response `total` field first, which should match Spotify's documented count for the playlist. Remaining: confirm in the browser that the cards now show nonzero counts for non-empty playlists.
- `2026-06-29T20:08Z` `[CODE]` Outcome: playlist selector can page through Spotify playlists with previous/next controls while keeping the current landing page design. Remaining: browser visual QA with a real Spotify session to confirm pagination controls and card layout.
- `2026-06-29T20:29Z` `[CODE]` Outcome: connected users can select a playlist and review normalized album candidates before Discogs matching without adding route handlers or database storage. Remaining: manual browser QA with a real Spotify session to confirm the import summary layout and data quality.
- `2026-06-29T20:32Z` `[CODE]` Outcome: import review now appears as a darkened-page popup rather than inline below playlists. Remaining: browser visual QA with a real Spotify session to confirm modal sizing and close behavior.
- `2026-06-29T20:34Z` `[CODE]` Outcome: localhost no longer renders a broken connected workspace without the 127.0.0.1-scoped Spotify cookie. Remaining: browser should use the configured OAuth origin after Spotify redirects back.
- `2026-06-29T20:36Z` `[CODE]` Outcome: selected playlist import now uses the standard Spotify playlist tracks response shape instead of a filtered response. Remaining: retest `Review import` in the browser with the Spotify session cookie.
- `2026-06-29T20:39Z` `[CODE]` Outcome: if selected playlist import still fails, the UI should now show Spotify's underlying reason/status for the failure.
- `2026-06-29T20:41Z` `[CODE]` Outcome: users with stale or insufficient Spotify grants can start OAuth again directly from the import error state.
- `2026-06-29T20:44Z` `[CODE]` Outcome: if reconnect does not resolve Spotify 403, user is guided to choose a playlist they created or copy songs into a new user-owned playlist before import.
- `2026-06-29T20:54Z` `[CODE]` Outcome: connected users can switch between Playlists and Saved albums at the top of the source panel and review saved album candidates before Discogs matching. Remaining: reconnect Spotify once to grant `user-library-read`, then browser QA saved-album loading and review modal.
- `2026-06-29T20:57Z` `[CODE]` Outcome: selected playlist/album bottom bars and import modal should no longer trigger React hydration mismatch warnings.
- `2026-06-29T20:59Z` `[CODE]` Outcome: saved-albums mode should now show either a real API error with reconnect action or a clear true-empty saved albums explanation.
- `2026-06-29T21:01Z` `[CODE]` Outcome: connected users should land on Saved albums first, with Playlists still available through the source toggle.
- `2026-06-29T21:06Z` `[CODE]` Outcome: import review should feel visually aligned with the landing page and now exposes the individual Spotify tracks behind each album candidate. Remaining: manual browser QA with a real Spotify session to confirm modal composition and scrolling.
- `2026-06-29T21:09Z` `[CODE]` Outcome: import review overlay should now feel more music-native by showing Spotify album artwork in the header and candidate list. Remaining: manual browser QA with real Spotify artwork.
- `2026-06-29T21:15Z` `[CODE]` Outcome: interactive buttons now present pointer affordance consistently through the shared button primitive and custom source-toggle controls.
- `2026-06-29T21:18Z` `[CODE]` Outcome: import review overlay should now show primary artist imagery when Spotify exposes artist IDs/images, with fallback music icons otherwise.
- `2026-06-29T21:26Z` `[CODE]` Outcome: connected users can send normalized album search units from import review to a server-side Discogs match run, with one Discogs search per normalized album and no stored Discogs/database data. Remaining: browser QA with real Spotify and Discogs credentials to confirm end-to-end match results and modal layout.
- `2026-06-30T06:48Z` `[CODE]` Outcome: opening the import review overlay should prevent the homepage/background from scrolling while keeping the overlay content scrollable.
- `2026-06-30T06:50Z` `[CODE]` Outcome: artist portraits should now populate in the import review overlay when Spotify exposes artist IDs/images for playlist or saved-album imports. Remaining: confirm in browser with real Spotify data.
- `2026-06-30T06:53Z` `[CODE]` Outcome: if direct Spotify artist ID lookup does not provide an image, import review summaries now try Spotify artist search by normalized artist name before falling back to the default icon.
- `2026-06-30T06:59Z` `[CODE]` Outcome: after `Match to Discogs`, users should see a ranked vinyl crate with buyability cues and can save/remove records via browser localStorage without database persistence. Remaining: manual browser QA with real Spotify and Discogs credentials to verify crate layout, marketplace hints, and local save state.
- `2026-06-30T07:03Z` `[CODE]` Outcome: Discogs candidates with matching words on the wrong side of an `Artist - Release` title should no longer score as reliable matches. Remaining: manual browser QA on `Milky - Star` with real Discogs search results to confirm the bad candidate is excluded from the crate.
- `2026-06-30T07:07Z` `[CODE]` Outcome: import review overlay should fade up on open and fade down on close. Remaining: manual browser QA with a real connected session to confirm motion timing feels subtle.
- `2026-06-30T07:50Z` `[CODE]` Outcome: connected users can open Spotify playback for albums and individual source tracks from the review/results flow while wishlist remains browser-local via `localStorage`. Remaining: manual browser QA with a real Spotify session to confirm external Spotify links open the expected track or album.
- `2026-06-30T07:11Z` `[CODE]` Outcome: saved Discogs records now persist as localStorage snapshots, display in the left-column Wishlist panel, and can be removed locally without database storage. Remaining: manual browser QA with real Spotify and Discogs credentials to confirm save/remove behavior and connected-layout spacing.
- `2026-06-30T07:14Z` `[CODE]` Outcome: saving a crate result should no longer trigger React's `Cannot update a component while rendering a different component` console warning. Remaining: browser QA with real match results to confirm no warning appears when toggling Save/Saved.
- `2026-06-30T07:56Z` `[CODE]` Outcome: connected workspace now communicates online, syncing, degraded playlist-sync, and offline states with a small animated status symbol below the connected header section. Remaining: manual browser QA with a real Spotify session to confirm placement under the header and left-column wishlist spacing.
- `2026-06-30T07:59Z` `[CODE]` Outcome: saved-albums mode now has search without database persistence or landing-page design changes. Remaining: manual browser QA with a real Spotify session to confirm filtered album cards, persisted query, and selected-album banner behavior.
