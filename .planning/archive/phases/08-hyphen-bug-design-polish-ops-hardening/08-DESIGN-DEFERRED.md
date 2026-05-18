# Phase 8 — DESIGN-01/02/03 Deferred

**Recorded:** 2026-05-17
**Mode:** Autonomous (user-deferred DESIGN polish per 08-CONTEXT.md `<decisions>` section).

## Scope of deferral

Three requirements from `.planning/REQUIREMENTS.md` are explicitly NOT planned in Phase 8:

- **DESIGN-01** — Audit of shadcn tokens against recviz design tokens; gaps documented; canonical token file updated.
- **DESIGN-02** — Visual regression test (Playwright + Percy/Chromatic equivalent OR screenshot diff) at the recviz↔React boundary.
- **DESIGN-03** — Component coverage parity — every shadcn primitive used in the React app maps to a recviz-style preset.

## Why deferred (verbatim from 08-CONTEXT.md)

> Autonomous-mode scope: BUG + OPS only. DESIGN deferred because:
> - User explicitly said "we will do it later bro" about UI polish after Phase 3.
> - DESIGN-02 visual regression needs ground-truth recviz screenshots that only the user can obtain from the Citi internal recviz instance.
> - DESIGN-01 token audit requires the recviz design system reference the user has access to but I do not.

## Inputs required to plan DESIGN-01..03 (handoff checklist)

To replan these requirements in a follow-up phase, the user must provide one of:

1. **Recviz design system reference** — either the recviz `src/index.css` tokens block, a Figma export, or a screenshot of the recviz Settings/About page showing the current token values (CSS custom properties for `--color-*`, `--series-*`, `--ramp-*`, `--chart-*`).
2. **Recviz screenshots at the integration boundary** — at minimum: one Recviz panel + one React panel rendered side-by-side at 1440×900 in light mode and dark mode (4 PNGs total) so DESIGN-02 has ground-truth.
3. **Inventory of shadcn primitives used in `frontend-react/`** — autocompute via `grep -r "from '@/components/ui/" frontend-react/src` (zero user-input — Claude can produce this list once back on the work).

Items 1 and 2 are user-provided; item 3 is automatable.

## Restart path

When ready:

- Run `/gsd-ui-review 3` to revisit the Phase 3 React shell's design parity, OR
- Run `/gsd-plan-phase 8 --gaps` after marking DESIGN-01..03 as gaps in a fresh `08-DESIGN-VERIFICATION.md`, OR
- Create a dedicated polish phase (`Phase 8.1: Design Parity`) with the three DESIGN requirements as its scope.

## Traceability impact

`.planning/REQUIREMENTS.md` continues to map DESIGN-01..03 to Phase 8. Status stays **Pending**. Phase 8 close-out should NOT mark these as complete; the phase passes with `BUG-01..03 + OPS-01..04 = 7/10 requirements done` and the three DESIGN entries remain open, surfaced again at the next planning checkpoint.

The phase will not reach `Complete` in the ROADMAP progress table until DESIGN is replanned and shipped, OR a roadmap edit moves DESIGN-01..03 to a successor phase. That edit is the user's call.
