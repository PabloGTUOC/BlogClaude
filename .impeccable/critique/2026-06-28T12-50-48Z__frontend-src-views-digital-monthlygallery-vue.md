---
target: digital monthly gallery (MonthlyGallery.vue)
total_score: 29
p0_count: 0
p1_count: 2
timestamp: 2026-06-28T12-50-48Z
slug: frontend-src-views-digital-monthlygallery-vue
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Strong phase messaging; no success confirmation after upload/import (silent close) |
| 2 | Match System / Real World | 3 | On-brand terminal jargon (FRAMES/SCRAP/TRANSMIT) costs non-technical family a little learning |
| 3 | User Control and Freedom | 3 | Picker modal closes via button + click-outside, but no Esc and polling isn't cancelled on close |
| 4 | Consistency and Standards | 4 | `[ BRACKET ]` button system applied consistently throughout |
| 5 | Error Prevention | 3 | Confirms before delete, but via native confirm(); multipart constraints exist |
| 6 | Recognition Rather Than Recall | 3 | Actions visible, uploader names on cards |
| 7 | Flexibility and Efficiency | 2 | No keyboard shortcuts, no bulk delete (admin scraps one at a time) |
| 8 | Aesthetic and Minimalist Design | 4 | Committed CRT identity, clean focus; picker modal slightly plainer than the rest |
| 9 | Error Recovery | 2 | Raw error strings surfaced via alert() ("Google Import processing failure: <msg>") |
| 10 | Help and Documentation | 2 | No guidance; empty state is atmospheric but not actionable |
| **Total** | | **29/40** | **Good (foundation is solid; address weak areas)** |

## Anti-Patterns Verdict

**LLM assessment:** This does NOT read as AI-generated. It has a committed, distinctive retro-brutalist CRT identity (phosphor-on-black, 1px grids, bracket buttons, `// comment //` markers) that no default generator produces. The tells are not aesthetic slop but interaction shortcuts: native browser `alert()`/`confirm()` dialogs that shatter the immersion, and a Google Photos picker modal that's plainer than the surrounding app.

**Deterministic scan:** `detect.mjs` on `MonthlyGallery.vue` returned `[]` (exit 0) — zero pattern hits (no gradient text, side-stripe borders, eyebrow scaffolding, contrast failures detectable statically). Clean.

**Visual overlays:** Not available. The surface is auth-gated (Google sign-in + family role + an existing gallery), so no reliable user-visible overlay could be injected. Fallback signal is the clean CLI scan plus the source review below.

## Overall Impression

A confident, identity-rich screen that knows exactly what it is. The bones are good: single focus (header + grid), clear actions, on-brand voice. The biggest opportunity is the **moments around the edges** — the native dialogs, the dead-end empty state, the silent success — which are where a personal family app earns warmth and where this one currently drops out of character.

## What's Working

1. **Uncompromising identity.** The CRT/terminal language is sustained end to end (loading "READING ARCHIVE INDEXES…", "X FRAMES" counts, bracket buttons). It feels inhabited, not costumed.
2. **Phase-aware Google import status.** The picker flow tells you where you are ("AUTHORIZING WITH GOOGLE" → "SELECT PHOTOS IN THE GOOGLE POPUP" → grid), which is genuinely good system-status design for a multi-step OAuth dance.
3. **Per-photo provenance.** Uploader name/avatar on each card and the contributor concept fit the "shared family memory" purpose well.

## Priority Issues

- **[P1] Native alert()/confirm() dialogs break the transmission.** `confirmDeletePhoto` (confirm), `submitGoogleImport` (alert), and `triggerGooglePhotosPicker` (two alerts) drop the user into unstyled OS dialogs that surface raw error strings. This violates the #1 product principle ("preserve the transmission") AND hurts error recovery — family users see developer messages.
  - **Fix:** Replace with in-aesthetic CRT-styled confirm/toast components; map raw errors to plain, reassuring copy.
  - **Suggested command:** /impeccable harden

- **[P1] Empty state is a dead end.** "// NO FRAMES CAPTURED IN THIS TIMELINE YET //" is atmospheric but offers no path forward — no call to action toward the upload buttons sitting above it. A family member landing on a fresh month sees a void with no invitation.
  - **Fix:** Turn the empty state into an on-brand prompt that points at DIRECT UPLOAD / LINK GOOGLE PHOTOS.
  - **Suggested command:** /impeccable onboard

- **[P2] Delete is hover-gated, so it's unusable on touch.** `[ SCRAP ]` uses `opacity-0 group-hover:opacity-100`. On a phone or iPad (a primary way family will browse) there is no hover, so owners/admins cannot reach delete at all.
  - **Fix:** Always-visible (or tap-to-reveal) affordance on touch devices.
  - **Suggested command:** /impeccable adapt

- **[P2] Success is silent.** After a direct upload or Google import, the modal/drawer just closes. The end of the most rewarding action has no confirmation — a weak peak-end for the core loop.
  - **Fix:** Brief on-brand confirmation line/toast ("// 3 FRAMES ARCHIVED //").
  - **Suggested command:** /impeccable delight

- **[P2] Picker modal: no Esc, leaked polling, plainer than the app.** The Google modal can't be dismissed with Escape (the Lightbox can), closing it mid-flow leaves the 2s poll timer running, and its grid/"SEL" badge treatment is generic relative to the rest of the CRT system.
  - **Fix:** Esc handler + cancel polling on close + bring the modal visually on-brand.
  - **Suggested command:** /impeccable polish

## Persona Red Flags

**Grandpa Rosa (non-technical family contributor — project persona):** Jargon ("SCRAP" to delete, "FRAMES", "TRANSMIT") demands translation. If an import fails he sees a raw `alert("Google Import processing failure: <message>")`. On an empty month he gets "// NO FRAMES CAPTURED //" with no next step. High confusion risk at exactly his moments.

**Casey (distracted mobile):** Primary actions live in the top-right header, outside the thumb zone. `[ SCRAP ]` is hover-only — invisible on his phone. The picker grid and the upload flow are otherwise tappable.

**Riley (stress tester):** Closing the picker mid-flow leaves the poll interval running in the background. An import error leaves the modal in an ambiguous state. The empty state shows nothing useful. A 1000-photo month renders every card at once (no virtualization/pagination).

## Minor Observations

- "CRITICAL WARN: SECURELY SCRAP THIS FRAME FROM TIMELINE?" over-alarms for deleting a personal snapshot; tone could match the stakes.
- The "SEL" selection badge is small and easy to miss; selection state could read more clearly.
- No pagination / lazy rendering for large galleries (works fine at family scale today, a latent Riley issue).
- The newly added video play overlay + duration badge are a nice, on-brand touch.

## Questions to Consider

- What should the *end* of a successful upload feel like? Right now it feels like nothing.
- Should deleting a family photo really shout "CRITICAL WARN", or is that borrowed drama?
- Can Grandpa actually delete a photo on his iPad today? (No — it's hover-gated.)
- What's the first thing a family member should see on an empty month, and is it an invitation or a void?
