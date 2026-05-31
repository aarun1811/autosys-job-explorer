#!/usr/bin/env bash
# ops/components.sh — registry consumed by ops/rectrace-ops.sh
#
# Phase 8 OPS-03 (D-8.6 / D-8.10): one component per array entry. Adding a new
# managed component is a single new line in REGISTRY.
#
# Portability constraint: NO bash-4 associative arrays (macOS ships bash 3.2).
# We use an indexed array of delimiter-joined strings instead.
#
# Field separator is '|' (NOT ':'): the start_cmd field literally contains
# colons (e.g., `mvn spring-boot:run`), so a colon split would mis-tokenize.
#
# Fields, in order:
#   1. name       — short label; matches the component argument from argv
#   2. port       — informational; rendered by `status`
#   3. pid_file   — path under $REPO_ROOT (e.g., run/backend.pid)
#   4. log_file   — path under $REPO_ROOT (e.g., logs/backend.log)
#   5. ready_url  — full URL polled by wait_ready (actuator /health or similar)
#   6. dir        — working directory under $REPO_ROOT; literal '-' if none
#   7. start_cmd  — literal command exec'd by start_one (eval'd, see T-08-05)
#
# Maintainers: keep paths RELATIVE to $REPO_ROOT. The dispatcher prepends
# $REPO_ROOT at use-time so the registry stays portable.

# Determine the react start command at sourcing time. D-2.15 codifies the
# pnpm-with-npm-fallback contract: prefer pnpm, fall back to npm run dev.
if command -v pnpm >/dev/null 2>&1; then
  REACT_START_CMD="pnpm dev"
else
  REACT_START_CMD="npm run dev"
fi

# REGISTRY entries. ORDER IS SIGNIFICANT: `start all` / `restart all` spawn
# in this order. Backend first matches smoke scripts that hit backend
# immediately after `start all`.
REGISTRY=(
  "backend|6088|run/backend.pid|logs/backend.log|http://localhost:6088/rectrace/actuator/health|-|mvn spring-boot:run -f backend/rectrace/pom.xml -Dspring-boot.run.profiles=local"
  "tlm-stats|8080|run/tlmstats.pid|logs/tlmstats.log|http://localhost:8080/actuator/health|-|mvn spring-boot:run -f rectrace-tlm-stats/pom.xml -Dspring-boot.run.profiles=local"
  "loader|6089|run/loader.pid|logs/loader.log|http://localhost:6089/actuator/health|-|mvn spring-boot:run -f rectrace-loader/pom.xml -Dspring-boot.run.profiles=local"
  "react|5173|run/react.pid|logs/react.log|http://localhost:5173/|frontend-react|$REACT_START_CMD"
)

# registry_names — echo each component name on its own line.
# No bash-4 features; pure indexed-array iteration.
registry_names() {
  local entry
  for entry in "${REGISTRY[@]}"; do
    # Field 1 (name) is everything up to the first '|'.
    printf '%s\n' "${entry%%|*}"
  done
}

# registry_lookup <name> — echo the full entry whose first field equals <name>.
# Exit 0 on match, 1 on no match. The match is exact (string equality, no glob).
registry_lookup() {
  local target="$1"
  local entry name
  for entry in "${REGISTRY[@]}"; do
    name="${entry%%|*}"
    if [ "$name" = "$target" ]; then
      printf '%s\n' "$entry"
      return 0
    fi
  done
  return 1
}

# registry_field <entry> <index> — echo field <index> (1..7) of <entry>.
# Uses POSIX `cut`; works on macOS BSD cut and GNU cut without flags that differ.
registry_field() {
  local entry="$1"
  local idx="$2"
  printf '%s' "$entry" | cut -d'|' -f"$idx"
}
