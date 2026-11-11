# WAXLIST

A vinyl collection workspace. Connect a listening source, build a crate of what
you're missing, and keep your shelf, wantlist, and listening diary in one place.

## Run it

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:3000` and stay on that host. Spotify OAuth sends its state
cookie back to the same origin, so a different hostname breaks the callback.

## Environment

Copy `.env.example` to `.env.local` and fill in the credentials you have.

```bash
NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
SPOTIFY_REDIRECT_URI=http://127.0.0.1:3000/api/auth/spotify/callback
DISCOGS_USER_AGENT=Waxlist/0.1 +http://127.0.0.1:3000
DISCOGS_TOKEN=
```

Register this exact redirect URI in the Spotify Developer Dashboard:

```txt
http://127.0.0.1:3000/api/auth/spotify/callback
```

Anything without `NEXT_PUBLIC_` stays on the server.

## Database branch

The Neon branch `production`, ID `br-dawn-butterfly-ab6edus9`, is the default
branch in project `waxlist`. It was previously named
`mcp-migration-2026-07-23T23-27-17`. The former production branch is retained
as `legacy-production`, ID `br-steep-snow-abt15jai`.
[Neon branches evolve independently](https://neon.com/docs/introduction/branching).

Local development uses the `development` branch, ID
`br-empty-butterfly-abmaiam8`, created from production. `.env.local` points both
the database and Auth URLs to development, and `.neon` pins that branch for
CLI commands. Development Auth trusts `http://127.0.0.1:3000` and allows
localhost. Restart the local server after changing these settings.

Development started with a copy of production's records and Auth accounts.
Future changes are independent. Adding or editing a local record changes
development only. Keep the hosted production environment on the production
database and Auth URLs; do not copy the local URLs into its settings.

The app and Drizzle migrations read `DATABASE_URL` through Next's environment
loader. Sign-in reads `NEON_AUTH_BASE_URL`. Keep both on the same branch and
database. `.neon` pins the CLI context, but editing it alone does not change
the app's connection or synchronize branch data.

Run the read-only check after changing database settings:

```bash
npm run db:check
```

It prints the CLI branch and actual database endpoint, checks app column names,
types and nullability, and compares the latest migration hash. It does not
compare indexes, constraints, older migration gaps, or records across branches.
Historical local repairs skipped some migration markers, so the migration row
count alone does not establish schema drift.

Production schema updates should apply reviewed, committed SQL migrations
during releases. Moving data between branches requires a separate data
reconciliation. Do not reset either branch to make their row counts match.

## Ground rules

- Spotify and Discogs calls run server-side.
- Matching is deterministic, and weak matches stay in review.
- `DESIGN.md` is the visual source of truth; `AGENTS.md` covers the rest.
