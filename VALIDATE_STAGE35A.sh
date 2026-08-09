#!/usr/bin/env bash
set -u
ROOT="${1:-.}"
cd "$ROOT" || exit 2

run_required_test() {
  local t="$1"
  if [ ! -f "$t" ]; then
    echo "FAIL missing required test: $t" >&2
    exit 1
  fi
  node "$t" || exit $?
}

run_optional_test() {
  local t="$1"
  if [ -f "$t" ]; then
    node "$t" || exit $?
  else
    echo "SKIP optional test: $t"
  fi
}

fail=0
FILES=(
  js/real-estate-ui.js
  js/iphone-playtest-fixes.js
  js/physical-iphone-playtest.js
  js/player-turnaround-plan-report.js
  js/ui-enhancer-registry.js
  tests/harness.js
  tests/stage-3-5a-observer-stability-test.js
  tests/stage-3-4-startup-observer-migration-test.js
  tests/setup-recovery-ui-test.js
  tests/game-over-settings-ui-test.js
  tests/observer-threshold-guard-test.js
  tests/startup-side-effects-test.js
  tests/startup-runtime-budget-test.js
  tests/physical-iphone-playtest-test.js
  tests/run-all.js
)
for f in "${FILES[@]}"; do
  if [ ! -f "$f" ]; then
    echo "FAIL missing validation input: $f" >&2
    fail=1
    continue
  fi
  node --check "$f" >/dev/null || fail=1
done
for f in js/real-estate-ui.js js/iphone-playtest-fixes.js js/physical-iphone-playtest.js js/player-turnaround-plan-report.js; do
  grep -Eq 'new[[:space:]]+([A-Za-z_$][A-Za-z0-9_$]*\.)?MutationObserver[[:space:]]*\(' "$f" && { echo "FAIL MutationObserver: $f"; fail=1; }
done
grep -Eq 'new[[:space:]]+([A-Za-z_$][A-Za-z0-9_$]*\.)?MutationObserver[[:space:]]*\(' index.html && { echo 'FAIL inline MutationObserver: index.html'; fail=1; }
[ "$fail" -eq 0 ] || exit 1

run_required_test tests/stage-3-5a-observer-stability-test.js
run_required_test tests/stage-3-4-startup-observer-migration-test.js
run_required_test tests/setup-recovery-ui-test.js
run_required_test tests/game-over-settings-ui-test.js
# Required: the Stage 3-5a package/checkout must include this diagnostic contract.
run_required_test tests/observer-threshold-guard-test.js
# Required: startup purity/pipeline collapse must remain integrated before ratchet validation.
run_required_test tests/startup-side-effects-test.js
# Required: this is the runtime ratchet for actual startup observer/enhancer/write counts.
run_required_test tests/startup-runtime-budget-test.js

run_optional_test tests/ceo-dashboard-test.js
run_optional_test tests/save-load-integration-test.js
for t in tests/player-turnaround-plan-report-test.js tests/physical-iphone-playtest-test.js tests/iphone-playtest-remediation-test.js tests/real-estate-test.js; do
  run_optional_test "$t"
done

npm run test:syntax --silent || exit $?
npm run test:static --silent || exit $?
npm run test:modules --silent || exit $?
echo 'Stage 3-5a focused validation set passed.'
