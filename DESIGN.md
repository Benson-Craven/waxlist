# DESIGN.md

# WAXLIST MVP Design Specification

This file is the strict visual and interaction source of truth for the WAXLIST MVP.

All agents must read this file before touching layout, styling, components, or copy on user-facing screens.

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
6. A prominent `Connect Spotify` button directly underneath the supporting line.
7. A small privacy reassurance below the button.

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
Connect Spotify button
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
Turn your Spotify taste into a vinyl crate worth collecting.
```

Approved eyebrow:

```txt
Spotify-powered vinyl discovery
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
      ConnectSpotifyButton
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

## 7. Connect Spotify Button

The primary CTA must say exactly:

```txt
Connect Spotify
```

Required style:

- Pill-shaped.
- Large enough to feel important.
- Spotify green base.
- Dark text or near-black text for contrast.
- Subtle shadow/glow.
- Hover state: slightly brighter/lifted.
- Focus-visible ring.

Suggested Tailwind classes:

```txt
inline-flex h-14 items-center justify-center rounded-full bg-[#1DB954] px-8 text-sm font-semibold text-[#041008] shadow-[0_0_40px_rgba(29,185,84,0.28)] transition hover:-translate-y-0.5 hover:bg-[#22d162] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFF4E8] focus-visible:ring-offset-2 focus-visible:ring-offset-[#05030A]
```

The button may include a Spotify icon if already available via a safe icon/source. Do not block MVP progress on adding the icon.

## 8. Glass / Card Style

For future screens, use dark glass panels over the liquid background.

Panel style:

```txt
rounded-3xl border border-white/10 bg-black/25 shadow-2xl backdrop-blur-xl
```

Cards should feel like collectible record sleeves, not generic tables.

Use tables only where dense comparison is genuinely needed.

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

Goal: make the user want to connect Spotify immediately.

Required copy:

```txt
Spotify-powered vinyl discovery
WAXLIST
Turn your Spotify taste into a vinyl crate worth collecting.
Connect Spotify
We only use your Spotify data to build your crate. You can disconnect anytime.
```

### Playlist Picker

Mood: record-bin browsing.

- Show playlists as glass cards.
- Include playlist cover image if available.
- Use track count.
- CTA copy: `Build crate`.

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
- `Connect Spotify` button appears directly under the supporting line.
- Page works on mobile and desktop.
- Reduced-motion users are respected.
- No Suno assets or copied Suno copy are used.

### Design Compliance Done When

- `DESIGN.md` has been read.
- `AGENTS.md` references `DESIGN.md`.
- `CONTINUITY.md` records any design decision changes.
- No implementation contradicts this file without an explicit continuity note.
