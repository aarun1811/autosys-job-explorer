#!/usr/bin/env bash
set -euo pipefail
# ops/build.sh — build pipeline for rectrace
# Usage: ops/build.sh react
# Separated from rectrace-ops.sh per D-2.16: runtime ops != build pipeline.
# Phase 2 ships: build.sh react only.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATIC_DIR="$REPO_ROOT/backend/rectrace/src/main/resources/static"

cmd="${1:-}"
case "$cmd" in
  react)
    echo "Building React app..."
    cd "$REPO_ROOT/frontend-react" || { echo "ERROR: frontend-react/ not found at $REPO_ROOT/frontend-react"; exit 1; }
    if command -v pnpm >/dev/null 2>&1; then
      pnpm build
    else
      npm run build
    fi
    echo "Cleaning backend static/ and copying dist/..."
    # T-2-05 guard: validate STATIC_DIR is non-empty AND is a descendant of REPO_ROOT
    # before executing rm -rf. Guards against empty REPO_ROOT (e.g., BASH_SOURCE[0] empty)
    # or path traversal that would produce a valid-looking but incorrect path.
    # Uses POSIX `case` (not bash-4 `[[ ... = pat* ]]`) to stay portable to macOS bash 3.2,
    # matching the OPS-01 contract enforced for ops/rectrace-ops.sh.
    safety_ok=1
    if [ -z "$REPO_ROOT" ] || [ -z "$STATIC_DIR" ]; then
      safety_ok=0
    else
      case "$STATIC_DIR" in
        "$REPO_ROOT"/*) ;;        # OK — STATIC_DIR is a descendant
        *) safety_ok=0 ;;
      esac
    fi
    if [ "$safety_ok" -ne 1 ]; then
      echo "ERROR: STATIC_DIR safety check failed (REPO_ROOT='$REPO_ROOT', STATIC_DIR='$STATIC_DIR'). Aborting."
      exit 1
    fi
    rm -rf "$STATIC_DIR"
    mkdir -p "$STATIC_DIR"
    cp -r dist/* "$STATIC_DIR/"
    echo "Done. React dist copied to: $STATIC_DIR"
    ;;
  *)
    echo "Usage: $0 react"
    echo ""
    echo "Verbs:"
    echo "  react   Build frontend-react/ and copy dist/ to backend static/"
    exit 1
    ;;
esac
