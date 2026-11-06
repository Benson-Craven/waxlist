# Listening-source and Discogs feasibility

Checked: 2026-07-23

> Product direction superseded on 2026-07-24 by
> `docs/adr/0003-spotify-first-beta-and-youtube-link-evidence.md`: Spotify is
> now the beta default, ListenBrainz remains an alternative, and individual
> YouTube links are accepted without fetching or playback inference. The
> feasibility notes below remain as historical research evidence.

## Product conclusion

WAXLIST should not launch as a broad streaming recommendation engine. The
defensible first product imports music a collector deliberately saved or
scrobbled, reconciles normalized album evidence with physical catalogue
identities, and surfaces gaps in WAXLIST-native collection state.

## Feasibility matrix

| Source | Feasibility | Public decision |
| --- | --- | --- |
| ListenBrainz | High | First tracer bullet. Import public username listens within a bounded window and respect response rate-limit headers. |
| YouTube Music Data Portability | Medium-high | Phase two. Requires Google verification/reverification and asynchronous archive handling. Request only `dataportability.youtube.music`. |
| Spotify | Low | Disable public importing until written policy approval and viable quota access exist. Retain only a one-time legacy-data claim. |
| Ordinary YouTube Data API | Low | Do not implement. It does not provide watch history and its policy boundary is unsuitable for this matching workflow. |
| Discogs | Split | Public use is limited to fresh CC0 catalogue fields and deep links. Restricted marketplace, image, seller, collection, wantlist, and user data stay gated. |
| Last.fm | Conditional | Revisit only with commercial permission. |
| Apple Music | Conditional | Revisit after the core flow; MusicKit and developer-program overhead are not justified for the tracer bullet. |

## Primary sources checked

- ListenBrainz user API and listens endpoint:
  <https://listenbrainz.readthedocs.io/en/latest/users/api/index.html> and
  <https://listenbrainz.readthedocs.io/en/latest/users/api/core.html>
- Google Data Portability overview and YouTube schema:
  <https://developers.google.com/data-portability/user-guide/overview> and
  <https://developers.google.com/data-portability/schema-reference/youtube>
- Spotify Developer Policy and quota modes:
  <https://developer.spotify.com/policy> and
  <https://developer.spotify.com/documentation/web-api/concepts/quota-modes>
- YouTube API Services developer policies:
  <https://developers.google.com/youtube/terms/developer-policies>
- Discogs API Terms of Use:
  <https://support.discogs.com/hc/en-us/articles/360009334593-API-Terms-of-Use>
- Last.fm API Terms of Service: <https://www.last.fm/api/tos>
- Neon Auth Next.js API-only quick start:
  <https://neon.com/docs/auth/quick-start/nextjs-api-only>

## Public hard gates

- Spotify import requires recorded written approval and viable quota access.
- Ordinary YouTube matching is prohibited for this product path.
- Last.fm commercial use requires permission.
- Discogs Restricted Data remains unavailable publicly without a separately
  recorded approval and implementation review.
- YouTube Music portability remains phase two and must delete its raw archive
  immediately after normalization.

## Data minimization

- ListenBrainz imports review at most 500 listens and retain at most 100
  deduplicated album candidates.
- Only the latest successful normalized snapshot per user/provider is retained.
- Raw provider responses are not persisted.
- Public Discogs cache lifetime is capped at one hour and only catalogue fields
  needed for deterministic matching are returned.
