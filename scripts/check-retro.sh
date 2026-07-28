#!/usr/bin/env bash
#
# Guards the Academic Web 1.0 house rules.
#
# It is easy to reach for a border-radius or a transition out of habit, and any
# one of them quietly breaks the aesthetic. This makes that a build failure
# rather than something you notice six months later.
#
# Run:  pnpm lint:retro       (after `pnpm build`, so the dist checks run too)

set -uo pipefail
cd "$(dirname "$0")/.."

fail=0

report() {
  printf '  FAIL  %s\n' "$1"
  fail=1
}

ok() {
  printf '  ok    %s\n' "$1"
}

echo "Checking source styles..."

# Properties that do not exist in 1996. Comments are stripped first so that
# prose mentioning a banned property does not trip the check.
for prop in 'border-radius' 'box-shadow' 'text-shadow' 'linear-gradient' 'radial-gradient' 'transition' 'animation' 'backdrop-filter'; do
  hits=$(
    find src -name '*.astro' -o -name '*.css' \
      | xargs perl -0777 -pe 's{/\*.*?\*/}{}gs' 2>/dev/null \
      | grep -cE "(^|[^-a-z])${prop}[[:space:]]*:" || true
  )
  if [ "${hits:-0}" -gt 0 ]; then
    report "$prop used $hits time(s) in src/"
  else
    ok "no $prop"
  fi
done

# The site must not ship its own web fonts. KaTeX is the sole exception and it
# lives in node_modules, not here. Comments are stripped first, since this
# file's own rulebook mentions @font-face by name.
font_faces=$(
  find src -name '*.astro' -o -name '*.css' \
    | xargs perl -0777 -pe 's{/\*.*?\*/}{}gs' 2>/dev/null \
    | grep -c '@font-face' || true
)
if [ "${font_faces:-0}" -gt 0 ]; then
  report "@font-face declared $font_faces time(s) in src/"
else
  ok "no @font-face in src/"
fi

if [ ! -d dist ]; then
  echo
  echo "dist/ not found — run 'pnpm build' first to check the output too."
  exit $fail
fi

echo
echo "Checking build output..."

# The global stylesheet is loaded by every page, so a font in it is a font on
# every page. KaTeX's fonts must stay confined to the post bundle.
base_css=$(ls dist/assets/Base.*.css 2>/dev/null | head -1)
if [ -z "$base_css" ]; then
  report "could not find the global stylesheet in dist/assets/"
else
  n=$(grep -o '@font-face' "$base_css" | wc -l | tr -d ' ')
  if [ "$n" -gt 0 ]; then
    report "global stylesheet declares $n @font-face rule(s) — every page now pays for fonts"
  else
    ok "global stylesheet is font-free ($(wc -c <"$base_css" | tr -d ' ') bytes)"
  fi
fi

# Index pages should reference exactly one stylesheet: the global one.
for page in dist/index.html dist/zh/index.html dist/blog/index.html; do
  [ -f "$page" ] || continue
  n=$(grep -o '<link[^>]*rel="stylesheet"' "$page" | wc -l | tr -d ' ')
  if [ "$n" -gt 1 ]; then
    report "$page loads $n stylesheets (expected 1)"
  else
    ok "$(basename "$(dirname "$page")")/$(basename "$page") loads $n stylesheet"
  fi
done

echo
if [ "$fail" -eq 0 ]; then
  echo "All Web 1.0 constraints hold."
else
  echo "Retro constraints violated. See FAIL lines above."
fi
exit $fail
