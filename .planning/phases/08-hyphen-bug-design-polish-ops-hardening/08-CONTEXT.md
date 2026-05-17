# Phase 8: Hyphen Bug + Design Polish + Ops Hardening — Context

**Gathered:** 2026-05-17
**Source:** Autonomous mode (`workflow.skip_discuss=true`).

<domain>
## Phase Boundary

Three independent workstreams:

1. **BUG-01..03** — Diagnose + fix hyphenated-search bug (e.g., `ABC-123`) in Elasticsearch; ship a regression test.
2. **DESIGN-01..03** — **[DEFERRED to user on return]** Visual parity audit between shadcn (React) and recviz tokens, visual regression tests, component coverage parity.
3. **OPS-01..04** — Harden `ops/rectrace-ops.sh` for `shellcheck` + macOS bash 3.2 + Linux bash 4/5 portability, add `start | stop | restart | status | logs`, readiness probes, Linux CI job.

**Autonomous-mode scope:** BUG + OPS only. DESIGN deferred because:
- User explicitly said "we will do it later bro" about UI polish after Phase 3.
- DESIGN-02 visual regression needs ground-truth recviz screenshots that only the user can obtain from the Citi internal recviz instance.
- DESIGN-01 token audit requires the recviz design system reference the user has access to but I do not.
</domain>

<decisions>
## Implementation Decisions

### Locked from ROADMAP / REQUIREMENTS — BUG + OPS only

- **D-8.1** (BUG-01): Run `_analyze` against the `rectrace_core_index` `file_name_pattern`, `recon`, and `job_name` fields with a hyphenated input. Capture the analyzer's tokenization in `.planning/phases/08-.../HYPHEN-DIAGNOSTIC.md`. Root cause is almost certainly the default `standard` analyzer's tokenization splitting `ABC-123` into `[abc, 123]`.
- **D-8.2** (BUG-02): Fix via additive `.keyword` subfield (preferred path per ROADMAP). NO reindex via alias swap unless additive path is insufficient. The existing `rectrace_core_alias` (Phase 6) is already in place, so an alias swap is feasible as fallback but should NOT be needed.
- **D-8.3** (BUG-03): Regression test in `backend/rectrace/src/test/java/.../HyphenSearchRegressionTest.java` — boots SB, hits ES via the v4 search endpoint with `ABC-123`-style terms from seed data, asserts ≥1 hit.
- **D-8.4** (OPS-01): `ops/rectrace-ops.sh` rewrite (or refactor) with `set -euo pipefail`, `#!/usr/bin/env bash`, NO GNU-only flags (`sed -i ''` works on macOS, `sed -i` works on Linux — use `sed -i.bak` pattern or `perl` / `awk` for portability). Passes `shellcheck` cleanly.
- **D-8.5** (OPS-02): `start | stop | restart | status | logs` per-component or all. `start` polls actuator `/health` with timeout + retry; fail-loud on no readiness within N seconds.
- **D-8.6** (OPS-03): PID files in `run/`, logs in `logs/`. Component registry in NEW `ops/components.sh` with array of `{name, start_cmd, pid_file, log_file, health_url}` tuples — adding a component is a one-line addition.
- **D-8.7** (OPS-04): GitHub Actions / GitLab CI workflow file `.github/workflows/ops-script.yml` (or wherever Citi CI lives) runs the script on Linux for each push. Smoke does: `bash ops/rectrace-ops.sh start backend && bash ops/rectrace-ops.sh status && bash ops/rectrace-ops.sh stop backend`.

### Claude's Discretion

- **D-8.8** [judgment]: Hyphen-bug regression test data uses the `RECON-XYZ-42` seed value already present in `rectrace_core` (verified during Phase 6).
- **D-8.9** [judgment]: ES mapping update applied via Phase 6 alias indirection — emit a one-shot `PUT /rectrace_core_index/_mapping` adding `.keyword` subfields where missing. NOT a reindex.
- **D-8.10** [judgment]: `ops/components.sh` schema is bash-array tuples (associative arrays require bash 4 which macOS doesn't have). Indexed-array-of-strings with delimiter.
- **D-8.11** [judgment]: Linux CI choice: GitHub Actions placeholder workflow committed under `.github/workflows/` with a comment `[NEEDS USER REVIEW — swap for Citi CI when known]`. The script itself is what matters; the CI integration is a one-line action invocation.

### Deferred to user (DESIGN-01..03)

- DESIGN-01 token audit
- DESIGN-02 visual regression test
- DESIGN-03 component coverage parity

These are the user's "later" stack. When you return, run `/gsd-ui-review 3` or create a dedicated polish phase.

</decisions>

<canonical_refs>
- `backend/rectrace/src/main/resources/search-config-v4.json` (ES field mappings reference)
- `../rectrace-local-dev/es/` (existing ES mapping JSON; `.keyword` may need to be added there for local-dev seed regenerations)
- `ops/rectrace-ops.sh` (current — to be hardened)
- `scripts/smoke-ssrm.sh`, `scripts/smoke-loader-admin.sh`, `scripts/smoke-observability.sh` (style refs)
- `backend/rectrace/src/main/java/com/citi/gru/rectrace/service/v4/ElasticsearchServiceV4.java` (where the search query is composed — may need `.keyword` fallback)
</canonical_refs>

<deferred>
- DESIGN-01 / DESIGN-02 / DESIGN-03 — visual polish (user-deferred)
- Recviz iframe wiring — Phase 4 (user-deferred autonomous mode)
- Citi-specific CI runner integration — `D-8.11` placeholder
</deferred>

---

*Phase: 08-hyphen-bug-design-polish-ops-hardening*
*Context: autonomous mode; BUG + OPS only; DESIGN deferred*
