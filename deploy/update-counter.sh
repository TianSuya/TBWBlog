#!/usr/bin/env bash
#
# Feeds the 90s hit counter in the site footer with real numbers.
#
# Why this exists: the site is static, so it has no backend that could hold an
# Umami API token. Putting the token in the page would hand anyone read access
# to the analytics. So this runs on the server, where the token stays private,
# and drops a plain JSON file that Caddy serves as a static asset.
#
# Install (as the deploy user):
#   sudo install -d -o $USER -g $USER /var/www/counter
#   crontab -e
#   */5 * * * * /opt/blog/deploy/update-counter.sh >> /var/log/counter.log 2>&1
#
# Requires: curl, jq  (apt install -y curl jq)

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="${COUNTER_OUT:-/var/www/counter/counter.json}"

# shellcheck source=/dev/null
[ -f "$HERE/.env" ] && set -a && . "$HERE/.env" && set +a

: "${UMAMI_URL:=http://127.0.0.1:3000}"
: "${UMAMI_USERNAME:?set UMAMI_USERNAME in deploy/.env}"
: "${UMAMI_PASSWORD:?set UMAMI_PASSWORD in deploy/.env}"
: "${UMAMI_WEBSITE_ID:?set UMAMI_WEBSITE_ID in deploy/.env}"
# 0 means "since the beginning of time", which is what a hit counter counts.
: "${UMAMI_START_MS:=0}"

die() {
  echo "[counter] $(date -Is) ERROR: $*" >&2
  exit 1
}

token=$(
  curl -fsS --max-time 15 \
    -H 'Content-Type: application/json' \
    -d "$(jq -nc --arg u "$UMAMI_USERNAME" --arg p "$UMAMI_PASSWORD" \
      '{username:$u, password:$p}')" \
    "$UMAMI_URL/api/auth/login" | jq -re '.token'
) || die "login failed — check UMAMI_USERNAME / UMAMI_PASSWORD"

now_ms=$(($(date +%s) * 1000))

stats=$(
  curl -fsS --max-time 15 \
    -H "Authorization: Bearer $token" \
    -H 'Accept: application/json' \
    "$UMAMI_URL/api/websites/$UMAMI_WEBSITE_ID/stats?startAt=$UMAMI_START_MS&endAt=$now_ms"
) || die "stats request failed — check UMAMI_WEBSITE_ID"

# Umami v2 returned {"pageviews":{"value":N,...}}; v3 flattened it to
# {"pageviews":N}. Accept either so an upgrade does not silently zero the
# counter. `// empty` makes a missing field fail loudly instead of printing null.
payload=$(
  echo "$stats" | jq -c '
    def num($f): (.[$f] | if type == "object" then .value else . end) // empty;
    {
      pageviews: (num("pageviews") | floor),
      visitors:  (num("visitors")  | floor)
    }
  '
) || die "unexpected stats response shape: $stats"

echo "$payload" | jq -e '.pageviews >= 0 and .visitors >= 0' >/dev/null \
  || die "refusing to write implausible payload: $payload"

# Write atomically. Caddy must never read a half-written file, and a failure
# above must leave the last good value in place rather than blanking it.
mkdir -p "$(dirname "$OUT")"
tmp=$(mktemp "$(dirname "$OUT")/.counter.XXXXXX")
trap 'rm -f "$tmp"' EXIT
echo "$payload" >"$tmp"
chmod 644 "$tmp"
mv -f "$tmp" "$OUT"
trap - EXIT

echo "[counter] $(date -Is) ok $payload"
