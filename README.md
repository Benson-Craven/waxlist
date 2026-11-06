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

## Ground rules

- Spotify and Discogs calls run server-side.
- Matching is deterministic, and weak matches stay in review.
- `DESIGN.md` is the visual source of truth; `AGENTS.md` covers the rest.
