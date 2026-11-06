# ADR 0003: Spotify-first beta and YouTube link evidence

- Status: Accepted
- Date: 2026-07-24
- Supersedes: ADR 0001 only where it selected ListenBrainz as the first source

## Context

WAXLIST retains provider-neutral email/password identity, but the invite-only
beta needs Spotify as the default intake path. The beta also needs a narrow way
to use individual YouTube links without scraping, watch-history inference, or
premature YouTube API and Discogs data combination.

## Decision

- Spotify is the default Crate source; ListenBrainz remains an alternative.
- OAuth state and encrypted Spotify sessions are bound to the signed-in WAXLIST
  auth identity. Safe legacy claiming remains available during linking.
- YouTube uses provider `youtube` and source type `video_links`.
- The link normalizer parses URLs locally, makes no outbound request, stores
  canonical URL/ID plus user metadata, and requires artist/album confirmation
  before catalogue matching.
- `watch_history` and `music_library` remain disabled future source types.
- Listening snapshots are unique by user, provider, and source type.

## Consequences

- Canonical Crate URLs can coexist without overwriting future YouTube modes.
- A YouTube link is labelled only as link evidence and includes `Open YouTube`.
- Playlist expansion, embeds, thumbnails, automatic music inference, and raw
  history archives are outside the beta.
- Future history work is governed by Google's `myactivity.youtube` Data
  Portability schema and consent/archive workflow; ordinary YouTube API data is
  not combined with Discogs without a separate policy review.

## References

- <https://developers.google.com/data-portability/schema-reference/my_activity?hl=en>
- <https://developers.google.com/data-portability/user-guide/introduction?hl=en>
- <https://developers.google.com/youtube/terms/developer-policies-guide>
