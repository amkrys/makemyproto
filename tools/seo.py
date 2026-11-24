#!/usr/bin/env python3
"""Adds (or refreshes) the share-preview and search tags in every page's <head>:
canonical link, Open Graph (WhatsApp, Facebook, LinkedIn, Instagram DMs) and Twitter/X card.
Title and description come from the page's own <title> and meta description.
WhatsApp, Facebook and LinkedIn get the small square assets/og/thumb.png (compact preview);
X gets the wide assets/og/<page>.png (or index.png).

    python3 tools/seo.py           # update all pages
    python3 tools/seo.py --check   # fail if any page is out of date (used in CI)
"""
import pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE = "https://makemeproto.com/"
START, END = "<!-- @seo -->", "<!-- @end-seo -->"
SKIP = {"404.html"}


def block(page, html):
    title = re.search(r"<title>(.*?)</title>", html, re.S).group(1).strip()
    desc = re.search(r'<meta name="description" content="([^"]*)">', html).group(1)
    key = page.stem
    url = SITE + ("" if key == "index" else page.name)
    img = key if (ROOT / "assets/og" / f"{key}.png").exists() else "index"
    return "\n".join([
        START,
        f'  <link rel="canonical" href="{url}">',
        '  <meta property="og:type" content="website">',
        '  <meta property="og:site_name" content="MakeMeProto">',
        '  <meta property="og:locale" content="en_IN">',
        f'  <meta property="og:title" content="{title}">',
        f'  <meta property="og:description" content="{desc}">',
        f'  <meta property="og:url" content="{url}">',
        f'  <meta property="og:image" content="{SITE}assets/og/thumb.png">',
        '  <meta property="og:image:width" content="256">',
        '  <meta property="og:image:height" content="256">',
        '  <meta property="og:image:alt" content="MakeMeProto">',
        '  <meta name="twitter:card" content="summary_large_image">',
        f'  <meta name="twitter:image" content="{SITE}assets/og/{img}.png">',
        '  <meta name="theme-color" content="#FF5A1F">',
        "  " + END,
    ])


def main():
    check = "--check" in sys.argv
    stale = []
    for page in sorted(ROOT.glob("*.html")):
        if page.name in SKIP:
            continue
        html = page.read_text()
        new_block = block(page, html)
        if START in html:
            new = re.sub(re.escape(START) + r".*?" + re.escape(END), new_block, html, flags=re.S)
        else:
            new = re.sub(r'(<meta name="description" content="[^"]*">)', r"\1\n  " + new_block.replace("\\", "\\\\"), html, count=1)
        if new != html:
            stale.append(page.name)
            if not check:
                page.write_text(new)
    if check and stale:
        print("Share tags out of date in:", ", ".join(stale), "\nRun: python3 tools/seo.py")
        sys.exit(1)
    print(("Checked" if check else "Updated"), "share tags", "" if check else f"({len(stale)} pages changed)")


if __name__ == "__main__":
    main()
