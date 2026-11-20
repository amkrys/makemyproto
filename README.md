# MakeMyProto website

**Socho. Design Karo. Print Karo.**

A one-page website for MakeMyProto (3D design & 3D printing services). Plain HTML, CSS and JavaScript, with nothing to install.

## Files

```
MakeMyProto/
├── index.html      ← all page text and sections
├── css/style.css   ← colours, fonts, layout
├── js/main.js      ← your contact details, prices, quote calculator
└── README.md
```

## See it

Double-click `index.html` and it opens in your browser.

## Before you go live (10 minutes)

1. **Your details:** open `js/main.js` and edit `CONFIG` at the top:
   - `whatsapp`: country code + number, digits only, e.g. `"919876543210"`
   - `phoneText`, `email`, `city`, `cityFull`, `instagram`
2. **Prices:** in the same `CONFIG`, change `rate` (₹ per gram) for each material, plus `minOrder` and `maxSizeMm` (set it to your printer's real build size).
3. **Text:** check these lines in `index.html` match what you actually offer:
   - delivery time ("2–4 din"), max print size in the FAQ, "Happy to sign an NDA", design price "From ₹300 / hour"
4. **Our work section:** the six tiles are drawings. Once you have real print photos, replace a tile's `<div class="tile__art">…</div>` with
   `<div class="tile__art"><img src="images/your-photo.jpg" alt="Phone stand in orange PLA"></div>`
   and put the photo in an `images/` folder. Then remove "Real photos of our prints coming soon."
5. **"Hum kaun?" section (`id="makers"`):** names, roles and LinkedIn links are set for Deepak Dadheech (mechanical/printing) and Bal Krishan Swami (software/design). The faces are cartoon drawings; you can swap each `<div class="maker__art">…</div>` for a real photo the same way as step 4. Also check the promises you're making: "step 3½: we WhatsApp you a photo while it prints" and "replies within a few hours".

## The hero printer (playground)

- Mouse over the printer: move up/down to add or remove layers. The nozzle follows left/right and the printer tilts.
- Click the printer or "▶ Print from scratch" to watch a full print, with sparks and a "Ho gaya!" bubble at the end.
- Model buttons (Vase, Kulhad, Rocket, Dil), "Apna naam…" prints any name, and the colour dots swap filament.
- On phones: tap to print, drag sideways to scrub.
- To add a shape, add a function to `SHAPES` in `js/main.js` and a button with `data-model="yourKey"`. The bubble messages are in `phrases`.

## How the instant quote works

- STL files are read **inside the visitor's browser**. Nothing is uploaded anywhere.
- Weight = model volume × material density × fill factor (walls + infill %).
- Price = weight × ₹/gram × quantity (infill changes the weight; colour doesn't change the price), shown as a −10% / +15% range, never below the minimum order.
- "Send this quote on WhatsApp" opens WhatsApp with all the details filled in. The customer sends the file there.

It's an estimate. Check every file before you confirm the final price.

## Putting it online (free hosting)

Any of these work. Upload the whole folder:

- **Netlify Drop:** go to app.netlify.com/drop and drag the `MakeMyProto` folder onto the page. You get a live link in seconds.
- **Cloudflare Pages** or **GitHub Pages:** free, and both can use your own domain.

Then connect your domain (e.g. `makemyproto.in`) in the host's "Custom domain" settings, and add the DNS records it shows you at your domain registrar.

## Changing the look

All colours and fonts are at the top of `css/style.css` under `:root`:
`--accent` (orange), `--ink` (black), `--paper` (background), `--mint` (green).

## Colours (the 🎨 "Rang badlo" button)

The site uses orange (Filament). The 🎨 button is switched off, but five palettes are still built in: **Filament** (orange), **Neem** (green), **Neela** (blue), **Gulabi** (pink), **Jamun** (purple). To try them again, set `showThemeSwitcher: true` in `js/main.js`.

Once you've picked one, open `js/main.js` and set it in `CONFIG`:

```js
theme: "neela",
showThemeSwitcher: false,   // hides the 🎨 button for visitors
```

To make your own palette, copy one of the `[data-theme="…"]` lines at the top of `css/style.css` and change the colours.

## Handwritten touches & Proto

- Handwritten notes use the Caveat font; the logo uses Kalam. Both load from Google Fonts when online.
- Marker highlight: wrap words in `<span class="hl">…</span>`. Hand-drawn circle: `<span class="circle-word">…</span>`.
- **Proto** is the little orange cube that peeks over the contact form. His eyes follow the mouse, and clicking him changes what he says. His lines are in `initProto()` in `js/main.js`.

## Getting a price quickly

- **Upload STL, get price** button at the top opens the file picker and jumps to the price.
- Drag an STL file **anywhere on the page** and a "Chhod do! 📦" box appears; drop it to get the price.
- **Try a sample** button in the quote section lets people test the calculator without a file (it's labelled as a sample).
- A small **⚡ Instant price** pill appears at the bottom left while scrolling.

## Logo

The logo is a small nozzle "writing" the name: the orange line under `makemyproto` is filament from the nozzle and draws itself on load and hover. It's built from code (`.logo` in `index.html`), so it stays sharp everywhere. For social media you'll want a PNG version as well.

## Sections (in order)

Services → **Kiske liye?** (tabs: student, engineer, shop, home, gift) → How it works → Instant quote → **Kitne ka padega?** (example prices, worked out live from `CONFIG` so they always match the calculator) → Materials → **Toota part? Mat phenko.** (before/after slider) → Our work → Hum kaun? → **Deepak ki diary** (STL tips) → Why us → **Reviews? Abhi zero.** → FAQ → Contact

Things to check:
- The example weights (`data-grams` in `index.html`) are typical guesses. Adjust them once you've printed real ones.
- The STL tips in "Deepak ki diary": Deepak should confirm the numbers match your printer.
- "Reviews? Abhi zero." is honest on purpose. Replace it with real reviews once you have 2–3.

## 3D Adda (community section)

Free help for anyone: file checks, printer troubleshooting, design doubts and beginner advice.
- **Quick fixes:** 5 common print fails (warping, bed adhesion, stringing, layer shift, under-extrusion). Edit the tips in the `<template id="fix-…">` blocks in `index.html`.
- **"Apna sawaal pucho":** the form sends the question to your WhatsApp.
- **Join the community:** create a WhatsApp Community or group, copy its invite link and it's connected to the 3D Adda WhatsApp community (`community` in `CONFIG`). Change the link there if you make a new group.

## Upload limit

STL files up to 500 MB are read in the browser (`maxFileMb` in `CONFIG`). Very large files can take a few seconds, and on low-end phones they may not load at all. Those customers can send the file on WhatsApp instead.

## Hero printer workbench

Under the printer is a little hand-drawn **shelf** of mini printed models (vase, kulhad, rocket, dil, and an "Aa" name tag).
- Click one, or **drag it onto the printer** (desktop), to print it. The chosen one gets a hand-drawn circle.
- **apna naam** opens a yellow paper tag: type a name, press Enter or "print ↵".
- **filament:** six little spools; click one to load that colour (the shelf models change colour too).
- **↻ phir se** prints the current model again.
The shelf thumbnails are drawn from the same `SHAPES` the printer uses, so a new shape automatically gets a matching thumbnail. Add a button with `data-model` and `data-thumb`.
