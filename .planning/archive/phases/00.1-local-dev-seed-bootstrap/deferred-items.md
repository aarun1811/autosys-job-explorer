# Phase 00.1 — Deferred Items

Discovered during plan execution but out of scope per the active task's SCOPE BOUNDARY rule. Tracked here for resolution outside plan-local execution.

## REQUIREMENTS.md missing LOCAL-DEV-* entries

**Found during:** plan 00.1-01 execute (2026-05-12), at `state-updates` step calling `gsd-sdk query requirements.mark-complete`.

**Issue:** ROADMAP.md Phase 00.1 lists requirement IDs `LOCAL-DEV-01..LOCAL-DEV-06` (plus `LOCAL-DEV-04a`) and every 00.1-*-PLAN.md's `requirements:` frontmatter references one or more of them, but `.planning/REQUIREMENTS.md` has no `LOCAL-DEV-*` entries (neither in the requirement list nor in the Traceability table). When plan 00.1-01 attempted `requirements.mark-complete LOCAL-DEV-01 LOCAL-DEV-06`, the SDK returned `not_found` for both.

**Why it's out of scope here:** Authoring 7 net-new requirement entries + traceability rows is a planning-state correction, not an execute-task correction. It would also dirty REQUIREMENTS.md outside the files this plan declares it touches.

**Recommended fix:** A short `/gsd-sync-requirements` or one-off planning commit should:
1. Append the LOCAL-DEV-01..06 + 04a entries to the "v1 Requirements" section of `REQUIREMENTS.md` (the exact wording is sourced from the `must_haves` blocks of each 00.1-*-PLAN.md).
2. Add 7 rows to the Traceability table mapping each to "Phase 00.1 — Local Dev Seed Bootstrap".
3. Re-run `gsd-sdk query requirements.mark-complete LOCAL-DEV-01 LOCAL-DEV-06` for plan 00.1-01's contributions, then incrementally as each subsequent plan finishes.

**Owner:** next planning checkpoint (before plan 00.1-02 starts, ideally).
