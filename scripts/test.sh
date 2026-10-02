#!/bin/sh
# Runs the mod's tests. They live outside plugins/flight-deck so the published
# plugin holds only the mod; this copies both into a scratch folder to run them.
set -e
root=$(cd "$(dirname "$0")/.." && pwd)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
cp -R "$root/plugins/flight-deck/." "$work/"
cp -R "$root/tests" "$work/tests"
claude plugin test "$work"
