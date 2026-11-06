# ADR 0002: Discogs CC0-only public boundary

- Status: Accepted
- Date: 2026-07-30

## Context

Discogs API terms distinguish catalogue data from Restricted Data such as
marketplace, image, seller, collection, wantlist, and user data.

## Decision

The public collection-gap flow uses only fresh catalogue fields required for
deterministic release matching and returns a Discogs deep link with attribution.
Public cache lifetime is capped at one hour. Restricted routes and surfaces
default closed in a server-only capability registry.

The disabled-by-default pressing-proof beta extends that same CC0 boundary to:

- seed search by artist, title, barcode, catalogue number, or Discogs release ID;
- master-version comparison;
- release format, label, country/year, catalogue number, barcode, matrix/runout,
  manufacturing, pressing, and mastering identifiers;
- Discogs attribution, freshness timestamps, throttling, and deep links.

The catalogue client strips images, notes, marketplace/pricing/seller fields,
Discogs collection/wantlist data, and API resource URLs before route responses
are built. Barcode discovers a candidate family but is never sufficient proof
of one exact pressing.

## Consequences

- Marketplace availability and pricing cannot influence public classification.
- Owned and wanted actions write WAXLIST-native state.
- Legacy Restricted Data code and data remain intact for local research or a
  future explicitly approved build.
- Client input cannot enable a disabled capability.
- Missing Discogs metadata never eliminates a version.
- A truncated version set, failed detail load, or top score cannot produce an
  `exact` pressing result.
- Saved investigations persist evidence and candidate IDs, then re-fetch
  current catalogue metadata when resumed.
