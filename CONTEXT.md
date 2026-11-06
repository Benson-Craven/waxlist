# WAXLIST domain context

## Ubiquitous language

**Listening source**  
A provider that supplies deliberate listening, library, or user-supplied link
evidence through an approved interface. It is not the user's WAXLIST identity.

**Album evidence**  
Normalized artist, release, tracks, listen count, timestamps, and stable source
identifiers supporting the assertion that an album belongs in a collector's
review crate.

**YouTube link evidence**  
A canonical individual video URL and ID with user-supplied artist, album, and
optional note. It never asserts that the user watched or listened to the video.

**Catalogue match**  
A deterministic mapping between album evidence and a Discogs physical release,
with an explicit confidence score.

**Master family**  
The Discogs master identity grouping physical releases of the same album.
Owning any release in the matched master family counts as owning the album.

**Native collection state**  
The owned or wanted state stored by WAXLIST. Public operation does not depend
on Discogs collection or wantlist APIs.

**Gap candidate**  
Album evidence classified as `owned`, `wanted`, `missing`, `review`, or
`unmatched`. Incomplete evidence or weak catalogue confidence must be reviewed
before it can be called missing.

**Provider approval**  
Recorded written permission and operational access sufficient to enable a
provider capability in a public build. A client-side flag is never approval.

**Pressing investigation**  
An evidence-led attempt to distinguish versions in one Discogs master family.
It may be active, resolved, or dismissed. An unresolved investigation never
writes a probable release into collection truth.

**Pressing resolution**  
One of three truthful outcomes: `exact` when one candidate is uniquely
supported by a complete comparison, `shortlist` when multiple viable candidates
remain and another discriminator is available, or `unknown` when evidence or
catalogue completeness cannot support responsible narrowing.

**Anonymous preview**  
One 24-hour, signed-cookie investigation bound to a single release family.
Iterative evidence checks are allowed inside that family; saving, resuming, and
starting another family require an invite-only account.

## Identity boundary

Managed Neon Auth owns account identity. Listening providers are optional source
adapters linked to that account. A Spotify identifier is a nullable legacy link,
not a primary WAXLIST identity.

## Public data boundary

Discogs is used publicly only for fresh CC0 catalogue resolution and deep links.
Marketplace, pricing, images, sellers, collection sync, wantlist sync, and other
Restricted Data remain behind server-only capability gates.

Pressing proof uses only release/version/format/label/catalogue-number/barcode/
identifier/manufacturing/mastering catalogue fields. Missing catalogue metadata
is uncertainty, not negative evidence.
