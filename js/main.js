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
  city: "Gurugram",
  cityFull: "Gurugram, Haryana",
  instagram: "makemeproto",          // handle without @
  community: "https://chat.whatsapp.com/D55pQNBsJBY4H8kOEmGliL",                     // WhatsApp community / group invite link (leave "" to use a WhatsApp message instead)
  maxFileMb: 500,                    // biggest STL the quote calculator will read

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
    if (file && file === here && !a.classList.contains("nav__quote")) a.setAttribute("aria-current", "page");
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
  const hero = $(".hero");
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
    ideas.hidden = false;
    ideas.classList.remove("pop"); void ideas.offsetWidth; ideas.classList.add("pop");
  }
  $("#nameIdeasX")?.addEventListener("click", () => { ideas.hidden = true; });
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
function initQuote() {
  const drop = $("#drop"), file = $("#stlFile"), info = $("#fileInfo");
  if (!drop || !file) return;
  const grams = $("#manualGrams"), material = $("#material"), qty = $("#qty");
  const infill = $("#infill"), infillVal = $("#infillVal");
  const out = {
    price: $("#price"), note: $("#priceNote"), weight: $("#statWeight"),
    time: $("#statTime"), size: $("#statSize"), vol: $("#statVol"), wa: $("#quoteWa"),
  };
  let model = null; // parsed STL
  let fileName = "";
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
      out.wa.classList.add("is-disabled");
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
    showFileMsg(mb > 50 ? `Reading ${f.name} (${Math.round(mb)} MB)… ${T("badi file hai, thoda time lagega ☕", "big file, this may take a moment ☕")}` : "Reading " + f.name + "…");
    await new Promise((r) => setTimeout(r, 40));   // let the message show before the heavy work
    try {
      model = parseSTL(await f.arrayBuffer());
      fileName = f.name;
      grams.value = "";
      drop.classList.add("has-file");
      showFileMsg(`✓ ${f.name} · ${model.triangles.toLocaleString("en-IN")} triangles`);
    } catch (e) {
      model = null; fileName = "";
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
    fileName = "sample-phone-stand.stl";
    grams.value = ""; file.value = "";
    drop.classList.add("has-file");
    showFileMsg("✓ sample-phone-stand.stl (sample) · 80 × 64 × 92 mm");
    calc();
  });

  grams.addEventListener("input", () => {
    if (grams.value) { // typing a weight replaces the file
      model = null; fileName = ""; file.value = "";
      drop.classList.remove("has-file"); info.hidden = true;
    }
    calc();
  });
  [material, qty, infill].forEach((el) => el.addEventListener("input", calc));
  $$('input[name="color"]').forEach((el) => el.addEventListener("change", calc));
  $("#quoteForm").addEventListener("submit", (e) => e.preventDefault());
  calc();
}

/* ---------- Floating "Instant price" pill: shows once the first screen is passed, hides near the calculator ---------- */
function initPriceFloat() {
  const pill = $("#priceFloat");
  if (!pill) return;
  const top = $(".hero") || $(".pagehead"), quoteSec = $("#quote");
  const toggle = () => {
    const past = top ? top.getBoundingClientRect().bottom < 0 : scrollY > 400;
    let nearQuote = false;
    if (quoteSec) { const q = quoteSec.getBoundingClientRect(); nearQuote = q.top < innerHeight && q.bottom > 0; }
    pill.classList.toggle("show", past && !nearQuote);
  };
  addEventListener("scroll", toggle, { passive: true }); toggle();
}

/* ---------- Contact form → WhatsApp ---------- */
function initContact() {
  const form = $("#contactForm");
  const hint = $("#contactHint");
  if (!form) return;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = $("#cName").value.trim();
    const phone = $("#cPhone").value.trim();
    if (!name || !phone) {
      hint.textContent = "Please add your name and phone number.";
      hint.style.color = "#c73f0c";
      return;
    }
    const msg = waFormat("New enquiry 👋", [
      ["Name", name],
      ["Phone", phone],
      ["Service", $("#cService").value],
      ["Details", $("#cMsg").value.trim() || null],
    ]);
    window.open(waLink(msg), "_blank", "noopener");
    hint.style.color = "";
    hint.textContent = hasRealNumber()
      ? "WhatsApp opened. Just press send."
      : "WhatsApp number not set yet.";
  });
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
  const wrap = $("#doodles"), hero = $(".hero");
  if (!wrap || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  hero.addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch") return;
    const r = hero.getBoundingClientRect();
    wrap.style.setProperty("--mx", ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
    wrap.style.setProperty("--my", ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
  });
  hero.addEventListener("pointerleave", () => { wrap.style.setProperty("--mx", 0); wrap.style.setProperty("--my", 0); });
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
    hello: ["WhatsApp sabse fast hai, try karo 💬", "WhatsApp is fastest, give it a try 💬"],
    "page-pricing": ["STL hai? Neeche daalo, price turant ⚡", "Got an STL? Drop it below for an instant price ⚡", { hi: "📂 STL chuno", en: "📂 Choose STL", run: () => $("#stlFile")?.click() }],
    "page-services": ["Apna kaam chuno, baaki hum sambhal lenge 🛠️", "Pick what you need, we'll handle the rest 🛠️"],
    "page-guide": ["Pehli baar print kar rahe ho? Yahan se shuru karo 📒", "First print? Start here 📒"],
    "page-community": ["Printer hai? Adda join karo, free help 🧡", "Got a printer? Join the Adda, free help 🧡"],
    "page-about": ["Hum dono se milo 👋 Polaroid pe tap karo", "Meet us both 👋 Tap a polaroid"],
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
  const pageKey = $(".hero") ? "hero" : "page-" + (document.body.dataset.page || "");
  let current = pageKey, quiet = false, hideT = 0, lastSaid = 0, dwellT = 0;
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
    seen.add(key); lastSaid = Date.now();
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
  const map = [[".hero", "hero"], [".pagehead", pageKey], ["#make", "services"], ["#ourwork", "work"], ["#hello", "hello"], ["#services", "services"], ["#uses", "uses"], ["#process", "process"], ["#quote", "quote"],
    ["#prices", "prices"], ["#materials", "materials"], ["#fixer", "fixer"], ["#work", "work"], ["#makers", "makers"],
    ["#tips", "tips"], ["#adda", "adda"], ["#reviews", "reviews"], ["#faq", "faq"], ["#contact", "contact"]];
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        const key = en.target.dataset.guide;
        if (key === current) return;
        current = key;
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
  if (pageKey !== "hero") { setTimeout(() => { if (!seen.has(pageKey)) say(pageKey); }, 2500); }
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
  const IMPORTANT = ".crumbs,.pagehead__sub,.homecta__btns,h1,h2,h3,.hero__lead,.hero__nofile,.hero__chips,.section__head p,.section__sub,.eyebrow,.btn,.hero__cta,input,select,textarea,.printer__frame,.shelf,.spools,.printer__readout,.card,.ex,.mat,.uses__panel,.uses__tabs,.quote__result,.drop,.compare,.notebook,.maker,.note,.fix,.tile,summary,.step,.nameideas,.nametag,.review__card,.adda__card,.contact__form";
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

/* ---------- Reveal sections on scroll ---------- */
function initReveal() {
  const items = $$(".section__head, .adda__head, .makers__copy, .hero__copy, .contact__info, .fixer__copy, .tips__copy, .review__grid, .card, .step, .mat, .tile, .faq__list details, .why__list li");
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
  initLang();
  initThemer();
  initProgress();
  initDoodles();
  initNav();
  initPrinter();
  initQuote();
  initContact();
  initPriceFloat();
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
