---
phase: 08-hyphen-bug-design-polish-ops-hardening
plan: 02
subsystem: ops
tags: [ops, shellcheck, bash, portability, actuator, readiness]
requires: []
provides:
  - ops/components.sh REGISTRY (one-line-per-component)
  - ops/rectrace-ops.sh v2 hardened dispatcher
  - actuator-readiness-gated start
affects:
  - ops/components.sh
  - ops/rectrace-ops.sh
tech-stack:
  added: []
  patterns:
    - "Indexed-array-of-pipe-delimited-strings (bash 3.2 surrogate for associative arrays)"
    - "Subshell-isolated cwd change for component start"
    - "curl-based readiness probe with HTTP 2xx match + env-overridable timeout/interval"
key-files:
  created:
    - ops/components.sh
  modified:
    - ops/rectrace-ops.sh
decisions:
  - "Field separator '|' (not ':') because start_cmd values literally contain `mvn spring-boot:run`"
  - "Use `eval` for start_cmd despite shellcheck SC2086; input is from version-controlled registry only (T-08-05)"
  - "`start all` spawns then probes — bounds wall-clock by slowest component, not sum"
  - "Stale pid files are auto-cleaned before spawn (idempotent restart after crash)"
metrics:
  duration_seconds: 156
  tasks_completed: 2
  files_created: 1
  files_modified: 1
  completed_at: 2026-05-17T15:50:26Z
requirements: [OPS-01, OPS-02, OPS-03]
---

# Phase 8 Plan 02: Ops Surface Hardening Summary

Hardened `ops/rectrace-ops.sh` to shellcheck-clean, macOS bash 3.2 + Linux bash 4/5 portable, with registry extraction to `ops/components.sh` and curl-based actuator readiness probe gating every `start`.

## Objective

Replace the v1 ops script (Phase 2 Plan 02-04) with a registry-driven, shellcheck-clean version. Closes OPS-01 (lint), OPS-02 (verbs + readiness probe), OPS-03 (one-line-per-component registry). Output is consumed by Plan 08-03 (Linux CI smoke).

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create `ops/components.sh` registry | `77182e1` | ops/components.sh |
| 2 | Rewrite `ops/rectrace-ops.sh` v2 (portable + readiness probe) | `e24385e` | ops/rectrace-ops.sh |

## Implementation Notes

### Registry shape (Task 1)

`REGISTRY` is an indexed array; each entry is a `|`-delimited 7-field string. Adding a managed component is a single new line. Three helpers (`registry_names`, `registry_lookup`, `registry_field`) expose the registry to consumers without leaking the delimiter choice.

Three seed entries match the v1 surface exactly — backend (6088), tlm-stats (8080), react (5173) — with `pnpm dev` vs `npm run dev` resolved at sourcing time per D-2.15.

### Dispatcher shape (Task 2)

`ops/rectrace-ops.sh` sources `components.sh` and iterates `REGISTRY` for every verb. Five verbs supported:

| Verb | per-component | `all` |
|------|---------------|-------|
| `start` | spawn + probe | spawn all, then probe all (parallel wait) |
| `stop` | SIGTERM, SIGKILL after 30s | iterate stop |
| `restart` | stop + start + probe | stop all, start all, probe all |
| `status` | up (pid N, port P) / down | iterate status |
| `logs` | `tail -f` log file | rejected (no multi-tail) |

Env overrides: `RECTRACE_READY_TIMEOUT` (default 30s), `RECTRACE_READY_INTERVAL` (default 2s).

### Portability gates

- No `declare -A`, no `mapfile`, no `readarray`, no GNU `sed -i` (without backup extension).
- All array iteration via `for entry in "${REGISTRY[@]}"; do ... done`.
- `read -r` with `IFS='|'` for field-split (POSIX, bash 3.2-safe).
- `cut -d'|' -f N` for ad-hoc field access (POSIX, no GNU-only flags).
- `printf '%s\n' "$pid"` instead of `echo -n` (POSIX, avoids `-n` semantic drift).
- All variable expansions quoted (shellcheck-validated).

### Security note (T-08-05)

`start_one` uses `eval "$C_CMD"` to execute the component start command. This is a deliberate, scoped use of `eval`: input comes exclusively from `ops/components.sh`, which is version-controlled. The alternative (`read -ra cmd <<< "$C_CMD"` followed by `"${cmd[@]}"`) breaks `-Dspring-boot.run.profiles=local` token preservation. The single-line `eval` is annotated with `shellcheck disable=SC2086` and an inline justification.

## Verification

### shellcheck output (verbatim — silence is success)

```text
$ shellcheck -x ops/rectrace-ops.sh ops/components.sh
$ echo $?
0
```

### Status against idle stack (verbatim)

```text
$ bash ops/rectrace-ops.sh status all
backend: down
tlm-stats: down
react: down
```

### Other gates

- `bash -n ops/rectrace-ops.sh` and `bash -n ops/components.sh`: both parse clean.
- `bash -c 'shopt -u extglob; bash -n ops/rectrace-ops.sh'`: parses without bash-4 globs.
- Active code grep for `declare -A | mapfile | readarray`: none found.
- Active code grep for `sed -i` without `.bak`: none found.
- Idempotent start: with a fake pid file pointing at a live `sleep`, `start backend` reports `backend: already running (pid N)` and does not spawn.
- Stop cleanup: with a fake pid file pointing at a live `sleep`, `stop backend` kills the process and removes `run/backend.pid`.
- Unknown component: `status nosuch` exits 1 with `ERROR: Unknown component: nosuch. Valid: backend tlm-stats react all`.
- Usage: bare invocation, `-h`, `--help`, `help`, and unknown verb all print the help block to stderr and exit 1.

## Deviations from Plan

None — plan executed exactly as written. The plan offered two field-separator alternatives (`:` vs `|`); the final implementation uses `|` as the plan recommended.

## Threat Surface Scan

No new threat-flagged surface introduced. T-08-04 / T-08-05 / T-08-06 / T-08-07 from the plan's threat register are all addressed inline (accept dispositions for registry-tampering and polling-DoS are inherent to a dev-side operator script; mitigate disposition for `eval` is documented at the line-of-use).

## Self-Check: PASSED

- FOUND: ops/components.sh
- FOUND: ops/rectrace-ops.sh (modified)
- FOUND: commit 77182e1 (feat 08-02 registry)
- FOUND: commit e24385e (refactor 08-02 v2)
- shellcheck -x: exit 0
- bash -n: exit 0 on both files
- bash ops/rectrace-ops.sh status all: exit 0, three rows
