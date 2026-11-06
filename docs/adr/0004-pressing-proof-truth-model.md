# ADR 0004: Pressing-proof truth model

- Status: Accepted for disabled-by-default beta validation
- Date: 2026-07-30

## Context

Generic collection scanning and duplicate checks are established product
categories. WAXLIST needs a narrower collector problem where its behavior is
both useful and defensible: guided version identification without pretending
that incomplete Discogs metadata is certainty.

## Decision

The pressing-proof beta uses the proposition `Prove the pressing—do not guess.`
and returns exactly one of:

- `exact`: one uniquely supported candidate from a complete, non-truncated
  comparison with no failed or unloaded candidate details;
- `shortlist`: multiple viable candidates remain and WAXLIST can name the next
  evidence field that would reduce them;
- `unknown`: conflicts, insufficient evidence, missing comparison metadata, or
  an unavailable discriminator prevent responsible narrowing.

Questions are ordered by collector effort: barcode, catalogue number, country,
label/year/format, matrix/runout, then manufacturing/mastering identifiers.
Fields that do not differ across viable candidates are skipped. Matched,
conflicting, and unavailable evidence are shown without probability-style
percentages.

The public preview is limited to one release family for 24 hours through a
signed HTTP-only cookie and hashed-IP abuse limits. Invite-only authentication
is required to save or resume. Saved evidence is revalidated against current
catalogue metadata before persistence or resolution. Unresolved investigations
never write a probable release into collection truth.

## Release gate

`WAXLIST_ENABLE_PRESSING_PROOF` defaults to `false`. The existing landing
hierarchy remains Spotify-first until six moderated sessions meet all planned
truthfulness, task-success, completion-time, and preference gates. Any false
`exact` result blocks activation.

## Consequences

- The first slice has no photo/AI identification, grading, pricing, seller,
  shipping, marketplace, or Discogs user-data behavior.
- Current catalogue access requires a network connection.
- The feature may remain secondary if moderated validation misses its gates.
