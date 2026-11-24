/* =========================================================
   MakeMeProto: site script
   ---------------------------------------------------------
   STEP 1: Put your real details in CONFIG below.
   Everything on the page (WhatsApp links, email, city)
   updates automatically from here.
   ========================================================= */

const CONFIG = {
  whatsapp: "918487072210",          // country code + number, digits only
  phoneText: "+91 84870 72210",      // how the number is shown on the page
  email: "contact@makemeproto.com",
  city: "Ahmedabad",
  cityFull: "Ahmedabad, Gujarat",
  instagram: "makemeproto",          // handle without @
  community: "https://chat.whatsapp.com/D55pQNBsJBY4H8kOEmGliL",                     // WhatsApp community / group invite link (leave "" to use a WhatsApp message instead)
  maxFileMb: 500,                    // biggest STL the quote calculator will read

  // Visitor stats: Cloudflare Web Analytics (free, no cookies). Paste the token from
  // Cloudflare → Analytics & Logs → Web Analytics → makemeproto.com → "Manage site" (the token in the JS snippet).
  // Only counts visits on the live site, never the test sites or a local copy.
  analytics: {
    cloudflareToken: "be87442c7b0c4a959c4370581505190e",
    liveHosts: ["makemeproto.com", "www.makemeproto.com"],
  },

  // Website forms → Google Sheet + Drive (see backend/forms/README.md).
  // Leave endpoint "" and every form simply opens WhatsApp, like before.
  forms: {
    endpoint: "https://script.google.com/macros/s/AKfycbxlvs76-R42puts5UtR2sOP5H7wI-cMJxzRCkHumyaAL-epoGe7Ba2tOd52gxQWj6gO/exec",
    maxMb: { stl: 25, photo: 8, resume: 5 },   // bigger STLs are sent without the file (we ask for it on WhatsApp)
  },

  // Colours: "filament" (orange), "neem" (green), "neela" (blue), "gulabi" (pink), "jamun" (purple)
  theme: "filament",
  showThemeSwitcher: false,          // true shows the 🎨 colour button

  // Prices in ₹ per gram, and material density in g/cm³
  materials: {
    PLA:  { rate: 5, density: 1.24 },
    PETG: { rate: 6, density: 1.27 },
    ABS:  { rate: 6, density: 1.04 },
    TPU:  { rate: 8, density: 1.21 },
  },
  minOrder: 300,           // ₹ minimum per order
  gramsPerHour: 15,        // rough printer speed, used for the time estimate
  maxSizeMm: 250,          // biggest single print (warns if the model is larger)
};

/* ---------- Small helpers ---------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const inr = (n) => "₹" + Math.round(n).toLocaleString("en-IN");
/* Every WhatsApp message is laid out the same way, so they're easy to read and sort:
     *📌 MakeMeProto · Topic*
     ━━━━━━━━━━━━
     *Label:* value
     _Sent from makemeproto website_                                         */
const waFormat = (topic, rows, note) => [
  `*📌 MakeMeProto · ${topic}*`,
  "━━━━━━━━━━━━",
  ...rows.filter((r) => r && r[1] != null && String(r[1]).trim() !== "").map(([k, v]) => (k ? `*${k}:* ${v}` : v)),
  note ? `\n${note}` : null,
  "",
  "_Sent from the makemeproto website_",
].filter((x) => x != null).join("\n");
// data-wa="Topic|Message" on links becomes a formatted message too
const waText = (raw) => {
  if (!raw.includes("|")) return raw;
  const [topic, message] = raw.split("|");
  return waFormat(topic.trim(), [["Message", message.trim()]]);
};
const waLink = (text) => `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(waText(text))}`;

/* ---------- Language: Hinglish (default in India) or English ---------- */
let LANG = "hi";
const T = (hi, en) => (LANG === "en" ? en : hi);
const original = new WeakMap();
function setLang(lang, save) {
  LANG = lang === "en" ? "en" : "hi";
  document.documentElement.lang = LANG === "en" ? "en" : "en-IN";
  $$("[data-en]").forEach((el) => {
    if (!original.has(el)) original.set(el, el.innerHTML);
    el.innerHTML = LANG === "en" ? el.getAttribute("data-en") : original.get(el);
    $$("[data-wa]", el).forEach((a) => { a.href = waLink(a.dataset.wa); });
  });
  $$("#langBtn [data-lang]").forEach((s) => s.classList.toggle("on", s.dataset.lang === LANG));
  if (save) { try { localStorage.setItem("mmp-lang", LANG); } catch (e) {} }
  window.dispatchEvent(new Event("mmp:lang"));
}
function initLang() {
  let saved = null;
  try { saved = localStorage.getItem("mmp-lang"); } catch (e) {}
  const langs = navigator.languages || [navigator.language || ""];
  const indian = langs.some((l) => /^hi|-IN$/i.test(l));
  setLang(saved || (indian ? "hi" : "en"), false);
  $("#langBtn")?.addEventListener("click", () => setLang(LANG === "en" ? "hi" : "en", true));
}
const hasRealNumber = () => /^\d{10,15}$/.test(CONFIG.whatsapp);

/* ---------- Fill in business details ---------- */
function applyConfig() {
  $$("[data-city]").forEach((el) => (el.textContent = CONFIG.city));
  $$("[data-city-full]").forEach((el) => (el.textContent = CONFIG.cityFull));
  $$("[data-phone-text]").forEach((el) => (el.textContent = CONFIG.phoneText));
  $$("[data-email]").forEach((el) => {
    el.textContent = CONFIG.email;
    el.href = "mailto:" + CONFIG.email;
  });
  $$("[data-insta]").forEach((el) => {
    el.textContent = "@" + CONFIG.instagram;
    el.href = "https://instagram.com/" + CONFIG.instagram;
  });
  $$("[data-wa]").forEach((el) => {
    el.href = waLink(el.dataset.wa);
    el.target = "_blank";
    el.rel = "noopener";
  });
  const y = $("#year");
  if (y) y.textContent = new Date().getFullYear();
}

/* ---------- Nav ---------- */
function initNav() {
  const nav = $(".nav");
  const toggle = $("#navToggle");
  const links = $("#navLinks");
  const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 8);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  toggle.addEventListener("click", () => {
    const open = links.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(open));
  });
  // mark the page you're on
  const here = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  $$("a", links).forEach((a) => {
    const file = (a.getAttribute("href") || "").split("#")[0].toLowerCase();
    if (file && file === here) a.setAttribute("aria-current", "page");
  });
  $$("a", links).forEach((a) =>
    a.addEventListener("click", () => {
      links.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    })
  );
}

/* ---------- Hero: printer playground ----------
   • Starts with the finished print (26/26).
   • Mouse over the printer: move UP to add layers, DOWN to remove them.
     The nozzle follows you left/right and the printer tilts toward the pointer.
   • Click / tap the printer (or the ▶ button): it prints the model from the bed up.
   • Pick a model, type your name, or swap the filament colour.
   • Touch: drag left/right across the printer to scrub layers. */
function initPrinter() {
  const svg = $("#printModel");
  if (!svg) return;
  const printer = $("#printer");
  const frame = svg.parentElement;
  const gantry = $("#gantry");
  const nozzle = $(".printer__nozzle");
  const layerNo = $("#layerNo");
  const status = $("#printStatus");
  const temp = $("#nozzleTemp");
  const hero = $("#play") || $(".hero");
  const visual = $(".hero__visual");
  const playBtn = $("#printPlay");
  const nameInput = $("#printName");
  const tilt = $(".enclosure") || svg.parentElement;   // the whole printer body tilts toward the mouse
  const NS = "http://www.w3.org/2000/svg";

  const LAYERS = 52, H = 300, layerH = 4.6, gap = 0.9, base = H - 6;   // 52 fine layers
  const rowY = (i) => base - (i + 1) * (layerH + gap);       // top y of layer i (0 = bottom)
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* Shapes: inside(v, u) where v = -1…1 across, u = 0 (bed) … 1 (top) */
  const SHAPES = {
    vase: (v, u) => Math.abs(v) < (150 + 70 * Math.sin(u * Math.PI * 1.15 + 0.35) - 40 * u) / 300,
    kulhad: (v, u) => {
      if (u < 0.7) return Math.abs(v) < 0.3 + 0.17 * u;                  // the cup
      if (u < 0.76) return Math.abs(v) < 0.45;                           // rim
      if (u > 0.82) {                                                    // steam
        const s = Math.sin(u * 22) * 0.05;
        return [-0.16, 0, 0.16].some((c) => Math.abs(v - c - s) < 0.04);
      }
      return false;
    },
    rocket: (v, u) => {
      const a = Math.abs(v);
      if (u < 0.07) return a < 0.1;                                      // exhaust
      if (u < 0.3 && a < 0.19 + 0.17 * ((0.3 - u) / 0.23)) return true;      // fins
      if (u > 0.5 && u < 0.6 && a < 0.07) return false;                  // window
      if (u < 0.72) return a < 0.19;                                     // body
      return a < 0.19 * Math.pow(1 - (u - 0.72) / 0.28, 0.7);           // nose cone
    },
    heart: (v, u) => {
      const X = v * 1.3, Y = -1.05 + u * 2.3;
      return Math.pow(X * X + Y * Y - 1, 3) - X * X * Y * Y * Y <= 0;
    },
  };

  // "Your name": draw text on a hidden canvas and slice it into layers
  function textShape(text) {
    const c = document.createElement("canvas");
    c.width = 300; c.height = 300;
    const g = c.getContext("2d");
    let size = 170;
    const fam = getComputedStyle(document.body).getPropertyValue("--f-display") || "sans-serif";
    do { g.font = `900 ${size}px ${fam}`; size -= 2; } while (g.measureText(text).width > 280 && size > 30);
    g.textAlign = "center"; g.textBaseline = "alphabetic";
    const m = g.measureText(text);
    const asc = m.actualBoundingBoxAscent || size * 0.72, desc = m.actualBoundingBoxDescent || 0;
    const sy = Math.min(2.2, 130 / (asc + desc));                           // stretch tall: more layers per letter
    g.save();
    g.translate(150, base - 2);
    g.scale(1, sy);
    g.fillText(text, 0, -desc);                                              // letters sit on the bed
    g.restore();
    const data = g.getImageData(0, 0, 300, 300).data;
    return (v, u) => {
      const x = Math.round(150 + v * 150), y = Math.round(rowY(Math.round(u * (LAYERS - 1))) + layerH / 2);
      return data[(y * 300 + x) * 4 + 3] > 110;
    };
  }

  // Build the <g> layers from a shape
  let layers = [];   // [{ g, x0, x1 }]
  function build(shape) {
    svg.innerHTML = "";
    layers = [];
    for (let i = 0; i < LAYERS; i++) {
      const u = i / (LAYERS - 1);
      const g = document.createElementNS(NS, "g");
      let start = null, x0 = 150, x1 = 150, any = false;
      for (let x = 0; x <= 300; x += 1) {
        const inside = x < 300 && shape((x - 150) / 150, u);
        if (inside && start === null) start = x;
        if (!inside && start !== null) {
          if (x - start >= 3) {
            const r = document.createElementNS(NS, "rect");
            r.setAttribute("x", start); r.setAttribute("y", rowY(i));
            r.setAttribute("width", x - start); r.setAttribute("height", layerH);
            r.setAttribute("rx", layerH / 2);
            g.appendChild(r);
            if (!any) x0 = start;
            x1 = x; any = true;
          }
          start = null;
        }
      }
      svg.appendChild(g);
      layers.push({ g, x0, x1 });
    }
    shown = -1;
  }

  let shown = -1;           // layers drawn right now
  let target = LAYERS;      // where we're heading
  let current = LAYERS;     // smoothed float
  let mode = "idle";        // idle | scrub | auto
  let raf = 0, autoStart = 0, lastSpark = 0, celebrated = true;

  // px inside the frame for a point in svg coords
  function toFrame(x, y) {
    const s = svg.getBoundingClientRect(), f = frame.getBoundingClientRect();
    const k = Math.min(s.width / 300, s.height / H);           // svg keeps its aspect ratio
    const ox = (s.width - 300 * k) / 2, oy = (s.height - H * k) / 2;
    return { x: s.left - f.left + ox + x * k, y: s.top - f.top + oy + y * k };
  }
  function gantryTopFor(n) {
    const y = n > 0 ? rowY(n - 1) : base + 6;
    return Math.max(14, toFrame(0, y).y - 34);
  }

  function render() {
    const n = clamp(Math.round(current), 0, LAYERS);
    if (n !== shown) {
      layers.forEach((l, i) => l.g.classList.toggle("on", i < n));
      shown = n;
    }
    gantry.style.top = gantryTopFor(mode === "auto" ? Math.min(LAYERS, n + 1) : n) + "px";
    layerNo.textContent = String(n).padStart(2, "0");
    const done = n === LAYERS;
    printer.classList.toggle("is-done", done && mode !== "scrub");
    printer.classList.toggle("is-printing", mode === "auto");
    status.textContent = done ? "PRINT DONE ✓" : n === 0 ? "BED READY" : "PRINTING…";
    temp.textContent = mode === "auto" ? 218 + Math.round(Math.random() * 4) : 220;
  }

  /* --- auto print: layer by layer, nozzle tracing each layer --- */
  const MS_PER_LAYER = 58;
  function autoFrame(now) {
    const p = Math.max(0, now - autoStart) / MS_PER_LAYER;  // layers printed (float)
    current = Math.min(LAYERS, p);
    const i = Math.min(LAYERS - 1, Math.floor(p));
    const l = layers[i], frac = p - Math.floor(p);
    const dir = i % 2 ? -1 : 1;                              // zig-zag like a real slicer
    const x = dir > 0 ? l.x0 + (l.x1 - l.x0) * frac : l.x1 - (l.x1 - l.x0) * frac;
    const fx = toFrame(x, 0).x - frame.clientWidth / 2;
    nozzle.style.setProperty("--nx", fx.toFixed(1) + "px");
    if (now - lastSpark > 45 && p < LAYERS) { spark(toFrame(x, rowY(i)).x, gantryTopFor(i + 1) + 34); lastSpark = now; }
    render();
    if (p >= LAYERS) { mode = "idle"; current = target = LAYERS; render(); celebrate(); raf = 0; resetPose(); showIdeas(); window.dispatchEvent(new CustomEvent("mmp:done", { detail: { model: modelKey } })); return; }
    raf = requestAnimationFrame(autoFrame);
  }
  function autoPrint() {
    printer.classList.add("played");
    window.dispatchEvent(new CustomEvent("mmp:print", { detail: { model: modelKey } }));
    cancelAnimationFrame(raf);
    mode = "auto"; celebrated = false;
    current = 0; target = LAYERS; shown = -1;
    printer.classList.remove("is-idle");
    tilt.style.removeProperty("--rx"); tilt.style.removeProperty("--ry");
    autoStart = performance.now();
    raf = requestAnimationFrame(autoFrame);
  }

  /* --- scrub: ease toward the pointer --- */
  function easeLoop() {
    current += (target - current) * 0.18;
    if (Math.abs(target - current) < 0.02) current = target;
    render();
    raf = current !== target ? requestAnimationFrame(easeLoop) : 0;
  }
  const kick = () => { if (!raf && mode !== "auto") raf = requestAnimationFrame(easeLoop); };

  /* --- little hot sparks under the nozzle --- */
  function spark(x, y) {
    const s = document.createElement("i");
    s.className = "spark";
    s.style.left = x + "px"; s.style.top = y + "px";
    s.style.setProperty("--dx", (Math.random() * 30 - 15).toFixed(0) + "px");
    frame.appendChild(s);
    setTimeout(() => s.remove(), 600);
  }

  /* --- after printing a name: "make it for real" ideas --- */
  function showIdeas() {
    if (!ideas || modelKey !== "name" || !modelText) return;
    $("#nameIdeasName").textContent = modelText;
    // laptops: the card replaces the generic "get it made" chips next to the printer, so it's on screen
    // phones: it sits under the printer and scrolls into view
    ideasHome ??= ideas.parentElement;
    const side = $(".play__side"), makeit = $(".makeit"), wide = matchMedia("(min-width: 861px)").matches;
    if (side && wide) { side.appendChild(ideas); if (makeit) makeit.hidden = true; }
    else if (ideasHome && ideas.parentElement !== ideasHome) { ideasHome.appendChild(ideas); if (makeit) makeit.hidden = false; }
    ideas.hidden = false;
    ideas.classList.remove("pop"); void ideas.offsetWidth; ideas.classList.add("pop");
    if (!(side && wide)) setTimeout(() => ideas.scrollIntoView({ behavior: "smooth", block: "nearest" }), 250);
  }
  let ideasHome = null;   // where the card lives under the printer (set on first use)
  $("#nameIdeasX")?.addEventListener("click", () => { ideas.hidden = true; const m = $(".makeit"); if (m) m.hidden = false; });
  $$("[data-idea]").forEach((b) => b.addEventListener("click", () => {
    const msg = waFormat("Name gift idea 🎁", [["Name to print", modelText], ["Product", b.dataset.idea]], "What would it cost?");
    window.open(waLink(msg), "_blank", "noopener");
  }));

  /* --- confetti + "Ho gaya!" when a print finishes --- */
  const bubble = $("#printBubble");
  const phrases = ["Ho gaya! ✨", "Ekdum perfect!", "Bas, ready hai!", "Mast print!", "Taiyaar! 🎉"];
  const phrasesEn = ["Done! ✨", "Looking perfect!", "All ready!", "Nice print!", "Ta-da! 🎉"];
  function celebrate() {
    if (celebrated) return;
    celebrated = true;
    const f = frame.getBoundingClientRect();
    for (let k = 0; k < 22; k++) {
      const c = document.createElement("i");
      c.className = "confetti";
      c.style.left = f.width / 2 + "px"; c.style.top = f.height * 0.35 + "px";
      const a = Math.random() * Math.PI * 2, d = 70 + Math.random() * 110;
      c.style.setProperty("--tx", (Math.cos(a) * d).toFixed(0) + "px");
      c.style.setProperty("--ty", (Math.sin(a) * d - 40).toFixed(0) + "px");
      c.style.setProperty("--r", (Math.random() * 720 - 360).toFixed(0) + "deg");
      c.style.background = k % 3 ? "var(--fil)" : k % 2 ? "var(--paper)" : "var(--mint)";
      frame.appendChild(c);
      setTimeout(() => c.remove(), 1100);
    }
    if (bubble) {
      const list = LANG === "en" ? phrasesEn : phrases;
      bubble.textContent = list[Math.floor(Math.random() * list.length)];
      bubble.classList.remove("pop"); void bubble.offsetWidth; bubble.classList.add("pop");
    }
  }

  function resetPose() {
    nozzle.style.removeProperty("--nx");
    tilt.style.removeProperty("--rx"); tilt.style.removeProperty("--ry");
    printer.classList.add("is-idle");
  }

  /* --- pointer handling --- */
  function onMouse(e) {
    if (mode === "auto" || printer.classList.contains("is-target")) return;
    const fb = frame.getBoundingClientRect();
    // tilt toward the pointer from anywhere in the hero
    const hb = hero.getBoundingClientRect();
    const tx = clamp((e.clientX - (fb.left + fb.width / 2)) / hb.width, -0.5, 0.5);
    const ty = clamp((e.clientY - (fb.top + fb.height / 2)) / hb.height, -0.5, 0.5);
    tilt.style.setProperty("--ry", (tx * 16).toFixed(2) + "deg");
    tilt.style.setProperty("--rx", (-ty * 10).toFixed(2) + "deg");
    const fx = clamp((e.clientX - fb.left) / fb.width, 0, 1) - 0.5;
    nozzle.style.setProperty("--nx", (fx * fb.width * 0.62).toFixed(1) + "px");
    printer.classList.remove("is-idle");
    // layers: only while the pointer is over the printer column
    // only while the pointer is over the printer itself (not the shelf or spools below it)
    const over = e.clientX >= fb.left - 10 && e.clientX <= fb.right + 10 && e.clientY >= fb.top - 30 && e.clientY <= fb.bottom + 6;
    if (over) {
      printer.classList.add("played");
      mode = "scrub";
      target = Math.round(clamp((fb.bottom - e.clientY) / (fb.height * 0.85), 0, 1) * LAYERS);
    } else if (mode === "scrub") {
      mode = "idle"; target = LAYERS;
    }
    kick();
  }
  function onTouch(e) {
    if (mode === "auto") return;
    const fb = frame.getBoundingClientRect();
    const fx = clamp((e.clientX - fb.left) / fb.width, 0, 1);
    mode = "scrub";
    target = Math.round(fx * LAYERS);
    nozzle.style.setProperty("--nx", ((fx - 0.5) * fb.width * 0.62).toFixed(1) + "px");
    printer.classList.remove("is-idle");
    kick();
  }

  /* --- controls: a little shelf of models, spools of filament, a name tag --- */
  const modelBtns = $$(".shelf__item");
  let modelKey = "vase", modelText = "";
  const ideas = $("#nameIdeas");
  function setModel(key, text) {
    modelKey = key; modelText = text || "";
    if (key !== "name" && ideas) ideas.hidden = true;
    modelBtns.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.model === key)));
    build(key === "name" ? textShape(text) : SHAPES[key]);
  }
  // mini layered thumbnails, drawn from the same shapes the printer uses
  $$("[data-thumb]").forEach((el) => {
    const shape = SHAPES[el.dataset.thumb];
    let r = "";
    const ROWS = 30, step = 292 / ROWS, h = step * 0.78;
    for (let i = 0; i < ROWS; i++) {
      const u = i / (ROWS - 1); let start = null;
      for (let x = 0; x <= 300; x += 2) {
        const inside = x < 300 && shape((x - 150) / 150, u);
        if (inside && start === null) start = x;
        if (!inside && start !== null) { r += `<rect x="${start}" y="${(296 - (i + 1) * step).toFixed(1)}" width="${x - start}" height="${h.toFixed(1)}" rx="${(h / 2).toFixed(1)}"/>`; start = null; }
      }
    }
    el.innerHTML = `<svg viewBox="0 0 300 300" aria-hidden="true">${r}</svg>`;
  });
  const go = () => (reduce ? (current = LAYERS, render()) : autoPrint());
  const nameForm = $("#nameForm");
  const openName = (open) => {
    nameForm.hidden = !open;
    if (open) { nameInput.focus(); nameInput.select(); }
  };
  function pick(key) {
    if (key === "name") {
      openName(true);
      if (nameInput.value.trim()) { setModel("name", nameInput.value.trim()); go(); }
      return;
    }
    openName(false);
    setModel(key); go();
  }
  let dragged = false;
  modelBtns.forEach((b) => b.addEventListener("click", () => { if (dragged) { dragged = false; return; } pick(b.dataset.model); }));
  nameForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = nameInput.value.trim();
    if (v) { clearTimeout(nameTimer); setModel("name", v); go(); }
  });
  $("#nameClose")?.addEventListener("click", () => openName(false));
  nameInput?.addEventListener("keydown", (e) => { if (e.key === "Escape") openName(false); });
  let nameTimer = 0;
  nameInput?.addEventListener("input", () => {
    clearTimeout(nameTimer);
    const t = nameInput.value.trim();
    if (!t) return;
    nameTimer = setTimeout(() => { setModel("name", t); go(); }, 600);
  });

  // spools: load a new filament colour
  $$(".spool").forEach((b) => b.addEventListener("click", () => {
    printer.style.setProperty("--fil", b.dataset.fil);
    $$(".spool").forEach((o) => o.setAttribute("aria-pressed", String(o === b)));
    b.classList.remove("roll"); void b.offsetWidth; b.classList.add("roll");
  }));

  // drag a model from the shelf onto the printer (mouse / pen)
  modelBtns.forEach((b) => b.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "touch" || e.button !== 0) return;
    const sx = e.clientX, sy = e.clientY;
    let ghost = null;
    const move = (ev) => {
      if (!ghost && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 8) {
        ghost = document.createElement("div");
        ghost.className = "shelf__ghost";
        const th = b.querySelector(".shelf__thumb");
        ghost.innerHTML = th ? th.innerHTML : `<span class="hand">${b.textContent.trim()}</span>`;
        document.body.appendChild(ghost);
        printer.classList.add("is-target");
      }
      if (!ghost) return;
      ghost.style.transform = `translate(${ev.clientX - 30}px, ${ev.clientY - 30}px) rotate(${Math.max(-20, Math.min(20, (ev.clientX - sx) / 10))}deg)`;
      const f = frame.getBoundingClientRect();
      printer.classList.toggle("is-over", ev.clientX > f.left && ev.clientX < f.right && ev.clientY > f.top && ev.clientY < f.bottom);
    };
    const up = () => {
      removeEventListener("pointermove", move); removeEventListener("pointerup", up);
      if (!ghost) return;
      dragged = true;
      const hit = printer.classList.contains("is-over");
      printer.classList.remove("is-target", "is-over");
      ghost.remove();
      if (hit) { dragged = false; pick(b.dataset.model); }
      setTimeout(() => { dragged = false; }, 0);
    };
    addEventListener("pointermove", move); addEventListener("pointerup", up);
  }));

  window.mmpPrinter = {
    print: () => autoPrint(),
    printName: () => $('.shelf__item[data-model="name"]')?.click(),
    played: () => printer.classList.contains("played"),
    el: printer,
  };
  window.addEventListener("mmp:lang", () => { if (ideas && !ideas.hidden) $("#nameIdeasName").textContent = modelText; });
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  setModel("vase");
  current = LAYERS;
  render();
  if (reduce) { printer.classList.remove("is-idle"); return; }

  playBtn?.addEventListener("click", autoPrint);

  /* --- show people the printer is a toy: a ghost hand scrubs the layers until they try it --- */
  const hand = $(".demo-hand");
  let demoTimer = 0;
  function demo() {
    if (!hand || printer.classList.contains("played") || mode !== "idle" || document.hidden) return schedule();
    const fb = frame.getBoundingClientRect();
    if (fb.bottom < 0 || fb.top > innerHeight) return schedule();              // only when it's on screen
    printer.classList.add("demo");
    const t0 = performance.now(), D = 3000;
    const step = (now) => {
      const k = (now - t0) / D;
      if (k >= 1 || printer.classList.contains("played")) {
        printer.classList.remove("demo");
        if (!printer.classList.contains("played")) { mode = "idle"; target = LAYERS; kick(); }
        return schedule();
      }
      const y = k < 0.45 ? k / 0.45 : 1 - (k - 0.45) / 0.55;                  // 0 = top, 1 = bottom
      hand.style.setProperty("--hy", (14 + y * 62).toFixed(1) + "%");
      hand.style.setProperty("--hx", (50 + Math.sin(k * Math.PI * 2) * 14).toFixed(1) + "%");
      mode = "scrub";
      target = Math.round((1 - y) * LAYERS);
      kick();
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  function schedule(ms = 9000) { clearTimeout(demoTimer); if (!printer.classList.contains("played")) demoTimer = setTimeout(demo, ms); }
  schedule(1800);
  window.addEventListener("mmp:theme", autoPrint);   // new colours → fresh print
  let lastType = "mouse";
  frame.addEventListener("click", () => { if (lastType !== "touch") autoPrint(); });
  hero.addEventListener("pointermove", (e) => {
    if (e.pointerType === "mouse" || e.pointerType === "pen") onMouse(e);
  });
  hero.addEventListener("pointerleave", (e) => {
    if (e.pointerType === "touch" || mode === "auto") return;
    mode = "idle"; target = LAYERS; resetPose(); kick();
  });
  let dragMoved = false;
  frame.addEventListener("pointerdown", (e) => { lastType = e.pointerType; if (e.pointerType === "touch") dragMoved = false; });
  frame.addEventListener("pointermove", (e) => { if (e.pointerType === "touch" && e.buttons) { dragMoved = true; onTouch(e); } });
  frame.addEventListener("pointerup", (e) => {
    if (e.pointerType !== "touch") return;
    if (!dragMoved) { autoPrint(); return; }
    setTimeout(() => { if (mode === "scrub") { mode = "idle"; target = LAYERS; resetPose(); kick(); } }, 1200);
  });
  window.addEventListener("resize", () => render());
}

/* ---------- STL parsing (binary + ASCII) ---------- */
function parseSTL(buffer) {
  const dv = new DataView(buffer);
  let tris = [];
  const isBinary =
    buffer.byteLength >= 84 && 84 + dv.getUint32(80, true) * 50 === buffer.byteLength;

  if (isBinary) {
    const n = dv.getUint32(80, true);
    tris = new Float32Array(n * 9);
    let o = 84;
    for (let t = 0; t < n; t++) {
      o += 12; // skip normal
      for (let k = 0; k < 9; k++) { tris[t * 9 + k] = dv.getFloat32(o, true); o += 4; }
      o += 2; // attribute bytes
    }
  } else {
    const text = new TextDecoder().decode(buffer);
    const re = /vertex\s+([-+\d.eE]+)\s+([-+\d.eE]+)\s+([-+\d.eE]+)/g;
    const v = [];
    let m;
    while ((m = re.exec(text))) v.push(+m[1], +m[2], +m[3]);
    if (v.length < 9) throw new Error("No triangles found");
    tris = new Float32Array(v.slice(0, Math.floor(v.length / 9) * 9));
  }

  let vol = 0;
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let t = 0; t < tris.length; t += 9) {
    const ax = tris[t], ay = tris[t + 1], az = tris[t + 2];
    const bx = tris[t + 3], by = tris[t + 4], bz = tris[t + 5];
    const cx = tris[t + 6], cy = tris[t + 7], cz = tris[t + 8];
    // signed volume of tetrahedron (origin, a, b, c)
    vol += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
    for (let k = 0; k < 9; k++) {
      const a = k % 3, val = tris[t + k];
      if (val < min[a]) min[a] = val;
      if (val > max[a]) max[a] = val;
    }
  }
  return {
    volumeCm3: Math.abs(vol) / 1000, // STL units are mm
    size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]],
    triangles: tris.length / 9,
  };
}

/* ---------- Instant quote ---------- */
/* ---------- Visitor stats (Cloudflare Web Analytics, live site only) ---------- */
function initAnalytics() {
  const a = CONFIG.analytics || {};
  if (!a.cloudflareToken || !(a.liveHosts || []).includes(location.hostname)) return;
  const s = document.createElement("script");
  s.defer = true;
  s.src = "https://static.cloudflareinsights.com/beacon.min.js";
  s.setAttribute("data-cf-beacon", JSON.stringify({ token: a.cloudflareToken }));
  document.head.appendChild(s);
}

/* =========================================================
   Website forms: saved to our Google Sheet (+ files to Drive)
   in the background, with a little notification card.
   ========================================================= */
const PAGE_START = Date.now();
const formsOn = () => !!CONFIG.forms?.endpoint;

/* ---------- Notification cards (bottom-left) ---------- */
function toast({ icon = "", title = "", text = "", kind = "info", progress = false, actions = [], timeout = 0 } = {}) {
  let box = $(".toasts");
  if (!box) { box = document.createElement("div"); box.className = "toasts"; document.body.appendChild(box); }
  const el = document.createElement("div");
  el.className = "toast";
  el.innerHTML = `<span class="toast__icon" aria-hidden="true"></span><div class="toast__body"><b class="toast__title"></b><p class="toast__text"></p>
    <div class="toast__bar" hidden><i></i></div><div class="toast__actions"></div></div><button type="button" class="toast__x" aria-label="Close">×</button>`;
  let timer;
  const api = {
    el,
    update(o) {
      if (o.kind) { el.className = "toast toast--" + o.kind + (el.classList.contains("show") ? " show" : ""); el.setAttribute("role", o.kind === "error" ? "alert" : "status"); }
      if (o.icon != null) $(".toast__icon", el).textContent = o.icon;
      if (o.title != null) $(".toast__title", el).textContent = o.title;
      if (o.text != null) $(".toast__text", el).textContent = o.text;
      if (o.progress != null) {
        const bar = $(".toast__bar", el);
        bar.hidden = o.progress === false;
        if (typeof o.progress === "number") $("i", bar).style.width = Math.round(o.progress * 100) + "%";
      }
      if (o.actions) {
        const row = $(".toast__actions", el); row.innerHTML = "";
        o.actions.forEach((a) => {
          const b = document.createElement(a.href ? "a" : "button");
          b.className = "toast__btn" + (a.primary ? " toast__btn--main" : "");
          b.textContent = a.label;
          if (a.href) { b.href = a.href; if (a.newTab !== false) { b.target = "_blank"; b.rel = "noopener"; } } else b.type = "button";
          b.addEventListener("click", () => { a.onClick?.(); if (a.close !== false) api.close(); });
          row.appendChild(b);
        });
      }
      clearTimeout(timer);
      if (o.timeout) timer = setTimeout(() => api.close(), o.timeout);
      return api;
    },
    close() { clearTimeout(timer); el.classList.remove("show"); setTimeout(() => el.remove(), 350); },
  };
  $(".toast__x", el).addEventListener("click", () => api.close());
  box.appendChild(el);
  api.update({ icon, title, text, kind, progress, actions, timeout });
  requestAnimationFrame(() => el.classList.add("show"));
  return api;
}

/* ---------- Is the file what it claims to be? (checked again on the server) ---------- */
const FILE_RULES = {
  stl: ["stl"],
  photo: ["jpg", "jpeg", "png", "webp", "heic"],
  resume: ["pdf", "doc", "docx", "jpg", "jpeg", "png"],
};
async function looksGenuine(file, ext) {
  const head = new Uint8Array(await file.slice(0, 2048).arrayBuffer());
  const asc = (a, n) => String.fromCharCode(...head.slice(a, a + n));
  switch (ext) {
    case "stl": {
      if (/^\s*solid/i.test(asc(0, 80)) && /facet|endsolid/i.test(asc(0, 2048))) return true;
      if (file.size < 134) return false;
      const tris = new DataView(head.buffer).getUint32(80, true);
      return tris > 0 && 84 + tris * 50 === file.size;
    }
    case "jpg": case "jpeg": return head[0] === 0xFF && head[1] === 0xD8 && head[2] === 0xFF;
    case "png": return head[0] === 0x89 && asc(1, 3) === "PNG";
    case "webp": return asc(0, 4) === "RIFF" && asc(8, 4) === "WEBP";
    case "heic": return asc(4, 4) === "ftyp";
    case "pdf": return asc(0, 5) === "%PDF-";
    case "docx": return head[0] === 0x50 && head[1] === 0x4B && head[2] === 0x03 && head[3] === 0x04;
    case "doc": return head[0] === 0xD0 && head[1] === 0xCF && head[2] === 0x11 && head[3] === 0xE0;
  }
  return false;
}
// returns an error message, or "" when the file is fine
async function checkFile(file, kind) {
  if (!file) return "";
  const ext = file.name.toLowerCase().split(".").pop();
  if (!FILE_RULES[kind].includes(ext)) return T(`.${ext} file nahi chalegi. Ye bhejo: ${FILE_RULES[kind].join(", ")}`, `.${ext} files aren't accepted. Use: ${FILE_RULES[kind].join(", ")}`);
  if (kind !== "stl" && file.size > CONFIG.forms.maxMb[kind] * 1048576) return T(`File ${CONFIG.forms.maxMb[kind]} MB se badi hai.`, `File is bigger than ${CONFIG.forms.maxMb[kind]} MB.`);
  if (!(await looksGenuine(file, ext))) return T("Ye file khul nahi rahi ya asli nahi lag rahi. Doosri try karo.", "This file looks damaged or isn't really that type. Try another one.");
  return "";
}

// Big phone photos are shrunk before sending (faster upload, less Drive space)
async function shrinkPhoto(file) {
  if (!/\.(jpe?g|png|webp)$/i.test(file.name) || file.size < 1.2 * 1048576 || !window.createImageBitmap) return file;
  try {
    const img = await createImageBitmap(file), k = Math.min(1, 2000 / Math.max(img.width, img.height));
    const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.85));
    return blob && blob.size < file.size ? new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" }) : file;
  } catch (e) { return file; }
}

const toBase64 = (file) => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(String(r.result).split(",")[1] || "");
  r.onerror = () => rej(r.error);
  r.readAsDataURL(file);
});

/* ---------- Sending, in the background ---------- */
let sending = 0;
addEventListener("beforeunload", (e) => { if (sending) { e.preventDefault(); e.returnValue = ""; } });

const OUTBOX = "mmp-outbox";
const outbox = {
  read() { try { return JSON.parse(localStorage.getItem(OUTBOX) || "[]"); } catch (e) { return []; } },
  write(list) { try { list.length ? localStorage.setItem(OUTBOX, JSON.stringify(list.slice(-5))) : localStorage.removeItem(OUTBOX); } catch (e) {} },
};

async function postEntry(payload) {
  const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), 120000);
  try {
    // text/plain keeps it a "simple" request, so Google Apps Script answers without a CORS preflight
    const r = await fetch(CONFIG.forms.endpoint, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload), signal: ctrl.signal });
    return await r.json();
  } finally { clearTimeout(t); }
}

/**
 * Save a form entry. Shows a card that tracks the upload, so people can keep browsing.
 *   form:   "quote" | "contact" | "careers"
 *   fields: plain values for the sheet
 *   files:  [File]
 *   wa:     WhatsApp message used as a fallback (and offered after sending)
 *   done:   wording for the success card
 */
async function sendEntry({ form, fields, files = [], wa, label, done, website = "", chat = true, doneTitle = null, track = false }) {
  if (!formsOn()) { window.open(waLink(wa), "_blank", "noopener"); return { whatsapp: true }; }
  const bytes = files.reduce((n, f) => n + f.size, 0);
  const size = bytes < 1048576 ? Math.max(1, Math.round(bytes / 1024)) + " KB" : (bytes / 1048576).toFixed(1) + " MB";
  const card = toast({ icon: "📤", title: label, text: files.length ? T(`File bhej rahe hain (${size})… aap browse karte raho.`, `Uploading ${size}… feel free to keep browsing.`) : T("Bhej rahe hain…", "Sending…"), progress: 0.04 });
  // the upload can't report real progress here, so we ease towards 95% based on size (~0.4 MB/s on mobile data)
  const expect = Math.max(1500, bytes / 420), t0 = Date.now();
  const tick = setInterval(() => card.update({ progress: 0.95 * (1 - Math.exp(-(Date.now() - t0) / expect * 2.2)) }), 200);
  sending++;
  const payload = { form, fields, website, elapsed: Date.now() - PAGE_START, source: location.hostname || "local file", base: location.href.split(/[?#]/)[0].replace(/[^/]*$/, ""), lang: LANG, files: [] };
  try {
    for (const f of files) payload.files.push({ name: f.name, data: await toBase64(f) });
    const res = await postEntry(payload);
    clearInterval(tick);
    if (res && res.ok) {
      const ref = res.ref || "";
      card.update({ kind: "ok", icon: "✅", title: doneTitle ? doneTitle(ref, res) : T("Pahunch gaya! 🎉", "Got it! 🎉") + (ref ? ` · ${ref}` : ""), text: done(ref, res), progress: false, timeout: 14000,
        actions: [...(track && ref ? [{ label: T("Order track karo", "Track this order"), href: "track.html?ref=" + encodeURIComponent(ref), newTab: false }] : []), ...(chat ? [{ label: T("WhatsApp pe bhi bolo", "Also message us on WhatsApp"), href: waLink(wa + (ref ? `\n\nRef: ${ref}` : "")) }] : []), { label: T("Theek hai", "Done"), primary: true }] });
      window.mmpGuide?.cheer?.();
      return { ok: true, ref, res };
    }
    card.update({ kind: "error", icon: "⚠️", title: T("Nahi gaya", "Not sent"), text: (res && res.message) || T("Kuch gadbad hui.", "Something went wrong."), progress: false,
      actions: [{ label: T("WhatsApp pe bhejo", "Send on WhatsApp"), href: waLink(wa), primary: true }] });
    return { ok: false, res };
  } catch (err) {
    clearInterval(tick);
    if (!files.length) outbox.write([...outbox.read(), payload]);   // text-only: we'll retry by ourselves next time
    card.update({ kind: "error", icon: "📶", title: T("Network gaya", "Connection dropped"), progress: false,
      text: files.length ? T("Upload poora nahi hua. Dobara try karo ya WhatsApp pe file bhejo.", "The upload didn't finish. Try again or send the file on WhatsApp.")
        : T("Hum agli baar khud bhej denge. Ya abhi WhatsApp pe bhejo.", "We'll send it automatically next time you visit. Or send it on WhatsApp now."),
      actions: [{ label: T("Phir se try", "Try again"), onClick: () => sendEntry({ form, fields, files, wa, label, done, website, chat, doneTitle }) }, { label: "WhatsApp", href: waLink(wa), primary: true }] });
    return { ok: false, err };
  } finally { sending--; }
}

// Anything that failed earlier without files is quietly sent again
async function flushOutbox() {
  if (!formsOn()) return;
  const list = outbox.read();
  if (!list.length) return;
  const left = [];
  for (const p of list) { try { const r = await postEntry(p); if (!r || !r.ok) left.push(p); } catch (e) { left.push(p); } }
  outbox.write(left);
  if (left.length < list.length) toast({ kind: "ok", icon: "✅", title: T("Purana message bhej diya", "Earlier message sent"), text: T("Jo pichhli baar nahi gaya tha, ab pahunch gaya.", "The message that didn't go through last time has now reached us."), timeout: 8000 });
}

// Shared bits for every form: a hidden field bots fill in, and phone checking
const honeypot = (form) => $('input[name="website"]', form)?.value || "";
const phoneOk = (v) => { const d = String(v).replace(/\D/g, ""); return /^(91)?[6-9]\d{9}$/.test(d) || (/^\d{11,15}$/.test(d) && !/^91/.test(d)); };
function setHint(el, text, bad) { if (!el) return; el.textContent = text; el.classList.toggle("is-bad", !!bad); }
function busy(btn, on, text) {
  if (!btn) return;
  if (on) { btn.dataset.label = btn.textContent; btn.textContent = text; btn.disabled = true; }
  else { btn.textContent = btn.dataset.label || btn.textContent; btn.disabled = false; }
}


function initQuote() {
  const drop = $("#drop"), file = $("#stlFile"), info = $("#fileInfo");
  if (!drop || !file) return;
  const grams = $("#manualGrams"), material = $("#material"), qty = $("#qty");
  const infill = $("#infill"), infillVal = $("#infillVal");
  const out = {
    price: $("#price"), note: $("#priceNote"), weight: $("#statWeight"),
    time: $("#statTime"), size: $("#statSize"), vol: $("#statVol"), wa: $("#quoteWa"),
  };
  out.wa.target = "_blank"; out.wa.rel = "noopener";
  let model = null; // parsed STL
  let fileName = "";
  let stlFile = null;   // the real file, uploaded only when they press Send
  let quoteMsg = "", quoteFields = {};
  const cheer = $("#cheer");
  const quoteSec = $("#quote");
  let scrollAfter = false;   // jump to the quote after a file is picked from elsewhere on the page
  const showQuote = () => {
    const r = quoteSec.getBoundingClientRect();
    if (r.top > innerHeight * 0.4 || r.bottom < 200) $("#quoteForm").scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const color = () => $('input[name="color"]:checked').value;

  function calc() {
    infillVal.textContent = infill.value + "%";
    $("#colorVal").textContent = color();
    const mat = CONFIG.materials[material.value];
    const q = Math.max(1, parseInt(qty.value, 10) || 1);
    let weight = 0;

    if (model) {
      // Walls and top/bottom are solid; the inside follows infill %.
      const fill = 0.25 + 0.75 * (infill.value / 100);
      weight = model.volumeCm3 * mat.density * fill;
      out.size.textContent = model.size.map((d) => d.toFixed(0)).join(" × ") + " mm";
      out.vol.textContent = model.volumeCm3.toFixed(1) + " cm³";
    } else {
      weight = parseFloat(grams.value) || 0;
      out.size.textContent = "—";
      out.vol.textContent = "—";
    }

    if (weight <= 0) {
      out.price.textContent = "₹ —";
      out.note.textContent = "Upload a file or enter a weight to see your estimate.";
      out.weight.textContent = out.time.textContent = "—";
      out.wa.href = waLink("Quote request 🧾|Hi! I'd like a 3D print. I'll share the details here.");
      quoteMsg = waFormat("Quote request 🧾", [["Material", material.value], ["Colour", color()], ["Quantity", q]]);
      quoteFields = { material: material.value, infill: infill.value + "%", colour: color(), quantity: q, weight: "", size: "", estimate: "", file: fileName };
      cheer?.classList.remove("show");
      return;
    }

    const each = weight * mat.rate;
    const total = Math.max(CONFIG.minOrder, each * q);
    const low = Math.max(CONFIG.minOrder, total * 0.9), high = Math.max(CONFIG.minOrder, total * 1.15);
    const hours = (weight * q) / CONFIG.gramsPerHour;

    out.price.textContent = each * q <= CONFIG.minOrder ? inr(CONFIG.minOrder) : `${inr(low)} – ${inr(high)}`;
    let note = `${q} × ${material.value}, ${infill.value}% infill`;
    if (each * q < CONFIG.minOrder) note += ` · minimum order ${inr(CONFIG.minOrder)}`;
    if (model && Math.max(...model.size) > CONFIG.maxSizeMm)
      note += " · larger than our print area, we'll print it in parts";
    out.note.textContent = note;
    out.weight.textContent = `${weight.toFixed(0)} g${q > 1 ? " each" : ""}`;
    out.time.textContent = hours < 1 ? `~${Math.max(10, Math.round(hours * 60))} min` : `~${hours.toFixed(1)} hrs`;

    const msg = waFormat("Quote request 🧾", [
      ["File", fileName || null],
      ["Approx weight", fileName ? null : `${weight.toFixed(0)} g`],
      ["Size", model ? out.size.textContent : null],
      ["Material", material.value],
      ["Infill", `${infill.value}%`],
      ["Colour", color()],
      ["Quantity", q],
      ["Website estimate", out.price.textContent],
    ], fileName ? "📎 I'll attach the STL file in this chat." : null);
    quoteMsg = msg;
    quoteFields = { material: material.value, infill: infill.value + "%", colour: color(), quantity: q, weight: `${weight.toFixed(0)} g${q > 1 ? " each" : ""}`,
      size: model ? out.size.textContent : "", estimate: out.price.textContent, file: fileName };
    out.wa.href = waLink(msg);
    out.wa.target = "_blank";
    out.wa.rel = "noopener";
    out.wa.classList.remove("is-disabled");
    if (cheer && !cheer.classList.contains("show")) { cheer.classList.add("show"); }
  }

  async function loadFile(f) {
    if (!f) return;
    if (!/\.stl$/i.test(f.name)) { showFileMsg("Please choose an .stl file", true); return; }
    const mb = f.size / 1048576;
    if (mb > CONFIG.maxFileMb) { showFileMsg(`File is over ${CONFIG.maxFileMb} MB. Send it on WhatsApp instead.`, true); return; }
    showFileMsg(mb > 50 ? `Reading ${f.name} (${Math.round(mb)} MB)… ${T("Badi file hai, thoda time lagega ☕", "Big file, this may take a moment ☕")}` : "Reading " + f.name + "…");
    await new Promise((r) => setTimeout(r, 40));   // let the message show before the heavy work
    try {
      model = parseSTL(await f.arrayBuffer());
      fileName = f.name; stlFile = f;
      grams.value = "";
      drop.classList.add("has-file");
      showFileMsg(`✓ ${f.name} · ${model.triangles.toLocaleString("en-IN")} triangles`);
    } catch (e) {
      model = null; fileName = ""; stlFile = null;
      drop.classList.remove("has-file");
      showFileMsg("Couldn't read this STL. Send it on WhatsApp and we'll check it.", true);
    }
    calc();
    if (scrollAfter) { scrollAfter = false; showQuote(); }
  }

  function showFileMsg(text, isError = false) {
    info.hidden = false;
    info.textContent = text;
    info.style.color = isError ? "#c73f0c" : "";
  }

  drop.addEventListener("click", (e) => { if (e.target.tagName !== "LABEL") file.click(); });
  file.addEventListener("change", () => loadFile(file.files[0]));
  ["dragenter", "dragover"].forEach((ev) =>
    drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("is-over"); }));
  ["dragleave", "drop"].forEach((ev) =>
    drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("is-over"); }));

  // Hero button opens the file picker straight away
  $("#heroUpload")?.addEventListener("click", () => { scrollAfter = true; file.click(); });

  // Drop an STL anywhere on the page
  const overlay = $("#dropAll");
  let depth = 0;
  const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes("Files");
  addEventListener("dragenter", (e) => { if (!hasFiles(e)) return; depth++; overlay.classList.add("show"); });
  addEventListener("dragleave", () => { depth = Math.max(0, depth - 1); if (!depth) overlay.classList.remove("show"); });
  addEventListener("dragover", (e) => { if (hasFiles(e)) e.preventDefault(); });
  addEventListener("drop", (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault(); depth = 0; overlay.classList.remove("show");
    scrollAfter = !drop.contains(e.target);
    loadFile(e.dataTransfer.files[0]);
  });

  // Sample model so people can try the calculator without a file
  $("#sampleBtn")?.addEventListener("click", () => {
    model = { volumeCm3: 160, size: [80, 64, 92], triangles: 2316 };
    fileName = "sample-phone-stand.stl"; stlFile = null;
    grams.value = ""; file.value = "";
    drop.classList.add("has-file");
    showFileMsg("✓ sample-phone-stand.stl (sample) · 80 × 64 × 92 mm");
    calc();
  });

  grams.addEventListener("input", () => {
    if (grams.value) { // typing a weight replaces the file
      model = null; fileName = ""; stlFile = null; file.value = "";
      drop.classList.remove("has-file"); info.hidden = true;
    }
    calc();
  });
  [material, qty, infill].forEach((el) => el.addEventListener("input", calc));
  $$('input[name="color"]').forEach((el) => el.addEventListener("change", calc));
  $("#quoteForm").addEventListener("submit", (e) => e.preventDefault());
  calc();

  /* ---- Send request: saved to our sheet, STL + photo uploaded in the background ---- */
  const order = $("#orderForm");
  if (!order) return;
  const oName = $("#oName"), oPhone = $("#oPhone"), oPhoto = $("#oPhoto"), oPhotoName = $("#oPhotoName"), oHint = $("#orderHint"), oSend = $("#orderSend");
  if (!formsOn()) { oSend.textContent = T("WhatsApp pe bhejo", "Send on WhatsApp"); }
  oPhoto.addEventListener("change", async () => {
    const f = oPhoto.files[0], err = await checkFile(f, "photo");
    if (err) { oPhoto.value = ""; setHint(oPhotoName, err, true); oPhotoName.classList.remove("on"); return; }
    setHint(oPhotoName, f ? `📎 ${f.name}` : "Broken part, idea or reference · up to 8 MB");
    oPhotoName.classList.toggle("on", !!f);
  });
  order.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = oName.value.trim(), phone = oPhone.value.trim(), notes = $("#oNotes").value.trim(), photo = oPhoto.files[0];
    if (name.length < 2) { setHint(oHint, T("Apna naam likho 🙂", "Please add your name 🙂"), true); oName.focus(); return; }
    if (!phoneOk(phone)) { setHint(oHint, T("10 digit ka mobile number daalo.", "Please add a valid 10-digit mobile number."), true); oPhone.focus(); return; }
    if (!fileName && !parseFloat(grams.value) && !photo && !notes) { setHint(oHint, T("Pehle file, weight ya photo daalo.", "Add a file, a weight or a photo first."), true); return; }
    setHint(oHint, "");
    const files = [];
    let note = notes;
    if (stlFile) {
      const err = await checkFile(stlFile, "stl");
      if (err) { setHint(oHint, err, true); return; }
      if (stlFile.size <= CONFIG.forms.maxMb.stl * 1048576) files.push(stlFile);
      else note = `[STL ${fileName} is ${Math.round(stlFile.size / 1048576)} MB, too big to upload; will share on WhatsApp/Drive]\n` + note;
    }
    if (photo) files.push(await shrinkPhoto(photo));
    const big = stlFile && !files.includes(stlFile);
    busy(oSend, true, T("Bhej rahe hain…", "Sending…"));
    const res = await sendEntry({
      form: "quote", website: honeypot(order), label: T("Quote request", "Quote request"),
      fields: { name, phone, ...quoteFields, notes: note },
      files,
      wa: waFormat("Quote request 🧾", [["Name", name], ...quoteMsg.split("\n").slice(2).filter((l) => /^\*/.test(l)).map((l) => [null, l]), ["Notes", notes || null]]),
      track: true,
      done: () => big ? T("File badi hai, WhatsApp ya Drive link se bhej do. Baaki details mil gayi!", "Your file is too big to upload, so please send it on WhatsApp or as a Drive link. We've got the rest!")
        : T("Hum file check karke WhatsApp pe final price bhejenge, aam taur pe kuch ghanton mein.", "We'll check your file and WhatsApp you the final price, usually within a few hours."),
    });
    busy(oSend, false);
    if (res.ok) setHint(oHint, T("Bhej diya ✓ Kuch aur bhejna ho to dobara bhej sakte ho.", "Sent ✓ You can send another one any time."));
  });
}

/* ---------- Floating "Instant price" pill: shows once the first screen is passed, hides near the calculator ---------- */
function initPriceFloat() {
  const pill = $("#priceFloat");
  if (!pill) return;
  const top = $("#play") || $(".hero") || $("main > section"), quoteSec = $("#quote");
  const toggle = () => {
    const past = top ? top.getBoundingClientRect().bottom < 0 : scrollY > 400;
    let nearQuote = false;
    if (quoteSec) { const q = quoteSec.getBoundingClientRect(); nearQuote = q.top < innerHeight && q.bottom > 0; }
    const foot = $(".footer"), atFooter = foot ? foot.getBoundingClientRect().top < innerHeight - 40 : false;   // don't cover the footer
    pill.classList.toggle("show", past && !nearQuote && !atFooter);
  };
  addEventListener("scroll", toggle, { passive: true }); toggle();
}

/* ---------- Contact form: saved to our sheet (or WhatsApp if forms aren't set up) ---------- */
function initContact() {
  const form = $("#contactForm");
  const hint = $("#contactHint");
  if (!form) return;
  const btn = $('button[type="submit"]', form);
  if (formsOn()) { btn.textContent = T("Message bhejo 📤", "Send message 📤"); setHint(hint, T("Hum WhatsApp pe jawab denge, aam taur pe kuch ghanton mein.", "We'll reply on WhatsApp, usually within a few hours.")); }
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = $("#cName").value.trim();
    const phone = $("#cPhone").value.trim();
    if (name.length < 2) { setHint(hint, T("Apna naam likho 🙂", "Please add your name 🙂"), true); $("#cName").focus(); return; }
    if (!phoneOk(phone)) { setHint(hint, T("10 digit ka mobile number daalo.", "Please add a valid 10-digit mobile number."), true); $("#cPhone").focus(); return; }
    const fields = { name, phone, service: $("#cService").value, message: $("#cMsg").value.trim() };
    const wa = waFormat("New enquiry 👋", [["Name", name], ["Phone", phone], ["Service", fields.service], ["Details", fields.message || null]]);
    busy(btn, true, T("Bhej rahe hain…", "Sending…"));
    const res = await sendEntry({ form: "contact", fields, wa, website: honeypot(form), label: T("Message", "Message"),
      done: () => T("Hum WhatsApp pe jaldi reply karenge 🙌", "We'll reply on WhatsApp soon 🙌") });
    busy(btn, false);
    if (res.whatsapp) setHint(hint, hasRealNumber() ? "WhatsApp opened. Just press send." : "WhatsApp number not set yet.");
    else if (res.ok) { setHint(hint, T("Bhej diya ✓", "Sent ✓")); $("#cMsg").value = ""; }
  });
}

/* ---------- Careers: "Apply" picks the role; the application (and resume) is saved to our sheet and Drive ---------- */
function initCareers() {
  const form = $("#jobForm");
  if (!form) return;
  const role = $("#jRole"), hint = $("#jobHint"), file = $("#jResume"), fileName = $("#jResumeName"), btn = $('button[type="submit"]', form);
  const pickText = () => formsOn() ? T("Resume chuno: PDF, Word ya photo · 5 MB tak", "Choose your resume: PDF, Word or image · up to 5 MB") : "Choose your resume (PDF). You'll attach it in WhatsApp next.";
  if (formsOn()) {
    btn.textContent = T("Application bhejo 📤", "Send application 📤");
    setHint(hint, T("Resume ke saath seedha humare paas aayega.", "Comes straight to us, resume included."));
    fileName.textContent = pickText();
  }
  $$(".job__apply").forEach((b) => b.addEventListener("click", () => {
    role.value = b.dataset.role;
    $("#apply").scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => $("#jName").focus({ preventScroll: true }), 600);
  }));
  file.addEventListener("change", async () => {
    const f = file.files[0];
    const err = formsOn() ? await checkFile(f, "resume") : "";
    if (err) { file.value = ""; setHint(fileName, err, true); fileName.classList.remove("on"); return; }
    setHint(fileName, f ? (formsOn() ? `📎 ${f.name}` : `📎 ${f.name}: attach this in WhatsApp after it opens`) : pickText());
    fileName.classList.toggle("on", !!f);
  });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = $("#jName").value.trim(), phone = $("#jPhone").value.trim(), email = $("#jEmail").value.trim();
    if (name.length < 2) { setHint(hint, T("Apna naam likho 🙂", "Please add your name 🙂"), true); $("#jName").focus(); return; }
    if (!phoneOk(phone)) { setHint(hint, T("10 digit ka mobile number daalo.", "Please add a valid 10-digit mobile number."), true); $("#jPhone").focus(); return; }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { setHint(hint, T("Email sahi nahi lag raha.", "That email doesn't look right."), true); $("#jEmail").focus(); return; }
    const f = file.files[0];
    const fields = { role: role.value, name, phone, email, city: $("#jCity").value.trim(), portfolio: $("#jLink").value.trim(), why: $("#jWhy").value.trim() };
    const wa = waFormat("Job application 💼", [
      ["Role", fields.role], ["Name", name], ["Phone", phone], ["Email", email || null], ["City", fields.city || null],
      ["Portfolio", fields.portfolio || null], ["Why me", fields.why || null],
    ], f ? `📎 Attaching my resume (${f.name}) in this chat.` : "📎 I'll attach my resume in this chat.");
    busy(btn, true, T("Bhej rahe hain…", "Sending…"));
    const res = await sendEntry({ form: "careers", fields, files: f ? [f] : [], wa, website: honeypot(form), label: T("Job application", "Job application"),
      done: () => T("Shukriya! Role khulte hi hum aapko contact karenge 🙌", "Thank you! We'll get in touch as soon as the role opens 🙌") });
    busy(btn, false);
    if (res.whatsapp) setHint(hint, "WhatsApp opened. Attach your resume there and press send. 🙌");
    else if (res.ok) setHint(hint, T("Application mil gayi ✓", "Application received ✓"));
  });
}

/* =========================================================
   Gallery: reels, behind the scenes, prints and vlogs (data in js/media-data.js)
   ========================================================= */
const MEDIA_TYPES = {
  reel:  { icon: "🎞️", hi: "Reel", en: "Reel", short: "Reel", bg: "linear-gradient(160deg,#FF8A4C,#FF5A1F 55%,#C73F0C)" },
  bts:   { icon: "🎥", hi: "Behind the scenes", en: "Behind the scenes", short: "BTS", bg: "linear-gradient(160deg,#3A3A38,#141414)" },
  print: { icon: "📸", hi: "Print", en: "Print", short: "Print", bg: "linear-gradient(160deg,#FFE58A,#F2B705)" },
  vlog:  { icon: "📹", hi: "Vlog", en: "Vlog", short: "Vlog", bg: "linear-gradient(160deg,#8C6CF0,#5B2FC9)" },
};
const mediaSlug = (m) => (m.titleEn || m.title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
const mediaTitle = (m) => (LANG === "en" ? m.titleEn || m.title : m.title);
const mediaCaption = (m) => (LANG === "en" ? m.captionEn || m.caption : m.caption) || "";
const mediaDate = (m) => { try { return new Date(m.date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); } catch (e) { return m.date; } };
const playable = (m) => !m.soon && (m.instagram || m.youtube || m.video || m.image);
const escHtml = (v) => String(v == null ? "" : v).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function mediaThumb(m, cls = "mcard__media") {
  const t = MEDIA_TYPES[m.type] || MEDIA_TYPES.reel;
  let inner = `<span class="mthumb__emoji" aria-hidden="true">${m.emoji || t.icon}</span>`;
  if (m.poster) inner = `<img src="${escHtml(m.poster)}" alt="" loading="lazy">`;
  else if (m.image) inner = `<img src="${escHtml(m.image)}" alt="" loading="lazy">`;
  else if (m.video) inner = `<video src="${escHtml(m.video)}" muted loop playsinline preload="metadata" aria-hidden="true"></video>`;
  return `<span class="${cls}" style="--bg:${t.bg}">${inner}</span>`;
}

function initGallery() {
  const grid = $("#mediaGrid");
  const vlogList = $("#vlogList");
  const list = (window.MEDIA || []).slice().sort((a, b) => (a.soon === b.soon ? String(b.date).localeCompare(String(a.date)) : a.soon ? 1 : -1));
  if (!grid && !vlogList) return;
  let filter = "all", shown = [];
  const box = $("#mediaBox"), stage = $("#mboxStage");
  let at = 0;

  function card(m, i) {
    const t = MEDIA_TYPES[m.type] || MEDIA_TYPES.reel, video = m.type !== "print";
    return `<button type="button" class="mcard mcard--${m.type}${m.soon ? " is-soon" : ""}" data-i="${i}" id="m-${mediaSlug(m)}">
      ${mediaThumb(m)}
      <span class="mcard__badge">${t.icon} <span class="mcard__lbl">${T(t.hi, t.en)}</span><span class="mcard__lbl--s">${t.short}</span></span>
      ${m.duration ? `<span class="mcard__dur mono">${escHtml(m.duration)}</span>` : ""}
      ${video && !m.soon ? `<span class="mcard__play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></span>` : ""}
      ${m.soon ? `<span class="mcard__soon hand">${T("Jaldi aa raha hai", "Coming soon")}</span>` : ""}
      <span class="mcard__text"><span class="mcard__title">${escHtml(mediaTitle(m))}</span><span class="mcard__date mono">${m.soon ? T("Aa raha hai", "Coming") + " " : ""}${mediaDate(m)}</span></span>
    </button>`;
  }

  function render() {
    if (grid) {
      shown = list.filter((m) => filter === "all" || m.type === filter);
      grid.innerHTML = shown.length ? shown.map(card).join("")
        : `<p class="mgrid__empty">${T("Yahan abhi kuch nahi hai. Jaldi aayega! 🎬", "Nothing here yet. Coming soon! 🎬")}</p>`;
      $$("#mediaFilter .mfilter__btn").forEach((b) => {
        const n = b.dataset.filter === "all" ? list.length : list.filter((m) => m.type === b.dataset.filter).length;
        $("b", b).textContent = n;
      });
      // videos without a poster play quietly while on screen
      $$("video", grid).forEach((v) => io?.observe(v));
    }
    if (vlogList) {
      const vlogs = list.filter((m) => m.type === "vlog");
      vlogList.innerHTML = vlogs.map((m) => `<article class="vlog${m.soon ? " is-soon" : ""}">
        ${mediaThumb(m, "vlog__thumb")}
        <div class="vlog__body">
          <p class="vlog__meta mono">${m.soon ? T("Aa raha hai", "Coming") + " · " : ""}${mediaDate(m)}${m.duration ? " · " + escHtml(m.duration) : ""}</p>
          <h3 class="vlog__title">${escHtml(mediaTitle(m))}</h3>
          <p class="vlog__cap">${escHtml(mediaCaption(m))}</p>
          ${m.soon ? `<a href="#newsletter" class="btn btn--ghost btn--sm">🔔 ${T("Aane pe batao", "Notify me")}</a>`
            : `<button type="button" class="btn btn--ink btn--sm" data-vlog="${list.indexOf(m)}">▶ ${T("Dekho", "Watch")}</button>`}
        </div>
      </article>`).join("") || `<p class="mgrid__empty">${T("Pehla episode jaldi! 🎬", "First episode coming soon! 🎬")}</p>`;
    }
  }

  const io = "IntersectionObserver" in window && !matchMedia("(prefers-reduced-motion: reduce)").matches
    ? new IntersectionObserver((es) => es.forEach((e) => (e.isIntersecting ? e.target.play().catch(() => {}) : e.target.pause())), { threshold: 0.4 }) : null;

  $$("#mediaFilter .mfilter__btn").forEach((b) => b.addEventListener("click", () => {
    filter = b.dataset.filter;
    $$("#mediaFilter .mfilter__btn").forEach((x) => { x.classList.toggle("is-on", x === b); x.setAttribute("aria-pressed", x === b); });
    render();
  }));

  /* ---- the viewer ---- */
  function open(i, from = shown) {
    if (!box) return;
    shown = from; at = (i + shown.length) % shown.length;
    const m = shown[at], t = MEDIA_TYPES[m.type] || MEDIA_TYPES.reel;
    let html = "";
    if (m.soon || !playable(m)) {
      html = `<div class="mbox__placeholder" style="--bg:${t.bg}"><span aria-hidden="true">${m.emoji || t.icon}</span>
        <p>${m.soon ? T("Ye episode jaldi aa raha hai 🎬", "This episode is coming soon 🎬") : T("Ye video jaldi yahan aayega 🎬", "This video is coming here soon 🎬")}</p></div>`;
    } else if (m.instagram) {
      const url = m.instagram.split("?")[0].replace(/\/?$/, "/");
      html = `<iframe class="mbox__frame mbox__frame--ig" src="${escHtml(url)}embed/" title="${escHtml(mediaTitle(m))}" loading="lazy" allowfullscreen></iframe>`;
    } else if (m.youtube) {
      html = `<iframe class="mbox__frame mbox__frame--yt" src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(m.youtube)}?autoplay=1&rel=0" title="${escHtml(mediaTitle(m))}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
    } else if (m.video) {
      html = `<video class="mbox__video" src="${escHtml(m.video)}" ${m.poster ? `poster="${escHtml(m.poster)}"` : ""} controls autoplay playsinline loop></video>`;
    } else if (m.image) {
      html = `<img class="mbox__img" src="${escHtml(m.image)}" alt="${escHtml(mediaTitle(m))}">`;
    }
    stage.innerHTML = html;
    stage.className = "mbox__stage mbox__stage--" + (m.type === "vlog" || m.youtube ? "wide" : m.type === "print" ? "photo" : "tall");
    const v = $("video", stage);
    v?.addEventListener("loadedmetadata", () => { if (v.videoWidth > v.videoHeight * 1.1) stage.className = "mbox__stage mbox__stage--wide"; });
    $("#mboxMeta").textContent = `${t.icon} ${T(t.hi, t.en)} · ${mediaDate(m)}${m.duration ? " · " + m.duration : ""}`;
    $("#mboxTitle").textContent = mediaTitle(m);
    $("#mboxCaption").textContent = mediaCaption(m);
    const acts = [];
    if (m.instagram) acts.push(`<a class="btn btn--ink btn--sm" href="${escHtml(m.instagram)}" target="_blank" rel="noopener">${T("Instagram pe kholo", "Open on Instagram")}</a>`);
    if (m.youtube) acts.push(`<a class="btn btn--ink btn--sm" href="https://youtu.be/${encodeURIComponent(m.youtube)}" target="_blank" rel="noopener">${T("YouTube pe dekho", "Watch on YouTube")}</a>`);
    if (m.soon) acts.push(`<a class="btn btn--accent btn--sm" href="#newsletter" data-close>🔔 ${T("Aane pe batao", "Notify me")}</a>`);
    else if (!playable(m)) acts.push(`<a class="btn btn--ink btn--sm" href="https://instagram.com/makemeproto" target="_blank" rel="noopener">${T("Instagram pe follow karo", "Follow on Instagram")}</a>`);
    acts.push(`<button type="button" class="btn btn--ghost btn--sm" data-share>${T("Link share karo", "Share link")}</button>`);
    $("#mboxActions").innerHTML = acts.join("");
    $$(".mbox__nav", box).forEach((n) => (n.hidden = shown.length < 2));
    if (!box.open) box.showModal();
    history.replaceState(null, "", "#m-" + mediaSlug(m));
  }
  function close() { if (box?.open) box.close(); }
  box?.addEventListener("close", () => { stage.innerHTML = ""; if (/^#m-/.test(location.hash)) history.replaceState(null, "", location.pathname + location.search); });
  box?.addEventListener("click", (e) => {
    if (e.target === box || e.target.closest("[data-close]")) { close(); return; }
    const step = e.target.closest("[data-step]");
    if (step) open(at + Number(step.dataset.step), shown);
    if (e.target.closest("[data-share]")) {
      const url = location.href.split("#")[0] + "#m-" + mediaSlug(shown[at]);
      if (navigator.share) navigator.share({ title: mediaTitle(shown[at]), url }).catch(() => {});
      else navigator.clipboard?.writeText(url).then(() => toast({ kind: "ok", icon: "🔗", title: T("Link copy ho gaya", "Link copied"), timeout: 3000 }));
    }
  });
  box?.addEventListener("keydown", (e) => { if (e.key === "ArrowRight") open(at + 1, shown); if (e.key === "ArrowLeft") open(at - 1, shown); });
  let sx = null;
  box?.addEventListener("touchstart", (e) => { sx = e.touches[0].clientX; }, { passive: true });
  box?.addEventListener("touchend", (e) => { if (sx == null) return; const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 60) open(at + (dx < 0 ? 1 : -1), shown); sx = null; });

  grid?.addEventListener("click", (e) => { const c = e.target.closest(".mcard"); if (c) open(Number(c.dataset.i), shown); });
  vlogList?.addEventListener("click", (e) => {
    const b = e.target.closest("[data-vlog]"); if (!b) return;
    const vlogs = list.filter((m) => m.type === "vlog");
    open(vlogs.indexOf(list[Number(b.dataset.vlog)]), vlogs);
  });

  render();
  addEventListener("mmp:lang", render);
  // a shared link like media.html#m-our-logo-comes-to-life opens that item
  const hit = location.hash.startsWith("#m-") ? list.findIndex((m) => "#m-" + mediaSlug(m) === location.hash) : -1;
  if (hit > -1) setTimeout(() => open(hit, list), 300);
}

/* =========================================================
   The Proto Post: newsletter sign-up (any form with data-newsletter) and one-click unsubscribe
   ========================================================= */
function initNewsletter() {
  $$("form[data-newsletter]").forEach((form) => {
    const email = $('input[name="email"]', form), hint = $("[data-hint]", form), btn = $('button[type="submit"]', form);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const v = email.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) { setHint(hint, T("Email sahi nahi lag raha.", "That email doesn't look right."), true); email.focus(); return; }
      const fields = { email: v, name: $('input[name="name"]', form)?.value.trim() || "", topics: $$('input[name="topics"]:checked', form).map((c) => c.value).join(", "), language: LANG === "en" ? "English" : "Hinglish" };
      busy(btn, true, T("Ruko…", "One sec…"));
      const res = await sendEntry({ form: "newsletter", fields, website: honeypot(form), label: "The Proto Post", chat: false,
        doneTitle: (ref, r) => r && r.already ? T("Aap pehle se andar ho 💌", "You're already in 💌") : T("Aap andar ho! 💌", "You're in! 💌"),
        wa: waFormat("Newsletter 💌", [["Email", v], ["Name", fields.name || null]], "Please add me to The Proto Post."),
        done: (ref, r) => r && r.already ? T("Aap pehle se subscribed ho 💌 Agla email jaldi!", "You're already subscribed 💌 The next issue is on its way!")
          : T("Welcome! Inbox check karo, ek welcome email bheja hai (spam mein bhi dekh lena).", "Welcome aboard! We've sent you a welcome email (check spam just in case).") });
      busy(btn, false);
      if (res.ok) { setHint(hint, T("Subscribed ✓", "Subscribed ✓")); form.reset(); }
    });
  });

  // media.html?unsubscribe=KEY (from the link in our emails)
  const key = new URLSearchParams(location.search).get("unsubscribe");
  const box = $("#unsubscribe");
  if (!key || !box) return;
  box.hidden = false;
  const yes = $("#unsubYes"), msg = $("#unsubMsg");
  yes.addEventListener("click", async () => {
    busy(yes, true, T("Ruko…", "One sec…"));
    try {
      const r = await postEntry({ form: "unsubscribe", fields: { key }, elapsed: Date.now() - PAGE_START, source: location.hostname || "local file" });
      if (r && r.ok) {
        $(".unsub__actions", box).hidden = true;
        $("h2", box).textContent = T("Unsubscribe ho gaya 💔", "You're unsubscribed 💔");
        msg.textContent = T("Ab koi newsletter email nahi aayega. Jab mann ho, wapas aa jaana!", "You won't get any more newsletter emails. Come back any time!");
        history.replaceState(null, "", location.pathname);
        setTimeout(() => (box.hidden = true), 5000);
      } else { msg.textContent = (r && r.message) || T("Kuch gadbad hui. Humein email karo.", "Something went wrong. Please email us."); busy(yes, false); }
    } catch (e) { msg.textContent = T("Network nahi mila. Dobara try karo.", "No connection. Please try again."); busy(yes, false); }
  });
}

/* =========================================================
   Track order: reference + phone → live status from our sheet (Quotes tab)
   ========================================================= */
const TRACK_STEPS = [
  { icon: "🧾", hi: "Mil gaya", en: "Received" },
  { icon: "✅", hi: "Confirm", en: "Confirmed" },
  { icon: "🖨️", hi: "Print ho raha", en: "Printing" },
  { icon: "📦", hi: "Ready", en: "Ready" },
  { icon: "🚚", hi: "Raste mein", en: "Shipped" },
  { icon: "🎉", hi: "Pahunch gaya", en: "Delivered" },
];
function trackHeadline(r) {
  const n = r.firstName ? r.firstName + ", " : "";
  if (r.state === "cancelled") return T(`${n}ye order cancel ho gaya hai`, `${n}this order was cancelled`);
  if (r.state === "hold") return T(`${n}aapka order abhi hold pe hai ⏸️`, `${n}your order is on hold ⏸️`);
  if (r.state === "quoted") return T(`${n}aapka quote ready hai 💬`, `${n}your quote is ready 💬`);
  return [
    T(`${n}aapki request humein mil gayi 🧾`, `${n}we've got your request 🧾`),
    T(`${n}aapka order confirm hai ✅`, `${n}your order is confirmed ✅`),
    T(`${n}aapka order print ho raha hai 🖨️`, `${n}your order is on the printer 🖨️`),
    T(`${n}aapka order ready hai 📦`, `${n}your order is ready 📦`),
    T(`${n}aapka order raste mein hai 🚚`, `${n}your order is on its way 🚚`),
    T(`${n}order pahunch gaya! 🎉`, `${n}your order was delivered! 🎉`),
  ][Math.max(0, Math.min(5, r.stage))];
}
function trackNext(r) {
  if (r.state === "cancelled") return T("Koi sawaal ho toh WhatsApp pe poochho.", "If you have any questions, message us on WhatsApp.");
  if (r.state === "hold") return T("Hum aapse WhatsApp pe baat karke aage badhenge.", "We'll message you on WhatsApp to sort out the next step.");
  if (r.state === "quoted") return T("WhatsApp pe price confirm karo aur advance bhejo, phir printing shuru.", "Confirm the price on WhatsApp and pay the advance, and we'll start printing.");
  return [
    T("Hum aapki file check karke WhatsApp pe final price bhejenge.", "We're checking your file and will WhatsApp you the final price."),
    T("Aapka order print queue mein hai. Jaldi printer pe hoga.", "Your order is in the print queue and will be on the printer soon."),
    T("Print ke baad hum isse check karke pack karenge.", "Once it's printed, we'll check it and pack it."),
    T("Courier ya pickup ke liye taiyaar. Hum details bhejenge.", "It's ready for the courier or pickup. We'll send you the details."),
    T("Tracking number se courier ki website pe dekh sakte ho.", "Use the tracking number on the courier's website to follow it."),
    T("Kaisa laga? Ek photo bhejo, humein bahut pasand aata hai!", "How did it turn out? Send us a photo, we love seeing them!"),
  ][Math.max(0, Math.min(5, r.stage))];
}

function initTrack() {
  const form = $("#trackForm");
  if (!form) return;
  const ref = $("#tRef"), phone = $("#tPhone"), hint = $("#trackHint"), btn = $("#trackBtn"), out = $("#trackResult");
  let last = null;
  const q = new URLSearchParams(location.search).get("ref");
  if (q) { ref.value = q.toUpperCase().slice(0, 12); setTimeout(() => phone.focus({ preventScroll: true }), 300); }
  ref.addEventListener("input", () => { const p = ref.selectionStart; ref.value = ref.value.toUpperCase().replace(/\s/g, ""); ref.setSelectionRange(p, p); });

  function render(r) {
    const stopped = r.state === "cancelled" || r.state === "hold";
    const at = stopped ? -1 : r.stage;
    const steps = TRACK_STEPS.map((st, i) => `<li class="tstep${i < at || (i === at && r.stage === 5) ? " is-done" : ""}${i === at && r.stage !== 5 ? " is-now" : ""}">
        <span class="tstep__dot" aria-hidden="true">${i < at || r.stage === 5 ? "✓" : st.icon}</span><span class="tstep__label">${T(st.hi, st.en)}</span></li>`).join("");
    const item = [r.item.quantity && r.item.quantity + " ×", r.item.material, r.item.colour && r.item.colour !== "Not sure" ? r.item.colour : "", r.item.infill && r.item.infill + " infill"].filter(Boolean).join(" · ");
    const rows = [
      [T("Request mili", "Received"), r.received],
      [T("Kab tak", "Expected by"), r.expected],
      [T("Order", "Item"), item],
      [T("Size", "Size"), r.item.size],
      [T("Website estimate", "Website estimate"), r.estimate],
      [T("Courier", "Courier"), r.courier],
      [T("Tracking number", "Tracking number"), r.tracking],
    ].filter(([, v]) => v);
    const pct = stopped ? 0 : Math.round((Math.max(0, r.stage) / 5) * 100);
    out.innerHTML = `<div class="trackres__card${stopped ? " is-stopped" : ""}${r.stage === 5 ? " is-done" : ""}">
      <div class="trackres__head">
        <div>
          <p class="trackres__ref mono">${T("Order", "Order")} ${escHtml(r.ref)} · ${T("Status", "Status")}: <b>${escHtml(r.status)}</b></p>
          <h2 class="trackres__title">${escHtml(trackHeadline(r))}</h2>
          <p class="trackres__next">${escHtml(trackNext(r))}</p>
        </div>
        <button type="button" class="btn btn--ghost btn--sm" data-refresh>↻ ${T("Refresh", "Refresh")}</button>
      </div>
      ${stopped ? `<p class="trackres__banner">${r.state === "hold" ? "⏸️" : "✖️"} ${escHtml(r.status)}</p>`
        : `<div class="tsteps-bar" style="--frac:${(pct / 100).toFixed(2)}"><ol class="tstepper" aria-label="${T("Order ki progress", "Order progress")}">${steps}</ol></div>`}
      ${r.update ? `<div class="trackres__update"><span aria-hidden="true">💬</span><div><b>${T("Humari taraf se update", "Update from us")}</b><p>${escHtml(r.update)}</p></div></div>` : ""}
      ${rows.length ? `<dl class="trackres__info">${rows.map(([k, v]) => `<div><dt class="mono">${escHtml(k)}</dt><dd>${escHtml(v)}</dd></div>`).join("")}</dl>` : ""}
      <div class="trackres__actions">
        <a class="btn btn--ink" href="${waLink(waFormat("Order status 🔍", [["Reference", r.ref], ["Status shown", r.status]], "Hi! I have a question about my order."))}" target="_blank" rel="noopener">💬 ${T("Is order ke baare mein WhatsApp karo", "Ask about this order on WhatsApp")}</a>
        <button type="button" class="btn btn--ghost" data-another>${T("Doosra order track karo", "Track another order")}</button>
      </div>
    </div>`;
    out.hidden = false;
    requestAnimationFrame(() => out.querySelector(".trackres__card")?.classList.add("show"));
    if (r.stage === 5 && !stopped) window.mmpGuide?.cheer?.();
  }

  async function lookup(scroll = true) {
    const r0 = ref.value.trim().toUpperCase(), p0 = phone.value.trim();
    if (!/^[QCJN]-\d{4}-[A-Z0-9]{3}$/.test(r0)) { setHint(hint, T("Reference aisa dikhta hai: Q-2411-ABC", "The reference looks like Q-2411-ABC."), true); ref.focus(); return; }
    if (!phoneOk(p0)) { setHint(hint, T("Order wala 10 digit mobile number daalo.", "Please add the 10-digit mobile number you used for the order."), true); phone.focus(); return; }
    if (!formsOn()) { window.open(waLink(waFormat("Order status 🔍", [["Reference", r0], ["Phone", p0]])), "_blank", "noopener"); return; }
    setHint(hint, "");
    busy(btn, true, T("Dhoondh rahe hain…", "Looking it up…"));
    try {
      const r = await postEntry({ form: "track", fields: { ref: r0, phone: p0 }, website: honeypot(form), source: location.hostname || "local file" });
      if (r && r.ok) {
        last = r; render(r);
        if (scroll) out.scrollIntoView({ behavior: "smooth", block: "start" });
        history.replaceState(null, "", location.pathname + "?ref=" + encodeURIComponent(r.ref));
      } else {
        out.hidden = true;
        setHint(hint, (r && r.message) || T("Ye order nahi mila.", "We couldn't find that order."), true);
      }
    } catch (e) {
      setHint(hint, T("Network nahi mila. Dobara try karo.", "No connection. Please try again."), true);
    } finally { busy(btn, false); }
  }

  form.addEventListener("submit", (e) => { e.preventDefault(); lookup(); });
  out.addEventListener("click", (e) => {
    if (e.target.closest("[data-refresh]")) lookup(false);
    if (e.target.closest("[data-another]")) { out.hidden = true; ref.value = ""; ref.focus(); form.scrollIntoView({ behavior: "smooth", block: "center" }); history.replaceState(null, "", location.pathname); }
  });
  addEventListener("mmp:lang", () => { if (last && !out.hidden) render(last); });
}

/* ---------- Colour theme switcher ---------- */
function initThemer() {
  const root = document.documentElement;
  const box = $("#themer");
  const set = (name, announce) => {
    if (name === "filament") root.removeAttribute("data-theme"); else root.setAttribute("data-theme", name);
    $$("[data-theme-set]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.themeSet === name)));
    if (announce) window.dispatchEvent(new Event("mmp:theme"));
  };
  let saved = null;
  if (CONFIG.showThemeSwitcher) { try { saved = localStorage.getItem("mmp-theme"); } catch (e) {} }
  set(saved || CONFIG.theme, false);
  if (!box) return;
  if (!CONFIG.showThemeSwitcher) { box.remove(); return; }
  const toggle = $("#themerToggle");
  toggle.addEventListener("click", () => {
    const open = box.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(open));
  });
  $$("[data-theme-set]").forEach((b) => b.addEventListener("click", () => {
    set(b.dataset.themeSet, true);
    try { localStorage.setItem("mmp-theme", b.dataset.themeSet); } catch (e) {}
  }));
}

/* ---------- Page "prints" as you scroll ---------- */
function initProgress() {
  const bar = $("#progress");
  if (!bar) return;
  const update = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.setProperty("--p", max > 0 ? (scrollY / max).toFixed(4) : 0);
  };
  addEventListener("scroll", update, { passive: true });
  addEventListener("resize", update);
  update();
}

/* ---------- Hero doodles drift with the mouse ---------- */
function initDoodles() {
  // every screen with doodles (and the home collage) drifts with the mouse
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  $$(".doodles").forEach((wrap) => {
    const sec = wrap.parentElement;
    sec.addEventListener("pointermove", (e) => {
      if (e.pointerType === "touch") return;
      const r = sec.getBoundingClientRect();
      sec.style.setProperty("--mx", ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
      sec.style.setProperty("--my", ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
    });
    sec.addEventListener("pointerleave", () => { sec.style.setProperty("--mx", 0); sec.style.setProperty("--my", 0); });
  });
  // phones: a gentle drift from tilting / scrolling instead of the mouse
  if (matchMedia("(hover: none)").matches) {
    addEventListener("scroll", () => {
      $$(".doodles").forEach((wrap) => {
        const sec = wrap.parentElement, r = sec.getBoundingClientRect();
        if (r.bottom < 0 || r.top > innerHeight) return;
        sec.style.setProperty("--my", (-(r.top / innerHeight)).toFixed(3));
      });
    }, { passive: true });
  }
}

/* ---------- "Kiske liye?" tabs ---------- */
function initUses() {
  const tabs = $$(".uses__tab");
  if (!tabs.length) return;
  const box = $(".uses"), dots = $$(".uses__dots i");
  let idx = 0, auto = 0, touched = false;
  const select = (tab, focus) => {
    idx = tabs.indexOf(tab);
    tabs.forEach((t, i) => {
      const on = t === tab;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
      $("#" + t.getAttribute("aria-controls")).hidden = !on;
      dots[i]?.classList.toggle("on", on);
    });
    if (focus) tab.focus();
    box.classList.remove("tick"); void box.offsetWidth; if (!touched) box.classList.add("tick");
  };
  const next = (d = 1) => select(tabs[(idx + d + tabs.length) % tabs.length]);
  const stop = () => { touched = true; clearInterval(auto); box.classList.remove("tick"); box.classList.add("touched"); };
  tabs.forEach((t, i) => {
    t.addEventListener("click", () => { stop(); select(t); });
    t.addEventListener("keydown", (e) => {
      const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!d) return;
      stop(); select(tabs[(i + d + tabs.length) % tabs.length], true);
    });
  });
  $("#usesNext")?.addEventListener("click", () => { stop(); next(); });
  dots.forEach((d, i) => d.addEventListener("click", () => { stop(); select(tabs[i]); }));
  // swipe left/right on the panel (phones)
  let sx = null;
  box.addEventListener("pointerdown", (e) => { if (e.pointerType === "touch") sx = e.clientX; });
  box.addEventListener("pointerup", (e) => {
    if (sx == null) return;
    const dx = e.clientX - sx; sx = null;
    if (Math.abs(dx) > 50 && !e.target.closest(".uses__tabs")) { stop(); next(dx < 0 ? 1 : -1); }
  });
  // gently show every option once, until the visitor picks one
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  select(tabs[0]);
  if (!reduce && "IntersectionObserver" in window) {
    new IntersectionObserver((en) => {
      clearInterval(auto);
      if (en[0].isIntersecting && !touched) { box.classList.add("tick"); auto = setInterval(() => (touched ? clearInterval(auto) : next()), 3600); }
    }, { threshold: 0.4 }).observe(box);
  }
}

/* ---------- "Kitne ka padega?" examples: same formula as the calculator ---------- */
function initExamples() {
  $$(".ex__price").forEach((el) => {
    const g = +el.dataset.grams, mat = CONFIG.materials[el.dataset.mat], q = +el.dataset.qty || 1;
    const total = g * mat.rate * q;
    el.textContent = total <= CONFIG.minOrder ? inr(CONFIG.minOrder)
      : `${inr(Math.max(CONFIG.minOrder, total * 0.9))}–${inr(total * 1.15)}`;
  });
  $$(".ex__try").forEach((b) => b.addEventListener("click", () => {
    const grams = $("#manualGrams"), material = $("#material");
    material.value = b.dataset.mat;
    grams.value = b.dataset.grams;
    grams.dispatchEvent(new Event("input"));
    $("#quoteForm").scrollIntoView({ behavior: "smooth", block: "start" });
  }));
}

/* ---------- Before / after slider ---------- */
function initCompare() {
  const box = $("#compare");
  if (!box) return;
  const range = $(".compare__range", box);
  const set = (v) => { box.style.setProperty("--pos", v + "%"); box.classList.add("touched"); };
  range.addEventListener("input", () => set(range.value));
  // gentle hint animation once it comes into view
  if ("IntersectionObserver" in window && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const io = new IntersectionObserver((en) => {
      if (!en[0].isIntersecting) return;
      io.disconnect();
      let t0 = null;
      const step = (now) => {
        if (box.classList.contains("touched")) return;
        t0 ??= now;
        const p = (now - t0) / 1800;
        if (p >= 1) { box.style.setProperty("--pos", "50%"); return; }
        box.style.setProperty("--pos", (50 + Math.sin(p * Math.PI * 2) * 22).toFixed(1) + "%");
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }, { threshold: 0.6 });
    io.observe(box);
  }
}

/* ---------- 3D Adda: community help ---------- */
function initAdda() {
  const btns = $$(".fix__btn");
  const out = $("#fixOut");
  if (btns.length && out) {
    const show = (b) => {
      btns.forEach((o) => o.setAttribute("aria-pressed", String(o === b)));
      const tpl = $("#" + b.dataset.fix);
      out.innerHTML = tpl.innerHTML;
      out.classList.remove("pop"); void out.offsetWidth; out.classList.add("pop");
    };
    btns.forEach((b) => b.addEventListener("click", () => show(b)));
    show(btns[0]);
  }
  // Join button: invite link if you have one, otherwise a WhatsApp message
  const join = $("#addaJoin");
  if (join && CONFIG.community) { join.href = CONFIG.community; join.target = "_blank"; join.rel = "noopener"; join.removeAttribute("data-wa"); }
  // Ask form → WhatsApp
  const form = $("#addaForm");
  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    const topic = $("#addaTopic").value, q = $("#addaQ").value.trim();
    if (!q) { $("#addaQ").focus(); return; }
    const msg = waFormat("3D Adda question 🙋", [["Topic", topic], ["Question", q]]);
    window.open(waLink(msg), "_blank", "noopener");
  });
}

/* ---------- "Do dost": flip the polaroids and the sticky notes ---------- */
function initMakers() {
  $$(".maker").forEach((m) => {
    const flip = () => m.classList.toggle("is-flipped");
    m.addEventListener("click", (e) => { if (!e.target.closest("a")) flip(); });
    m.addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && e.target === m) { e.preventDefault(); flip(); } });
  });
  $$(".note__btn").forEach((b) => b.addEventListener("click", () => b.parentElement.classList.toggle("is-flipped")));
}

/* ---------- Floating WhatsApp button: hide it while the hero's WhatsApp button is on screen ---------- */
function initWaFloat() {
  const fl = $(".wa-float"), heroWa = $(".hero__cta [data-wa]");
  if (!fl || !heroWa || !("IntersectionObserver" in window)) return;
  new IntersectionObserver((en) => fl.classList.toggle("is-hidden", en[0].isIntersecting)).observe(heroWa);
}

/* ---------- Proto the guide: dances in the corner, explains each section, shows how the printer works ---------- */
function initGuide() {
  const g = $("#guide");
  if (!g) return;
  const text = $("#guideText"), cta = $("#guideCta"), bubble = $("#guideBubble");
  const P = () => window.mmpPrinter;
  const scrollToPrinter = () => P()?.el.scrollIntoView({ behavior: "smooth", block: "center" });
  // what Proto says in each section: [Hinglish, English, optional button]
  const TIPS = {
    hero: () => P()?.played()
      ? ["Mast! 🎉 Ab apna naam print karke dekho ✍️", "Nice! 🎉 Now print your own name ✍️", { hi: "✍️ Apna naam", en: "✍️ My name", run: () => { scrollToPrinter(); P()?.printName(); } }]
      : (matchMedia("(hover: none)").matches
        ? ["Psst! 👋 Main Proto. Printer pe tap karo, ya ye dabao 👇", "Psst! 👋 I'm Proto. Tap the printer, or tap here 👇"]
        : ["Psst! 👋 Main Proto. Printer pe mouse upar-neeche karo, ya ye dabao 👇", "Psst! 👋 I'm Proto. Move your mouse over the printer, or tap here 👇"]).concat([ { hi: "▶ Print karke dikhao", en: "▶ Show me a print", run: () => { scrollToPrinter(); setTimeout(() => P()?.print(), 400); } }]),
    services: ["Kuch bhi banwana ho, yahan se shuru karo 🛠️", "Whatever you need made, start here 🛠️"],
    make: ["Jo aap pe fit baithe, wahi chuno 👆", "Tap the one that sounds like you 👆"],
    intro: ["Neeche ek printer hai, khud chalake dekho 👇", "There's a printer just below, try it yourself 👇", { hi: "🖨️ Printer dikhao", en: "🖨️ Show me", run: () => $("#play")?.scrollIntoView({ behavior: "smooth" }) }],
    hello: ["WhatsApp sabse fast hai, try karo 💬", "WhatsApp is fastest, give it a try 💬"],
    "page-pricing": ["STL hai? Neeche daalo, price turant ⚡", "Got an STL? Drop it below for an instant price ⚡", { hi: "📂 STL chuno", en: "📂 Choose STL", run: () => $("#stlFile")?.click() }],
    "page-services": ["Apna kaam chuno, baaki hum sambhal lenge 🛠️", "Pick what you need, we'll handle the rest 🛠️"],
    "page-guide": ["Pehli baar print kar rahe ho? Yahan se shuru karo 📒", "First print? Start here 📒"],
    "page-community": ["Printer hai? Adda join karo, free help 🧡", "Got a printer? Join the Adda, free help 🧡"],
    "page-about": ["Hum dono se milo 👋 Polaroid pe tap karo", "Meet us both 👋 Tap a polaroid"],
    "page-careers": ["Pasand ka role chuno, apply karo 💼", "Pick a role and apply 💼"],
    "page-track": ["Reference aur number daalo, main dhoondhta hoon 🔍", "Enter your reference and number, I'll find it 🔍"],
    "page-404": ["Main bhi dhoond raha hoon 🔍 Neeche wale links try karo!", "I'm looking for it too 🔍 Try the links below!"],
    "page-media": ["Koi bhi reel tap karo, yahin chalegi 🎬", "Tap any reel to play it right here 🎬"],
    "page-terms": ["Simple bhasha mein likha hai, padh lo 📜", "Written in plain words, have a read 📜"],
    "page-privacy": ["Aapka data safe hai, kabhi bechte nahi 🔒", "Your data is safe, we never sell it 🔒"],
    "page-contact": ["Form bharo, WhatsApp khul jaayega 💬", "Fill the form and WhatsApp opens 💬"],
    uses: ["Apna type chuno: student, startup, ghar… 👆", "Pick who you are: student, startup, home… 👆"],
    process: ["Sirf 4 steps. Main bhi aise hi bana tha 😎", "Just 4 steps. That's how I was made too 😎"],
    quote: ["STL hai? Daalo, price turant milega ⚡", "Got an STL? Drop it in for an instant price ⚡", { hi: "📂 STL chuno", en: "📂 Choose STL", run: () => $("#stlFile")?.click() }],
    prices: ["Ek keychain bhi sirf ₹300 😉", "Even one keychain is just ₹300 😉"],
    materials: ["Confused? PLA le lo, sabse easy 👍", "Not sure? Go with PLA, it's the easiest 👍"],
    fixer: ["Slider ko drag karo ← → 🔧", "Drag the slider ← → 🔧"],
    work: ["Real photos jaldi aa rahe hain 📸", "Real photos coming soon 📸"],
    makers: ["Polaroid pe tap karo, palat jaayega 🔄", "Tap a polaroid to flip it 🔄"],
    tips: ["Deepak ki diary padho, bahut kaam ki hai 📒", "Read Deepak's diary, it's gold 📒"],
    adda: ["Print fail? Problem chuno, fix dekho 🩺", "Print failed? Pick the problem, see the fix 🩺"],
    reviews: ["Pehla review aapka ho sakta hai ⭐", "The first review could be yours ⭐"],
    faq: ["Sawaal hai? Bindaas pucho 🙋", "Got questions? Ask away 🙋"],
  };
  const pageKey = $("#play") ? "intro" : $(".hero") ? "hero" : "page-" + (document.body.dataset.page || "");
  let shownKey = "", current = pageKey, quiet = false, hideT = 0, lastSaid = 0, dwellT = 0;
  const seen = new Set();
  // reading time: ~0.4 s a word + a calm buffer, between 6 and 15 seconds
  const readMs = (str, hasBtn) => Math.min(15000, Math.max(6000, str.split(/\s+/).length * 420 + 3500 + (hasBtn ? 3000 : 0)));
  function hide() { bubble.classList.remove("show"); window.mmpGuide?.rest(); }
  function say(key, force) {
    const tip = typeof TIPS[key] === "function" ? TIPS[key]() : TIPS[key];
    if (!tip || (quiet && !force)) return;
    const msg = T(tip[0], tip[1]);
    text.textContent = msg;
    const btn = tip[2];
    cta.hidden = !btn;
    if (btn) { cta.textContent = T(btn.hi, btn.en); cta.onclick = () => { btn.run(); hide(); }; }
    window.mmpGuide?.wake();                       // come out of the corner…
    window.mmpGuide?.findSpot();                   // …and stand somewhere empty
    bubble.classList.remove("show"); void bubble.offsetWidth; bubble.classList.add("show");
    window.fitGuideBubble?.();
    g.classList.remove("hop"); void g.offsetWidth; g.classList.add("hop");
    seen.add(key); lastSaid = Date.now(); shownKey = key;
    clearTimeout(hideT);
    hideT = setTimeout(hide, readMs(msg, !!btn));
  }
  // don't keep the bubble open while the hand is busy with it
  bubble.addEventListener("pointerenter", () => clearTimeout(hideT));
  bubble.addEventListener("pointerleave", () => { clearTimeout(hideT); hideT = setTimeout(hide, 3500); });
  $("#guideBot").addEventListener("click", () => { quiet = false; say(current, true); });
  $("#guideX").addEventListener("click", () => { quiet = true; hide(); });
  window.addEventListener("mmp:lang", () => { if (bubble.classList.contains("show")) say(current, true); });
  window.addEventListener("mmp:print", () => { g.classList.add("cheer"); hide(); window.mmpGuide?.wake(); });
  window.addEventListener("mmp:done", (e) => {
    g.classList.remove("cheer");
    if (current !== "hero") return;
    if (e.detail.model === "name") return;            // the name-ideas card takes over
    say("hero", true);
  });
  // which section is in the middle of the screen?
  const map = [[".intro", "intro"], ["#play", "hero"], ["#make", "make"], ["#ourwork", "work"], ["#hello", "hello"], ["#services", "services"], ["#uses", "uses"], ["#process", "process"], ["#quote", "quote"],
    ["#prices", "prices"], ["#materials", "materials"], ["#fixer", "fixer"], ["#work", "work"], ["#makers", "makers"],
    ["#tips", "tips"], ["#adda", "adda"], ["#reviews", "reviews"], ["#faq", "faq"], ["#contact", "contact"]];
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        const key = en.target.dataset.guide;
        if (key === current) return;
        current = key;
        if (shownKey === "intro" && key !== "intro" && bubble.classList.contains("show")) hide();   // that tip was about getting here
        g.classList.toggle("away", key === "contact");   // Proto goes "home" to the contact form
        clearTimeout(dwellT);
        if (key === "contact" || seen.has(key)) return;  // each tip once; tap Proto to hear it again
        // wait until the visitor actually stops on the section, and leave a gap after the last tip
        const wait = Math.max(1800, 5000 - (Date.now() - lastSaid));
        dwellT = setTimeout(() => { if (current === key && !bubble.classList.contains("show")) say(key); }, wait);
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    map.forEach(([sel, key]) => { const el = $(sel); if (el) { el.dataset.guide = key; io.observe(el); } });
  }
  // first tip: on laptops right away; on phones only once the printer is actually on screen
  const frameEl = $(".printer__frame");
  const firstTip = () => setTimeout(() => { if (!seen.has(pageKey) && current === pageKey) say(pageKey); }, 2500);
  if (document.body.classList.contains("is-being-born")) addEventListener("mmp:born", () => { if (pageKey !== "hero") firstTip(); }, { once: true });
  else if (pageKey !== "hero") firstTip();
  else if (innerWidth > 860 || !frameEl || !("IntersectionObserver" in window)) setTimeout(() => say("hero"), 3000);
  else {
    const po = new IntersectionObserver((en) => {
      if (!en[0].isIntersecting) return;
      po.disconnect();
      setTimeout(() => { if (current === "hero" && !seen.has("hero")) say("hero"); }, 1200);
    }, { threshold: 0.6 });
    po.observe(frameEl);
  }
}

/* ---------- Proto's personality: greets, leans, winks, sleeps, gets tickled, can be dragged ---------- */
function initGuideFun() {
  const g = $("#guide"), bot = $("#guideBot"), hi = $("#guideHi");
  if (!g || !bot) return;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  let hiT = 0;
  const pop = (hiText, enText, ms = 1600) => {
    if ($("#guideBubble")?.classList.contains("show") && !g.classList.contains("dragging")) return;   // never talk over the tip bubble
    hi.textContent = T(hiText, enText);
    window.fitGuideBubble?.();
    hi.classList.remove("show"); void hi.offsetWidth; hi.classList.add("show");
    clearTimeout(hiT); hiT = setTimeout(() => hi.classList.remove("show"), ms);
  };
  const act = (cls, ms) => { g.classList.remove(cls); void g.offsetWidth; g.classList.add(cls); setTimeout(() => g.classList.remove(cls), ms); };

  /* hello on hover */
  const GREET = [["Namaste! 🙏", "Hello! 👋"], ["Arre, hello! 👋", "Hey there! 😄"], ["Kaise ho? 😄", "How's it going? 😄"], ["Hi hi! ✨", "Hi friend! ✨"]];
  bot.addEventListener("pointerenter", (e) => {
    if (e.pointerType === "touch" || g.classList.contains("sleep")) return;
    g.classList.add("greet");
    const [a, b] = pick(GREET); pop(a, b);
  });
  bot.addEventListener("pointerleave", () => g.classList.remove("greet"));

  /* lean toward the cursor, like he's curious */
  addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch") return;
    const r = bot.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    g.style.setProperty("--lean", Math.max(-14, Math.min(14, dx / 35)).toFixed(1) + "deg");
    g.classList.toggle("near", Math.hypot(dx, dy) < 170);
  }, { passive: true });

  /* tickle: three quick taps */
  let taps = [];
  bot.addEventListener("click", () => {
    const now = Date.now();
    taps = taps.filter((t) => now - t < 1200); taps.push(now);
    if (taps.length >= 3) { taps = []; act("tickle", 1100); pop("Hehe, gudgudi! 😆", "Hehe, that tickles! 😆", 1800); }
  });

  /* fall asleep when you go quiet, wake up startled */
  let idleT = 0;
  const wake = () => {
    if (g.classList.contains("sleep")) { g.classList.remove("sleep"); act("startle", 700); pop("Oh! Main so nahi raha tha 😳", "Oh! I wasn't sleeping 😳", 2000); }
    clearTimeout(idleT); idleT = setTimeout(() => { g.classList.remove("greet"); g.classList.add("sleep"); }, 25000);
  };
  ["pointermove", "keydown", "scroll", "touchstart"].forEach((ev) => addEventListener(ev, wake, { passive: true }));
  wake();

  /* wobble when you scroll really fast */
  let lastY = scrollY, lastT = performance.now(), wobT = 0;
  addEventListener("scroll", () => {
    const now = performance.now(), v = Math.abs(scrollY - lastY) / Math.max(1, now - lastT);
    lastY = scrollY; lastT = now;
    if (v > 4 && now - wobT > 2500 && !g.classList.contains("away")) { wobT = now; act("wobble", 900); pop("Woah, dheere! 🌀", "Whoa, slow down! 🌀", 1400); }
  }, { passive: true });

  /* little habits every few seconds: wink, look around, stretch, jump, spin */
  if (!reduce) {
    const HABITS = [["wink", 700], ["look", 1600], ["stretch", 900], ["jump", 700], ["spin", 900]];
    const habit = () => {
      if (!g.classList.contains("sleep") && !g.classList.contains("greet") && !g.classList.contains("dragging") && !document.hidden) {
        const [c, ms] = pick(HABITS); act(c, ms);
      }
      setTimeout(habit, 6000 + Math.random() * 6000);
    };
    setTimeout(habit, 5000);
  }

  /* smart placement: when he talks, stand where the bubble covers the least real content */
  let pinned = false, tuckT = 0;
  const IMPORTANT = ".job,.legal__toc,.faq__chips,.path,.play__title,.homecta__btns,.fixer__steps,.makeit,.snap,.chatmock,.intro__tag,h1,h2,h3,.hero__lead,.hero__nofile,.hero__chips,.section__head p,.section__sub,.eyebrow,.btn,.hero__cta,input,select,textarea,.printer__frame,.shelf,.spools,.printer__readout,.card,.ex,.mat,.uses__panel,.uses__tabs,.quote__result,.drop,.compare,.notebook,.maker,.note,.fix,.tile,summary,.step,.nameideas,.nametag,.review__card,.adda__card,.contact__form";
  function overlap(a, b) { const w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top); return w > 0 && h > 0 ? w * h : 0; }
  function findSpot() {
    if (pinned || g.classList.contains("dragging") || g.classList.contains("away")) return;
    const els = $$(IMPORTANT).map((e) => e.getBoundingClientRect()).filter((r) => r.bottom > 0 && r.top < innerHeight && r.width > 0);
    const bw = W(), bh = H(), bubW = Math.min(270, innerWidth - bw - 50), bubH = Math.max(110, bub.offsetHeight || 120);
    const cur = g.getBoundingClientRect();
    let best = null;
    const STACK_W = Math.min(240, innerWidth - 28);
    for (const right of [true, false]) {
      for (let y = 80; y <= innerHeight - bh - 20; y += 30) {
        const x = right ? innerWidth - bw - 14 : 14;
        const botR = { left: x, right: x + bw, top: y, bottom: y + bh };
        const layouts = [];
        // bubble beside him
        if (y <= innerHeight - bh - 110) {
          const drop = y < 260, by = drop ? y + 6 : y + bh - 26 - bubH, bx = right ? x - 12 - bubW : x + bw + 12;
          layouts.push({ mode: "beside", r: { left: bx, right: bx + bubW, top: by, bottom: by + bubH } });
        }
        // bubble stacked above or below him, along the screen edge
        const sx = right ? innerWidth - 14 - STACK_W : 14;
        if (y - 10 - bubH > 76) layouts.push({ mode: "above", r: { left: sx, right: sx + STACK_W, top: y - 10 - bubH, bottom: y - 10 } });
        if (y + bh + 10 + bubH < innerHeight - 8) layouts.push({ mode: "below", r: { left: sx, right: sx + STACK_W, top: y + bh + 10, bottom: y + bh + 10 + bubH } });
        for (const L of layouts) {
          let score = 0;
          for (const r of els) score += overlap(L.r, r) + overlap(botR, r) * 2;
          score += Math.abs(y - cur.top) * 3 + (right !== g.classList.contains("right") ? 1200 : 0) + (L.mode === "beside" ? 0 : 400);
          if (!best || score < best.score) best = { score, x, y, right, mode: L.mode };
        }
      }
    }
    if (!best) return;
    g.classList.add("snapping", "moved");
    g.style.right = "auto"; g.style.bottom = "auto";
    g.classList.toggle("right", best.right);
    g.classList.toggle("stack-above", best.mode === "above");
    g.classList.toggle("stack-below", best.mode === "below");
    requestAnimationFrame(() => { g.style.left = best.x + "px"; g.style.top = best.y + "px"; });
    setTimeout(() => { g.classList.remove("snapping"); fit(); }, 520);
  }
  /* when he isn't talking, he tucks half-way into the screen edge so he's out of your way */
  function rest() { clearTimeout(tuckT); tuckT = setTimeout(() => { if (!bub.classList.contains("show") && !g.matches(":hover") && !g.classList.contains("dragging")) g.classList.add("tucked"); }, 3500); }
  function wakeUp() { clearTimeout(tuckT); g.classList.remove("tucked"); }
  window.mmpGuide = { findSpot, rest, wake: wakeUp };
  bot.addEventListener("pointerenter", wakeUp);
  bot.addEventListener("pointerleave", rest);
  bot.addEventListener("focus", wakeUp);
  rest();

  /* keep both speech bubbles fully on screen, whichever side he's on */
  const bub = $("#guideBubble");
  function fit() {
    const r = bot.getBoundingClientRect(), right = g.classList.contains("right");
    const room = right ? r.left - 22 : innerWidth - r.right - 22;          // space beside him
    const stacked = g.classList.contains("stack-above") || g.classList.contains("stack-below");
    bub.style.maxWidth = (stacked ? Math.min(240, innerWidth - 28) : Math.max(150, Math.min(270, room))) + "px";
    g.classList.toggle("g-drop", r.top < 260);                                // near the top: bubble opens downward
    hi.classList.toggle("under", r.top < 60);
    const cx = r.left + r.width / 2, half = hi.offsetWidth / 2;          // unscaled size, so it's exact
    let shift = 0;
    if (cx - half < 6) shift = 6 - (cx - half);
    if (cx + half > innerWidth - 6) shift = innerWidth - 6 - (cx + half);
    hi.style.setProperty("--hx", shift + "px");
  }
  window.fitGuideBubble = fit;
  addEventListener("resize", () => { if (g.classList.contains("moved")) snap(false); fit(); });

  /* drag him anywhere; he glides to the nearest side */
  let drag = null, justDragged = false;
  const W = () => bot.offsetWidth, H = () => bot.offsetHeight;
  function snap(animate = true) {
    const r = g.getBoundingClientRect();
    const right = r.left + W() / 2 > innerWidth / 2;
    const left = right ? innerWidth - W() - 14 : 14;
    const top = Math.max(80, Math.min(innerHeight - H() - 110, r.top));   // clear of the nav and the WhatsApp button
    g.classList.toggle("right", right);
    if (animate) g.classList.add("snapping");
    requestAnimationFrame(() => { g.style.left = left + "px"; g.style.top = top + "px"; });
    setTimeout(() => { g.classList.remove("snapping"); fit(); }, 520);
  }
  bot.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    const r = g.getBoundingClientRect();
    drag = { x: e.clientX, y: e.clientY, ox: e.clientX - r.left, oy: e.clientY - r.top, moved: false, id: e.pointerId };
  });
  addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 8) return;
    if (!drag.moved) {
      drag.moved = true;
      const r = g.getBoundingClientRect();
      g.classList.add("dragging", "moved"); g.classList.remove("snapping");
      g.style.left = r.left + "px"; g.style.top = r.top + "px"; g.style.bottom = "auto"; g.style.right = "auto";
      bub.classList.remove("show");
      pop("Weee! 🎢", "Weee! 🎢", 4000);
      try { bot.setPointerCapture(e.pointerId); } catch (_) {}
    }
    g.style.left = Math.max(4, Math.min(innerWidth - W() - 4, e.clientX - drag.ox)) + "px";
    g.style.top = Math.max(64, Math.min(innerHeight - H() - 8, e.clientY - drag.oy)) + "px";
    fit();
  });
  addEventListener("pointerup", (e) => {
    if (!drag) return;
    const moved = drag.moved; drag = null;
    if (!moved) return;
    justDragged = true; setTimeout(() => (justDragged = false), 50);
    g.classList.remove("dragging");
    pinned = true;                                   // the visitor chose this place; respect it
    g.classList.remove("stack-above", "stack-below");
    snap(true); rest();
    act("land", 600); pop("Nayi jagah, mast! 😎", "Nice spot! 😎");
  });
  fit();
  bot.addEventListener("click", (e) => { if (justDragged) { e.stopImmediatePropagation(); e.preventDefault(); } }, true);
}

/* ---------- Proto the cube: eyes follow you, says hi ---------- */
function initProto() {
  const proto = $("#proto");
  if (!proto) return;
  const pupils = $$(".proto__pupil");
  const bubble = $("#protoBubble");
  const linesHi = ["Hi! Main Proto hoon 👋", "Kya banwana hai? 🤔", "Form bharo na, please! 🙏", "Main bhi 3D printed hoon 😎", "Deepak & Bal Krishan se baat karo!"];
  const linesEn = ["Hi! I'm Proto 👋", "What do you want made? 🤔", "Fill in the form, please! 🙏", "I'm 3D printed too 😎", "Talk to Deepak & Bal Krishan!"];
  let k = 0;
  addEventListener("pointermove", (e) => {
    pupils.forEach((p) => {
      const r = p.parentNode.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      const d = Math.hypot(dx, dy) || 1, m = Math.min(4.5, d / 40);
      p.setAttribute("transform", `translate(${(dx / d * m).toFixed(1)} ${(dy / d * m).toFixed(1)})`);
    });
  }, { passive: true });
  const say = () => {
    const lines = LANG === "en" ? linesEn : linesHi;
    k = (k + 1) % lines.length;
    bubble.textContent = lines[k];
    proto.classList.remove("is-bouncing"); void proto.offsetWidth; proto.classList.add("is-bouncing");
  };
  proto.addEventListener("click", say);
  $$("#contactForm input, #contactForm select, #contactForm textarea").forEach((el) =>
    el.addEventListener("focus", () => { proto.classList.add("is-peek"); }));
  if ("IntersectionObserver" in window) {
    new IntersectionObserver((en) => en.forEach((x) => proto.classList.toggle("is-up", x.isIntersecting)),
      { threshold: 0.4 }).observe($("#contactForm"));
  } else proto.classList.add("is-up");
}

/* ---------- Home: glide between screen 1 (intro) and screen 2 (printer) on laptops ----------
   Scroll down from the intro → glides to the printer. Scroll up at the printer → glides back to the top.
   Everywhere else the page scrolls normally. Phones and small screens are never touched. */
function initScreens() {
  const play = $("#play"), intro = $(".intro");
  if (!play || !intro) return;
  const fits = matchMedia("(min-width: 861px) and (min-height: 640px) and (pointer: fine)");
  const navH = () => $(".nav")?.offsetHeight || 72;
  const playTop = () => Math.round(play.getBoundingClientRect().top + scrollY - navH());
  let busy = false;
  const glide = (y) => {
    busy = true;
    scrollTo({ top: y, behavior: "smooth" });
    const t0 = performance.now();
    const done = () => (Math.abs(scrollY - y) < 2 || performance.now() - t0 > 1000) ? setTimeout(() => { busy = false; settle = true; }, 120) : requestAnimationFrame(done);
    requestAnimationFrame(done);
  };
  // a trackpad swipe keeps sending wheel events (momentum) after we glide: ignore them until the swipe ends
  let lastWheel = 0, settle = false;
  addEventListener("wheel", (e) => {
    if (!fits.matches || e.ctrlKey || Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
    const now = performance.now(), gap = now - lastWheel; lastWheel = now;
    const pt = playTop(), y = scrollY;
    if (busy) { e.preventDefault(); settle = true; return; }
    if (settle) { if (gap < 220) { e.preventDefault(); return; } settle = false; }
    if (e.deltaY > 0 && y < pt - 4) { e.preventDefault(); glide(pt); }                  // intro → printer
    else if (e.deltaY < 0 && y > 4 && y <= pt + 4) { e.preventDefault(); glide(0); }    // printer → intro
  }, { passive: false });
  addEventListener("keydown", (e) => {
    if (!fits.matches || busy || e.target.closest("input, textarea, select, [contenteditable]")) return;
    const pt = playTop(), y = scrollY;
    const down = ["PageDown", "ArrowDown", " "].includes(e.key) && !e.shiftKey, up = ["PageUp", "ArrowUp"].includes(e.key) || (e.key === " " && e.shiftKey);
    if (down && y < pt - 4) { e.preventDefault(); glide(pt); }
    else if (up && y > 4 && y <= pt + 4) { e.preventDefault(); glide(0); }
  });
}

/* ---------- First visit: Proto is "born" out of the logo ----------
   The word "makemeproto" appears; the two o's of "proto" fly into place as his eyes while every other
   letter swirls into his body. He opens his eyes for the first time, yawns and stretches, looks around
   at the world, then flies to his corner and becomes the guide.
   Plays once per visitor (localStorage), never with reduced motion, and can always be skipped.
   Replay any time with ?intro in the address. */
function initBirth() {
  let seen = false;
  try { seen = localStorage.getItem("mmp-born") === "1"; } catch (e) {}
  const force = /[?&]intro\b/.test(location.search);
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if ((seen && !force) || (reduce && !force) || !Element.prototype.animate) return false;
  const remember = () => { try { localStorage.setItem("mmp-born", "1"); } catch (e) {} };

  document.body.classList.add("is-being-born");
  const letters = "makemeproto".split("");
  const eyeIdx = [8, 10];                       // the two o's in "proto"
  const eyeSvg = (x) => `<g class="born__eye" transform="translate(${x} 50)">
      <g class="born__ball"><circle r="10" fill="#fff"/><g class="born__look"><g class="born__track"><circle class="proto__pupil" r="4.5"/><circle class="born__shine" cx="-1.6" cy="-1.8" r="1.5"/></g></g></g>
      <path class="born__shut" d="M-8 0q8 6 16 0"/><path class="born__happy" d="M-8 3q8-10 16 0"/></g>`;
  const ov = document.createElement("div");
  ov.className = "born";
  ov.setAttribute("role", "dialog");
  ov.setAttribute("aria-label", "MakeMeProto intro");
  ov.innerHTML = `
    <div class="born__stage">
      <span class="born__ring" aria-hidden="true"></span>
      <p class="born__word" aria-label="makemeproto">${letters.map((c, i) => `<span class="born__l${i === 4 || i === 5 ? " born__l--me" : ""}${eyeIdx.includes(i) ? " born__l--o" : ""}">${c}${eyeIdx.includes(i) ? '<i class="born__op"></i>' : ""}</span>`).join("")}</p>
      <svg class="born__bot" viewBox="0 0 120 110" aria-hidden="true">
        <ellipse class="born__shadow" cx="60" cy="102" rx="40" ry="4"/>
        <g class="born__jump">
          <g class="born__armL"><path class="born__arm" d="M22 60c-10-4-14-14-12-24"/></g>
          <g class="born__body">
            <path class="proto__side born__side" d="M98 26 112 14v62l-14 14Z"/>
            <path class="proto__top born__top" d="M22 26 36 14h76L98 26Z"/>
            <rect class="proto__front born__front" x="22" y="26" width="76" height="64" rx="6"/>
            <path class="proto__lines" d="M22 46h76M22 66h76"/>
            ${eyeSvg(46)}${eyeSvg(74)}
            <path class="born__brow" d="M37 35q9-5 18 0"/><path class="born__brow" d="M65 35q9-5 18 0"/>
            <circle class="born__blush" cx="33" cy="69" r="5"/><circle class="born__blush" cx="87" cy="69" r="5"/>
            <path class="proto__mouth born__smile" d="M50 72q10 8 20 0"/>
            <ellipse class="born__o" cx="60" cy="75" rx="5" ry="6"/>
            <ellipse class="born__yawn" cx="60" cy="76" rx="9" ry="10"/>
            <g class="born__grin"><path d="M47 69q13 16 26 0Z"/><path class="born__tongue" d="M54 76.4q6 4 12 0q-6-3-12 0Z"/></g>
          </g>
          <g class="born__armR"><path class="born__arm" d="M111 58c10-4 14-14 12-24"/></g>
        </g>
      </svg>
      <p class="born__say hand" aria-live="polite"></p>
    </div>
    <button type="button" class="born__skip">${T("Skip karo ›", "Skip ›")}</button>`;
  document.body.appendChild(ov);

  const $o = (sel) => ov.querySelector(sel), $$o = (sel) => [...ov.querySelectorAll(sel)];
  const stage = $o(".born__stage"), word = $o(".born__word"), spans = $$o(".born__l"), bot = $o(".born__bot"), say = $o(".born__say");
  const jump = $o(".born__jump"), shadow = $o(".born__shadow"), front = $o(".born__front");
  const balls = $$o(".born__ball"), looks = $$o(".born__look"), tracks = $$o(".born__track");
  const shuts = $$o(".born__shut"), happys = $$o(".born__happy"), brows = $$o(".born__brow"), blush = $$o(".born__blush");
  const smile = $o(".born__smile"), mouthO = $o(".born__o"), yawn = $o(".born__yawn"), grin = $o(".born__grin");
  const armL = $o(".born__armL"), armR = $o(".born__armR");
  const anims = [];
  const A = (el, kf, opt) => { const a = el.animate(kf, { fill: "forwards", easing: "cubic-bezier(.3,1.3,.5,1)", ...opt }); anims.push(a); return a; };
  const AA = (els, kf, opt) => els.forEach((el, k) => A(el, typeof kf === "function" ? kf(k) : kf, opt));
  const show = (els, on, ms = 200, delay = 0) => AA([].concat(els), [{ opacity: on ? 0 : 1 }, { opacity: on ? 1 : 0 }], { duration: ms, delay, easing: "ease-out" });
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  let done = false, alive = false, tracking = false;
  const W = async (ms) => { await wait(ms); if (done) throw 0; };
  const later = (ms, fn) => setTimeout(() => { if (!done) fn(); }, ms);
  const talk = (hi, en) => { say.textContent = T(hi, en); A(say, [{ opacity: 0, transform: "translate(-50%, 10px) scale(.8) rotate(-4deg)" }, { opacity: 1, transform: "translate(-50%, 0) scale(1) rotate(0)" }], { duration: 380 }); };

  // little floating feelings (z, !, ?, hearts, sparkles), placed in Proto's own coordinates
  const fx = (txt, vx, vy, { dx = 0, dy = -50, rot = 0, dur = 1100, size = 1, cls = "" } = {}) => {
    const s = stage.getBoundingClientRect(), b = bot.getBoundingClientRect();
    const e = document.createElement("span");
    e.className = "born__fx hand " + cls; e.textContent = txt; e.setAttribute("aria-hidden", "true");
    e.style.left = b.left - s.left + vx * b.width / 120 + "px"; e.style.top = b.top - s.top + vy * b.height / 110 + "px"; e.style.setProperty("--s", size);
    stage.appendChild(e);
    e.animate([{ opacity: 0, transform: "translate(-50%,-50%) scale(.3)" },
      { opacity: 1, transform: `translate(calc(-50% + ${dx * .3}px), calc(-50% + ${dy * .3}px)) scale(1.15) rotate(${rot / 2}deg)`, offset: .25 },
      { opacity: 0, transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.9) rotate(${rot}deg)` }], { duration: dur, easing: "ease-out" }).onfinish = () => e.remove();
  };

  // eyes follow your mouse once he's awake and curious
  const lookAt = (x, y) => {
    const b = bot.getBoundingClientRect(), dx = x - (b.left + b.width / 2), dy = y - (b.top + b.height * .45), d = Math.hypot(dx, dy) || 1, m = Math.min(3.5, d / 40);
    tracks.forEach((t) => t.setAttribute("transform", `translate(${(dx / d * m).toFixed(2)} ${(dy / d * m).toFixed(2)})`));
  };
  const onMove = (e) => { if (tracking) lookAt(e.clientX, e.clientY); };
  addEventListener("pointermove", onMove);
  // tickle him
  bot.addEventListener("click", () => {
    if (!alive || done) return;
    jump.animate([{ transform: "none" }, { transform: "rotate(-9deg) scale(1.06,.94)", offset: .25 }, { transform: "rotate(8deg)", offset: .5 }, { transform: "rotate(-4deg)", offset: .75 }, { transform: "none" }], { duration: 460, composite: "add" });
    fx(T("Hehe 😆", "Hehe 😆"), 60, -4, { dy: -45, size: .8 });
  });

  async function finish(fast) {
    if (done) return; done = true;
    remember();
    tracking = false; removeEventListener("pointermove", onMove);
    anims.forEach((a) => { try { a.finish(); } catch (e) {} });
    tracks.forEach((t) => t.removeAttribute("transform"));
    const target = $("#guideBot");
    const g = $("#guide");
    if (!fast && target) {
      // spring off the crouch and fly into the guide's corner, leaving sparkles
      const from = bot.getBoundingClientRect(), to = target.getBoundingClientRect();
      const dx = to.left + to.width / 2 - (from.left + from.width / 2), dy = to.top + to.height / 2 - (from.top + from.height / 2);
      say.style.opacity = 0;
      blush.forEach((b) => (b.style.opacity = 0));
      ov.animate([{ backgroundColor: getComputedStyle(ov).backgroundColor }, { backgroundColor: "transparent" }], { duration: 800, fill: "forwards" });
      $$o(".born__skip").forEach((b) => (b.style.opacity = 0));
      jump.animate([{ transform: "scale(1.1,.85)" }, { transform: "scale(.9,1.15)", offset: .25 }, { transform: "none", offset: .6 }, { transform: "none" }], { duration: 950, fill: "forwards" });
      const trail = setInterval(() => fx("✦", 60, 58, { dy: 14, dur: 650, size: .55 }), 70);
      await bot.animate([{ transform: "translate(0,0) scale(1) rotate(0)" }, { transform: `translate(${dx * .45}px, ${dy * .45 - 90}px) scale(.75) rotate(-14deg)`, offset: .5 },
        { transform: `translate(${dx}px, ${dy}px) scale(${to.width / from.width}) rotate(0)` }], { duration: 950, easing: "cubic-bezier(.5,0,.3,1)", fill: "forwards" }).finished;
      clearInterval(trail);
    } else {
      await ov.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250, fill: "forwards" }).finished;
    }
    ov.remove();
    document.body.classList.remove("is-being-born");
    g?.classList.remove("hop"); void g?.offsetWidth; g?.classList.add("hop");
    window.dispatchEvent(new Event("mmp:born"));
  }
  $o(".born__skip").addEventListener("click", () => finish(true));
  ov.addEventListener("click", (e) => { if (e.target === ov) finish(true); });
  addEventListener("keydown", function k(e) { if (e.key === "Escape") { removeEventListener("keydown", k); finish(true); } });

  // smooth curved flight: keyframes sampled along a quadratic curve
  const curve = (dx, dy, cx, cy, rot, s1, n = 14) => Array.from({ length: n + 1 }, (_, j) => {
    const t = j / n, mt = 1 - t, x = 2 * mt * t * cx + t * t * dx, y = 2 * mt * t * cy + t * t * dy;
    return { transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${(rot * t).toFixed(1)}deg) scale(${(1 + (s1 - 1) * t).toFixed(3)})` };
  });

  (async () => { try {
    // 1. the word drops in, letter by letter, with a bit of squash and stretch
    spans.forEach((sp, i) => A(sp, [
      { opacity: 0, transform: "translateY(-70px) scale(.8,1.3)", easing: "cubic-bezier(.55,0,1,.45)" },
      { opacity: 1, transform: "translateY(0) scale(1.3,.7)", offset: .55, easing: "cubic-bezier(.2,.8,.4,1)" },
      { opacity: 1, transform: "translateY(-10px) scale(.92,1.08)", offset: .78, easing: "ease-in-out" },
      { opacity: 1, transform: "none" }], { duration: 560, delay: 55 * i, easing: "linear" }));
    await W(55 * spans.length + 450);

    // 2. something is alive in there: a heartbeat, then the o's open their eyes
    A(word, [{ transform: "none" }, { transform: "scale(1.05)", offset: .14 }, { transform: "none", offset: .3 }, { transform: "scale(1.09)", offset: .45 }, { transform: "none", offset: .7 }, { transform: "none" }], { duration: 850, easing: "ease-out" });
    [0, 360].forEach((d) => A($o(".born__ring"), [{ opacity: .5, transform: "scale(.2)" }, { opacity: 0, transform: "scale(1.6)" }], { duration: 900, delay: d, easing: "ease-out", fill: "none" }));
    await W(650);
    const ops = eyeIdx.map((i) => spans[i].querySelector(".born__op"));
    ops.forEach((p, k) => A(p, [
      { opacity: 0, transform: "none" }, { opacity: 1, transform: "none", offset: .1 },
      { opacity: 1, transform: "translate(-.06em,0)", offset: .25 }, { opacity: 1, transform: "translate(-.06em,0)", offset: .38 },
      { opacity: 1, transform: "translate(.06em,0)", offset: .5 }, { opacity: 1, transform: "translate(.06em,0)", offset: .62 },
      { opacity: 1, transform: `translate(${k ? -.07 : .07}em,.01em)`, offset: .78 }, { opacity: 1, transform: `translate(${k ? -.07 : .07}em,.01em)` }], { duration: 1400, easing: "ease-in-out" }));
    eyeIdx.forEach((i) => A(spans[i], [{ transform: "none" }, { transform: "scaleY(.12)", offset: .5 }, { transform: "none" }], { duration: 220, delay: 170, easing: "ease-in-out" }));
    await W(1100);
    // they spot each other: an excited hop, the rest of the word shivers
    eyeIdx.forEach((i) => A(spans[i], [{ transform: "none" }, { transform: "translateY(-14px) scale(.95,1.08)", offset: .4 }, { transform: "translateY(0) scale(1.1,.9)", offset: .75 }, { transform: "none" }], { duration: 420, easing: "ease-in-out" }));
    spans.forEach((sp, i) => { if (!eyeIdx.includes(i)) A(sp, [{ transform: "none" }, { transform: `rotate(${i % 2 ? 7 : -7}deg)`, offset: .25 }, { transform: `rotate(${i % 2 ? -5 : 5}deg)`, offset: .55 }, { transform: "none" }], { duration: 420, delay: 18 * i, easing: "ease-in-out" }); });
    await W(560);

    // 3. the morph: letters swirl along curves onto Proto's outline, the o's arc up into his eyes
    bot.style.opacity = 1;
    const bb = bot.getBoundingClientRect(), u = bb.width / 120, P = (vx, vy) => [bb.left + vx * u, bb.top + vy * u];
    const dest = { 0: [24, 86], 1: [22, 56], 2: [27, 28], 3: [46, 15], 4: [72, 14], 5: [98, 17], 6: [110, 28], 7: [106, 68], 9: [62, 92] };
    let n = 0;
    spans.forEach((sp, i) => {
      const r = sp.getBoundingClientRect(), e = eyeIdx.indexOf(i);
      if (e >= 0) {
        const ox = r.left + r.width / 2, oy = r.top + r.height * .62, [ex, ey] = P(e ? 74 : 46, 50);
        const dx = ex - ox, dy = ey - oy, sc = 20 * u / (r.height * .55);
        const kf = curve(dx, dy, dx * .35, dy * .35 - 150, e ? 360 : -360, sc), end = kf[kf.length - 1].transform;
        A(sp, kf, { duration: 1150, delay: 120, easing: "cubic-bezier(.45,0,.25,1)" });
        A(sp.querySelector(".born__op"), [{ opacity: 1 }, { opacity: 0 }], { duration: 300, delay: 450, easing: "ease-out" });
        // they close like a sleepy newborn's eyes, then hand over to the real ones
        A(sp, [{ transform: end, opacity: 1 }, { transform: `${end} scaleY(.12)`, opacity: 1, offset: .6 }, { transform: `${end} scaleY(.12)`, opacity: 0 }], { duration: 480, delay: 1350, easing: "ease-in-out" });
      } else {
        const ox = r.left + r.width / 2, oy = r.top + r.height * .85, [tx, ty] = P(...dest[i]);
        const dx = tx - ox, dy = ty - oy, k = n++, spin = (k % 2 ? 1 : -1) * (220 + k * 25);
        const kf = curve(dx, dy, dx * .5 + (k % 2 ? 40 : -40), dy * .5 - 70 - Math.abs(dx) * .15, spin, .42), end = kf[kf.length - 1].transform;
        A(sp, kf, { duration: 950, delay: 50 * k, easing: "cubic-bezier(.55,0,.3,1)" });
        A(sp, [{ transform: end, opacity: 1 }, { transform: end.replace(/scale\([^)]*\)$/, "scale(.6)"), opacity: 1, offset: .3 }, { transform: end.replace(/scale\([^)]*\)$/, "scale(0)"), opacity: 0 }],
          { duration: 420, delay: 50 * k + 1050, easing: "ease-in" });
      }
    });
    // the outline draws itself between the letters, then he fills in, folds out his top and side, grows arms
    let len = 280; try { len = front.getTotalLength() || len; } catch (e) {}
    front.style.strokeDasharray = len; front.style.strokeDashoffset = len;
    A(front, [{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: 800, delay: 550, easing: "ease-in-out" });
    A(front, [{ fillOpacity: 0 }, { fillOpacity: 1 }], { duration: 420, delay: 1250, easing: "ease-out" });
    A(front, [{ strokeOpacity: 1 }, { strokeOpacity: 0 }], { duration: 400, delay: 1750, easing: "ease-out" });
    A(shadow, [{ opacity: 0, transform: "scaleX(.2)" }, { opacity: 1, transform: "none" }], { duration: 500, delay: 1100, easing: "ease-out" });
    A($o(".born__top"), [{ transform: "scaleY(0)" }, { transform: "scaleY(1.15)", offset: .7 }, { transform: "none" }], { duration: 380, delay: 1350 });
    A($o(".born__side"), [{ transform: "scaleX(0)" }, { transform: "scaleX(1.15)", offset: .7 }, { transform: "none" }], { duration: 380, delay: 1450 });
    show($o(".born__bot .proto__lines"), true, 300, 1600);
    show(shuts, true, 220, 1650);
    AA($$o(".born__arm"), [{ transform: "scale(0)" }, { transform: "scale(1.2)", offset: .7 }, { transform: "none" }], { duration: 400, delay: 1750 });
    A(jump, [{ transform: "none" }, { transform: "scale(1.08,.9)", offset: .3 }, { transform: "scale(.96,1.05)", offset: .65 }, { transform: "none" }], { duration: 450, delay: 1900, easing: "ease-in-out" });
    await W(2300);

    // 4. fast asleep, snoring softly
    A(mouthO, [{ opacity: 0, transform: "scale(.4)" }, { opacity: 1, transform: "scale(.6)", offset: .15 }, { opacity: 1, transform: "scale(1)", offset: .55 }, { opacity: 1, transform: "scale(.6)" }], { duration: 1200, easing: "ease-in-out" });
    A(jump, [{ transform: "none" }, { transform: "scale(1.02,1.04)", offset: .55 }, { transform: "none" }], { duration: 1200, easing: "ease-in-out" });
    [["z", 0, .75], ["z", 330, 1], ["Z", 660, 1.3]].forEach(([z, d, s]) => later(d, () => fx(z, 98, 16, { dx: 26, dy: -60, rot: 15, dur: 1300, size: s })));
    await W(1250);

    // 5. one eye peeks first… then both flutter open
    show(mouthO, false, 200);
    A(balls[0], [{ opacity: 1, transform: "scaleY(.1)" }, { opacity: 1, transform: "scaleY(.55)", offset: .25 }, { opacity: 1, transform: "scaleY(.55)", offset: .75 }, { opacity: 1, transform: "scaleY(.1)" }], { duration: 850, easing: "ease-in-out" });
    A(shuts[0], [{ opacity: 1 }, { opacity: 0, offset: .2 }, { opacity: 0, offset: .8 }, { opacity: 1 }], { duration: 850 });
    A(looks[0], [{ transform: "none" }, { transform: "translate(-3px,0)", offset: .35 }, { transform: "translate(3px,0)", offset: .6 }, { transform: "none" }], { duration: 850, easing: "ease-in-out" });
    await W(900);
    alive = true;
    AA(balls, [{ opacity: 1, transform: "scaleY(.1)" }, { opacity: 1, transform: "scaleY(.7)", offset: .3 }, { opacity: 1, transform: "scaleY(.25)", offset: .5 }, { opacity: 1, transform: "none" }], { duration: 650, easing: "ease-out" });
    show(shuts, false, 150);
    await W(700);

    // 6. a huge yawn and a stretch (with a tiny tear)
    talk("Uaaaah… 🥱", "Yaaawn… 🥱");
    AA(balls, [{ transform: "none" }, { transform: "scaleY(.12)", offset: .2 }, { transform: "scaleY(.12)", offset: .8 }, { transform: "none" }], { duration: 1400, easing: "ease-in-out" });
    AA(shuts, [{ opacity: 0 }, { opacity: 1, offset: .2 }, { opacity: 1, offset: .8 }, { opacity: 0 }], { duration: 1400 });
    AA(brows, [{ opacity: 0, transform: "none" }, { opacity: 1, transform: "translateY(-3px)", offset: .3 }, { opacity: 1, transform: "translateY(-3px)", offset: .75 }, { opacity: 0, transform: "none" }], { duration: 1400, easing: "ease-in-out" });
    A(yawn, [{ transform: "scale(0)", opacity: 1 }, { transform: "scale(1.3,1.5)", opacity: 1, offset: .5 }, { transform: "scale(1.15,1.3)", opacity: 1, offset: .8 }, { transform: "scale(0)", opacity: 0 }], { duration: 1400, easing: "ease-in-out" });
    A(armL, [{ transform: "rotate(0)" }, { transform: "rotate(30deg)", offset: .5 }, { transform: "rotate(22deg)", offset: .8 }, { transform: "rotate(0)" }], { duration: 1400, easing: "ease-in-out" });
    A(armR, [{ transform: "rotate(0)" }, { transform: "rotate(-30deg)", offset: .5 }, { transform: "rotate(-22deg)", offset: .8 }, { transform: "rotate(0)" }], { duration: 1400, easing: "ease-in-out" });
    A(jump, [{ transform: "none" }, { transform: "scale(.95,1.1)", offset: .45 }, { transform: "scale(.97,1.08)", offset: .72 }, { transform: "scale(1.06,.93)", offset: .88 }, { transform: "none" }], { duration: 1400, easing: "ease-in-out" });
    later(1000, () => fx("💧", 84, 46, { dx: 6, dy: 32, dur: 900, size: .45 }));
    await W(1450);
    // shakes off the sleep
    A(jump, [{ transform: "none" }, { transform: "rotate(-6deg)", offset: .2 }, { transform: "rotate(6deg)", offset: .45 }, { transform: "rotate(-4deg)", offset: .7 }, { transform: "none" }], { duration: 420, easing: "ease-in-out" });
    await W(450);

    // 7. surprise! the world exists
    talk("Arre?! 😮", "Whoa?! 😮");
    AA(balls, [{ transform: "none" }, { transform: "scale(1.3)", offset: .4 }, { transform: "scale(1.18)" }], { duration: 300, easing: "ease-out" });
    AA(brows, [{ opacity: 0, transform: "translateY(3px)" }, { opacity: 1, transform: "translateY(-5px)" }], { duration: 250 });
    A(mouthO, [{ opacity: 0, transform: "scale(.3)" }, { opacity: 1, transform: "scale(1.1)" }], { duration: 260 });
    A(jump, [{ transform: "none" }, { transform: "translateY(-16px) scale(.95,1.06)", offset: .4 }, { transform: "translateY(0) scale(1.05,.95)", offset: .8 }, { transform: "none" }], { duration: 450, easing: "ease-in-out" });
    shadow.animate([{ transform: "none" }, { transform: "scale(.7)", offset: .4 }, { transform: "none", offset: .8 }], { duration: 450 });
    fx("!", 60, -6, { dy: -30, dur: 900, size: 1.6 });
    await W(800);

    // 8. curious: looks around (and follows your mouse from now on)
    tracking = true;
    talk("Ye kya jagah hai? 👀", "Where am I? 👀");
    AA(balls, [{ transform: "scale(1.18)" }, { transform: "none" }], { duration: 300, easing: "ease-out" });
    AA(brows, (k) => [{ transform: "translateY(-5px)" }, { transform: k ? "translateY(-1px) rotate(9deg)" : "translateY(-6px) rotate(-10deg)" }], { duration: 300 });
    A(mouthO, [{ transform: "scale(1.1)" }, { transform: "scale(.6)" }], { duration: 300 });
    AA(looks, [{ transform: "none" }, { transform: "translate(-4px,-1px)", offset: .2 }, { transform: "translate(-4px,-1px)", offset: .45 }, { transform: "translate(4px,-1px)", offset: .65 }, { transform: "translate(4px,-1px)", offset: .85 }, { transform: "none" }], { duration: 1400, easing: "ease-in-out" });
    A(jump, [{ transform: "none" }, { transform: "rotate(-7deg)", offset: .2 }, { transform: "rotate(-7deg)", offset: .45 }, { transform: "rotate(7deg)", offset: .65 }, { transform: "rotate(7deg)", offset: .85 }, { transform: "none" }], { duration: 1400, easing: "ease-in-out" });
    later(250, () => fx("?", 18, 6, { dx: -20, dy: -40, rot: -20 }));
    later(950, () => fx("?", 104, 6, { dx: 20, dy: -40, rot: 20 }));
    await W(1450);

    // 9. …and spots you. Shy, blushing, happy.
    talk("Arre, aap! 🥰", "Oh, hi you! 🥰");
    AA(balls, [{ transform: "none" }, { transform: "scaleY(.1)" }], { duration: 200, easing: "ease-in" });
    show(happys, true, 200, 120);
    show(blush, true, 400);
    show(brows, false, 300);
    show(mouthO, false, 150);
    show(smile, true, 250, 100);
    A(jump, [{ transform: "none" }, { transform: "rotate(-4deg) translateX(-3px)", offset: .25 }, { transform: "rotate(4deg) translateX(3px)", offset: .55 }, { transform: "rotate(-2deg)", offset: .8 }, { transform: "none" }], { duration: 800, easing: "ease-in-out" });
    fx("♥", 24, 12, { dx: -30, dy: -60, rot: -20, size: 1.1, cls: "born__fx--heart" });
    later(260, () => fx("♥", 98, 8, { dx: 30, dy: -55, rot: 20, size: .8, cls: "born__fx--heart" }));
    await W(950);

    // 10. a big wave hello, with a grin and a happy hop
    talk("Namaste! Main Proto 👋", "Hi! I'm Proto 👋");
    show(happys, false, 150);
    AA(balls, [{ transform: "scaleY(.1)" }, { transform: "scale(1.08)", offset: .6 }, { transform: "none" }], { duration: 260 });
    show(smile, false, 120);
    A(grin, [{ opacity: 0, transform: "scaleY(.3)" }, { opacity: 1, transform: "none" }], { duration: 250 });
    A(armR, [{ transform: "rotate(0)" }, { transform: "rotate(35deg)", offset: .18 }, { transform: "rotate(-8deg)", offset: .34 }, { transform: "rotate(35deg)", offset: .5 }, { transform: "rotate(-8deg)", offset: .66 }, { transform: "rotate(35deg)", offset: .82 }, { transform: "rotate(0)" }], { duration: 1300, easing: "ease-in-out" });
    A(jump, [{ transform: "none" }, { transform: "scale(1.06,.92)", offset: .1 }, { transform: "translateY(-26px) scale(.94,1.07)", offset: .28 }, { transform: "translateY(0) scale(1.07,.92)", offset: .45 }, { transform: "none", offset: .56 }, { transform: "none" }], { duration: 1300, easing: "ease-in-out" });
    shadow.animate([{ transform: "none" }, { transform: "none", offset: .1 }, { transform: "scale(.55)", offset: .28 }, { transform: "none", offset: .45 }], { duration: 1300 });
    [[10, 20, -40, -30], [110, 30, 40, -30], [60, -10, 0, -50]].forEach(([x, y, dx, dy], j) => later(350 + j * 140, () => fx("✦", x, y, { dx, dy, size: .9, dur: 900 })));
    await W(1350);

    // 11. off to work: crouch, then fly to his corner (finish)
    talk("Chalo, ghumata hoon! ✨", "Come, I'll show you around! ✨");
    A(grin, [{ opacity: 1 }, { opacity: 0 }], { duration: 150 });
    show(smile, true, 150);
    A(jump, [{ transform: "none" }, { transform: "scale(1.1,.85)" }], { duration: 300, delay: 350, easing: "ease-in" });
    await W(700);
    finish(false);
  } catch (e) { /* skipped */ } })();
  return true;
}

/* ---------- Reveal sections on scroll ---------- */
function initReveal() {
  const items = $$(".play__title, .section__head, .adda__head, .makers__copy, .hero__copy, .contact__info, .fixer__copy, .tips__copy, .review__grid, .card, .step, .mat, .tile, .faq__list details, .why__list li");
  if (!("IntersectionObserver" in window)) return;
  items.forEach((el) => el.classList.add("reveal"));
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); }
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
  items.forEach((el) => io.observe(el));
}

document.addEventListener("DOMContentLoaded", () => {
  applyConfig();
  initAnalytics();
  initLang();
  initBirth();
  initThemer();
  initProgress();
  initDoodles();
  initNav();
  initPrinter();
  initQuote();
  initContact();
  initPriceFloat();
  initCareers();
  initGallery();
  initNewsletter();
  initTrack();
  flushOutbox();
  initScreens();
  initUses();
  initExamples();
  initCompare();
  initAdda();
  initMakers();
  initGuide();
  initGuideFun();
  initWaFloat();
  initProto();
  initReveal();
});
