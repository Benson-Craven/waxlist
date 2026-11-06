# DESIGN.md

# WAXLIST MVP Design Specification

This file is the strict visual and interaction source of truth for the WAXLIST MVP.

All agents must read this file before touching layout, styling, components, or copy on user-facing screens.

## 0. Current public product boundary

The 2026-07-24 beta is Spotify-first while retaining provider-neutral account
identity. The landing primary action is `Start with Spotify`; ListenBrainz and
individual YouTube links are secondary source links. The authenticated Crate
uses canonical source URLs and defaults to Spotify.

The 2026-07-30 pressing-proof vertical slice is disabled by default. While it is
under validation, the landing hierarchy above remains binding. When
`WAXLIST_ENABLE_PRESSING_PROOF=true`, `/identify` and authenticated Digging may
show the shared `Prove the pressing—do not guess.` workflow. Do not change the
public landing CTA to `Identify a pressing` until the validation gates in
`USER_REQUIREMENTS.md` succeed.

### Pressing-proof surface

- Keep the WAXLIST cream/aubergine/magenta/amber system.
- Lead with the evidence task, not a marketing hero.
- Camera scanning and manual entry must be adjacent; manual entry never hides.
- Ask one question at a time and explain why it can reduce the shortlist.
- Outcome labels are exactly `Exact`, `Shortlist`, and `Unknown`.
- Use text and icons as well as colour.
- Candidate cards show matched, conflicting, and unavailable evidence.
- Do not show confidence percentages or a primary `Strong match` badge.
- In authenticated Digging, show native owned/wanted/duplicate state without
  introducing Discogs collection or wantlist data.
- Clearly state that current catalogue checks require a network connection.

## 1. Product Name and Visual Positioning

Primary display name: `WAXLIST`.

Internal project name may still appear in legacy notes, but the UI must present the product as `WAXLIST`.

Product vibe:

- Premium music discovery.
- Modern streaming-to-vinyl bridge.
- Dark, atmospheric, collectible, and editorial.
- More like a polished music product than a generic SaaS dashboard.

Design inspiration:

- Use Suno as a broad design reference for an immersive music product landing page: large central hero copy, simple prompt/CTA focus, dark creative background, and music-centric visual rhythm.
- Do **not** copy Suno assets, logos, layouts pixel-for-pixel, text, or branding.
- Translate the design direction into WAXLIST's own vinyl/discovery identity.

## 2. Non-Negotiable Landing Page Requirements

The home page must include, above the fold:

1. Full-screen or near full-screen dark liquid-gradient background.
2. Centered hero content.
3. H1 using an italic serif type treatment.
4. H1 text must be exactly:

```txt
WAXLIST
```

5. A short supporting line below the H1.
6. A prominent `Start with Spotify` button directly underneath the supporting line.
7. Secondary `Use ListenBrainz` and `Add YouTube links` links.
8. A small invite/privacy reassurance below the source actions.

Required visual hierarchy:

```txt
Liquid animated background
  ↓
Small eyebrow / label
  ↓
Huge italic serif WAXLIST h1
  ↓
One-sentence value proposition
  ↓
Start with Spotify button
  ↓
ListenBrainz and YouTube links
  ↓
Privacy reassurance
```

## 3. Background System

Use the provided `LiquidGradientCanvas` component as the primary app background.

Required component location:

```txt
src/components/ui/liquid-gradient.tsx
```

If the file does not exist, create it from the provided `liquid-gradient.tsx` component instructions.

The app should use a shadcn-compatible component structure:

```txt
src/components/ui/
```

If the project uses a root-level `components/ui` folder instead of `src/components/ui`, follow the project convention consistently and update imports.

### Required Background Treatment

The hero background must include:

- `LiquidGradientCanvas` positioned absolutely behind all content.
- A dark overlay to keep text readable.
- A subtle vignette.
- Optional grain/noise overlay using CSS only.
- No stock images for the initial landing background.

Recommended `LiquidGradientCanvas` params:

```tsx
<LiquidGradientCanvas
  colors={["#08030f", "#261047", "#6d2aa8", "#d34278", "#f08a4b"]}
  speed={0.38}
  scale={0.58}
  seed={18}
  turbAmp={0.55}
  turbFreq={0.72}
  turbIter={10}
  waveFreq={1.7}
  distBias={-0.08}
  ditherMode="grain"
  dither={0.035}
  exposure={1.08}
  contrast={1.16}
  saturation={1.08}
  maxDpr={1.5}
  respectReducedMotion
  pauseWhenOffscreen
  pauseWhenHidden
  className="absolute inset-0 h-full w-full"
/>
```

Fallback background if WebGL fails:

```css
background:
  radial-gradient(circle at 50% 25%, rgba(211, 66, 120, 0.28), transparent 34%),
  radial-gradient(circle at 20% 80%, rgba(109, 42, 168, 0.35), transparent 38%),
  #05030a;
```

## 4. Typography

The H1 must use an italic serif font.

Preferred font stack:

```css
font-family: "Cormorant Garamond", "Playfair Display", Georgia, ui-serif, serif;
font-style: italic;
```

If external fonts are not configured yet, use Tailwind/browser fallback classes:

```txt
font-serif italic
```

H1 requirements:

- Text: `WAXLIST`.
- Uppercase.
- Italic serif.
- Large scale.
- Tight line height.
- Slight negative letter spacing.
- Must feel editorial and luxurious, not tech-dashboard generic.

Suggested Tailwind H1 classes:

```txt
font-serif italic text-[clamp(5rem,16vw,15rem)] leading-[0.8] tracking-[-0.08em]
```

Supporting text:

- Use a clean sans-serif.
- Keep it short.
- Maximum width: `36rem`.
- Tone: direct, tasteful, music-focused.

Approved supporting line:

```txt
Turn albums on your radar into a reviewable crate of what you own, want, and are still missing.
```

Approved eyebrow:

```txt
Listening history, reconciled for collectors
```

## 5. Colour Palette

Use only this palette unless a new design decision is recorded in `CONTINUITY.md`.

```txt
Base black:        #05030A
Deep aubergine:   #160A24
Purple:           #6D2AA8
Magenta:          #D34278
Warm amber:       #F08A4B
Cream text:       #FFF4E8
Muted cream:      rgba(255, 244, 232, 0.72)
Border glass:     rgba(255, 255, 255, 0.16)
Spotify green:    #1DB954
Spotify dark:     #159443
```

Do not use bright white as the dominant text colour. Prefer cream/off-white.

## 6. Home Page Layout

Target file:

```txt
src/app/page.tsx
```

Required layout:

```txt
main.relative.min-h-svh.overflow-hidden
  LiquidGradientCanvas.absolute.inset-0
  overlay.absolute.inset-0
  section.relative.z-10.flex.min-h-svh.items-center.justify-center
    div.hero-content
      p.eyebrow
      h1 WAXLIST
      p.supporting-copy
      StartCrateButton
      p.privacy-note
```

Hero alignment:

- Center both horizontally and vertically.
- Text alignment: center.
- Width: full with safe horizontal padding.
- Avoid crowded content.

Recommended container classes:

```txt
relative z-10 mx-auto flex min-h-svh w-full max-w-6xl flex-col items-center justify-center px-6 py-20 text-center
```

## 7. Start With Spotify Button

The primary CTA must say exactly:

```txt
Start with Spotify
```

Required style:

- Pill-shaped.
- Large enough to feel important.
- Cream base with dark text.
- Dark text or near-black text for contrast.
- Subtle shadow/glow.
- Hover state: slightly brighter/lifted.
- Focus-visible ring.

Suggested Tailwind classes:

```txt
inline-flex h-14 items-center justify-center rounded-full bg-[#FFF4E8] px-8 text-sm font-semibold text-[#08030F] shadow-[0_0_40px_rgba(255,244,232,0.18)] transition hover:-translate-y-0.5 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFF4E8] focus-visible:ring-offset-2 focus-visible:ring-offset-[#05030A]
```

The button may include a simple record or Spotify icon. It starts WAXLIST
email/password account creation with Spotify selected; Spotify remains a linked
source rather than account identity.

## 8. Glass / Card Style

For future public screens, use dark glass panels over the liquid background.

Panel style:

```txt
rounded-3xl border border-white/10 bg-black/25 shadow-2xl backdrop-blur-xl
```

Cards should feel like collectible record sleeves, not generic tables.

Use tables only where dense comparison is genuinely needed.

### Authenticated app surfaces

The signed-in workspace is borderless. Do not draw outlines around panels,
cards, tiles, inputs, carousel artwork, or controls; separate surfaces with
background value, spacing, and soft shadows instead. The app shell applies the
`wax-flat` root class to enforce this. Focus-visible rings and selected-state
highlights stay, because they communicate interaction rather than decoration.

The Dashboard is one continuous gradient surface. No panel background, radius,
or shadow is drawn inside it; the dashboard container owns the shared stage
gradient, and the synopsis, metric band, crate prompt, and shortcut rows sit
directly on it with spacing instead of nested cards.

The Dashboard leads with a shelf synopsis, not a carousel: one serif italic
sentence about the owned shelf, then up to four quiet facts on one row
(format, era, most collected artist, average rating). It is text only, so the
surface stays calm and the metric band keeps the visual weight. The orbit
carousel does not appear on the Dashboard.

The merged Collection page is one continuous gradient surface too: the browse
toolbar, the orbit stage, and the shelving grid share one generously padded
container rather than sitting in separate cards.

The sidebar is the workspace page selector. On desktop it collapses to a narrow
icon rail with a small chevron handle on its edge; every workspace link keeps
its icon, tooltip, and active state while the wordmark, labels, and sign-out
copy fall away. Mobile keeps the full-width navigation strip.

### Badges and labels

Every state label is neutral. Owned, Wanted, Missing, Duplicate, priority,
confidence, severity, and similar chips share one cream-on-translucent
treatment; the text and icon carry the meaning, never green, amber, or magenta
fills. Use `components/ui/label-badge.tsx` instead of hand-rolled pill classes.
Tones only change cream opacity: `neutral` for the common state, `quiet` for
secondary metadata, `attention` for the one thing to look at first, and
`outline` for a standalone frame. Do not reintroduce semantic badge colours on
individual screens.

The `Wanted` state on a record card is a cream heart badge rather than a worded
chip. The heart carries the state visually; keep the word `Wanted` in the
tooltip and the accessible name.

### Favourites

Favourite is the app's only star affordance. The toggle is an outline star that
fills with cream when it is on, and it never borrows the amber rating stars.
The heart is reserved for wanted/wantlist; do not use it for favourites.

- `Favourites` is a lens of the Wantlist shortlist, not a separate list. Its tab
  and empty state use the same star.
- The Collection carousel is the favourite's feature surface: only starred
  records appear there, ordered by rating. It never falls back to unstarred
  records; an unstarred shelf shows a quiet prompt to star a record instead.
- Cards that do not carry a star toggle show a small cream star beside the
  status or shelf code when the record is favourited.
- Favouriting never changes owned/wanted status.

### Record inspector panel

The record inspector is a side panel that slides out from the right edge of the
screen. It never reserves a column in the workspace: the workspace renders at
full width and the panel overlays it.

- Selecting a record opens the panel. The header toggle opens and hides it
  directly; the panel's own close button and `Escape` close it.
- Desktop keeps the workspace live behind the panel so another record can be
  selected without closing it. Below the large breakpoint the panel is a modal
  drawer with a dimmed backdrop.
- Closed does not mean unmounted. The panel stays mounted and returns to the
  screen state it was left in, so unsaved edits survive hiding it.
- Keep the inspector chrome minimal: one `Inspector` label and a close control.
  The record title is the panel heading.
- Views that pre-select a record on load must not force the panel open.
- The inspector's shelf block is read-only: the group in serif italic and the
  shelf code in small tracked caps, with a short pointer to Collection for
  group changes. Do not render location inputs in the inspector. A record
  without a group reads `Unsorted`, not `No shelf location`.
- Inspector section labels are one-word small caps (`Status`, `Rating`,
  `Shelf`, `Tags`, `Notes`), and the primary submit is simply `Save`.

## 9. App-Wide Design Rules

Do:

- Keep the interface sparse and cinematic.
- Use the liquid background on the landing page and optionally as a subtle app shell background.
- Use glass panels for playlists, crate results, and wishlist cards.
- Keep copy short and confident.
- Make loading states feel like scanning/building a crate.
- Prioritise readability over animation.

Do not:

- Use a plain white SaaS dashboard style.
- Use cartoon record graphics.
- Use heavy neon cyberpunk styling.
- Use default blue links/buttons.
- Use many competing colours.
- Prefix every app UI string with the user's name.
- Copy Suno text, logos, assets, or exact layout.
- Add checkout, payment, seller messaging, or marketplace automation.

## 10. Screen-Specific Direction

### Landing

Goal: make the user want to start a collection-gap crate immediately.

Required copy:

```txt
Listening history, reconciled for collectors
WAXLIST
Turn albums on your radar into a reviewable crate of what you own, want, and are still missing.
Start with Spotify
Use ListenBrainz
Add YouTube links
Invite-only beta. Your WAXLIST email/password account stays separate from connected music sources.
```

### Playlist Picker

Mood: record-bin browsing.

- Show playlists as glass cards.
- Include playlist cover image if available.
- Use track count.
- CTA copy: `Build crate`.

### Crate Source Selector

- Sources: `Spotify`, `ListenBrainz`, `YouTube`.
- Default: Spotify.
- Canonical URLs:
  - `/app?view=crate&source=spotify`
  - `/app?view=crate&source=listenbrainz`
  - `/app?view=crate&source=youtube`
- YouTube presents individual links as `YouTube link`, offers `Open YouTube`,
  and labels watch-history import `Coming soon`.

### Import Review Overlay

Mood: a quick checkpoint between picking a source and searching Discogs.

- The overlay is one fixed surface with a compact sticky header (source cover,
  `Review import` label, source title, track/album count) and a sticky footer
  that owns the single primary action.
- Step one is the source check: a four-value metric band, one metadata status
  line, and the album list. Album rows collapse; individual tracks expand on
  demand and never lead the layout.
- Step two is the match result. It replaces the album list, keeps the source in
  the header, and offers `Back to albums` beside `Done`.
- Keep `Match to Discogs` in the footer, not buried inside the body. While
  matching, the footer explains the wait and the control becomes disabled.
- Do not repeat the source name, use a featured-artwork collage, or show a
  separate `Strongest signal` panel. The overlay is a flow, not a hero.

### Analysis Progress

Mood: the app is digging through crates.

Use progress labels such as:

```txt
Reading playlist
Finding unique albums
Searching Discogs
Scoring vinyl matches
Building your crate
```

### Vinyl Crate Results

Mood: curated record shop recommendation wall.

Each result card should include:

- Artist.
- Album/release title.
- Match confidence.
- Why it matched.
- Availability indicator.
- Discogs link.
- Save action.

### Wishlist

Mood: private buying shortlist.

- Keep it calm and focused.
- Show saved records as cards.
- Include source context: which Spotify playlist/album caused the recommendation.

### Spin log

Mood: a listening diary for records already on the shelf.

- Lead with one quick-log surface: owned-record search, optional side, optional note.
- Group the timeline by local day and show the time, record, side, note, and shelf location.
- Show compact total, last-7-days, records-spun, and day-streak stats.
- Offer a small "worth another spin" list of never-spun or long-unspun owned records.
- Keep logging inline in the workspace; do not make a modal the primary spin surface.
- Selecting `View record` on a timeline entry opens that record in the shared right-edge inspector panel.
- Only owned records can be spun.

### Dashboard

Mood: the morning read — what the shelf is, not a carousel to scroll.

- Lead with one shelf synopsis: a short serif italic sentence about the owned
  shelf, then up to four quiet facts on one row (format, era, most collected
  artist, average rating).
- Facts describe composition, not totals. The metric band below owns the
  counts, so do not add a second numbers panel to the synopsis.
- Keep the wording tied to what the data supports. Say `Mostly LPs` and
  `from the 1970s` only when that bucket is the majority of owned records;
  otherwise say `A mixed shelf`.
- Do not put the orbit carousel on the Dashboard. It belongs to Collection.
- Below the metric band, one `Price overview` section owns the money read for
  every valued vinyl, owned or wanted: the total in the dominant recorded
  currency, the latest move, a movement graph, and a carry-forward total line
  for the last 90 days when at least two daily points exist. Use cream marks on
  hairlines; never a multi-colour finance chart.
- The movement graph is one row per valued vinyl, grouped `Price drops`,
  `Same price`, and `Price increases`. Each row carries a hollow blip at the
  previous value and a cream blip at the current value; the cream blip is that
  release's Discogs marketplace link, so a drop can become a purchase from the
  graph. A vinyl with one check sits in `Same price` labelled `First check`.
  Rows share one cream value scale and tabular prices. On narrow screens the
  price sits beside the title and the blips take the full row beneath it.
- Values are dated observations, not live quotes. Say `Last checked` and name
  the recorded move; never imply a guaranteed market price. A vinyl with no
  observation is unpriced, not zero.
- When nothing is valued, the section explains how to record a value from the
  record inspector instead of drawing an empty axis. The Discogs refresh action
  appears only when the marketplace capability is enabled, and it stays
  on-demand and bounded.
- The record inspector owns one `Discogs price` action beside the manual value
  field. It asks Discogs for the lowest marketplace listing in the record's
  current currency, stores a dated observation, and labels the result
  `Discogs lowest listing` rather than implying a guaranteed value. It never
  fetches on page load and never prices more than the one selected release.
- An empty shelf shows one centered prompt to open the collection instead of
  the synopsis and its facts.

### Collection and Shelving

Mood: one collector surface — the featured shelf above, the browse grid and
physical groups below. Collection and Shelf are the same page; there is no
separate Shelf navigation item.

- Lead with the orbit carousel (`VinylOrbitCarousel`, `fill` and `flush`) on
  the shared dashboard gradient. It shows the featured shelf: the five
  highest-rated starred records, plus the most and least expensive records that
  carry a recorded value. The value picks are labelled `Most expensive` /
  `Least expensive` with the recorded amount, and they never displace a starred
  record, so the stage holds at most seven. Wanted records stay eligible when
  they carry a value. Compare values only inside the shelf's dominant recorded
  currency. Do not pad the stage with other unstarred
  records. With nothing starred and no recorded values, replace it with the
  compact feature prompt so the page still explains where featured records come
  from. Collection is the carousel's only home; the Dashboard leads with a text
  synopsis instead.
- The stage widens with the screen and its whole 960x520 canvas scales with it,
  type included. Do not cap the canvas scale: a capped canvas leaves the stage
  growing around a stalled orbit, so wide displays show permanent side gutters.
  The carousel stays the page's lead surface at every breakpoint.
- The carousel's `Details / Formats` box is anchored to the right edge of the
  orbit stage, with two equal tab segments. Formats render as a padded chip
  list; details keep the description, rating, and record actions. Keep the
  format chips and thumbnail captions roomy rather than tight text pills.
- Put the browse controls below the carousel, not above it: status tabs, the
  Filters panel, sort, reset, the record count, and the Health / Add wishlist
  actions. They are one control strip for the grid that follows.
- Below the controls, `All vinyls` is the flat browse grid. It shows every
  record that matches the current tab, search, filter, and sort. Start with
  twelve covers and offer `Show all N vinyls` / `Show less`; changing a filter
  collapses the grid back to the preview. The grid uses smaller covers than
  the shelving groups so a phone still reads as a two-column crate.
- Browse controls apply to the `All vinyls` grid only. They never narrow the
  `Shelving` groups or the separate `Wantlist` surface, so filtering cannot make
  a record look missing from its physical group.
- Below the grid, `Shelving` groups owned records and any wanted record that
  carries a group in a responsive grid of group tiles. Each tile stacks its
  vinyls behind each other: the first record is the front sleeve and up to
  three more peek out behind it, with the group name in serif italic, the
  record count, and an expand control. Do not use horizontal shelf planks or a
  location table.
- A tile opens in place at the full row width and shows that group's records as
  a cover grid, so the page reads as a crate overview until a group is worth
  opening. Any number of tiles can be open at once, and a reopen does not
  reorder the grid.
- `Shelving` and `Wantlist` are separate surfaces. `Shelving` sits on a warm
  cream wash with the `+ New group` action; `Wantlist` sits below it on a
  deeper violet well with its own heading, count, and `Not on the shelf`
  label. Do not fold the wantlist back into the shelving groups or share one
  panel between them.
- Use `Group` as the product word everywhere, including the inspector field,
  the API, and the stored data model. Label groups in serif italic (`Music group`) with
  the record count beside the name. Show the album title, artist, and shelf
  code under each cover. The group heading already carries the group, so do
  not repeat it on every card.
- A group is enough to shelve a record. Unit, shelf, and slot are optional
  detail inside that group; anything without a group goes to a final `Unsorted`
  group. Inspector, Digging, Spins, Collection, and Health all use the word
  `Unsorted` for records without a group.
- Grouping is one plus action, not a select mode buried in the page chrome:
  every group header has `+ Add records`, the shelving header has `+ New
  group`, and each cover exposes a cream `+` on hover or keyboard focus to add
  that record to a group. `New group` starts with the unsorted records already
  selected, so creating a group from the loose pile is a name and one
  confirmation.
- A per-record plus opens a quick-add dialog: every existing group is a
  one-tap row that saves and closes immediately. Naming a new group uses the
  same dialog and an `Enter` or `Create & add` press. The multi-record picker
  is only for filling an existing group or creating one from the loose pile.
- Inside an open group, the same cream cover control flips to a minus and takes
  the record back out of that group on one press, with no dialog. It appears on
  hover or keyboard focus like the plus, always on touch. The `Unsorted` tile is
  not a group, so its covers keep the plus. Removing a record clears the group
  and the unit/shelf/slot it held inside that group, because a shelf spot has no
  meaning once the group is gone; the record returns to `Unsorted`.
- Adding to a group only moves the group. It never clears the unit, shelf, or
  slot already stored on a record.
- Wanted records keep their `Wanted` label and stay in the separate
  `Wantlist` surface. They can carry a group from the same plus: a grouped want
  appears in its group tile and keeps its Wantlist row. Ungrouped wants are not
  counted in `Unsorted`.
- Each cover on the `Wantlist` surface carries a heart-off control in its
  top-left corner, opposite the group plus, and it is visible at rest rather
  than hover-revealed: taking a want off the list must be findable without
  knowing to hover. It is a dark chip with a cream hairline and turns cream on
  hover, so the plus stays the louder action. One press removes the want with
  no dialog and no undo prompt, because adding it back is one search away. The
  control appears only on the `Wantlist` surface, never on the `All vinyls`
  grid or inside a group, and it keeps the heart language: the heart-off means
  "not wanted", never "favourite".
- A cover shows its latest recorded value as a small tabular line in the card
  metadata row, and the inspector owns the editable `Value` field. Saving a
  value writes a dated snapshot; it does not overwrite the previous one.
- Keep the page copy to one count line (`24 records · 3 groups`) plus the
  browse controls and the app-shell search. Selecting a cover opens the shared
  inspector.

### Collection Health

Mood: a calm maintenance read, not a dashboard of charts.

- Read top to bottom once: one verdict band, the findings that need action, then
  a short "worth a look" row.
- The verdict band owns the state word, one supporting sentence, the collection
  counts, and a single metric row (findings, high attention, duplicate releases,
  unsorted). Do not repeat those numbers in a second card grid.
- Findings are compact rows ordered by severity. Each row carries its severity,
  short explanation, one muted evidence line, affected-record chips, and one
  short action; selecting a chip or the action opens the shared inspector.
- Filter findings with severity chips plus one type select. Never render a
  second summary panel for duplicates or missing locations that the findings
  already list.
- "Worth a look" holds recent additions, wanted albums from collected artists,
  and high-value records when price data is enabled. Unavailable listening
  history is stated in one muted line, not as empty panels.
- An empty collection shows one centered prompt to build a crate instead of the
  verdict band and zeroed metrics.

## 11. Responsive Requirements

Mobile:

- H1 must remain dramatic but not clipped.
- CTA must be easy to tap.
- Hero content must not overflow vertically on small screens.
- Cards should stack one column.

Desktop:

- H1 should feel oversized and editorial.
- Hero should breathe with large empty space.
- Results may use multi-column cards.

## 12. Motion and Accessibility

Motion:

- Respect `prefers-reduced-motion`.
- Pause WebGL animation when offscreen/hidden.
- Avoid distracting fast movement.

Accessibility:

- Maintain readable contrast over the animated background.
- All interactive elements need focus-visible states.
- Buttons need meaningful accessible labels.
- Do not communicate match confidence by colour alone.

## 13. Implementation Checklists

### Landing Page Done When

- `WAXLIST` appears as a huge italic serif H1.
- Liquid gradient background renders behind the hero.
- Dark overlay keeps all copy readable.
- `Start with Spotify` button appears directly under the supporting line.
- ListenBrainz and YouTube link alternatives are visible but secondary.
- Page works on mobile and desktop.
- Reduced-motion users are respected.
- No Suno assets or copied Suno copy are used.

### Design Compliance Done When

- `DESIGN.md` has been read.
- `AGENTS.md` references `DESIGN.md`.
- `CONTINUITY.md` records any design decision changes.
- No implementation contradicts this file without an explicit continuity note.
