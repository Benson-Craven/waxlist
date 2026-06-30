# WAXLIST

WAXLIST is a Next.js MVP that will turn Spotify listening data into a Discogs-backed vinyl crate worth collecting.

## Current Foundation

- Next.js App Router with routes under `app/`.
- Tailwind CSS v4 via `app/globals.css` and `@tailwindcss/postcss`.
- shadcn/ui configured with components under `components/ui`.
- Landing page uses `components/ui/liquid-gradient.tsx` for the required dark liquid gradient.

## Getting Started

Install dependencies and run the development server with npm:

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:3000`. Use this host consistently for Spotify OAuth; the redirect URI and browser origin must match so the OAuth state cookie is sent back on callback.

## Environment

Copy `.env.example` to `.env.local` and fill real credentials when API work begins.

```bash
NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
SPOTIFY_REDIRECT_URI=http://127.0.0.1:3000/api/auth/spotify/callback
DISCOGS_USER_AGENT=Waxlist/0.1 +http://127.0.0.1:3000
DISCOGS_TOKEN=
```

Secrets without `NEXT_PUBLIC_` must stay server-side.

In the Spotify Developer Dashboard, register this exact local redirect URI:

```txt
http://127.0.0.1:3000/api/auth/spotify/callback
```

## MVP Guardrails

- Do not add database logic until the persistence task is scoped.
- Spotify OAuth uses temporary HTTP-only cookies only; no database token storage exists yet.
- Discogs matching is server-side and uses normalized album search units; no Discogs data is stored yet.
- Keep UI direction aligned with `DESIGN.md`.
