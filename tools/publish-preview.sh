#!/usr/bin/env bash
# Publish the current branch to the test site (never the live site).
#   tools/publish-preview.sh [path-to-makemeproto-preview-clone]
# Result: https://amkrys.github.io/makemeproto-preview/<branch-name>/
set -euo pipefail
SITE="$(cd "$(dirname "$0")/.." && pwd)"
PREVIEW="${1:-$SITE/../makemeproto-preview}"
BRANCH="$(git -C "$SITE" rev-parse --abbrev-ref HEAD)"
SLUG="$(echo "$BRANCH" | tr '/' '-' | tr -cd 'a-zA-Z0-9._-')"
SHA="$(git -C "$SITE" rev-parse --short HEAD)"
[ "$BRANCH" = "main" ] && { echo "main is the live site; nothing to preview."; exit 1; }
OUT="$PREVIEW/$SLUG"

rm -rf "$OUT" && mkdir -p "$OUT"
cp -r "$SITE"/*.html "$SITE/css" "$SITE/js" "$SITE/assets" "$OUT/"     # no CNAME: a preview can never take the domain

# every page: hidden from Google + a TEST SITE banner
for f in "$OUT"/*.html; do
  python3 - "$f" "$BRANCH" "$SHA" <<'PY'
import sys
f, branch, sha = sys.argv[1:4]
s = open(f, encoding="utf-8").read()
s = s.replace("<head>", '<head>\n  <meta name="robots" content="noindex, nofollow">', 1)
banner = (f'<div style="position:fixed;left:50%;transform:translateX(-50%);bottom:0;z-index:9999;'
          f'background:#141414;color:#fffdf8;font:600 12px/1.4 monospace;padding:5px 12px;border-radius:8px 8px 0 0;'
          f'pointer-events:none">TEST SITE · {branch} · {sha} · live site is makemeproto.com</div>')
s = s.replace("</body>", banner + "\n</body>", 1)
open(f, "w", encoding="utf-8").write(s)
PY
done

printf 'User-agent: *\nDisallow: /\n' > "$PREVIEW/robots.txt"
touch "$PREVIEW/.nojekyll"
# index of all previews
{
  echo '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="robots" content="noindex, nofollow"><title>MakeMeProto test sites</title></head>'
  echo '<body style="font:16px/1.6 system-ui;max-width:640px;margin:40px auto;padding:0 16px"><h1>MakeMeProto test sites</h1><p>Not the live site. Live: <a href="https://makemeproto.com">makemeproto.com</a></p><ul>'
  for d in "$PREVIEW"/*/; do n="$(basename "$d")"; echo "<li><a href=\"$n/\">$n</a></li>"; done
  echo '</ul></body></html>'
} > "$PREVIEW/index.html"

git -C "$PREVIEW" add -A
git -C "$PREVIEW" commit -q -m "preview: $BRANCH @ $SHA" || echo "nothing changed"
echo "Committed in $PREVIEW. Push it, then open: https://amkrys.github.io/makemeproto-preview/$SLUG/"
