#!/bin/bash
# Runs automatically at the start of every Claude Code session against this
# repo, on any surface (CLI, web, iOS app) — settings.json is read the same
# way regardless of which client opened the session. The point: this repo
# gets worked on from multiple agents/sessions/platforms, and a fresh session
# has no memory of what any of the others did. Rather than starting blind,
# surface what changed on the default branch since it was last checked out,
# and confirm the build/tests still pass before any new work begins.
#
# Deliberately read-only on git state (fetch + log only, never checkout/
# reset/pull) — reconciling a stale local checkout is a judgment call for
# the session itself to make, not something a hook should do unattended.
set -uo pipefail

cd "$CLAUDE_PROJECT_DIR" || exit 0

DEFAULT_BRANCH="master"

echo "=== Session start: checking for work from other agents/sessions/platforms ==="
echo ""

if ! git fetch origin "$DEFAULT_BRANCH" --quiet 2>/dev/null; then
    echo "(git fetch failed — offline, or no remote access from this environment. Skipping drift check.)"
else
    echo "--- Last 15 commits on origin/$DEFAULT_BRANCH ---"
    git log "origin/$DEFAULT_BRANCH" -15 --pretty=format:'%h  %an <%ae>  %ad  %s' --date=short 2>/dev/null
    echo ""
    echo ""

    LOCAL_SHA=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
    REMOTE_SHA=$(git rev-parse "origin/$DEFAULT_BRANCH" 2>/dev/null || echo "unknown")
    if [ "$LOCAL_SHA" != "$REMOTE_SHA" ]; then
        echo "NOTE: this checkout ($LOCAL_SHA) is behind origin/$DEFAULT_BRANCH ($REMOTE_SHA)."
        echo "Recommend starting new work from a fresh base: git checkout -B <branch> origin/$DEFAULT_BRANCH"
        echo ""
    fi

    echo "Scan the commit list above for anything unfamiliar — author, timing, or subject that doesn't match this session's own prior work. That's very likely a different agent, platform, or person. Acknowledge those changes to the user before starting anything new, and read the diff of anything unclear (git show <sha>) rather than assuming what it does."
fi

echo ""
echo "--- Installing dependencies ---"
# This repo has repeatedly hit "Failed to resolve import" build errors after
# switching to a commit where another agent added a dependency this checkout
# never installed for. Running it every session start avoids relying on any
# one agent to remember to do it.
npm install --no-audit --no-fund 2>&1 | tail -15

BUILD_LOG="$(mktemp)"
TEST_LOG="$(mktemp)"

echo ""
echo "--- Build check (catches regressions from any recent change, whoever made it) ---"
if npm run build > "$BUILD_LOG" 2>&1; then
    echo "Build: OK"
else
    echo "Build: FAILED — likely a regression introduced since this was last checked. Full output:"
    cat "$BUILD_LOG"
fi
rm -rf dist

echo ""
echo "--- Test check ---"
if npm test > "$TEST_LOG" 2>&1; then
    echo "Tests: OK"
    tail -6 "$TEST_LOG"
else
    echo "Tests: FAILED — likely a regression introduced since this was last checked. Full output:"
    cat "$TEST_LOG"
fi

rm -f "$BUILD_LOG" "$TEST_LOG"

echo ""
echo "=== Session start checks complete ==="
