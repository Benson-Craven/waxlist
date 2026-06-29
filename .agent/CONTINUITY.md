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

## [OUTCOMES]

- `2026-06-29T13:13Z` `[CODE]` Outcome: documentation now requires `.agent/CONTINUITY.md` as the canonical, living handoff file. Remaining: when a real repo is created, create the `.agent/` directory and copy this continuity file there.
- `2026-06-29T13:12Z` `[CODE]` Outcome: MVP specification and design brief exist. Remaining: create the actual Next.js app, add `.env.example`, integrate `LiquidGradientCanvas`, and implement the landing page.
- `2026-06-29T13:33Z` `[CODE]` Outcome: MVP foundation audit and landing stabilization are implemented and verified with lint, build, and HTTP render check. Remaining: implement Spotify OAuth route in a later scoped task.
