# .planning/archive

Historical artifacts from the GSD-era workflow used during Phases 0 through 8 of the modernization milestone (≈ 2026-01 through 2026-05-17).

The repo no longer uses the GSD workflow — new work follows the superpowers skill suite documented in `CLAUDE.md`. These files are kept for context (decision trail, audit, citations from current docs) but are **not maintained**.

## What's in here

| Path | Was | Notes |
|---|---|---|
| `phases/` | Per-phase CONTEXT/RESEARCH/PATTERNS/VALIDATION/PLAN/SUMMARY/VERIFICATION blizzard | 11 phase directories, ~150 markdown files. Cited by closure notes in `CONCERNS.md`, decision IDs (`D-N.M`), and `parity-matrix.md` |
| `autonomous-log.md` | Day-by-day decision log from the autonomous Phase 5-8 run | Records every `D-N.M` judgment call the autonomous run made without user input |
| `HANDOFF.json` | Machine-readable handoff state at the milestone pause point | Frozen at 2026-05-17 |
| `.continue-here.md` | Resume pointer for `/gsd-resume-work` | Pre-pause snapshot |
| `config.json` | GSD workflow configuration (skip_discuss, auto_advance, etc.) | Settings no longer apply |

## Living registers (NOT archived — still maintained at `.planning/`)

- `STATE.md` — current phase, what's complete, what's open
- `ROADMAP.md` — phase list with success criteria
- `REQUIREMENTS.md` — REQ-IDs and traceability matrix
- `PROJECT.md` — extended background and key decisions
- `parity-matrix.md` — React ↔ Angular feature port status
- `codebase/` — STACK, ARCHITECTURE, CONVENTIONS, INTEGRATIONS, CONCERNS, TESTING, STRUCTURE
- `research/` — domain research summaries
