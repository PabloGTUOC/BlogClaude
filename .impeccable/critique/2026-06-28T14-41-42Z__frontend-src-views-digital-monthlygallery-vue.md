---
target: digital monthly gallery (MonthlyGallery.vue)
total_score: 35
p0_count: 0
p1_count: 0
timestamp: 2026-06-28T14-41-42Z
slug: frontend-src-views-digital-monthlygallery-vue
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 4 | Success toasts now confirm upload/import/delete; phase-aware picker status retained |
| 2 | Match System / Real World | 3 | Terminal jargon (FRAMES/SCRAP) is deliberate brand; minor learning cost for non-technical family |
| 3 | User Control and Freedom | 4 | Picker now has Esc + clean close + timer cleanup; confirms are cancelable |
| 4 | Consistency and Standards | 4 | Unified confirm/toast system, standardized btn--sm, tokenized glow |
| 5 | Error Prevention | 4 | Styled confirm before every destructive action; import-session guard; upload constraints |
| 6 | Recognition Rather Than Recall | 4 | Empty state teaches the actions inline; CTAs visible at point of need |
| 7 | Flexibility and Efficiency | 2 | Still no bulk delete and no gallery-level keyboard shortcuts (admin scraps one at a time) |
| 8 | Aesthetic and Minimalist Design | 4 | Picker modal now fully on-brand; toasts/dialogs match the CRT identity |
| 9 | Error Recovery | 3 | Plain, reassuring messages replace raw strings and preserve selections; no one-click retry, toasts not at source |
| 10 | Help and Documentation | 3 | Contextual guidance in empty state + picker; no formal/searchable help |
| **Total** | | **35/40** | **Good (upper band, approaching Excellent)** |

## Anti-Patterns Verdict

**LLM assessment:** Identity is intact and now consistent end to end. The previous tells (native OS dialogs, a plainer-than-the-app picker) are gone: feedback lives in CRT toasts, confirms are bracket-button dialogs, the picker uses tokenized phosphor glow and a `✓` selection check. Nothing reads as AI-generated.

**Deterministic scan:** `detect.mjs` on `MonthlyGallery.vue` and `GlobalNotifications.vue` returned `[]` (exit 0). Clean.

**Visual overlays:** Not available — surface is auth-gated (Google sign-in + family role + an existing gallery). Fallback signal is the clean CLI scan plus source review.

## Overall Impression

The edges that dragged the baseline down are resolved. The screen now confirms what it does, recovers from failure in plain language, invites action when empty, and works under a finger. What's left is genuine product scope (bulk actions, large-gallery performance), not polish gaps. This is a solid, shippable surface.

## What's Working

1. **Unified feedback system.** A single in-aesthetic toast + confirm layer (`stores/ui.js` + `GlobalNotifications.vue`) now serves the whole app, so every success and failure speaks the same CRT language.
2. **Activation-ready empty state.** A fresh month explains itself and offers both upload paths inline, instead of a dead-end "// NO FRAMES //".
3. **Touch-correct destructive action.** `[ SCRAP ]` is reachable on phones/iPads via input-aware reveal, with a confirm guard against accidental taps.
4. **Picker hardened + on-brand.** Esc closes it, the poll timer can no longer leak, cells are keyboard-operable buttons, and selection reads clearly.

## Priority Issues

- **[P2] No bulk actions or keyboard accelerators.** An admin clearing several frames still confirms and deletes one at a time; there's no multi-select on the gallery grid and no gallery-level shortcuts. This is the one heuristic still at 2 (Flexibility).
  - **Fix:** Add multi-select + a bulk "scrap selected" action (the feed manager already has a bulk pattern to mirror).
  - **Suggested command:** /impeccable shape (feature-sized, not a polish tweak)

- **[P3] Error toasts lack a one-click recovery.** Messages are plain and preserve the user's selections, but say "try again" without a retry affordance, and appear bottom-right rather than at the source.
  - **Fix:** Optional retry action on failure toasts for the import/upload paths.
  - **Suggested command:** /impeccable harden

- **[P3] Large galleries render every card.** No virtualization/pagination; fine at family scale, latent at 1000+ frames.
  - **Suggested command:** /impeccable optimize

- **[P3] Admin analog overlay still hover-gated on touch.** Carried over from the touch pass; `AnalogGallery.vue` action overlay needs a bottom-strip treatment for phones. Different surface from this critique.
  - **Suggested command:** /impeccable adapt

## Persona Red Flags

**Grandpa Rosa (non-technical family):** Now gets a guided empty month and plain-language errors instead of raw alerts. Residual: terminal nouns (SCRAP/FRAMES) still need a beat to learn, but they're consistent and on-brand.

**Casey (mobile):** Can delete his own frames on a phone now (input-aware reveal). Upload actions still sit at the top of the screen rather than the thumb zone, but uploading is a deliberate action and the empty state surfaces the CTAs inline.

**Riley (stress tester):** Closing the picker mid-flow no longer leaks the poll interval; an import error keeps the modal open with selections intact. Remaining: a 1000-photo month still renders all cards at once.

## Minor Observations

- No focus-trap inside modals (accepted at the personal/minimal a11y bar; Esc works globally).
- Modal opens instantly (no entrance transition) while the confirm dialog fades; a shared fade would unify them.
- Picker keeps `z-[400]` as an arbitrary value matching `--z-modal`; consistent with the sibling publish modal, so left as-is.

## Questions to Consider

- Is one-at-a-time deletion acceptable for the owner, or is bulk cleanup a real need?
- Should the largest months paginate, or is family scale a safe permanent assumption?
- Worth a single shared modal transition so the picker and confirm dialog enter the same way?
