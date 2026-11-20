/* =========================================================
   MakeMyProto: site script
   ---------------------------------------------------------
   STEP 1: Put your real details in CONFIG below.
   Everything on the page (WhatsApp links, email, city)
   updates automatically from here.
   ========================================================= */

const CONFIG = {
  whatsapp: "91XXXXXXXXXX",          // country code + number, digits only, e.g. "919876543210"
  phoneText: "+91 XXXXX XXXXX",      // how the number is shown on the page
  email: "hello@makemyproto.in",
  city: "Gurugram",
  cityFull: "Gurugram, Haryana",
  instagram: "makemyproto",          // handle without @
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
const waLink = (text) => `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(text)}`;
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
  const NS = "http://www.w3.org/2000/svg";

  const LAYERS = 26, H = 300, layerH = 9.5, gap = 1.5, base = H - 6;
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
    let size = 150;
    const fam = getComputedStyle(document.body).getPropertyValue("--f-display") || "sans-serif";
    do { g.font = `900 ${size}px ${fam}`; size -= 4; } while (g.measureText(text).width > 270 && size > 30);
    g.textAlign = "center"; g.textBaseline = "alphabetic";
    g.fillText(text, 150, 236);
    const data = g.getImageData(0, 0, 300, 300).data;
    return (v, u) => {
      const x = Math.round(150 + v * 150), y = Math.round(rowY(Math.round(u * (LAYERS - 1))) + layerH / 2);
      return data[(y * 300 + x) * 4 + 3] > 110;
    };
  }

  // Build 26 <g> layers from a shape
  let layers = [];   // [{ g, x0, x1 }]
  function build(shape) {
    svg.innerHTML = "";
    layers = [];
    for (let i = 0; i < LAYERS; i++) {
      const u = i / (LAYERS - 1);
      const g = document.createElementNS(NS, "g");
      let start = null, x0 = 150, x1 = 150, any = false;
      for (let x = 0; x <= 300; x += 2) {
        const inside = x < 300 && shape((x - 150) / 150, u);
        if (inside && start === null) start = x;
        if (!inside && start !== null) {
          if (x - start >= 4) {
            const r = document.createElementNS(NS, "rect");
            r.setAttribute("x", start); r.setAttribute("y", rowY(i));
            r.setAttribute("width", x - start); r.setAttribute("height", layerH);
            r.setAttribute("rx", 3);
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
  const MS_PER_LAYER = 110;
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
    if (p >= LAYERS) { mode = "idle"; current = target = LAYERS; render(); celebrate(); raf = 0; resetPose(); return; }
    raf = requestAnimationFrame(autoFrame);
  }
  function autoPrint() {
    printer.classList.add("played");
    cancelAnimationFrame(raf);
    mode = "auto"; celebrated = false;
    current = 0; target = LAYERS; shown = -1;
    printer.classList.remove("is-idle");
    frame.style.removeProperty("--rx"); frame.style.removeProperty("--ry");
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

  /* --- confetti + "Ho gaya!" when a print finishes --- */
  const bubble = $("#printBubble");
  const phrases = ["Ho gaya! ✨", "Ekdum perfect!", "Bas, ready hai!", "Mast print!", "Taiyaar! 🎉"];
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
      bubble.textContent = phrases[Math.floor(Math.random() * phrases.length)];
      bubble.classList.remove("pop"); void bubble.offsetWidth; bubble.classList.add("pop");
    }
  }

  function resetPose() {
    nozzle.style.removeProperty("--nx");
    frame.style.removeProperty("--rx"); frame.style.removeProperty("--ry");
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
    frame.style.setProperty("--ry", (tx * 16).toFixed(2) + "deg");
    frame.style.setProperty("--rx", (-ty * 10).toFixed(2) + "deg");
    const fx = clamp((e.clientX - fb.left) / fb.width, 0, 1) - 0.5;
    nozzle.style.setProperty("--nx", (fx * fb.width * 0.62).toFixed(1) + "px");
    printer.classList.remove("is-idle");
    // layers: only while the pointer is over the printer column
    const vb = visual.getBoundingClientRect();
    const over = e.clientX >= vb.left && e.clientX <= vb.right && e.clientY >= vb.top && e.clientY <= vb.bottom;
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
  function setModel(key, text) {
    modelBtns.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.model === key)));
    build(key === "name" ? textShape(text) : SHAPES[key]);
  }
  // mini layered thumbnails, drawn from the same shapes the printer uses
  $$("[data-thumb]").forEach((el) => {
    const shape = SHAPES[el.dataset.thumb];
    let r = "";
    for (let i = 0; i < 12; i++) {
      const u = i / 11; let start = null;
      for (let x = 0; x <= 300; x += 6) {
        const inside = x < 300 && shape((x - 150) / 150, u);
        if (inside && start === null) start = x;
        if (!inside && start !== null) { r += `<rect x="${start}" y="${296 - (i + 1) * 24}" width="${x - start}" height="20" rx="7"/>`; start = null; }
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
        ghost.innerHTML = b.querySelector(".shelf__thumb").innerHTML;
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

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  setModel("vase");
  current = LAYERS;
  render();
  if (reduce) { printer.classList.remove("is-idle"); return; }

  playBtn?.addEventListener("click", autoPrint);
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

    const msg = [
      "Hi MakeMyProto! I'd like a 3D printing quote.",
      fileName ? `File: ${fileName}` : `Approx weight: ${weight.toFixed(0)} g`,
      model ? `Size: ${out.size.textContent}` : null,
      `Material: ${material.value} | Infill: ${infill.value}% | Colour: ${color()}`,
      `Quantity: ${q}`,
      `Website estimate: ${out.price.textContent}`,
      fileName ? "(I'll send the file here.)" : null,
    ].filter(Boolean).join("\n");
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
    showFileMsg(mb > 50 ? `Reading ${f.name} (${Math.round(mb)} MB)… badi file hai, thoda time lagega ☕` : "Reading " + f.name + "…");
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

  // Floating "Instant price" pill: visible after the hero, hidden near the quote
  const pill = $("#priceFloat"), heroEl = $(".hero");
  const togglePill = () => {
    const q = quoteSec.getBoundingClientRect(), h = heroEl.getBoundingClientRect();
    pill.classList.toggle("show", h.bottom < 0 && (q.top > innerHeight || q.bottom < 0));
  };
  addEventListener("scroll", togglePill, { passive: true }); togglePill();

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

/* ---------- Contact form → WhatsApp ---------- */
function initContact() {
  const form = $("#contactForm");
  const hint = $("#contactHint");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = $("#cName").value.trim();
    const phone = $("#cPhone").value.trim();
    if (!name || !phone) {
      hint.textContent = "Please add your name and phone number.";
      hint.style.color = "#c73f0c";
      return;
    }
    const msg = [
      `Hi MakeMyProto! I'm ${name}.`,
      `Phone: ${phone}`,
      `I need: ${$("#cService").value}`,
      $("#cMsg").value.trim() ? `Details: ${$("#cMsg").value.trim()}` : null,
    ].filter(Boolean).join("\n");
    window.open(waLink(msg), "_blank", "noopener");
    hint.style.color = "";
    hint.textContent = hasRealNumber()
      ? "WhatsApp opened. Just press send."
      : "WhatsApp number not set yet (edit CONFIG in js/main.js).";
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
  const select = (tab) => {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
      $("#" + t.getAttribute("aria-controls")).hidden = !on;
    });
  };
  tabs.forEach((t, i) => {
    t.addEventListener("click", () => select(t));
    t.addEventListener("keydown", (e) => {
      const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!d) return;
      const next = tabs[(i + d + tabs.length) % tabs.length];
      select(next); next.focus();
    });
  });
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
    const msg = `Hi MakeMyProto 3D Adda! 🙋\nTopic: ${topic}\nQuestion: ${q}`;
    window.open(`https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(msg)}`, "_blank", "noopener");
  });
}

/* ---------- Proto the cube: eyes follow you, says hi ---------- */
function initProto() {
  const proto = $("#proto");
  if (!proto) return;
  const pupils = $$(".proto__pupil", proto);
  const bubble = $("#protoBubble");
  const lines = ["Hi! Main Proto hoon 👋", "Kya banwana hai? 🤔", "Form bharo na, please! 🙏", "Main bhi 3D printed hoon 😎", "Deepak & Bal Krishan se baat karo!"];
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
  initThemer();
  initProgress();
  initDoodles();
  initNav();
  initPrinter();
  initQuote();
  initContact();
  initUses();
  initExamples();
  initCompare();
  initAdda();
  initProto();
  initReveal();
});
