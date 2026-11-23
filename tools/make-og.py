#!/usr/bin/env python3
"""Make the link-preview images (Open Graph, 1200 x 630) shown when a page is shared
on WhatsApp, Instagram, LinkedIn or X. One image per page, saved to assets/og/.

    python3 tools/make-og.py

Needs Python Playwright (pip install playwright && playwright install chromium).
Edit PAGES below to change the words on each card.
"""
import asyncio, base64, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "og"

PAGES = {
    # key: (headline, sub line, handwritten note)
    "index":     ("Think it. Design it. <em>Print it.</em>", "3D design and 3D printing services in Ahmedabad", "Socho. Design karo. Print karo. ✨"),
    "pricing":   ("Instant 3D printing <em>price</em>", "Upload an STL and get an estimate in seconds. PLA from ₹5/gram.", "Kitna lagega? Abhi pata karo!"),
    "services":  ("3D design, printing <em>&amp; prototypes</em>", "CAD, prototypes, replacement parts, gifts and student projects", "Kya banwana hai?"),
    "guide":     ("3D printing guide <em>&amp; FAQ</em>", "Design tips and clear answers to 22 common questions", "Pehle padh lo 😉"),
    "community": ("3D Adda: <em>free</em> 3D help", "A free WhatsApp community for anyone into 3D printing", "No selling, no spam. Bas madad."),
    "media":     ("Inside the <em>workshop</em>", "Reels, behind-the-scenes clips, prints and vlogs", "Proto Diaries 🎬"),
    "about":     ("Two friends. One printer. <em>Lots of chai.</em>", "Meet the makers behind MakeMeProto", "Hi! Main Proto 👋"),
    "contact":   ("Let's <em>make it.</em>", "WhatsApp, email or Instagram. Real humans reply.", "Hum sach mein reply karte hain 🤞"),
    "careers":   ("Build <em>with us</em>", "Future roles at MakeMeProto: reels, social media, 3D design", "No CV formalities 🙌"),
    "terms":     ("Terms <em>&amp; Conditions</em>", "For our 3D printing, CAD and design services", "Clear and simple ✍️"),
    "privacy":   ("Privacy <em>Policy</em>", "What we collect, why, and your rights", "Your data stays yours 🔒"),
}

PROTO = """<svg viewBox="0 0 120 110" width="330" height="302">
  <path d="M22 60c-10-4-14-14-12-24" fill="none" stroke="#c73f0c" stroke-width="6" stroke-linecap="round"/>
  <path d="M98 26 112 14v62l-14 14Z" fill="#c73f0c"/>
  <path d="M22 26 36 14h76L98 26Z" fill="#ff9c79"/>
  <rect x="22" y="26" width="76" height="64" rx="6" fill="#FF5A1F"/>
  <path d="M22 46h76M22 66h76" stroke="rgba(0,0,0,.14)" stroke-width="2" fill="none"/>
  <g transform="translate(46 50)"><circle r="10" fill="#fff"/><circle r="4.5" cx="1.5" fill="#141414"/><circle r="1.5" cx="0" cy="-1.8" fill="#fff"/></g>
  <g transform="translate(74 50)"><circle r="10" fill="#fff"/><circle r="4.5" cx="1.5" fill="#141414"/><circle r="1.5" cx="0" cy="-1.8" fill="#fff"/></g>
  <circle cx="34" cy="68" r="5" fill="#ff8fa3" opacity=".8"/><circle cx="86" cy="68" r="5" fill="#ff8fa3" opacity=".8"/>
  <path d="M50 70q10 9 20 0" fill="none" stroke="#141414" stroke-width="3.5" stroke-linecap="round"/>
  <path d="M98 60c10-4 18-16 16-28" fill="none" stroke="#c73f0c" stroke-width="6" stroke-linecap="round"/>
</svg>"""


def card(head, sub, note, logo_b64, kalam_b64):
    return f"""<!doctype html><html><head><meta charset="utf-8"><style>
@font-face {{ font-family: Kalam; src: url(data:font/ttf;base64,{kalam_b64}); font-weight: 700; }}
* {{ box-sizing: border-box; margin: 0; }}
body {{ width: 1200px; height: 630px; background: #F4F1EA; font-family: "Inter Display", Inter, sans-serif; color: #141414; position: relative; overflow: hidden;
  background-image: radial-gradient(#d9d3c6 1.4px, transparent 1.6px); background-size: 26px 26px; }}
.bar {{ position: absolute; left: 0; right: 0; top: 0; height: 14px; background: #FF5A1F; }}
.logo {{ position: absolute; left: 70px; top: 62px; height: 78px; }}
h1 {{ position: absolute; left: 72px; top: 188px; width: 720px; font-weight: 900; font-size: 72px; line-height: 1.04; letter-spacing: -.6px; word-spacing: 4px; }}
h1 em {{ font-style: normal; color: #FF5A1F; }}
p.sub {{ position: absolute; left: 74px; bottom: 132px; width: 680px; font-size: 29px; line-height: 1.3; color: #3a3a38; font-weight: 500; }}
.note {{ position: absolute; right: 70px; top: 92px; font-family: Kalam; font-weight: 700; font-size: 34px; color: #c73f0c; transform: rotate(-4deg);
  background: #FFE58A; padding: 10px 22px; border-radius: 10px; box-shadow: 0 10px 24px rgba(0,0,0,.08); }}
.proto {{ position: absolute; right: 62px; bottom: 84px; filter: drop-shadow(0 24px 26px rgba(0,0,0,.16)); }}
.foot {{ position: absolute; left: 74px; right: 72px; bottom: 46px; display: flex; justify-content: space-between; font-size: 24px; font-weight: 700; color: #141414; }}
.foot span {{ color: #6d6a63; font-weight: 500; }}
</style></head><body>
<div class="bar"></div>
<img class="logo" src="data:image/png;base64,{logo_b64}">
<div class="note">{note}</div>
<h1>{head}</h1>
<p class="sub">{sub}</p>
<div class="proto">{PROTO}</div>
<div class="foot">makemeproto.com <span>Ahmedabad · WhatsApp +91 84870 72210</span></div>
</body></html>"""


async def main():
    from playwright.async_api import async_playwright
    OUT.mkdir(parents=True, exist_ok=True)
    # the brand PNG has a big transparent margin: crop to the logo itself
    import io
    from PIL import Image
    im = Image.open(ROOT / "assets/brand/makemeproto-logo-transparent-4k.png")
    im = im.crop(im.getbbox())
    buf = io.BytesIO(); im.save(buf, "PNG")
    logo = base64.b64encode(buf.getvalue()).decode()
    kalam = base64.b64encode((ROOT / "assets/brand/fonts/Kalam-Bold.ttf").read_bytes()).decode()
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": 1200, "height": 630})
        for key, (h, s, n) in PAGES.items():
            await pg.set_content(card(h, s, n, logo, kalam))
            await pg.wait_for_timeout(150)
            path = OUT / f"{key}.png"
            await pg.screenshot(path=str(path))
            print("made", path.relative_to(ROOT))
        await b.close()

if __name__ == "__main__":
    asyncio.run(main())
