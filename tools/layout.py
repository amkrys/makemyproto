#!/usr/bin/env python3
"""Keep the shared layout identical on every page.

Each page has blocks like:
    <!-- @layout:nav -->
    ...copied from _layout/nav.html...
    <!-- @end -->

Edit the file in _layout/, then run:
    python3 tools/layout.py          # copy _layout/* into every page
    python3 tools/layout.py --check  # fail if any page is out of date (used in CI)
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LAYOUT = ROOT / "_layout"
BLOCK = re.compile(r"(  <!-- @layout:(?P<name>[a-z]+) -->\n)(?P<body>.*?)(  <!-- @end -->)", re.S)


def sync(check: bool) -> int:
    parts = {p.stem: p.read_text(encoding="utf-8") for p in LAYOUT.glob("*.html")}
    stale = []
    for page in sorted(ROOT.glob("*.html")):
        html = page.read_text(encoding="utf-8")
        new = BLOCK.sub(lambda m: m.group(1) + parts.get(m.group("name"), m.group("body")) + m.group(4), html)
        if new != html:
            stale.append(page.name)
            if not check:
                page.write_text(new, encoding="utf-8")
    if check and stale:
        print("Out of date with _layout/: " + ", ".join(stale) + "\nRun: python3 tools/layout.py")
        return 1
    print(("Checked" if check else "Synced") + f" {len(list(ROOT.glob('*.html')))} pages" + ("" if check else f", updated {len(stale)}"))
    return 0


if __name__ == "__main__":
    sys.exit(sync("--check" in sys.argv))
