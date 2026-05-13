#!/usr/bin/env bash
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
    # T-2-05 guard: only rm -rf the literal static/ path, not a variable that could be empty.
    # STATIC_DIR is computed as a literal sub-path of REPO_ROOT (not from $PWD or env injection).
    if [ -z "$STATIC_DIR" ]; then
      echo "ERROR: STATIC_DIR is empty. Aborting to prevent accidental deletion."
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
