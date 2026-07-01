# ENDERTHOUGHTS — DESIGN SYSTEM
### `// RETRO-BRUTALIST 80s // TRANSMISSION SPEC v1.1`

---

## 0. DESIGN PHILOSOPHY

Enderthoughts is a transmission from a slightly alternate 1984 — one where the network was wired a decade early and photography went digital while still feeling physical, chemical, and weighty. The interface is reverent, not costume: CRT phosphor glow on wet-concrete black, scanline texture, monospaced terminals, and the bruised warmth of VHS color, all filtered through a refined adult eye. Every surface should feel like a well-calibrated industrial monitor in a dim room — precise, utilitarian, a little dangerous. We are building a machine for looking at photographs, not a lifestyle blog; restraint and signal density matter more than friendliness.

---

## 1. COLOR TOKENS

Dark mode is the **canonical** mode. Light mode is a secondary inversion (see §1.3) and must never be the default.

### 1.1 Core Palette

| Token | Hex | CSS Variable | Role |
|---|---|---|---|
| **VOID** | `#0A0A0F` | `--void` | Main background. Near-black, blue-cold undertone. |
| **SURFACE** | `#111118` | `--surface` | Elevated cards / panels / nav / status bar. |
| **PANEL** | `#1A1A26` | `--panel` | Secondary panels, sidebars, pill fills. |
| **GRID** | `#1F1F2E` | `--grid` | Grid lines, dividers, 1px card borders. |
| **PHOSPHOR** | `#00FF94` | `--phosphor` | Primary accent. CRT terminal green. Use sparingly. |
| **AMBER** | `#FFB347` | `--amber` | Secondary accent. Analog warmth, digital-zone marker, VHS overlay. |
| **NEON-RED** | `#FF2D55` | `--neon-red` | Danger, error, admin zone, selected-state pop. |
| **DUST** | `#4A4A6A` | `--dust` | Borders, disabled controls, decorative glyphs, inactive nav/tab labels. ~2.3:1 on VOID — **never use as readable body text.** |
| **FOG** | `#8A8AAA` | `--fog` | Readable secondary text: metadata, field labels, table headers, captions, placeholders. ~5.9:1 on VOID. |
| **CHROME** | `#C8C8E8` | `--chrome` | Primary body text. Blue-white monitor calibration. |
| **WHITE** | `#F0F0FF` | `--white` | Headings, emphasis, max contrast. |

**Contrast rule:** readable text is **CHROME or FOG**. `--dust` is for non-text roles (borders, disabled, decorative) plus the deliberate inactive-tab muting; the personal-app accessibility bar (see PRODUCT.md) accepts that tradeoff for inactive nav only, never for content.

### 1.2 Semantic Aliases

```css
:root {
  /* surfaces */
  --bg:            var(--void);
  --bg-elevated:   var(--surface);
  --bg-panel:      var(--panel);
  --border:        var(--grid);
  --border-strong: var(--dust);

  /* text */
  --text:          var(--chrome);
  --text-heading:  var(--white);
  --text-muted:    var(--fog);
  --text-disabled: var(--dust);

  /* intent */
  --accent:        var(--phosphor);
  --accent-warm:   var(--amber);
  --danger:        var(--neon-red);
  --focus-ring:    var(--phosphor);

  /* glows */
  --glow-phosphor: 0 0 6px rgba(0,255,148,0.55), 0 0 14px rgba(0,255,148,0.25);
  --glow-amber:    0 0 6px rgba(255,179,71,0.5);
  --glow-red:      0 0 6px rgba(255,45,85,0.55);
}
```

### 1.3 Light Mode (secondary)

Triggered by `[data-theme="light"]` on `<html>`. It is a *cooled paper* inversion — never pure white, never friendly.

| Token | Dark | Light |
|---|---|---|
| `--void` | `#0A0A0F` | `#E6E6F0` |
| `--surface` | `#111118` | `#DADAE8` |
| `--panel` | `#1A1A26` | `#CECEDE` |
| `--grid` | `#1F1F2E` | `#B8B8CC` |
| `--chrome` | `#C8C8E8` | `#1A1A26` |
| `--white` | `#F0F0FF` | `#0A0A0F` |
| `--phosphor` | `#00FF94` | `#00B368` (darkened for AA on light) |

Accents keep their hue; only lightness shifts to preserve contrast. Glows are reduced to 30% opacity in light mode.

---

## 2. TYPOGRAPHY

### 2.1 Families (all Google Fonts)

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=VT323&family=Share+Tech+Mono&family=IBM+Plex+Mono:wght@400;500;600&family=Orbitron:wght@300;400;500;700&display=swap" rel="stylesheet">
```

```css
:root {
  --font-display: 'VT323', monospace;        /* hero, section titles  */
  --font-label:   'Share Tech Mono', monospace; /* labels, subheads    */
  --font-body:    'IBM Plex Mono', monospace; /* body, captions, EXIF  */
  --font-ui:      'Orbitron', sans-serif;     /* nav, badges, status   */
}
```

**Rules:** Predominantly monospaced or geometric. No humanist sans. No serif except a rare editorial pull-quote. Display & label type is **UPPERCASE**.

### 2.2 Type Scale

| Token | Font | Size / Line | Weight | Tracking | Transform | Usage |
|---|---|---|---|---|---|---|
| `display-xl` | VT323 | 72 / 0.95 | 400 | 0.05em | UPPER | Home hero title |
| `display-lg` | VT323 | 56 / 1.0 | 400 | 0.05em | UPPER | Page titles |
| `display-md` | VT323 | 40 / 1.05 | 400 | 0.05em | UPPER | Section titles, month headers |
| `label-lg` | Share Tech Mono | 18 / 1.4 | 400 | 0.1em | UPPER | Subheads |
| `label-md` | Share Tech Mono | 14 / 1.4 | 400 | 0.1em | UPPER | Field labels, badges |
| `label-sm` | Share Tech Mono | 12 / 1.4 | 400 | 0.12em | UPPER | Captions overline, kicker |
| `body-lg` | IBM Plex Mono | 17 / 1.6 | 400 | 0 | none | Article body |
| `body-md` | IBM Plex Mono | 15 / 1.6 | 400 | 0 | none | Default body, captions |
| `body-sm` | IBM Plex Mono | 13 / 1.5 | 400 | 0 | none | EXIF data, metadata |
| `ui-md` | Orbitron | 14 / 1 | 400 | 0.08em | UPPER | Nav items |
| `ui-sm` | Orbitron | 12 / 1 | 400 | 0.1em | UPPER | Status bar, micro-labels |
| `ui-badge` | Orbitron | 11 / 1 | 500 | 0.1em | UPPER | Role badges, status dots |

Mobile down-scales `display-*` by ~30% (e.g. hero 72→48).

**Legibility floor:** no readable text below **12px**. Body never below 13px; EXIF / metadata / field labels / table headers never below 12px. Sizes of **10–11px are reserved for badges and corner glyphs only** (role badges, format pills, the `G`/`F` frame markers). Nav tabs render at **13px** Share Tech Mono (the `ui-md` 14px spec is the ceiling; 13px is used to keep the nav row from overflowing on small laptops); status bar at 12px.

### 2.3 Glow Discipline

`text-shadow: var(--glow-phosphor)` is permitted **only** on: active nav item, headings ≥ `display-md`, key data readouts, and status indicators. **Never** on body copy or EXIF blocks — it destroys legibility at small sizes.

---

## 3. SPACING, RADIUS, ELEVATION

### 3.1 Spacing scale (4px base)

```css
--space-1: 4px;  --space-2: 8px;  --space-3: 12px; --space-4: 16px;
--space-5: 24px; --space-6: 32px; --space-7: 48px; --space-8: 64px;
--space-9: 96px;
```

### 3.2 Radius — BRUTALIST

```css
--radius-none: 0px;   /* default for cards, panels, photos, inputs */
--radius-pill: 2px;   /* the ONLY rounding allowed — bracket pills  */
```

Border-radius above 2px is prohibited (see §10).

### 3.3 Borders & Elevation

Depth is communicated through **borders and luminance**, not shadows. Soft drop-shadows are banned; the only "shadow" is phosphor/amber glow.

```css
--border-hair:   1px solid var(--grid);
--border-active: 2px solid var(--phosphor);
--border-dash:   1px dashed var(--phosphor);
```

---

## 4. VISUAL TEXTURE & EFFECTS

### 4.1 Scanline overlay
Single `body::after`, fixed, full viewport, `pointer-events:none`, `z-index: 50` (below chrome, above content).
```css
body::after{
  content:""; position:fixed; inset:0; pointer-events:none; z-index:50;
  background: repeating-linear-gradient(
    to bottom, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 1px,
    rgba(0,0,0,0.05) 2px, rgba(0,0,0,0.05) 3px);
}
```
Mandatory on public home page; opt-in elsewhere via `.scanlines` on a wrapper.

### 4.2 CRT power-on (one-shot, on load)
```css
@keyframes crt-on{
  0%{ transform: scale(1,0.001); filter: brightness(6); opacity:0; }
  40%{ transform: scale(1,0.02); filter: brightness(4); opacity:1; }
  100%{ transform: scale(1,1); filter: brightness(1); }
}
.crt-boot{ animation: crt-on .3s cubic-bezier(0.16,1,0.3,1) 1; }
@media (prefers-reduced-motion: reduce){ .crt-boot{ animation:none; } }
```
Applied once to the app root; never loops.

### 4.3 Noise grain
SVG `feTurbulence` rendered to a fixed background layer over hero/header only, 2–3% opacity.
```html
<svg class="grain"><filter id="g"><feTurbulence type="fractalNoise"
  baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/></filter>
  <rect width="100%" height="100%" filter="url(#g)"/></svg>
```
```css
.grain{ position:absolute; inset:0; opacity:.03; pointer-events:none; mix-blend-mode:overlay; }
```

### 4.4 Phosphor glow
`text-shadow: var(--glow-phosphor)` per §2.3 discipline. For box glow on active borders use `box-shadow: var(--glow-phosphor)`.

### 4.5 Grid-line background (toggleable)
```css
.grid-bg{
  background-image:
    linear-gradient(var(--grid) 1px, transparent 1px),
    linear-gradient(90deg, var(--grid) 1px, transparent 1px);
  background-size: 32px 32px; opacity:.4;
}
```
Sits behind main content; toggle via `.grid-bg--on`.

### 4.6 Corner brackets
Technical-drawing corner marks via `::before`/`::after` on cards. 14px, 1px PHOSPHOR stroke.
```css
.bracket{ position:relative; }
.bracket::before, .bracket::after{
  content:""; position:absolute; width:14px; height:14px;
  border-color: var(--phosphor); border-style:solid; pointer-events:none;
}
.bracket::before{ top:0; left:0; border-width:1px 0 0 1px; }
.bracket::after{  bottom:0; right:0; border-width:0 1px 1px 0; }
```
(Use a wrapper or extra spans for all four corners.)

### 4.7 VHS aberration (accent, sparingly)
RGB-split on hero title only, on hover or boot:
```css
.aberration{ text-shadow: -1px 0 var(--neon-red), 1px 0 #00e0ff; }
```

---

## 5. COMPONENT LIBRARY

> Every component is borderless-radius, border-driven, monospaced. States listed as: **default / hover / active / focus / disabled**.

### 5.1 Top Navigation Bar
- **Structure:** fixed top, height `48px`, `--surface` bg, `1px solid var(--grid)` bottom border, `z-index:200`.
- **Left:** logo lockup `ENDERTHOUGHTS // SYSTEM` — `ENDERTHOUGHTS` in Orbitron 500 WHITE, `// SYSTEM` in Share Tech Mono DUST.
- **Right:** mode selectors `[PUBLIC] [ANALOG] [DIGITAL]` + `[AUTH STATUS]`.
- **Tabs (terminal mode selectors):**
  - type: Share Tech Mono **13px**, `0.1em` tracking, UPPERCASE.
  - default: DUST text, no underline.
  - hover: CHROME text.
  - active: PHOSPHOR text + 2px phosphor underline with `--glow-phosphor`.
  - focus: 1px phosphor outline offset 2px.
- **Padding:** `0 var(--space-5)`. Gap between tabs `var(--space-4)`.
- **Mobile (<768px):** collapses to a `[≡]` hamburger → slide-in drawer (see 5.2).
```css
--nav-h: 48px;
```

### 5.2 Mobile Drawer
- Slides from right, width `min(80vw, 320px)`, `--surface` bg, `1px solid var(--grid)` left border.
- Transition: `transform .2s cubic-bezier(0.16,1,0.3,1)` from `translateX(100%)`.
- Backdrop: `rgba(10,10,15,0.7)`. Items stacked, Orbitron, same active/hover states as 5.1.
- Drawer header repeats logo + a `[ X CLOSE ]` button in Share Tech Mono.

### 5.3 Photo Card (Public Grid)
- **Layout:** masonry; columns 2/3/4 at mobile/tablet/desktop. Gap `var(--space-4)`.
- **Card:** `border-radius:0`, `1px solid var(--grid)`, `--surface` bg, image fills width.
- **States:**
  - hover: top border becomes `2px solid var(--phosphor)` + AMBER caption overlay slides up `translateY(100%→0)` over `200ms cubic-bezier(0.16,1,0.3,1)`; caption in IBM Plex Mono on `rgba(10,10,15,0.85)`.
  - focus: 1px phosphor outline, offset -1px.
- **Format badge (top-right):** monospaced pill `[35mm]` or `[DIGITAL]`. `35mm/analog` → PHOSPHOR text + border; `DIGITAL` → AMBER text + border. `--panel` bg, `2px` radius, Share Tech Mono 12px.
- **Optional:** corner brackets (§4.6) on hover only.

### 5.4 Lightbox / Photo Detail
- **Overlay:** full viewport, `--void` bg `rgba(10,10,15,0.97)`, `z-index:300`.
- **Photo:** centered, `max-width:80vw; max-height:80vh; border-radius:0`.
- **EXIF readout (below photo):** single terminal line, IBM Plex Mono 13px FOG, `//`-delimited:
  `FILE: DSC0123.jpg // ISO: 400 // f/2.8 // 1/500s // LEICA M6 // KODAK PORTRA 400`
  Key values (camera, film) may be CHROME for emphasis.
- **Tags:** `[ TAG ]` pills — bracketed, `--panel` bg, `1px solid var(--phosphor)`, PHOSPHOR text, 2px radius.
- **Nav:** `◀ PREV` / `NEXT ▶` in CHROME, Share Tech Mono; large hit areas; keyboard `←`/`→`/`Esc`.
- **Close:** top-right `[ ESC ]`. Caption/EXIF panel max-width `min(80vw, 900px)`, left-aligned.

### 5.5 Upload Component (Analog zone)
- **Drop zone:** `1px dashed var(--phosphor)`, `--void` bg, min-height `240px`, centered content. Label `// DROP SCANS HERE //` in VT323 `display-md` PHOSPHOR with glow.
  - dragover: bg `rgba(0,255,148,0.04)`, border solid phosphor, label brightens.
- **Progress:** terminal bar rendered as text — `[████████░░░░░░] 58%` IBM Plex Mono. Filled cells PHOSPHOR, empty cells DUST.
- **Button:** `[ UPLOAD ]` → while transmitting becomes `[ TRANSMITTING... ]`, disabled, with a blinking `_` cursor; debounced so repeat clicks are ignored.

### 5.6 Monthly Gallery (Digital zone)
- **Month header:** `▶ JUNE 2026 // 47 FRAMES` in VT323 `display-md`, AMBER triangle marker.
- **Cards:** same system as 5.3, plus uploader credit line `↑ BY GRANDMA ROSA` in Share Tech Mono FOG, bottom-left.
- **Import button:** `[LINK GOOGLE PHOTOS]` styled as a terminal command — Share Tech Mono, PHOSPHOR text, `1px solid var(--grid)`, hover gains phosphor border + glow.

### 5.7 Role Badge
Orbitron `ui-badge`, 2px radius, `0 var(--space-2)` padding, height `20px`.

| Badge | Background | Text |
|---|---|---|
| `[ADMIN]` | PHOSPHOR | VOID |
| `[FAMILY]` | AMBER | VOID |
| `[VIEWER]` | DUST | CHROME |

### 5.8 Status Bar (Bottom)
- **Structure:** fixed bottom, height `28px`, `--surface` bg, `1px solid var(--grid)` top border, `z-index:100`. Orbitron `ui-sm`.
- **Left:** `● ZONE: PUBLIC` — dot color by zone: PHOSPHOR = analog, AMBER = digital, NEON-RED = admin, FOG = public.
- **Center:** `ENDERTHOUGHTS v1.0`.
- **Right:** `USER: PABLO // 14:32:07` (live clock, monospaced).
- **Mobile:** center label drops; keep zone dot (left) + clock (right).

### 5.9 Terminal Input Field
- `--panel` bg, `1px solid var(--grid)`, `border-radius:0`, IBM Plex Mono, padding `var(--space-3)`.
- Leading `>` prompt glyph in PHOSPHOR; trailing blinking `_` cursor when focused.
- focus: border → phosphor + `--glow-phosphor`. error: border → NEON-RED + `--glow-red`.
- Placeholder in FOG.

### 5.10 Buttons
- **Primary:** `1px solid var(--phosphor)`, transparent bg, PHOSPHOR text, Share Tech Mono UPPER. hover: bg `rgba(0,255,148,0.08)` + glow. active: bg PHOSPHOR / text VOID.
- **Ghost:** `1px solid var(--grid)`, CHROME text. hover: border DUST.
- **Danger:** as primary but NEON-RED.
- **Focus (keyboard):** `:focus-visible` → 1px `--focus-ring` (PHOSPHOR) outline, `2px` offset; danger variant uses a NEON-RED outline. Uses `:focus-visible` (not `:focus`), so the ring never shows on mouse click.
- All buttons `border-radius:0`, padding `var(--space-3) var(--space-5)`.

### 5.11 Loading / Empty States
- Loading: blinking `_` cursor (1s steps), **never** a spinner. Optional `LOADING` label + animated `...`.
- Empty: terminal message e.g. `// NO FRAMES IN THIS ZONE //` in Share Tech Mono FOG.

### 5.12 Modal / Dialog (`TerminalModal`)
Shared accessible modal primitive (`components/TerminalModal.vue`). **All admin create / edit / publish dialogs use it — never hand-roll a fixed-overlay modal.**
- **Structure:** `Teleport` to `<body>`; backdrop `rgba(10,10,15,0.9)` at `--z-modal`; panel `--surface`, `1px solid var(--grid)`, `border-radius:0`, corner brackets (§4.6), `max-height:90vh` with scroll. Title in `--font-display` UPPERCASE with phosphor glow.
- **Accessibility:** `role="dialog"`, `aria-modal="true"`, `aria-labelledby` → title. Focus moves to the first field on open and is **restored to the trigger on close**; focus is **trapped** (Tab / Shift-Tab cycle inside). `Esc` and backdrop click close. Body scroll locked while open.
- **API:** `v-model` (open state), `title`, `max-width`; default slot = body.

### 5.13 Confirm Dialog (`ui.confirm`)
Promise-based confirm rendered by `GlobalNotifications.vue`; sits above modals at `--z-confirm`.
- `role="alertdialog"`, `aria-modal`, focus trap + restore, `Esc` = cancel, `Enter` = confirm, focus defaults to the confirm button.
- **Danger tone:** NEON-RED title + border. Returns `Promise<boolean>` — replaces native `confirm()`.

### 5.14 Toast (`ui.notify` / `ui.success` / `ui.error`)
In-aesthetic transient feedback (`GlobalNotifications.vue`) at `--z-toast`, bottom-right, slide-in from the right. (This is the sanctioned terminal toast; the "no pastel toasts" ban in §10 still holds.)
- Tone borders: success → PHOSPHOR + glow, error → NEON-RED + glow, info → DUST. Monospace, dismissible, optional inline action (e.g. retry). Errors linger longer. Respects reduced motion.

---

## 6. PAGE LAYOUTS

Global frame: `--nav-h` top (48px) + `--status-h` bottom (28px) fixed; content scrolls between. Max content width `1440px`, gutters `var(--space-5)` (mobile) → `var(--space-7)` (desktop).

### 6.1 Home / Public Feed
- **Hero:** full-width band, `--void`, grain (§4.3) + scanlines mandatory. Hero title `display-xl` WHITE + glow, optional aberration on hover. Kicker overline `label-sm` PHOSPHOR. Subline `body-md` FOG.
- **Grid:** masonry photo cards (5.3) below hero. Sticky filter row optional (`[ ALL ] [ 35mm ] [ DIGITAL ]`).
- **z-index:** content 1, scanlines 50, status 100, nav 200.

### 6.2 Photo Detail (Lightbox)
- Full-bleed takeover (5.4). EXIF terminal panel pinned under photo. Prev/Next anchored to viewport mid-height edges. Tags row beneath EXIF.

### 6.3 Login
- Centered card `min(92vw, 420px)`, `--surface`, `1px solid var(--grid)`, corner brackets.
- Title `// AUTHENTICATE //` `display-md` PHOSPHOR glow.
- Terminal inputs (5.9) for email + password, each prefixed `>`.
- Primary `[ ENTER ]` button + divider `// OR //` + `[ GOOGLE OAUTH ]` ghost button.
- Footer micro-text `body-sm` FOG.

### 6.4 Analog Dashboard
- **Sidebar (left, 260px):** roll list — each item `ROLL #042 // PORTRA 400` Share Tech Mono, active = phosphor left border + PANEL bg.
- **Main:** gallery grid (5.3) of selected roll; upload zone (5.5) docked top or as a `[ + NEW ROLL ]` action.
- Collapses to stacked layout below 1024px (sidebar → horizontal scroller of roll chips).

### 6.5 Roll Detail
- **Header:** roll metadata as terminal readout — `ROLL #042 // KODAK PORTRA 400 // 36 EXP // SHOT: MAY 2026 // DEV: CINESTILL` in IBM Plex Mono.
- **Grid:** photo cards below; per-frame index badge `[12/36]`.
- **Contact sheet (admin):** drag-to-reorder with a keyboard/touch fallback (`◀ ▶` move buttons). Per-frame actions reveal as a hover overlay on pointer devices and as a static action bar on touch (`@media (hover:none)`) — every action stays reachable without hover.

### 6.6 Digital Monthly
- **Top rail:** horizontal month selector chips `[ JUN ] [ MAY ] [ APR ]`; active = AMBER border + glow.
- **Body:** monthly gallery (5.6) with uploader credits. Upload/import button top-right.

### 6.7 Admin Curator
- **Split panel:** left = unpublished queue, right = live public-feed preview.
- Drag a frame left→right to publish; selected frame gets NEON-RED outline + `--glow-red`.
- Top toolbar: `[ PUBLISH ] [ REJECT ] [ FLAG ]` action buttons. Zone dot in status bar = NEON-RED (admin).

---

## 7. RESPONSIVE

Mobile-first. Breakpoints:

```css
--bp-sm: 480px;  --bp-md: 768px;  --bp-lg: 1024px;  --bp-xl: 1440px;
```

| Range | Grid cols | Nav | Notes |
|---|---|---|---|
| `<480` | 1 | hamburger drawer | display type −30%; status bar simplified (dot + clock) |
| `480–767` | 2 | hamburger drawer | |
| `768–1023` | 3 | inline tabs | |
| `1024–1439` | 4 | inline tabs | sidebars appear (dashboard) |
| `≥1440` | 4 | inline tabs | max content width caps at 1440 |

Status bar persists at all sizes. Navigation always keeps the terminal feel even when collapsed.

---

## 8. MOTION

- **Global easing:** `cubic-bezier(0.16, 1, 0.3, 1)`. **Duration:** 150–250ms. Tokens:
```css
--ease: cubic-bezier(0.16,1,0.3,1);
--dur-fast: 150ms; --dur: 200ms; --dur-slow: 250ms;
```
- **Page transition:** horizontal terminal "screen wipe" (translateX + clip-path reveal), ~250ms.
- **Photo card hover:** caption `translateY(100% → 0)` over 200ms.
- **CRT power-on:** one-shot on app load (§4.2), respects reduced-motion.
- **Loading:** blinking `_` cursor (`step-end`, 1s), never a spinner.
- **Blink keyframe:**
```css
@keyframes blink{ 50%{ opacity:0; } }
.cursor{ animation: blink 1s step-end infinite; }
```
- **Reduced motion:** all non-essential animation disabled under `prefers-reduced-motion: reduce`; end-states remain visible.

---

## 9. CSS ARCHITECTURE

### 9.1 Custom properties
All colors, fonts, spacing, radii, durations, z-index live as `:root` custom properties (§1–§3, §8). Components reference tokens only — no raw hex inside component CSS.

### 9.2 Naming (BEM-adjacent, for Vue SFCs)
`block__element--modifier`, e.g. `photo-card`, `photo-card__badge`, `photo-card--digital`. Each Vue component owns a `<style scoped>` block. Shared primitives (buttons, pills, terminal input) live in global `components.css`.

### 9.3 Tailwind vs scoped styles
- **Tailwind utilities:** layout only — flex/grid, gap, spacing, responsive breakpoints, sizing. Configure Tailwind theme to read the same custom properties so utilities and tokens never diverge.
- **Scoped component CSS:** anything aesthetic — borders, glows, brackets, scanlines, terminal states, pseudo-elements. Effects in §4 are always hand-written CSS, never utilities.

### 9.4 Z-index scale
```css
--z-content: 1;
--z-scanlines: 50;
--z-status: 100;
--z-nav: 200;
--z-lightbox: 300;
--z-modal: 400;
--z-toast: 500;
--z-confirm: 600;
```

### 9.5 Scanline implementation
Single `body::after` per §4.1 — one node for the whole app, `pointer-events:none`, `--z-scanlines`. Do not duplicate per-component.

### 9.6 File structure
```
styles/
  tokens.css        /* :root variables (colors, type, space, z) */
  base.css          /* reset, body, scanlines, grain, crt-boot   */
  components.css     /* buttons, pills, badges, terminal input    */
  utilities.css      /* tailwind layer + small helpers           */
```

---

## 10. WHAT NOT TO DO

- **No rounded corners on cards, photos, panels, or inputs.** Max radius is 2px, reserved for bracket pills only.
- **No white (or near-white) backgrounds.** The lightest surface ever is light-mode `--surface` (`#DADAE8`), and only in opt-in light mode.
- **No sans-serif body text.** Body is always IBM Plex Mono. Orbitron is geometric UI only, never paragraphs.
- **No gradients.** The only repeating-gradient permitted is the scanline overlay. No color gradients, no gradient buttons, no gradient text.
- **No friendly / warm UI patterns.** No bubbly illustrations, no emoji, no pastel toasts, no bouncy spring animations, no drop-shadow "cards floating on white."
- **No soft drop-shadows.** Depth is borders + glow only.
- **No glow on body text or EXIF.** Glow is for accents, headings, and status only (§2.3).
- **No spinners.** Loading is a blinking terminal cursor.
- **No hand-drawn complex SVG illustration.** Decorative marks are limited to brackets, lines, dots, triangles.
- **No humanist or serif typefaces** (except a single rare editorial pull-quote, by exception).
- **Never make light mode the default.**

---

`// END TRANSMISSION // ENDERTHOUGHTS v1.1 //`
