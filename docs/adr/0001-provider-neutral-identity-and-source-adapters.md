# ADR 0001: Provider-neutral identity and listening-source adapters

- Status: Accepted
- Date: 2026-07-23

## Context

WAXLIST previously treated a Spotify profile identifier as account identity and
coupled album evidence to Spotify-shaped imports. Public Spotify policy and
quota access do not support that dependency.

## Decision

Managed Neon Auth email/password identity is the owner of protected data.
Listening providers implement a provider-neutral adapter contract and persist
only normalized evidence. ListenBrainz is the first adapter. Spotify remains a
nullable legacy link with a one-time, signed-in claim flow.

## Consequences

- Protected routes resolve a Neon Auth session before loading owner data.
- A provider can be disabled without making collection data inaccessible.
- Existing Spotify-linked rows are preserved by an additive migration.
- Cross-account legacy claims fail closed and temporary Spotify credentials are
  discarded.
