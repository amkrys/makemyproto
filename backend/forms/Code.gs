/**
 * MakeMeProto website forms → Google Sheet + Google Drive
 * ----------------------------------------------------------------
 * Paste this whole file into a Google Apps Script project (script.google.com)
 * while signed in to the MakeMeProto Google account, then:
 *   1. Run  setup()  once (allow the permissions it asks for).
 *   2. Deploy → New deployment → Web app · Execute as: Me · Who has access: Anyone.
 *   3. Copy the web app URL into CONFIG.forms.endpoint in js/main.js.
 * Full steps: backend/forms/README.md
 */

/* ------------------------- Settings ------------------------- */
const SETTINGS = {
  notifyEmail: "contact@makemeproto.com",   // gets an email for every new entry ("" = no email)
  sheetName: "MakeMeProto · Website forms",
  folderName: "MakeMeProto · Website uploads",

  // Abuse and storage guards
  maxPerMinute: 10,          // whole site, all forms together
  maxPerPhonePerHour: 4,     // same phone number
  maxPerDay: 150,            // whole site, per day
  maxUploadMbPerDay: 400,    // all files together, per day
  stopUploadsAtPct: 85,      // stop saving files when Drive is this full (entries are still saved)
  minSecondsOnForm: 3,       // bots submit instantly

  // How long uploaded files are kept, in days (then moved to Drive trash)
  keepDays: { quote: 120, careers: 365 },

  // Allowed files per form: extension → max MB
  files: {
    quote:   { stl: 25, jpg: 8, jpeg: 8, png: 8, webp: 8, heic: 8 },
    careers: { pdf: 5, doc: 5, docx: 5, jpg: 5, jpeg: 5, png: 5 },
    contact: {},
  },
  maxFilesPerEntry: 2,
};

const TABS = {
  quote:   ["Received", "Ref", "Status", "Name", "Phone", "Material", "Infill", "Colour", "Quantity", "Weight", "Size", "Estimate", "Notes", "Files", "Source"],
  contact: ["Received", "Ref", "Status", "Name", "Phone", "Service", "Message", "Source"],
  careers: ["Received", "Ref", "Status", "Role", "Name", "Phone", "Email", "City", "Portfolio", "Why", "Files", "Source"],
};
const TAB_TITLES = { quote: "Quotes", contact: "Contact", careers: "Careers" };
const PREFIX = { quote: "Q", contact: "C", careers: "J" };

/* ------------------------- One-time setup ------------------------- */
function setup() {
  const props = PropertiesService.getScriptProperties();
  let ss;
  const sheetId = props.getProperty("SHEET_ID");
  if (sheetId) ss = SpreadsheetApp.openById(sheetId);
  else { ss = SpreadsheetApp.create(SETTINGS.sheetName); props.setProperty("SHEET_ID", ss.getId()); }
  Object.keys(TABS).forEach((form) => {
    let sh = ss.getSheetByName(TAB_TITLES[form]);
    if (!sh) sh = ss.insertSheet(TAB_TITLES[form]);
    if (sh.getLastRow() === 0) {
      sh.appendRow(TABS[form]);
      sh.getRange(1, 1, 1, TABS[form].length).setFontWeight("bold").setBackground("#FFE4D6");
      sh.setFrozenRows(1);
    }
  });
  const first = ss.getSheetByName("Sheet1");
  if (first && ss.getSheets().length > 1) ss.deleteSheet(first);

  if (!props.getProperty("FOLDER_ID")) props.setProperty("FOLDER_ID", DriveApp.createFolder(SETTINGS.folderName).getId());

  // daily clean-up of old uploads
  ScriptApp.getProjectTriggers().filter((t) => t.getHandlerFunction() === "cleanup").forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger("cleanup").timeBased().everyDays(1).atHour(3).create();

  Logger.log("Sheet:  " + ss.getUrl());
  Logger.log("Folder: " + DriveApp.getFolderById(props.getProperty("FOLDER_ID")).getUrl());
}

/* ------------------------- Web app ------------------------- */
function doGet() {
  return json_({ ok: true, service: "makemeproto-forms" });
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const check = checkEntry(body, SETTINGS);
    if (check.silent) return json_({ ok: true, ref: makeRef(PREFIX[body.form] || "X") });   // a bot: pretend it worked, save nothing
    if (!check.ok) return json_(check);

    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    let limit;
    try { limit = takeQuota_(body, check.uploadBytes); } finally { lock.releaseLock(); }
    if (!limit.ok) return json_(limit);

    const ref = makeRef(PREFIX[body.form]);
    const saved = saveFiles_(body, ref, check.files);
    appendRow_(body, ref, saved);
    notify_(body, ref, saved);
    return json_({ ok: true, ref: ref, filesSaved: saved.links.length, filesSkipped: saved.skipped });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: "server", message: "Something went wrong on our side." });
  }
}

/* ------------------------- Checks (pure, also unit-tested) ------------------------- */
function checkEntry(b, S) {
  const bad = (error, message) => ({ ok: false, error: error, message: message });
  if (!b || !TABS[b.form]) return bad("form", "Unknown form.");
  if (b.website) return { ok: false, silent: true };                       // honeypot field, humans never see it
  if (!(Number(b.elapsed) >= S.minSecondsOnForm * 1000)) return bad("fast", "That was quick! Please try again.");
  const f = b.fields || {};
  const name = clean(f.name, 80), phone = digits(f.phone);
  if (!name || name.length < 2) return bad("name", "Please add your name.");
  if (!validPhone(phone)) return bad("phone", "Please add a valid 10-digit mobile number.");
  if (b.form === "careers" && f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(f.email))) return bad("email", "That email doesn't look right.");
  if (/https?:\/\//i.test(String(f.name || "")) || countLinks(JSON.stringify(f)) > 3) return bad("spam", "Too many links.");

  const allowed = S.files[b.form] || {};
  const files = Array.isArray(b.files) ? b.files : [];
  if (files.length > S.maxFilesPerEntry) return bad("files", "Too many files.");
  let uploadBytes = 0;
  const ok = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i] || {};
    const ext = String(file.name || "").toLowerCase().split(".").pop();
    if (!allowed[ext]) return bad("filetype", "This file type isn't allowed: ." + ext);
    const bytes = Math.floor(String(file.data || "").length * 3 / 4);
    if (!bytes) return bad("file", "A file was empty.");
    if (bytes > allowed[ext] * 1048576) return bad("filesize", file.name + " is bigger than " + allowed[ext] + " MB.");
    uploadBytes += bytes;
    ok.push({ name: safeName(file.name), ext: ext, data: file.data, bytes: bytes });
  }
  return { ok: true, files: ok, uploadBytes: uploadBytes };
}

// Does the file really look like what its name says? (first bytes of the file)
function looksLike(ext, bytes, totalLength) {
  const b = (i) => (bytes[i] + 256) % 256;
  const ascii = (from, n) => String.fromCharCode.apply(null, Array.prototype.slice.call(bytes, from, from + n).map((x) => (x + 256) % 256));
  switch (ext) {
    case "stl": {
      if (/^\s*solid/i.test(ascii(0, 80)) && /facet|endsolid/i.test(ascii(0, Math.min(bytes.length, 2048)))) return true;
      if (totalLength < 134) return false;
      const tris = b(80) + b(81) * 256 + b(82) * 65536 + b(83) * 16777216;
      return tris > 0 && 84 + tris * 50 === totalLength;
    }
    case "jpg": case "jpeg": return b(0) === 0xFF && b(1) === 0xD8 && b(2) === 0xFF;
    case "png": return b(0) === 0x89 && ascii(1, 3) === "PNG";
    case "webp": return ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP";
    case "heic": return ascii(4, 4) === "ftyp";
    case "pdf": return ascii(0, 5) === "%PDF-";
    case "docx": return b(0) === 0x50 && b(1) === 0x4B && b(2) === 0x03 && b(3) === 0x04;
    case "doc": return b(0) === 0xD0 && b(1) === 0xCF && b(2) === 0x11 && b(3) === 0xE0;
  }
  return false;
}

function clean(v, max) { return String(v == null ? "" : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, max || 500); }
function digits(v) { return String(v || "").replace(/\D/g, ""); }
function validPhone(p) { return /^(91)?[6-9]\d{9}$/.test(p) || /^\d{11,15}$/.test(p) && !/^91/.test(p); }
function countLinks(s) { return (String(s).match(/https?:\/\//gi) || []).length; }
function safeName(n) { return String(n || "file").replace(/[^\w.\- ]+/g, "_").replace(/\s+/g, " ").slice(-80); }
// Sheets treats text starting with = + - @ as a formula; keep it as plain text
function cell(v) { const s = String(v == null ? "" : v); return /^[=+\-@]/.test(s) ? "'" + s : s; }
function makeRef(prefix) {
  const t = new Date(), pad = (n) => ("0" + n).slice(-2);
  const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
  return prefix + "-" + pad(t.getDate()) + pad(t.getMonth() + 1) + "-" + rand;
}

/* ------------------------- Limits ------------------------- */
function takeQuota_(b, uploadBytes) {
  const cache = CacheService.getScriptCache(), props = PropertiesService.getScriptProperties();
  const minuteKey = "m" + Math.floor(Date.now() / 60000);
  const perMin = Number(cache.get(minuteKey) || 0);
  if (perMin >= SETTINGS.maxPerMinute) return { ok: false, error: "busy", message: "We're getting a lot of requests. Please try again in a minute." };

  const phoneKey = "p" + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, digits(b.fields.phone))).slice(0, 20);
  const perPhone = Number(cache.get(phoneKey) || 0);
  if (perPhone >= SETTINGS.maxPerPhonePerHour) return { ok: false, error: "phone-limit", message: "You've sent a few already. We'll reply soon, or WhatsApp us." };

  const day = Utilities.formatDate(new Date(), "Asia/Kolkata", "yyyyMMdd");
  const used = JSON.parse(props.getProperty("day") || "{}");
  const today = used.d === day ? used : { d: day, n: 0, mb: 0 };
  if (today.n >= SETTINGS.maxPerDay) return { ok: false, error: "day-limit", message: "We've hit today's limit. Please WhatsApp us instead." };
  const mb = uploadBytes / 1048576;
  b._noFiles = today.mb + mb > SETTINGS.maxUploadMbPerDay;   // over the daily upload budget: save the entry, skip the files

  today.n++; if (!b._noFiles) today.mb += mb;
  props.setProperty("day", JSON.stringify(today));
  cache.put(minuteKey, String(perMin + 1), 120);
  cache.put(phoneKey, String(perPhone + 1), 3600);
  return { ok: true };
}

function driveFull_() {
  try { return DriveApp.getStorageUsed() / DriveApp.getStorageLimit() * 100 >= SETTINGS.stopUploadsAtPct; }
  catch (e) { return false; }
}

/* ------------------------- Saving ------------------------- */
function saveFiles_(b, ref, files) {
  const out = { links: [], skipped: 0, reason: "" };
  if (!files.length) return out;
  if (b._noFiles || driveFull_()) {
    out.skipped = files.length; out.reason = b._noFiles ? "daily upload limit" : "Drive almost full";
    alertOnce_("Uploads paused: " + out.reason, "New files are not being saved to Drive (" + out.reason + "). Entries still arrive in the sheet. Free up space in Drive or raise the limit in SETTINGS.");
    return out;
  }
  const root = DriveApp.getFolderById(PropertiesService.getScriptProperties().getProperty("FOLDER_ID"));
  const month = Utilities.formatDate(new Date(), "Asia/Kolkata", "yyyy-MM");
  const folder = child_(child_(root, b.form === "careers" ? "Careers" : "Quotes"), month);
  files.forEach((f) => {
    const bytes = Utilities.base64Decode(f.data);
    if (!looksLike(f.ext, bytes.slice(0, 2048), bytes.length)) { out.skipped++; out.reason = "file didn't match its type"; return; }
    const blob = Utilities.newBlob(bytes, mimeFor_(f.ext), ref + " · " + f.name);
    const file = folder.createFile(blob);        // private: only the MakeMeProto account can open it
    file.setDescription(ref + " · " + clean(b.fields.name, 80) + " · " + digits(b.fields.phone));
    out.links.push(file.getUrl());
  });
  return out;
}

function child_(parent, name) {
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

function mimeFor_(ext) {
  return ({ stl: "model/stl", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic",
    pdf: "application/pdf", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" })[ext] || "application/octet-stream";
}

function appendRow_(b, ref, saved) {
  const f = b.fields || {}, c = (k, n) => cell(clean(f[k], n || 500));
  const when = Utilities.formatDate(new Date(), "Asia/Kolkata", "dd MMM yyyy, HH:mm");
  const files = saved.links.join("\n") + (saved.skipped ? (saved.links.length ? "\n" : "") + "⚠️ " + saved.skipped + " file(s) not saved: " + saved.reason : "");
  const source = cell(clean(b.source, 80));
  const phone = cell(digits(f.phone));
  const row = {
    quote:   [when, ref, "New", c("name", 80), phone, c("material", 20), c("infill", 10), c("colour", 20), c("quantity", 10), c("weight", 20), c("size", 40), c("estimate", 40), c("notes", 1000), files, source],
    contact: [when, ref, "New", c("name", 80), phone, c("service", 60), c("message", 2000), source],
    careers: [when, ref, "New", c("role", 60), c("name", 80), phone, c("email", 120), c("city", 60), c("portfolio", 300), c("why", 1500), files, source],
  }[b.form];
  const ss = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty("SHEET_ID"));
  ss.getSheetByName(TAB_TITLES[b.form]).appendRow(row);
}

function notify_(b, ref, saved) {
  if (!SETTINGS.notifyEmail) return;
  try {
    const f = b.fields || {}, phone = digits(f.phone), wa = "https://wa.me/" + (phone.length === 10 ? "91" + phone : phone);
    const lines = Object.keys(f).filter((k) => clean(f[k])).map((k) => k + ": " + clean(f[k], 1000));
    const ss = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty("SHEET_ID"));
    MailApp.sendEmail({
      to: SETTINGS.notifyEmail,
      subject: "🧾 New " + TAB_TITLES[b.form].replace(/s$/, "") + " · " + ref + " · " + clean(f.name, 40) + (/test|localhost|github\.io|file/i.test(String(b.source)) ? " [TEST]" : ""),
      body: lines.join("\n") + "\n\nFiles:\n" + (saved.links.join("\n") || "none") + (saved.skipped ? "\n⚠️ " + saved.skipped + " not saved: " + saved.reason : "") +
        "\n\nReply on WhatsApp: " + wa + "\nSheet: " + ss.getUrl() + "\nFrom: " + clean(b.source, 80),
    });
  } catch (e) { console.warn("mail", e); }
}

function alertOnce_(subject, body) {
  if (!SETTINGS.notifyEmail) return;
  const cache = CacheService.getScriptCache(), key = "alert" + subject;
  if (cache.get(key)) return;
  cache.put(key, "1", 21600);
  try { MailApp.sendEmail(SETTINGS.notifyEmail, "⚠️ MakeMeProto forms: " + subject, body); } catch (e) {}
}

/* ------------------------- Daily clean-up ------------------------- */
function cleanup() {
  const id = PropertiesService.getScriptProperties().getProperty("FOLDER_ID");
  if (!id) return;
  const root = DriveApp.getFolderById(id);
  [["Quotes", SETTINGS.keepDays.quote], ["Careers", SETTINGS.keepDays.careers]].forEach(([name, days]) => {
    const it = root.getFoldersByName(name);
    if (!it.hasNext()) return;
    const cutoff = Date.now() - days * 86400000;
    const months = it.next().getFolders();
    while (months.hasNext()) {
      const files = months.next().getFiles();
      while (files.hasNext()) { const f = files.next(); if (f.getDateCreated().getTime() < cutoff && !f.isStarred()) f.setTrashed(true); }
    }
  });
  if (driveFull_()) alertOnce_("Drive almost full", "Your Google Drive is over " + SETTINGS.stopUploadsAtPct + "% full, so website uploads are paused. Star files you want to keep, delete old ones, or empty the trash.");
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

if (typeof module !== "undefined") module.exports = { checkEntry, looksLike, validPhone, cell, safeName, makeRef, SETTINGS };
