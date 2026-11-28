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
  siteUrl: "https://makemeproto.com",       // used in newsletter emails (welcome + unsubscribe link)
  sendWelcome: true,                        // email new newsletter subscribers a welcome note
  notifyOnSubscribe: false,                 // also email you for every new subscriber
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
    newsletter: {},
  },
  maxFilesPerEntry: 2,
};

const TABS = {
  quote:   ["Received", "Reference", "Status", "Customer name", "WhatsApp number", "Material", "Infill density", "Colour", "Quantity", "Estimated weight", "Dimensions", "Website estimate", "Customer notes", "Attachments", "Submitted from",
            "Customer update", "Courier", "Tracking number", "Expected by", "Photos"],   // update…expected and photos are shown to the customer on the Track order page
  contact: ["Received", "Reference", "Status", "Customer name", "Phone number", "Service required", "Message", "Submitted from"],
  careers: ["Received", "Reference", "Status", "Position", "Applicant name", "Phone number", "Email address", "City", "Portfolio link", "Cover note", "Attachments", "Submitted from"],
  newsletter: ["Subscribed", "Reference", "Status", "Email address", "First name", "Interests", "Language", "Submitted from", "Unsubscribe key"],
};
const HEADER_VERSION = "8";

/* Order stages the customer sees on the Track order page. Pick one from the Status dropdown in the Quotes tab. */
const ORDER_STATUSES = ["New", "Quote sent", "Confirmed", "Printing", "Ready", "Shipped", "Delivered", "On hold", "Cancelled"];   // bump when the headers above change; the sheet is updated on the next entry
const TAB_TITLES = { quote: "Quotes", contact: "Contact", careers: "Careers", newsletter: "Subscribers" };
const PREFIX = { quote: "Q", contact: "C", careers: "J", newsletter: "N" };

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
    if (body && body.form === "admin") return json_(admin_(body));       // the MakeMeProto Ops app
    if (body && body.form === "track") return json_(track_(body));
    if (body && body.form === "gallery") return json_(gallery_());           // the website's Gallery page
    if (body && body.form === "pricing") return json_(pricing_());           // the website's price calculator and material cards
    if (body && body.form === "release") return json_(release_(body));       // a new app version from GitHub Actions
    const check = checkEntry(body, SETTINGS);
    if (check.silent) return json_({ ok: true, ref: makeRef(PREFIX[body.form] || "X") });   // a bot: pretend it worked, save nothing
    if (!check.ok) return json_(check);

    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    let limit;
    try { limit = takeQuota_(body, check.uploadBytes); } finally { lock.releaseLock(); }
    if (!limit.ok) return json_(limit);

    if (body.form === "newsletter") return json_(subscribe_(body));
    if (body.form === "unsubscribe") return json_(unsubscribe_(body));

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
  if (!b || !(TABS[b.form] || b.form === "unsubscribe")) return bad("form", "Unknown form.");
  if (b.website) return { ok: false, silent: true };                       // honeypot field, humans never see it
  const f = b.fields || {};
  if (b.form === "unsubscribe") {                                          // one click from an email link
    return /^[A-Za-z0-9]{16,64}$/.test(String(f.key || "")) ? { ok: true, files: [], uploadBytes: 0 } : bad("key", "This unsubscribe link isn't valid. Please email us and we'll remove you.");
  }
  if (!(Number(b.elapsed) >= S.minSecondsOnForm * 1000)) return bad("fast", "That was quick! Please try again.");
  if (b.form === "newsletter") {
    if (!validEmail(f.email)) return bad("email", "That email doesn't look right.");
    if (countLinks(JSON.stringify(f)) > 0) return bad("spam", "Links aren't allowed here.");
    return { ok: true, files: [], uploadBytes: 0 };
  }
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
function validEmail(v) { const e = String(v || "").trim(); return e.length <= 120 && /^[^\s@<>",;]+@[^\s@<>",;]+\.[a-z]{2,}$/i.test(e); }
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

  const who = b.form === "newsletter" ? String(b.fields.email || "").toLowerCase().trim() : b.form === "unsubscribe" ? String(b.fields.key || "") : digits(b.fields.phone);
  const phoneKey = "p" + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, who)).slice(0, 20);
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
  const out = { links: [], files: [], skipped: 0, reason: "" };
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
    out.files.push({ name: f.name, url: file.getUrl(), kb: Math.max(1, Math.round(bytes.length / 1024)) });
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
  ensureHeaders_(ss);
  ss.getSheetByName(TAB_TITLES[b.form]).appendRow(row);
}

// Keeps the header row in step with TABS (same column order, clearer names)
function ensureHeaders_(ss) {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty("HEADERS") === HEADER_VERSION) return;
  const all = Object.assign({}, TABS, ADMIN_TABS), titles = Object.assign({}, TAB_TITLES, ADMIN_TAB_TITLES);
  Object.keys(all).forEach((form) => {
    const sh = ss.getSheetByName(titles[form]) || ss.insertSheet(titles[form]);
    sh.getRange(1, 1, 1, all[form].length).setValues([all[form]]).setFontWeight("bold").setBackground("#FFE4D6");
    sh.setFrozenRows(1);
    if (form === "quote") {
      sh.getRange(2, 3, Math.max(sh.getMaxRows() - 1, 1), 1).setDataValidation(
        SpreadsheetApp.newDataValidation().requireValueInList(ORDER_STATUSES, true).setAllowInvalid(true).build());
      sh.getRange(1, 16, 1, 4).setBackground("#DFF5EC").setNote("Shown to the customer on the Track order page");
    }
  });
  props.setProperty("HEADERS", HEADER_VERSION);
}

function notify_(b, ref, saved) {
  if (!SETTINGS.notifyEmail) return;
  let mail;
  try {
    const ss = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty("SHEET_ID"));
    const when = Utilities.formatDate(new Date(), "Asia/Kolkata", "EEE d MMM yyyy, h:mm a");
    mail = buildEmail(b, ref, saved, ss.getUrl() + "#gid=" + ss.getSheetByName(TAB_TITLES[b.form]).getSheetId(), when);
    MailApp.sendEmail({ to: SETTINGS.notifyEmail, subject: mail.subject, body: mail.text, htmlBody: mail.html });   // no custom sender name or reply-to: from a Gmail account those look like spoofing to spam filters
  } catch (e) {
    logProblem_("Email (designed) failed for " + ref, e);
    try {   // fall back to a plain email so the alert still arrives
      MailApp.sendEmail(SETTINGS.notifyEmail, (mail && mail.subject) || ("New entry " + ref), (mail && mail.text) || JSON.stringify(b.fields || {}, null, 2));
    } catch (e2) { logProblem_("Email (plain) failed for " + ref, e2); }
  }
}

// Problems go to a "Log" tab in the sheet, so nothing fails silently
function logProblem_(what, err) {
  console.warn(what, err);
  try {
    const ss = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty("SHEET_ID"));
    const sh = ss.getSheetByName("Log") || ss.insertSheet("Log");
    if (sh.getLastRow() === 0) sh.appendRow(["When", "What", "Details"]);
    sh.appendRow([Utilities.formatDate(new Date(), "Asia/Kolkata", "dd MMM yyyy, HH:mm"), what, String(err && err.message || err)]);
  } catch (e) {}
}

/* Run this from the editor (pick "testEmail" → Run) to check alert emails arrive.
   It sends one sample quote email and shows how many emails you can still send today. */
function testEmail() {
  Logger.log("Emails left today: " + MailApp.getRemainingDailyQuota());
  notify_({ form: "quote", source: "makemeproto.com", fields: { name: "Test Customer", phone: "9876543210", material: "PLA", infill: "20%", colour: "Orange",
    quantity: 1, weight: "50 g", size: "60 × 40 × 30 mm", estimate: "₹300", notes: "This is a test email from testEmail()." } }, "Q-TEST", { links: [], files: [], skipped: 0 });
  Logger.log("Sent to " + SETTINGS.notifyEmail + ". Check the inbox and the spam folder. Problems, if any, are in the sheet's Log tab.");
}

/* ------------------------- The alert email (pure, previewed in tests) ------------------------- */
const MAIL_KIND = {
  quote:   { title: "New quote request", emoji: "🧾", color: "#FF5A1F" },
  contact: { title: "New message",       emoji: "👋", color: "#3557FF" },
  careers: { title: "New job application", emoji: "💼", color: "#7A3FE6" },
};
const MAIL_LABELS = {
  quote:   [["phone", "WhatsApp number"], ["material", "Material"], ["colour", "Colour"], ["quantity", "Quantity"], ["infill", "Infill density"], ["weight", "Estimated weight"], ["size", "Dimensions"], ["file", "STL file"], ["notes", "Customer notes"]],
  contact: [["phone", "Phone number"], ["service", "Service required"], ["message", "Message"]],
  careers: [["phone", "Phone number"], ["email", "Email address"], ["city", "City"], ["portfolio", "Portfolio"], ["why", "Cover note"]],
};

function buildEmail(b, ref, saved, sheetUrl, when) {
  const f = b.fields || {}, kind = MAIL_KIND[b.form], esc = (v) => String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const val = (k, n) => clean(f[k], n || 1500);
  const test = /test|localhost|github\.io|file/i.test(String(b.source));
  const name = val("name", 80), first = name.split(/\s+/)[0] || "there";
  const phone = digits(f.phone), intl = phone.length === 10 ? "91" + phone : phone;
  const pretty = phone.length === 10 ? "+91 " + phone.slice(0, 5) + " " + phone.slice(5) : "+" + phone;
  const hello = {
    quote: `Hi ${first}! 👋 MakeMeProto here. Thanks for your quote request (${ref}). `,
    contact: `Hi ${first}! 👋 MakeMeProto here, replying to your message (${ref}). `,
    careers: `Hi ${first}! 👋 MakeMeProto here. Thanks for applying for ${val("role", 60) || "a role"} (${ref}). `,
  }[b.form];
  const wa = "https://wa.me/" + intl + "?text=" + encodeURIComponent(hello);
  const files = saved.files || [];
  const subject = `${kind.emoji} ${kind.title} · ${name || "someone"} · ${ref}` + (b.form === "quote" && val("estimate") ? ` · ${val("estimate", 40)}` : "") + (test ? " [TEST]" : "");

  // rows of details
  const rows = MAIL_LABELS[b.form].filter(([k]) => val(k)).map(([k, label]) => {
    let v = esc(val(k));
    if (k === "phone") v = `<a href="${wa}" style="color:#0b6a45;text-decoration:none;font-weight:600">${esc(pretty)}</a>`;
    else if (k === "email") v = `<a href="mailto:${esc(val(k))}" style="color:#1a1a1a">${v}</a>`;
    else if (k === "portfolio" && /^https?:\/\//i.test(val(k))) v = `<a href="${esc(val(k))}" style="color:#1a1a1a">${v}</a>`;
    else v = v.replace(/\n/g, "<br>");
    return `<tr><td style="padding:10px 0;border-bottom:1px solid #EFE8DA;width:120px;vertical-align:top;font:600 11px/1.4 Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#8a857a">${label}</td>
      <td style="padding:10px 0;border-bottom:1px solid #EFE8DA;vertical-align:top;font:15px/1.5 Arial,sans-serif;color:#1a1a1a">${v}</td></tr>`;
  }).join("");

  const highlight = b.form === "quote" && val("estimate") ? `
    <tr><td style="padding:0 28px 6px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#141414;border-radius:14px"><tr><td style="padding:18px 20px">
        <div style="font:600 11px/1 Arial,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#a8a296">Website estimate</div>
        <div style="font:800 30px/1.2 Arial,sans-serif;color:#FF5A1F;margin-top:6px">${esc(val("estimate", 40))}</div>
        <div style="font:13px/1.4 Arial,sans-serif;color:#d9d3c7;margin-top:4px">${esc([val("quantity") && val("quantity") + " ×", val("material"), val("infill") && val("infill") + " infill", val("weight")].filter(Boolean).join(" · "))}</div>
      </td></tr></table>
    </td></tr>` : "";

  const fileList = files.length || saved.skipped ? `
    <tr><td style="padding:18px 28px 0">
      <div style="font:600 11px/1 Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#8a857a;margin-bottom:10px">Attachments</div>
      ${files.map((x) => `<a href="${esc(x.url)}" style="display:block;margin:0 0 8px;padding:12px 14px;border:1.5px solid #EFE8DA;border-radius:12px;background:#FBF8F2;text-decoration:none;color:#1a1a1a;font:14px/1.3 Arial,sans-serif">
        📎 <b>${esc(x.name)}</b> <span style="color:#8a857a">· ${x.kb >= 1024 ? (x.kb / 1024).toFixed(1) + " MB" : x.kb + " KB"} · open in Drive →</span></a>`).join("")}
      ${saved.skipped ? `<div style="padding:12px 14px;border-radius:12px;background:#FFF1E8;color:#b4400f;font:14px/1.4 Arial,sans-serif">⚠️ ${saved.skipped} file(s) not saved: ${esc(saved.reason)}</div>` : ""}
    </td></tr>` : "";

  const btn = (href, text, bg, fg) => `<a href="${href}" style="display:inline-block;margin:0 8px 8px 0;padding:13px 20px;border-radius:999px;background:${bg};color:${fg};font:700 14px/1 Arial,sans-serif;text-decoration:none">${text}</a>`;

  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;padding:0;background:#F6F1E7">
<div style="display:none;max-height:0;overflow:hidden">${esc(name)} · ${esc(b.form === "quote" ? val("estimate", 40) || "quote request" : b.form === "careers" ? val("role", 60) : val("service", 60))} · ${esc(ref)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F1E7"><tr><td align="center" style="padding:28px 12px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">
    <tr><td style="padding:0 6px 14px;font:800 22px/1 Arial,sans-serif;color:#141414">make<span style="color:#FF5A1F">me</span>proto
      ${test ? `<span style="display:inline-block;vertical-align:middle;margin-left:8px;padding:5px 9px;border-radius:999px;background:#FFE58A;color:#5c4a00;font:700 10px/1 Arial,sans-serif;letter-spacing:.08em">TEST SITE</span>` : ""}</td></tr>
    <tr><td style="background:#ffffff;border-radius:20px;border:1px solid #E8E0CF;overflow:hidden">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="height:6px;background:${kind.color};font-size:0;line-height:0">&nbsp;</td></tr>
        <tr><td style="padding:26px 28px 18px">
          <div style="display:inline-block;padding:6px 11px;border-radius:999px;background:${kind.color}1A;color:${kind.color};font:700 12px/1 Arial,sans-serif">${kind.emoji} ${kind.title}</div>
          <div style="font:800 26px/1.25 Arial,sans-serif;color:#141414;margin-top:14px">${esc(name) || "New visitor"}</div>
          ${b.form === "careers" && val("role") ? `<div style="font:15px/1.4 Arial,sans-serif;color:#4a4740;margin-top:4px">Applied for the <b>${esc(val("role", 60))}</b> position</div>` : ""}
          <div style="font:13px/1.4 Arial,sans-serif;color:#8a857a;margin-top:6px">Ref <b style="color:#141414;font-family:Consolas,Menlo,monospace">${esc(ref)}</b> · ${esc(when)}</div>
        </td></tr>
        ${highlight}
        <tr><td style="padding:12px 28px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table></td></tr>
        ${fileList}
        <tr><td style="padding:24px 28px 20px">
          ${btn(wa, "💬 Reply on WhatsApp", "#1FAF5A", "#ffffff")}${btn(esc(sheetUrl), "📊 Open in sheet", "#141414", "#ffffff")}
          <div style="font:12px/1.5 Arial,sans-serif;color:#8a857a;margin-top:6px">“Reply on WhatsApp” opens a chat with ${esc(first)}, with a greeting ready to send.</div>
        </td></tr>
      </table>
    </td></tr>
    <tr><td style="padding:16px 6px;font:12px/1.6 Arial,sans-serif;color:#a39d90">Submitted through the ${({ quote: "quote", contact: "contact", careers: "careers" })[b.form]} form on ${test ? "the test site (" + esc(clean(b.source, 80)) + ")" : "makemeproto.com"}.<br>Once you've replied, update the Status column in the sheet.</td></tr>
  </table>
</td></tr></table></body></html>`;

  const text = [`${kind.emoji} ${kind.title} · ${ref}${test ? " [TEST]" : ""}`, when, "", `${b.form === "careers" ? "Applicant name" : "Customer name"}: ${name}`, b.form === "careers" ? `Position: ${val("role", 60)}` : "",
    ...MAIL_LABELS[b.form].filter(([k]) => val(k)).map(([k, l]) => `${l}: ${k === "phone" ? pretty : val(k)}`),
    b.form === "quote" && val("estimate") ? `Website estimate: ${val("estimate", 40)}` : "",
    files.length ? "\nAttachments:\n" + files.map((x) => `${x.name}: ${x.url}`).join("\n") : "",
    saved.skipped ? `⚠️ ${saved.skipped} file(s) not saved: ${saved.reason}` : "",
    "", `Reply on WhatsApp: ${wa}`, `Open in sheet: ${sheetUrl}`].filter((x) => x !== "").join("\n");
  return { subject, html, text };
}

function alertOnce_(subject, body) {
  if (!SETTINGS.notifyEmail) return;
  const cache = CacheService.getScriptCache(), key = "alert" + subject;
  if (cache.get(key)) return;
  cache.put(key, "1", 21600);
  try { MailApp.sendEmail(SETTINGS.notifyEmail, "⚠️ MakeMeProto forms: " + subject, body); } catch (e) {}
}

/* =========================================================================================
   MakeMeProto Ops app (admin API)
   Only Google accounts listed in Script Properties can use it. Set these in
   Project Settings → Script properties (they are private and never in this public code):
     ADMIN_EMAILS           comma-separated, e.g. you@gmail.com,deepak@gmail.com
     GOOGLE_WEB_CLIENT_ID   the "Web application" OAuth client ID the app signs in with
   ========================================================================================= */
const ADMIN_TABS = {
  expenses:  ["ID", "Date", "Amount (₹)", "Category", "Paid by", "Payment method", "Note", "Added by", "Added at", "Split"],
  stock:     ["ID", "Material", "Colour", "Brand", "Spool size (g)", "Remaining (g)", "Low stock at (g)", "Note", "Updated", "Updated by", "Colour (hex)"],
  payments:  ["ID", "Date", "Amount (₹)", "Order ref", "Customer", "Phone", "Type", "Payment method", "Note", "Added by", "Added at"],
  documents: ["Number", "Type", "Date", "Order ref", "Customer", "Phone", "Items", "Subtotal (₹)", "Discount (₹)", "GST (₹)", "Total (₹)", "Created by", "Created at"],
  tasks:     ["ID", "Task", "Assigned to", "Due", "Status", "Order ref", "Note", "Created by", "Created at", "Done at"],
  jobs:      ["ID", "Job", "Order ref", "Printer", "Spool ID", "Filament (g)", "Print time (h)", "Status", "Position", "Started", "Finished", "Note", "Updated by"],
  media:     ["ID", "Date", "Type", "Title", "Caption", "File ID", "Kind", "On website", "Instagram", "LinkedIn", "Added by", "Added at"],
  supplies:  ["ID", "Item", "Unit", "Quantity", "Low stock at", "Cost per unit (₹)", "Note", "Updated", "Updated by", "Used per order"],
  printlog:  ["ID", "Date", "Printer", "Type", "Note", "Cost (₹)", "Added by", "Added at"],
};
const ADMIN_TAB_TITLES = { expenses: "Expenses", stock: "Filament stock", payments: "Payments", documents: "Quotes & invoices",
  tasks: "Tasks", jobs: "Print queue", media: "Media posts", supplies: "Supplies", printlog: "Printer log" };
const SERVICE_TYPES = ["Nozzle change", "Bed levelling", "Cleaning", "Lubrication", "Belt tension", "Repair", "Other"];
const ORDER_CHANNELS = ["WhatsApp", "Instagram", "Phone call", "Walk-in", "Email", "Other"];
const EXPENSE_CATEGORIES = ["Filament", "Printer & parts", "Packaging", "Courier", "Marketing", "Software & domains", "Tools", "Other"];
const PAY_METHODS = ["UPI", "Cash", "Card", "Bank transfer", "Other"];
const SETTLE_CATEGORY = "Settle up";   // money moved between people to clear a balance; never counted as spending
const PAYMENT_TYPES = ["Advance", "Full payment", "Balance", "Refund"];
const INBOX_STATUSES = ["New", "Replied", "Done", "Spam"];
const TASK_STATUSES = ["Open", "Done"];
const JOB_STATUSES = ["Queued", "Printing", "Done", "Failed"];
const GALLERY_TYPES = ["reel", "bts", "print", "vlog"];
const GALLERY_FOLDER = "Website gallery";   // inside the uploads folder; never cleaned up automatically
const DEFAULT_OPS_SETTINGS = {
  founders: ["Krishna", "Deepak"],
  printers: ["Printer 1"],
  // One price list for the website calculator and the app. rate = what the customer pays per gram, cost = what the filament costs us.
  materials: [
    { name: "PLA", rate: 5, cost: 2.5, density: 1.24, hex: "#FF5A1F", show: true, strength: 3, heat: 1, flex: 1,
      about: "Easy, accurate, many colours. Best for gifts, models, prototypes and display pieces." },
    { name: "PETG", rate: 6, cost: 3, density: 1.27, hex: "#1FBF8F", show: true, strength: 4, heat: 2, flex: 2,
      about: "Tough and water resistant. Good for brackets, outdoor parts and food-contact containers." },
    { name: "ABS", rate: 6, cost: 3, density: 1.04, hex: "#3B6CFF", show: true, strength: 4, heat: 4, flex: 2,
      about: "Heat resistant and machinable. For car parts, enclosures, jigs and functional parts." },
    { name: "TPU", rate: 8, cost: 4.5, density: 1.21, hex: "#141414", show: true, strength: 3, heat: 2, flex: 5,
      about: "Flexible like rubber. Phone cases, gaskets, grips, bumpers and wearable parts." },
    { name: "Silk PLA", rate: 6, cost: 3.5, density: 1.24, hex: "#C9A227", show: false, strength: 3, heat: 1, flex: 1,
      about: "Shiny, metallic look. Trophies, vases and decor." },
  ],
  // Filament wasted while printing (supports, purge, brim, failed starts) is added to the grams we charge for.
  wasteSmallPct: 30,      // small items waste more, relatively
  wasteLargePct: 25,
  smallUpToG: 100,        // items up to this many grams count as small
  gramsPerHour: 15,       // rough printer speed, for print-time estimates
  machinePerHour: 30,     // ₹ per print hour (electricity + wear), our cost only
  designPerHour: 300,     // ₹ per hour of 3D design work
  minPrice: 300,          // minimum order
  roundTo: 10,
  rates: {},              // filled from materials (₹ per gram it costs us), kept for older app versions
  gstPct: 0,              // 0 until you register for GST
  quoteValidDays: 7,
  business: { name: "MakeMeProto", phone: "", email: "contact@makemeproto.com", address: "Ahmedabad, Gujarat", gstin: "", upi: "" },
  serviceEveryHours: 150,   // remind to service a printer after this many print hours
  // WhatsApp messages the app fills in. {name} {ref} {link} {courier} {tracking} are replaced.
  templates: {
    "New": "Hi {name}! MakeMeProto here, about your request {ref}.",
    "Quote sent": "Hi {name}! Your quote for order {ref} is ready. Shall we go ahead?",
    "Confirmed": "Hi {name}! Your order {ref} is confirmed. We'll start printing soon.\n\nTrack it any time: {link}",
    "Printing": "Hi {name}! Your order {ref} is on the printer now.\n\nTrack it any time: {link}",
    "Ready": "Hi {name}! Your order {ref} is ready. Pickup or delivery?\n\nTrack it any time: {link}",
    "Shipped": "Hi {name}! Your order {ref} is on its way with {courier} (tracking no. {tracking}).\n\nTrack it any time: {link}",
    "Delivered": "Hi {name}! Hope you love your print! Could you share a photo or a quick Google review? It helps us a lot.",
  },
};
const SESSION_DAYS = 30;

function admin_(b) {
  const action = String(b.action || "");
  if (action === "login") return adminLogin_(b);
  const who = adminSession_(b.session);
  if (!who) return { ok: false, error: "auth", message: "Please sign in again." };
  if (action === "logout") { PropertiesService.getScriptProperties().deleteProperty(sessionKey_(b.session)); return { ok: true }; }
  const ss = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty("SHEET_ID"));
  ensureHeaders_(ss);
  const d = b.data || {};
  if (action === "all") return adminAll_(ss, who);
  return adminAction_(ss, action, d, who);
}

// Everything the app shows, in one request. The app used to send 14 at once; Google slows those down
// (20+ seconds each) and some failed, leaving screens blank. One failed part doesn't stop the rest.
const ALL_PARTS = ["settings", "summary", "orders", "inbox", "expenses", "stock", "payments", "documents", "tasks", "jobs", "media", "supplies", "printerLog", "appVersion"];
function adminAll_(ss, who) {
  const parts = {}, failed = [];
  ALL_PARTS.forEach((p) => {
    try {
      const r = adminAction_(ss, p, {}, who);
      if (r && r.ok) parts[p] = r; else failed.push(p);
    } catch (e) { console.error("all/" + p, e); failed.push(p); }
  });
  return { ok: true, parts: parts, failed: failed };
}

function adminAction_(ss, action, d, who) {
  switch (action) {
    case "me": return { ok: true, email: who.email, name: who.name };
    case "summary": return adminSummary_(ss);
    case "orders": { const orders = rows_(ss, TAB_TITLES.quote, TABS.quote.length, 400).map(orderOut_); return { ok: true, orders: orders, money: orderMoney_(ss, orders) }; }
    case "updateOrder": return adminUpdateOrder_(ss, d, who);
    case "inbox": return { ok: true, messages: rows_(ss, TAB_TITLES.contact, TABS.contact.length, 300).map(messageOut_),
      applications: rows_(ss, TAB_TITLES.careers, TABS.careers.length, 300).map(applicationOut_) };
    case "setInboxStatus": return adminInboxStatus_(ss, d);
    case "expenses": return { ok: true, expenses: rows_(ss, ADMIN_TAB_TITLES.expenses, ADMIN_TABS.expenses.length, 2000).map(expenseOut_),
      categories: EXPENSE_CATEGORIES, methods: PAY_METHODS };
    case "addExpense": return adminAddExpense_(ss, d, who);
    case "updateExpense": return adminUpdateExpense_(ss, d, who);
    case "deleteExpense": return adminDeleteById_(ss, ADMIN_TAB_TITLES.expenses, d.id);
    case "stock": return { ok: true, spools: rows_(ss, ADMIN_TAB_TITLES.stock, ADMIN_TABS.stock.length, 500).map(spoolOut_) };
    case "saveSpool": return adminSaveSpool_(ss, d, who);
    case "deleteSpool": return adminDeleteById_(ss, ADMIN_TAB_TITLES.stock, d.id);
    case "settings": return { ok: true, settings: opsSettings_() };
    case "saveSettings": return adminSaveSettings_(d);
    case "payments": return { ok: true, payments: rows_(ss, ADMIN_TAB_TITLES.payments, ADMIN_TABS.payments.length, 3000).map(paymentOut_) };
    case "addPayment": return adminAddPayment_(ss, d, who);
    case "deletePayment": return adminDeleteById_(ss, ADMIN_TAB_TITLES.payments, d.id);
    case "documents": return { ok: true, documents: rows_(ss, ADMIN_TAB_TITLES.documents, ADMIN_TABS.documents.length, 1000).map(documentOut_) };
    case "issueDocument": return adminIssueDocument_(ss, d, who);
    case "tasks": return { ok: true, tasks: rows_(ss, ADMIN_TAB_TITLES.tasks, ADMIN_TABS.tasks.length, 1000).map(taskOut_) };
    case "saveTask": return adminSaveTask_(ss, d, who);
    case "deleteTask": return adminDeleteById_(ss, ADMIN_TAB_TITLES.tasks, d.id);
    case "jobs": return { ok: true, jobs: rows_(ss, ADMIN_TAB_TITLES.jobs, ADMIN_TABS.jobs.length, 500).map(jobOut_) };
    case "saveJob": return adminSaveJob_(ss, d, who);
    case "jobStatus": return adminJobStatus_(ss, d, who);
    case "moveJob": return adminMoveJob_(ss, d);
    case "deleteJob": return adminDeleteById_(ss, ADMIN_TAB_TITLES.jobs, d.id);
    case "media": return { ok: true, media: rows_(ss, ADMIN_TAB_TITLES.media, ADMIN_TABS.media.length, 500).map(mediaOut_) };
    case "startUpload": return adminStartUpload_(d);
    case "addMedia": return adminAddMedia_(ss, d, who);
    case "updateMedia": return adminUpdateMedia_(ss, d);
    case "deleteMedia": return adminDeleteMedia_(ss, d);
    case "createOrder": return adminCreateOrder_(ss, d, who);
    case "addOrderPhoto": return adminOrderPhoto_(ss, d, true);
    case "removeOrderPhoto": return adminOrderPhoto_(ss, d, false);
    case "supplies": return { ok: true, supplies: rows_(ss, ADMIN_TAB_TITLES.supplies, ADMIN_TABS.supplies.length, 500).map(supplyOut_) };
    case "saveSupply": return adminSaveSupply_(ss, d, who);
    case "deleteSupply": return adminDeleteById_(ss, ADMIN_TAB_TITLES.supplies, d.id);
    case "printerLog": return { ok: true, log: rows_(ss, ADMIN_TAB_TITLES.printlog, ADMIN_TABS.printlog.length, 1000).map(logOut_) };
    case "addLog": return adminAddLog_(ss, d, who);
    case "deleteLog": return adminDeleteById_(ss, ADMIN_TAB_TITLES.printlog, d.id);
    case "appVersion": return { ok: true, release: appRelease_() };
  }
  return { ok: false, error: "action", message: "Unknown action." };
}

/* ---- sign-in: Google ID token → our own 30-day session ---- */
function adminLogin_(b) {
  const props = PropertiesService.getScriptProperties(), cache = CacheService.getScriptCache();
  const tries = Number(cache.get("loginTries") || 0);
  if (tries > 30) return { ok: false, error: "busy", message: "Too many sign-in attempts. Try again in 10 minutes." };
  cache.put("loginTries", String(tries + 1), 600);
  const clientId = String(props.getProperty("GOOGLE_WEB_CLIENT_ID") || "").trim();
  const admins = String(props.getProperty("ADMIN_EMAILS") || "").toLowerCase().split(/[,\s]+/).filter(Boolean);
  if (!clientId || !admins.length) return { ok: false, error: "setup", message: "The app isn't set up yet: add ADMIN_EMAILS and GOOGLE_WEB_CLIENT_ID in Script properties." };
  const token = String(b.idToken || "");
  if (!/^[\w-]+\.[\w-]+\.[\w-]+$/.test(token)) return { ok: false, error: "token", message: "Sign-in failed. Please try again." };
  const res = UrlFetchApp.fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(token), { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) return { ok: false, error: "token", message: "Google couldn't confirm this sign-in. Please try again." };
  const info = JSON.parse(res.getContentText());
  const check = checkGoogleToken(info, clientId, admins, Date.now());
  if (!check.ok) return check;
  // tidy up expired sessions, then start a new one
  const now = Date.now(), all = props.getProperties();
  Object.keys(all).filter((k) => k.indexOf("S_") === 0).forEach((k) => { try { if (JSON.parse(all[k]).exp < now) props.deleteProperty(k); } catch (e) { props.deleteProperty(k); } });
  const session = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, "");
  const exp = now + SESSION_DAYS * 86400000;
  props.setProperty(sessionKey_(session), JSON.stringify({ email: check.email, name: check.name, exp: exp }));
  return { ok: true, session: session, email: check.email, name: check.name, expires: exp };
}

// pure: is this Google token for our app, fresh, verified, and one of our admins?
function checkGoogleToken(info, clientId, admins, now) {
  const email = String(info.email || "").toLowerCase();
  if (info.aud !== clientId) return { ok: false, error: "token", message: "This sign-in is for a different app." };
  if (["accounts.google.com", "https://accounts.google.com"].indexOf(info.iss) < 0) return { ok: false, error: "token", message: "Sign-in failed. Please try again." };
  if (!(Number(info.exp) * 1000 > now)) return { ok: false, error: "token", message: "Sign-in expired. Please try again." };
  if (String(info.email_verified) !== "true") return { ok: false, error: "token", message: "This Google account's email isn't verified." };
  if (admins.indexOf(email) < 0) return { ok: false, error: "not-admin", message: email + " isn't allowed to use MakeMeProto Ops." };
  return { ok: true, email: email, name: String(info.name || info.given_name || email.split("@")[0]) };
}

function sessionKey_(session) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(session || ""));
  return "S_" + bytes.map((x) => ("0" + ((x + 256) % 256).toString(16)).slice(-2)).join("");
}
function adminSession_(session) {
  if (!/^[a-f0-9]{64}$/.test(String(session || ""))) return null;
  const raw = PropertiesService.getScriptProperties().getProperty(sessionKey_(session));
  if (!raw) return null;
  try { const s = JSON.parse(raw); return s.exp > Date.now() ? s : null; } catch (e) { return null; }
}

/* ---- reading and writing rows ---- */
function rows_(ss, title, width, limit) {
  const sh = ss.getSheetByName(title), last = sh ? sh.getLastRow() : 0;
  if (last < 2) return [];
  const first = Math.max(2, last - limit + 1);
  const vals = sh.getRange(first, 1, last - first + 1, width).getValues();
  return vals.map((v, i) => ({ row: first + i, v: v })).filter((r) => r.v.some((x) => x !== "")).reverse();   // newest first
}
function txt_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, "Asia/Kolkata", "dd MMM yyyy, HH:mm").replace(", 00:00", "");
  return String(v == null ? "" : v).trim();
}
function day_(v) { return v instanceof Date ? Utilities.formatDate(v, "Asia/Kolkata", "yyyy-MM-dd") : String(v || "").trim(); }
function pct_(v) { return typeof v === "number" ? Math.round(v * (v <= 1 ? 100 : 1)) + "%" : txt_(v); }
function links_(v) { return String(v || "").split("\n").map((x) => x.trim()).filter((x) => /^https:\/\//.test(x)); }
function findRow_(sh, col, value) {
  const last = sh.getLastRow();
  if (last < 2) return 0;
  const vals = sh.getRange(2, col, last - 1, 1).getValues();
  for (let i = vals.length - 1; i >= 0; i--) if (String(vals[i][0]).trim().toUpperCase() === String(value).trim().toUpperCase()) return i + 2;
  return 0;
}
function shortId_(prefix) { return prefix + "-" + Utilities.getUuid().replace(/-/g, "").slice(0, 8).toUpperCase(); }
function stamp_() { return Utilities.formatDate(new Date(), "Asia/Kolkata", "dd MMM yyyy, HH:mm"); }

function orderOut_(r) {
  const v = r.v;
  return { row: r.row, received: txt_(v[0]), ref: txt_(v[1]), status: txt_(v[2]) || "New", name: txt_(v[3]), phone: txt_(v[4]),
    material: txt_(v[5]), infill: pct_(v[6]), colour: txt_(v[7]), quantity: txt_(v[8]), weight: txt_(v[9]), size: txt_(v[10]),
    estimate: txt_(v[11]), notes: txt_(v[12]), files: links_(v[13]), filesNote: /⚠️/.test(String(v[13])) ? String(v[13]).split("\n").filter((x) => /⚠️/.test(x)).join(" ") : "",
    source: txt_(v[14]), update: txt_(v[15]), courier: txt_(v[16]), tracking: txt_(v[17]), expected: txt_(v[18]), photos: photoIds(v[19]) };
}
function messageOut_(r) {
  const v = r.v;
  return { kind: "contact", row: r.row, received: txt_(v[0]), ref: txt_(v[1]), status: txt_(v[2]) || "New", name: txt_(v[3]), phone: txt_(v[4]),
    service: txt_(v[5]), message: txt_(v[6]), source: txt_(v[7]) };
}
function applicationOut_(r) {
  const v = r.v;
  return { kind: "careers", row: r.row, received: txt_(v[0]), ref: txt_(v[1]), status: txt_(v[2]) || "New", role: txt_(v[3]), name: txt_(v[4]),
    phone: txt_(v[5]), email: txt_(v[6]), city: txt_(v[7]), portfolio: txt_(v[8]), why: txt_(v[9]), files: links_(v[10]), source: txt_(v[11]) };
}
function expenseOut_(r) {
  const v = r.v;
  return { id: txt_(v[0]), date: day_(v[1]), amount: Number(v[2]) || 0, category: txt_(v[3]), paidBy: txt_(v[4]), method: txt_(v[5]),
    note: txt_(v[6]), addedBy: txt_(v[7]), addedAt: txt_(v[8]), split: txt_(v[9]) };
}
function spoolOut_(r) {
  const v = r.v;
  return { id: txt_(v[0]), material: txt_(v[1]), colour: txt_(v[2]), brand: txt_(v[3]), spoolSize: Number(v[4]) || 0, remaining: Number(v[5]) || 0,
    lowAt: Number(v[6]) || 0, note: txt_(v[7]), updated: txt_(v[8]), updatedBy: txt_(v[9]), colourHex: txt_(v[10]) };
}

/* ---- actions ---- */
function adminSummary_(ss) {
  const orderRows = rows_(ss, TAB_TITLES.quote, TABS.quote.length, 400), orders = orderRows.map(orderOut_);
  const msgs = rows_(ss, TAB_TITLES.contact, TABS.contact.length, 300).map(messageOut_);
  const apps = rows_(ss, TAB_TITLES.careers, TABS.careers.length, 300).map(applicationOut_);
  const today = Utilities.formatDate(new Date(), "Asia/Kolkata", "yyyy-MM-dd"), month = today.slice(0, 7);
  const exps = rows_(ss, ADMIN_TAB_TITLES.expenses, ADMIN_TABS.expenses.length, 2000).map(expenseOut_);
  const pays = rows_(ss, ADMIN_TAB_TITLES.payments, ADMIN_TABS.payments.length, 3000).map(paymentOut_);
  const spools = rows_(ss, ADMIN_TAB_TITLES.stock, ADMIN_TABS.stock.length, 500).map(spoolOut_);
  const tasks = rows_(ss, ADMIN_TAB_TITLES.tasks, ADMIN_TABS.tasks.length, 1000).map(taskOut_);
  const jobRows = rows_(ss, ADMIN_TAB_TITLES.jobs, ADMIN_TABS.jobs.length, 500), jobs = jobRows.map(jobOut_);
  const supplies = rows_(ss, ADMIN_TAB_TITLES.supplies, ADMIN_TABS.supplies.length, 500).map(supplyOut_);
  const logRows = rows_(ss, ADMIN_TAB_TITLES.printlog, ADMIN_TABS.printlog.length, 1000);
  const ms = (v) => v instanceof Date ? v.getTime() : (Date.parse(String(v || "")) || 0);
  const service = serviceDue(
    jobRows.filter((r) => String(r.v[7]) === "Done").map((r) => ({ printer: txt_(r.v[3]), hours: Number(r.v[6]) || 0, finished: ms(r.v[10]) })),
    logRows.map((r) => ({ printer: txt_(r.v[2]), date: ms(r.v[1]) })),
    opsSettings_().serviceEveryHours);
  const money = orderMoney_(ss, orders, pays);
  const st = (o) => orderStage(o.status);
  const monthIncome = pays.filter((p) => p.date.slice(0, 7) === month).reduce((n, p) => n + p.amount, 0);
  const monthExpenses = exps.filter((e) => e.date.slice(0, 7) === month && e.category !== SETTLE_CATEGORY).reduce((n, e) => n + e.amount, 0);
  const ages = {};
  orderRows.forEach((r) => { if (r.v[0] instanceof Date) ages[txt_(r.v[1])] = (Date.now() - r.v[0].getTime()) / 86400000; });
  const reminders = buildReminders({ orders: orders, ages: ages, money: money, tasks: tasks, spools: spools, today: today, supplies: supplies, service: service });
  return { ok: true,
    newOrders: orders.filter((o) => o.status === "New").length,
    activeOrders: orders.filter((o) => st(o).state === "active" && st(o).stage >= 1 && st(o).stage <= 4).length,
    newMessages: msgs.filter((m) => m.status === "New").length + apps.filter((a) => a.status === "New").length,
    monthExpenses: monthExpenses,
    monthIncome: monthIncome,
    monthProfit: monthIncome - monthExpenses,
    toCollect: Object.keys(money).reduce((n, k) => n + (money[k].owed ? money[k].balance : 0), 0),
    lowStock: spools.filter((s) => s.lowAt > 0 && s.remaining <= s.lowAt).length + supplies.filter((s) => s.lowAt > 0 && s.quantity <= s.lowAt).length,
    openTasks: tasks.filter((t) => t.status !== "Done").length,
    printing: jobs.filter((j) => j.status === "Printing").length,
    queued: jobs.filter((j) => j.status === "Queued").length,
    reminders: reminders,
    recentOrders: orders.slice(0, 10).map((o) => ({ ref: o.ref, name: o.name, received: o.received, estimate: o.estimate, status: o.status })) };
}

/* Money per order: the latest invoice (or quote, or the website estimate) against payments received */
function orderMoney_(ss, orders, pays) {
  pays = pays || rows_(ss, ADMIN_TAB_TITLES.payments, ADMIN_TABS.payments.length, 3000).map(paymentOut_);
  const docs = rows_(ss, ADMIN_TAB_TITLES.documents, ADMIN_TABS.documents.length, 1000).map(documentOut_);
  return orderMoney(orders, docs, pays);
}
// pure
function orderMoney(orders, docs, pays) {
  const out = {};
  const amountOf = (s) => { const n = Number(String(s || "").replace(/[^\d.]/g, "")); return isFinite(n) ? n : 0; };
  orders.forEach((o) => {
    if (!o.ref) return;
    const mine = docs.filter((d) => d.ref === o.ref);   // newest first
    const inv = mine.filter((d) => d.type === "Invoice")[0], quote = mine.filter((d) => d.type === "Quote")[0];
    const total = inv ? inv.total : quote ? quote.total : amountOf(o.estimate);
    const paid = pays.filter((p) => p.ref === o.ref).reduce((n, p) => n + p.amount, 0);
    const stage = orderStage(o.status);
    const balance = Math.round((total - paid) * 100) / 100;
    out[o.ref] = { total: total, paid: paid, balance: balance, source: inv ? "invoice" : quote ? "quote" : "estimate",
      owed: (stage.state === "active" || stage.state === "delivered") && stage.stage >= 1 && balance > 0 && total > 0 };
  });
  return out;
}
// pure: what needs doing, as notification-ready reminders. key is stable so the same reminder isn't sent twice
function buildReminders(x) {
  const out = [], first = (n) => String(n || "the customer").trim().split(/\s+/)[0];
  x.orders.forEach((o) => {
    const age = x.ages[o.ref] || 0;
    if (o.status === "New" && age >= 1) out.push({ key: "new:" + o.ref, kind: "order", ref: o.ref, title: "Reply to " + first(o.name), text: o.ref + " has been waiting " + Math.floor(age) + " day" + (age >= 2 ? "s" : "") + "." });
    if (o.status === "Quote sent" && age >= 3) out.push({ key: "quote:" + o.ref, kind: "order", ref: o.ref, title: "Follow up with " + first(o.name), text: "No answer yet on the quote for " + o.ref + "." });
    const m = x.money[o.ref];
    if (m && m.owed && /Delivered|Ready|Shipped/.test(o.status)) out.push({ key: "pay:" + o.ref + ":" + m.balance, kind: "money", ref: o.ref, title: "Collect ₹" + Math.round(m.balance) + " from " + first(o.name), text: o.ref + " is " + o.status.toLowerCase() + " but not fully paid." });
  });
  x.tasks.forEach((t) => {
    if (t.status !== "Done" && t.due && t.due <= x.today) out.push({ key: "task:" + t.id + ":" + t.due, kind: "task", ref: t.id, title: (t.due < x.today ? "Overdue: " : "Due today: ") + t.title, text: t.assignee ? "For " + t.assignee + "." : "" });
  });
  x.spools.forEach((s) => {
    if (s.lowAt > 0 && s.remaining <= s.lowAt) out.push({ key: "stock:" + s.id, kind: "stock", ref: s.id, title: s.material + " " + s.colour + " is running low", text: s.remaining + " g left." });
  });
  (x.supplies || []).forEach((s) => {
    if (s.lowAt > 0 && s.quantity <= s.lowAt) out.push({ key: "supply:" + s.id + ":" + s.quantity, kind: "stock", ref: s.id, title: s.name + " is running low", text: s.quantity + " " + (s.unit || "left") + " left." });
  });
  (x.service || []).forEach((p) => {
    out.push({ key: "service:" + p.printer + ":" + Math.floor(p.hours / 50), kind: "print", ref: p.printer, title: "Service " + p.printer, text: Math.round(p.hours) + " print hours since the last service." });
  });
  return out.slice(0, 30);
}

function adminUpdateOrder_(ss, d, who) {
  const sh = ss.getSheetByName(TAB_TITLES.quote), row = findRow_(sh, 2, d.ref || "");
  if (!row) return { ok: false, error: "notfound", message: "Order " + d.ref + " wasn't found." };
  let changed = false;
  if (d.status != null) {
    if (ORDER_STATUSES.indexOf(String(d.status)) < 0) return { ok: false, error: "status", message: "Unknown status." };
    changed = String(sh.getRange(row, 3).getValue()) !== String(d.status);
    sh.getRange(row, 3).setValue(String(d.status));
  }
  [["update", 16, 500], ["courier", 17, 60], ["tracking", 18, 80], ["expected", 19, 40]].forEach(([k, col, max]) => {
    if (d[k] != null) sh.getRange(row, col).setValue(cell(clean(d[k], max)));
  });
  const order = orderOut_({ row: row, v: sh.getRange(row, 1, 1, TABS.quote.length).getValues()[0] });
  let auto = [];
  if (changed && who) { try { auto = autoForOrder_(ss, order, who); } catch (e) { console.error("auto", e); } }
  return { ok: true, order: order, auto: auto };
}

// pure: "85 g each", "85g", "1.2 kg" → grams per piece
function parseGrams(w) {
  const m = String(w || "").replace(/,/g, "").match(/(\d+(?:\.\d+)?)\s*(kg|g)?/i);
  if (!m) return 0;
  return Number(m[1]) * (/kg/i.test(m[2] || "") ? 1000 : 1);
}
// pure: the spool an order should print from: same material, colour name matching, most filament left
function matchSpool(spools, material, colour) {
  const mat = String(material || "").trim().toLowerCase(), col = String(colour || "").trim().toLowerCase();
  const same = spools.filter((s) => s.material.toLowerCase() === mat && s.remaining > 0);
  const byColour = col && col !== "not sure" ? same.filter((s) => s.colour.toLowerCase() === col || s.colour.toLowerCase().indexOf(col) >= 0 || col.indexOf(s.colour.toLowerCase()) >= 0) : [];
  const pick = (byColour.length ? byColour : []).sort((a, b) => b.remaining - a.remaining)[0];
  return pick || null;
}
// pure: what the automation should do for an order now in `status`, given what it already did (flags) and its jobs
function autoPlan(status, flags, jobs) {
  const open = jobs.filter((j) => j.status === "Queued" || j.status === "Printing");
  const plan = [];
  const stage = { "Confirmed": 1, "Printing": 2, "Ready": 3, "Shipped": 4, "Delivered": 4 }[status] || 0;
  if (stage >= 1 && !flags.job && !jobs.length) plan.push("addJob");
  if (stage === 2) plan.push("startJobs");
  if (stage >= 3) plan.push("finishJobs");
  if (stage >= 4 && !flags.packed) plan.push("pack");
  if (status === "Cancelled" && open.some((j) => j.status === "Queued")) plan.push("dropQueued");
  return plan;
}
function autoForOrder_(ss, o, who) {
  const props = PropertiesService.getScriptProperties(), key = "AUTO_" + o.ref;
  let flags = {};
  try { flags = JSON.parse(props.getProperty(key) || "{}"); } catch (e) { flags = {}; }
  const jobsOf = () => rows_(ss, ADMIN_TAB_TITLES.jobs, ADMIN_TABS.jobs.length, 500).map(jobOut_).filter((j) => j.ref.toUpperCase() === o.ref.toUpperCase());
  const plan = autoPlan(o.status, flags, jobsOf()), done = [];
  plan.forEach((step) => {
    if (step === "addJob") {
      const s = opsSettings_(), spools = rows_(ss, ADMIN_TAB_TITLES.stock, ADMIN_TABS.stock.length, 500).map(spoolOut_);
      const qty = Math.max(1, parseInt(o.quantity, 10) || 1), each = parseGrams(o.weight);
      const price = quotePrice(s, o.material, each, qty, 0, 0), spool = matchSpool(spools, o.material, o.colour);
      const r = adminSaveJob_(ss, { title: (o.name ? o.name + ": " : "") + qty + " × " + [o.material, o.colour !== "Not sure" ? o.colour : ""].filter(Boolean).join(" "),
        ref: o.ref, printer: s.printers[0], spoolId: spool ? spool.id : "", grams: Math.round(price.billedGrams * qty), hours: Math.round(price.hours * 10) / 10,
        note: "Added automatically when the order was confirmed." + (each ? "" : " Add the grams and hours from your slicer.") + (spool ? "" : " Pick the spool.") }, who);
      if (r.ok) { flags.job = r.id; done.push("Added to the print queue" + (spool ? " (" + spool.material + " " + spool.colour + ")" : "")); }
    }
    if (step === "startJobs") jobsOf().filter((j) => j.status === "Queued").forEach((j) => { adminJobStatus_(ss, { id: j.id, status: "Printing" }, who); done.push("Print job started"); });
    if (step === "finishJobs") jobsOf().filter((j) => j.status === "Queued" || j.status === "Printing").forEach((j) => {
      const r = adminJobStatus_(ss, { id: j.id, status: "Done" }, who);
      done.push(r.spool ? "Print job done, " + j.grams + " g taken off the spool" : "Print job done");
    });
    if (step === "pack") {
      const sh = ss.getSheetByName(ADMIN_TAB_TITLES.supplies);
      rows_(ss, ADMIN_TAB_TITLES.supplies, ADMIN_TABS.supplies.length, 500).map((r) => Object.assign(supplyOut_(r), { row: r.row })).filter((u) => u.perOrder > 0).forEach((u) => {
        const left = Math.max(0, u.quantity - u.perOrder);
        sh.getRange(u.row, 4).setValue(left);
        sh.getRange(u.row, 8, 1, 2).setValues([[stamp_(), who.email]]);
        done.push(u.perOrder + " " + u.unit + " " + u.name + " used");
      });
      flags.packed = true;
    }
    if (step === "dropQueued") jobsOf().filter((j) => j.status === "Queued").forEach((j) => { adminDeleteById_(ss, ADMIN_TAB_TITLES.jobs, j.id); done.push("Queued print job removed"); });
  });
  props.setProperty(key, JSON.stringify(flags));
  return done;
}

function adminInboxStatus_(ss, d) {
  const title = d.kind === "careers" ? TAB_TITLES.careers : TAB_TITLES.contact;
  if (INBOX_STATUSES.indexOf(String(d.status)) < 0) return { ok: false, error: "status", message: "Unknown status." };
  const sh = ss.getSheetByName(title), row = findRow_(sh, 2, d.ref || "");
  if (!row) return { ok: false, error: "notfound", message: d.ref + " wasn't found." };
  sh.getRange(row, 3).setValue(String(d.status));
  return { ok: true };
}

// pure: checks an expense before it's saved
function checkExpense(d) {
  const amount = Math.round(Number(d.amount) * 100) / 100;
  if (!(amount > 0 && amount < 10000000)) return { ok: false, error: "amount", message: "Enter an amount above ₹0." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d.date || ""))) return { ok: false, error: "date", message: "Pick a date." };
  const settle = String(d.category) === SETTLE_CATEGORY;
  if (!settle && EXPENSE_CATEGORIES.indexOf(String(d.category)) < 0) return { ok: false, error: "category", message: "Pick a category." };
  if (d.method && PAY_METHODS.indexOf(String(d.method)) < 0) return { ok: false, error: "method", message: "Pick a payment method." };
  const paidBy = clean(d.paidBy, 40);
  const sp = checkSplit(d.split);
  if (!sp.ok) return sp;
  if (settle && (!paidBy || sp.parts.length !== 1 || sp.parts[0].name === paidBy))
    return { ok: false, error: "split", message: "Pick who paid and who received the money." };
  return { ok: true, amount: amount, paidBy: paidBy, split: sp.text };
}
// pure: "Krishna:50|Deepak:50" (percent each). Empty means split equally between the founders.
function checkSplit(v) {
  const text = clean(v, 300);
  if (!text) return { ok: true, text: "", parts: [] };
  const parts = text.split("|").map((x) => { const i = x.lastIndexOf(":"); return { name: clean(x.slice(0, i), 40), pct: Number(x.slice(i + 1)) }; });
  if (parts.some((p) => !p.name || !(p.pct > 0) || p.pct > 100)) return { ok: false, error: "split", message: "Check the split: each share must be above 0%." };
  const sum = parts.reduce((n, p) => n + p.pct, 0);
  if (Math.abs(sum - 100) > 0.5) return { ok: false, error: "split", message: "The shares must add up to 100%." };
  return { ok: true, parts: parts, text: parts.map((p) => p.name + ":" + Math.round(p.pct * 100) / 100).join("|") };
}
function adminAddExpense_(ss, d, who) {
  const c = checkExpense(d);
  if (!c.ok) return c;
  const sh = ss.getSheetByName(ADMIN_TAB_TITLES.expenses), id = shortId_("E");
  sh.appendRow([id, String(d.date), c.amount, String(d.category), cell(c.paidBy || who.name), String(d.method || ""), cell(clean(d.note, 200)), who.email, stamp_(), cell(c.split)]);
  sh.getRange(sh.getLastRow(), 2).setNumberFormat("dd MMM yyyy");
  return { ok: true, id: id };
}
function adminUpdateExpense_(ss, d, who) {
  const c = checkExpense(d);
  if (!c.ok) return c;
  const sh = ss.getSheetByName(ADMIN_TAB_TITLES.expenses), row = d.id ? findRow_(sh, 1, d.id) : 0;
  if (!row) return { ok: false, error: "notfound", message: "That expense wasn't found. It may have been deleted." };
  sh.getRange(row, 2, 1, 6).setValues([[String(d.date), c.amount, String(d.category), cell(c.paidBy || who.name), String(d.method || ""), cell(clean(d.note, 200))]]);
  sh.getRange(row, 2).setNumberFormat("dd MMM yyyy");
  sh.getRange(row, 10).setValue(cell(c.split));
  return { ok: true, id: String(d.id) };
}

// pure: checks a filament spool before it's saved
function checkSpool(d) {
  const material = clean(d.material, 30), colour = clean(d.colour, 40);
  if (!material) return { ok: false, error: "material", message: "Add the material, e.g. PLA." };
  if (!colour) return { ok: false, error: "colour", message: "Add the colour." };
  const n = (x) => Math.max(0, Math.round(Number(x) || 0));
  const size = n(d.spoolSize) || 1000, remaining = Math.min(n(d.remaining), 100000);
  const hex = /^#[0-9A-F]{6}$/i.test(String(d.colourHex || "")) ? String(d.colourHex).toUpperCase() : "";
  return { ok: true, material: material, colour: colour, brand: clean(d.brand, 40), spoolSize: size, remaining: remaining, lowAt: n(d.lowAt), note: clean(d.note, 200), colourHex: hex };
}
function adminSaveSpool_(ss, d, who) {
  const c = checkSpool(d);
  if (!c.ok) return c;
  const sh = ss.getSheetByName(ADMIN_TAB_TITLES.stock);
  let row = d.id ? findRow_(sh, 1, d.id) : 0, id = row ? String(d.id) : shortId_("S");
  const values = [id, cell(c.material), cell(c.colour), cell(c.brand), c.spoolSize, c.remaining, c.lowAt, cell(c.note), stamp_(), who.email, c.colourHex];
  if (row) sh.getRange(row, 1, 1, values.length).setValues([values]); else sh.appendRow(values);
  return { ok: true, id: id };
}

function adminDeleteById_(ss, title, id) {
  const sh = ss.getSheetByName(title), row = id ? findRow_(sh, 1, id) : 0;
  if (!row) return { ok: false, error: "notfound", message: "That item wasn't found. It may already be deleted." };
  sh.deleteRow(row);
  return { ok: true };
}

/* ---- settings (rates, printers, business details for invoices) ---- */
function opsSettings_() {
  let saved = {};
  try { saved = JSON.parse(PropertiesService.getScriptProperties().getProperty("OPS_SETTINGS") || "{}"); } catch (e) { saved = {}; }
  return withRates(mergeSettings(DEFAULT_OPS_SETTINGS, saved), saved);
}
// pure: older saved settings had only filament costs ("rates"); carry them over, and keep rates in step with materials
function withRates(s, saved) {
  if (!(saved && Array.isArray(saved.materials)) && saved && saved.rates) {
    s.materials = s.materials.map((m) => saved.rates[m.name] != null ? Object.assign({}, m, { cost: Number(saved.rates[m.name]) || m.cost }) : m);
  }
  s.rates = s.materials.reduce((o, m) => { o[m.name] = m.cost; return o; }, {});
  return s;
}
// pure: the price formula the website and the app share.
// grams = actual filament for ONE piece (from the slicer or the website's STL estimate)
function quotePrice(p, materialName, grams, qty, designHours, extras) {
  const m = (p.materials || []).filter((x) => x.name === materialName)[0] || (p.materials || [])[0] || { rate: 0, cost: 0 };
  const g = Math.max(0, Number(grams) || 0), q = Math.max(1, Math.round(Number(qty) || 1));
  const wastePct = g <= p.smallUpToG ? p.wasteSmallPct : p.wasteLargePct;
  const billed = g * (1 + wastePct / 100);                    // grams we charge for, per piece
  const print = billed * m.rate * q;
  const hours = billed * q / Math.max(1, p.gramsPerHour);
  const design = Math.max(0, Number(designHours) || 0) * p.designPerHour, extra = Math.max(0, Number(extras) || 0);
  const minApplied = print > 0 && print < p.minPrice;
  const total = (minApplied ? p.minPrice : print) + design + extra;
  const rounded = Math.ceil(total / Math.max(1, p.roundTo)) * Math.max(1, p.roundTo);
  const cost = billed * q * m.cost + hours * p.machinePerHour + extra;
  return { material: m.name, wastePct: wastePct, billedGrams: billed, print: print, design: design, extras: extra, minApplied: minApplied,
    total: rounded, hours: hours, cost: cost, profit: rounded - cost };
}
// pure: what the website is allowed to see (no costs)
function publicPricing(s) {
  return { ok: true, materials: s.materials.filter((m) => m.show).map((m) => ({ name: m.name, rate: m.rate, density: m.density, hex: m.hex,
      about: m.about, strength: m.strength, heat: m.heat, flex: m.flex })),
    wasteSmallPct: s.wasteSmallPct, wasteLargePct: s.wasteLargePct, smallUpToG: s.smallUpToG, minPrice: s.minPrice,
    gramsPerHour: s.gramsPerHour, designPerHour: s.designPerHour, roundTo: s.roundTo };
}
function pricing_() {
  const cache = CacheService.getScriptCache(), hit = cache.get("pricing");
  if (hit) return JSON.parse(hit);
  const out = publicPricing(opsSettings_());
  cache.put("pricing", JSON.stringify(out), 300);
  return out;
}
// pure
function mergeSettings(def, saved) {
  const out = JSON.parse(JSON.stringify(def));
  Object.keys(saved || {}).forEach((k) => {
    if (!(k in out)) return;
    if (out[k] && typeof out[k] === "object" && !Array.isArray(out[k]) && k !== "rates" && k !== "templates") Object.assign(out[k], saved[k] || {});
    else if (k === "templates") Object.assign(out[k], saved[k] || {});
    else out[k] = saved[k];
  });
  return out;
}
// pure: tidies the settings sent by the app
// The app leaves out any field still at its default value; put those defaults back before checking, so nothing becomes 0 or empty.
const APP_MATERIAL_DEFAULTS = { rate: 5, cost: 2.5, density: 1.24, hex: "#8E8E8E", show: true, strength: 3, heat: 1, flex: 1, about: "" };
const APP_BUSINESS_DEFAULTS = { name: "MakeMeProto", email: "contact@makemeproto.com", address: "Ahmedabad, Gujarat" };
// pure
function fillAppDefaults(d) {
  const D = DEFAULT_OPS_SETTINGS, out = Object.assign({}, d || {});
  ["founders", "printers", "materials", "wasteSmallPct", "wasteLargePct", "smallUpToG", "gramsPerHour", "machinePerHour", "designPerHour",
    "minPrice", "roundTo", "quoteValidDays", "serviceEveryHours"].forEach((k) => { if (out[k] === undefined) out[k] = JSON.parse(JSON.stringify(D[k])); });
  if (out.gstPct === undefined) out.gstPct = 0;
  if (Array.isArray(out.materials)) out.materials = out.materials.map((m) => Object.assign({}, APP_MATERIAL_DEFAULTS, m || {}));
  out.business = Object.assign({}, APP_BUSINESS_DEFAULTS, out.business || {});
  return out;
}
function checkSettings(d) {
  d = fillAppDefaults(d);
  const num = (x, min, max, dflt) => { const n = Number(x); return x !== "" && x != null && isFinite(n) ? Math.min(max, Math.max(min, n)) : dflt; };
  const list = (a, max) => (Array.isArray(a) ? a : []).map((x) => clean(x, 40)).filter(Boolean).slice(0, max);
  const founders = list(d.founders, 6), printers = list(d.printers, 10);
  if (!founders.length) return { ok: false, error: "founders", message: "Add at least one founder name." };
  if (!printers.length) return { ok: false, error: "printers", message: "Add at least one printer." };
  const D = DEFAULT_OPS_SETTINGS, b = d.business || {};
  const seen = {}, materials = (Array.isArray(d.materials) ? d.materials : []).slice(0, 20).map((m) => {
    const name = clean(m && m.name, 30);
    if (!name || seen[name.toLowerCase()]) return null;
    seen[name.toLowerCase()] = true;
    const lvl = (x) => Math.round(num(x, 1, 5, 3));
    return { name: name, rate: num(m.rate, 0, 1000, 0), cost: num(m.cost, 0, 1000, 0), density: num(m.density, 0.5, 3, 1.24),
      hex: /^#[0-9A-F]{6}$/i.test(String(m.hex || "")) ? String(m.hex).toUpperCase() : "#8E8E8E", show: m.show !== false,
      strength: lvl(m.strength), heat: lvl(m.heat), flex: lvl(m.flex), about: clean(m.about, 200) };
  }).filter(Boolean);
  if (Array.isArray(d.materials) && !materials.length) return { ok: false, error: "materials", message: "Keep at least one material." };
  return { ok: true, settings: {
    founders: founders, printers: printers, materials: materials.length ? materials : D.materials,
    wasteSmallPct: num(d.wasteSmallPct, 0, 200, D.wasteSmallPct), wasteLargePct: num(d.wasteLargePct, 0, 200, D.wasteLargePct),
    smallUpToG: Math.round(num(d.smallUpToG, 1, 100000, D.smallUpToG)), gramsPerHour: num(d.gramsPerHour, 1, 1000, D.gramsPerHour),
    machinePerHour: num(d.machinePerHour, 0, 10000, D.machinePerHour), designPerHour: num(d.designPerHour, 0, 100000, D.designPerHour),
    minPrice: num(d.minPrice, 0, 100000, D.minPrice), roundTo: num(d.roundTo, 1, 1000, D.roundTo),
    gstPct: num(d.gstPct, 0, 28, 0), quoteValidDays: Math.round(num(d.quoteValidDays, 1, 90, D.quoteValidDays)),
    serviceEveryHours: Math.round(num(d.serviceEveryHours, 10, 5000, D.serviceEveryHours)),
    templates: Object.keys(D.templates).reduce((o, k) => { const t = clean((d.templates || {})[k], 600); o[k] = t || D.templates[k]; return o; }, {}),
    business: { name: clean(b.name, 60) || "MakeMeProto", phone: clean(b.phone, 20), email: clean(b.email, 80), address: clean(b.address, 200),
      gstin: clean(b.gstin, 20).toUpperCase(), upi: clean(b.upi, 60) } } };
}
function adminSaveSettings_(d) {
  const c = checkSettings(d);
  if (!c.ok) return c;
  PropertiesService.getScriptProperties().setProperty("OPS_SETTINGS", JSON.stringify(c.settings));
  CacheService.getScriptCache().remove("pricing");   // the website picks up new prices straight away
  return { ok: true, settings: opsSettings_() };
}

/* ---- payments ---- */
function paymentOut_(r) {
  const v = r.v;
  return { id: txt_(v[0]), date: day_(v[1]), amount: Number(v[2]) || 0, ref: txt_(v[3]), customer: txt_(v[4]), phone: txt_(v[5]), type: txt_(v[6]),
    method: txt_(v[7]), note: txt_(v[8]), addedBy: txt_(v[9]), addedAt: txt_(v[10]) };
}
// pure
function checkPayment(d) {
  const amount = Math.round(Number(d.amount) * 100) / 100;
  if (!(amount > 0 && amount < 10000000)) return { ok: false, error: "amount", message: "Enter an amount above ₹0." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d.date || ""))) return { ok: false, error: "date", message: "Pick a date." };
  if (PAYMENT_TYPES.indexOf(String(d.type)) < 0) return { ok: false, error: "type", message: "Pick advance, full payment, balance or refund." };
  if (d.method && PAY_METHODS.indexOf(String(d.method)) < 0) return { ok: false, error: "method", message: "Pick a payment method." };
  if (!clean(d.ref, 20) && !clean(d.customer, 60)) return { ok: false, error: "who", message: "Pick an order or add the customer's name." };
  return { ok: true, amount: String(d.type) === "Refund" ? -amount : amount };
}
function adminAddPayment_(ss, d, who) {
  const c = checkPayment(d);
  if (!c.ok) return c;
  const sh = ss.getSheetByName(ADMIN_TAB_TITLES.payments), id = shortId_("P");
  sh.appendRow([id, String(d.date), c.amount, cell(clean(d.ref, 20).toUpperCase()), cell(clean(d.customer, 60)), digits(d.phone).slice(-10), String(d.type),
    String(d.method || ""), cell(clean(d.note, 200)), who.email, stamp_()]);
  sh.getRange(sh.getLastRow(), 2).setNumberFormat("dd MMM yyyy");
  return { ok: true, id: id };
}

/* ---- quotes & invoices (the app makes the PDF; this keeps the number and a record) ---- */
function documentOut_(r) {
  const v = r.v;
  return { number: txt_(v[0]), type: txt_(v[1]), date: day_(v[2]), ref: txt_(v[3]), customer: txt_(v[4]), phone: txt_(v[5]), items: txt_(v[6]),
    subtotal: Number(v[7]) || 0, discount: Number(v[8]) || 0, gst: Number(v[9]) || 0, total: Number(v[10]) || 0, createdBy: txt_(v[11]), createdAt: txt_(v[12]) };
}
// pure: works out the totals the same way the app does
function checkDocument(d, gstPct) {
  if (["Quote", "Invoice"].indexOf(String(d.type)) < 0) return { ok: false, error: "type", message: "Pick quote or invoice." };
  const items = (Array.isArray(d.items) ? d.items : []).slice(0, 30).map((i) => ({
    name: clean(i && i.name, 80), qty: Math.round(Number(i && i.qty) * 100) / 100, rate: Math.round(Number(i && i.rate) * 100) / 100 }))
    .filter((i) => i.name && i.qty > 0 && i.qty <= 100000 && i.rate >= 0 && i.rate < 10000000);
  if (!items.length) return { ok: false, error: "items", message: "Add at least one line with a name, quantity and price." };
  if (!clean(d.customer, 60)) return { ok: false, error: "customer", message: "Add the customer's name." };
  const r2 = (n) => Math.round(n * 100) / 100;
  const subtotal = r2(items.reduce((n, i) => n + i.qty * i.rate, 0));
  const discount = Math.min(subtotal, Math.max(0, r2(Number(d.discount) || 0)));
  const gst = r2((subtotal - discount) * (Number(gstPct) || 0) / 100);
  return { ok: true, items: items, subtotal: subtotal, discount: discount, gst: gst, total: r2(subtotal - discount + gst) };
}
function adminIssueDocument_(ss, d, who) {
  const settings = opsSettings_(), c = checkDocument(d, settings.gstPct);
  if (!c.ok) return c;
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const props = PropertiesService.getScriptProperties(), year = Utilities.formatDate(new Date(), "Asia/Kolkata", "yyyy");
    const key = "DOC_" + d.type + "_" + year, n = Number(props.getProperty(key) || 0) + 1;
    props.setProperty(key, String(n));
    const number = (d.type === "Invoice" ? "INV" : "QT") + "-" + year + "-" + ("000" + n).slice(-4);
    const date = Utilities.formatDate(new Date(), "Asia/Kolkata", "yyyy-MM-dd");
    const lines = c.items.map((i) => i.qty + " × " + i.name + " @ ₹" + i.rate).join("\n");
    const sh = ss.getSheetByName(ADMIN_TAB_TITLES.documents);
    sh.appendRow([number, d.type, date, cell(clean(d.ref, 20).toUpperCase()), cell(clean(d.customer, 60)), digits(d.phone).slice(-10), cell(lines),
      c.subtotal, c.discount, c.gst, c.total, who.email, stamp_()]);
    sh.getRange(sh.getLastRow(), 3).setNumberFormat("dd MMM yyyy");
    return { ok: true, number: number, date: date, subtotal: c.subtotal, discount: c.discount, gst: c.gst, total: c.total, settings: settings };
  } finally { lock.releaseLock(); }
}

/* ---- tasks ---- */
function taskOut_(r) {
  const v = r.v;
  return { id: txt_(v[0]), title: txt_(v[1]), assignee: txt_(v[2]), due: day_(v[3]), status: txt_(v[4]) || "Open", ref: txt_(v[5]), note: txt_(v[6]),
    createdBy: txt_(v[7]), createdAt: txt_(v[8]), doneAt: txt_(v[9]) };
}
// pure
function checkTask(d) {
  const title = clean(d.title, 140);
  if (!title) return { ok: false, error: "title", message: "Write what needs doing." };
  const due = String(d.due || "");
  if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) return { ok: false, error: "due", message: "Pick a due date." };
  const status = TASK_STATUSES.indexOf(String(d.status)) >= 0 ? String(d.status) : "Open";
  return { ok: true, title: title, assignee: clean(d.assignee, 40), due: due, status: status, ref: clean(d.ref, 20).toUpperCase(), note: clean(d.note, 300) };
}
function adminSaveTask_(ss, d, who) {
  const c = checkTask(d);
  if (!c.ok) return c;
  const sh = ss.getSheetByName(ADMIN_TAB_TITLES.tasks);
  const row = d.id ? findRow_(sh, 1, d.id) : 0, id = row ? String(d.id) : shortId_("T");
  const prev = row ? sh.getRange(row, 1, 1, ADMIN_TABS.tasks.length).getValues()[0] : null;
  const doneAt = c.status === "Done" ? (prev && prev[9] ? prev[9] : stamp_()) : "";
  const values = [id, cell(c.title), cell(c.assignee), c.due, c.status, cell(c.ref), cell(c.note), prev ? prev[7] : who.email, prev ? prev[8] : stamp_(), doneAt];
  if (row) sh.getRange(row, 1, 1, values.length).setValues([values]); else sh.appendRow(values);
  return { ok: true, id: id };
}

/* ---- print queue ---- */
function jobOut_(r) {
  const v = r.v;
  return { id: txt_(v[0]), title: txt_(v[1]), ref: txt_(v[2]), printer: txt_(v[3]), spoolId: txt_(v[4]), grams: Number(v[5]) || 0, hours: Number(v[6]) || 0,
    status: txt_(v[7]) || "Queued", position: Number(v[8]) || 0, started: txt_(v[9]), finished: txt_(v[10]), note: txt_(v[11]), updatedBy: txt_(v[12]) };
}
// pure
function checkJob(d) {
  const title = clean(d.title, 120);
  if (!title) return { ok: false, error: "title", message: "Name the job, e.g. Name lamp × 2." };
  const grams = Math.max(0, Math.round(Number(d.grams) || 0)), hours = Math.max(0, Math.round((Number(d.hours) || 0) * 10) / 10);
  if (grams > 20000 || hours > 500) return { ok: false, error: "size", message: "That filament or time looks too big." };
  return { ok: true, title: title, ref: clean(d.ref, 20).toUpperCase(), printer: clean(d.printer, 40), spoolId: clean(d.spoolId, 20), grams: grams, hours: hours, note: clean(d.note, 300) };
}
function adminSaveJob_(ss, d, who) {
  const c = checkJob(d);
  if (!c.ok) return c;
  const sh = ss.getSheetByName(ADMIN_TAB_TITLES.jobs);
  const row = d.id ? findRow_(sh, 1, d.id) : 0, id = row ? String(d.id) : shortId_("J");
  if (row) {
    sh.getRange(row, 2, 1, 6).setValues([[cell(c.title), cell(c.ref), cell(c.printer), c.spoolId, c.grams, c.hours]]);
    sh.getRange(row, 12, 1, 2).setValues([[cell(c.note), who.email]]);
  } else {
    const all = rows_(ss, ADMIN_TAB_TITLES.jobs, ADMIN_TABS.jobs.length, 500).map(jobOut_);
    const pos = all.reduce((m, j) => Math.max(m, j.position), 0) + 1;
    sh.appendRow([id, cell(c.title), cell(c.ref), cell(c.printer), c.spoolId, c.grams, c.hours, "Queued", pos, "", "", cell(c.note), who.email]);
  }
  return { ok: true, id: id };
}
function adminJobStatus_(ss, d, who) {
  const status = String(d.status);
  if (JOB_STATUSES.indexOf(status) < 0) return { ok: false, error: "status", message: "Unknown status." };
  const sh = ss.getSheetByName(ADMIN_TAB_TITLES.jobs), row = d.id ? findRow_(sh, 1, d.id) : 0;
  if (!row) return { ok: false, error: "notfound", message: "That job wasn't found." };
  const job = jobOut_({ row: row, v: sh.getRange(row, 1, 1, ADMIN_TABS.jobs.length).getValues()[0] });
  sh.getRange(row, 8).setValue(status);
  sh.getRange(row, 13).setValue(who.email);
  let spool = null;
  if (status === "Printing") {
    sh.getRange(row, 10).setValue(new Date()).setNumberFormat("dd MMM yyyy, HH:mm");
    if (job.ref) {   // move the order along so the customer sees it on the Track order page
      const qs = ss.getSheetByName(TAB_TITLES.quote), orow = findRow_(qs, 2, job.ref);
      if (orow && ["New", "Quote sent", "Confirmed"].indexOf(String(qs.getRange(orow, 3).getValue())) >= 0) qs.getRange(orow, 3).setValue("Printing");
    }
  }
  if (status === "Done" && job.status !== "Done") {
    sh.getRange(row, 11).setValue(new Date()).setNumberFormat("dd MMM yyyy, HH:mm");
    if (job.spoolId && job.grams > 0) {   // take the filament off the spool
      const ss2 = ss.getSheetByName(ADMIN_TAB_TITLES.stock), srow = findRow_(ss2, 1, job.spoolId);
      if (srow) {
        const left = Math.max(0, (Number(ss2.getRange(srow, 6).getValue()) || 0) - job.grams);
        ss2.getRange(srow, 6).setValue(left);
        ss2.getRange(srow, 9, 1, 2).setValues([[stamp_(), who.email]]);
        spool = { id: job.spoolId, remaining: left };
      }
    }
  }
  return { ok: true, spool: spool };
}
function adminMoveJob_(ss, d) {
  const sh = ss.getSheetByName(ADMIN_TAB_TITLES.jobs);
  const jobs = rows_(ss, ADMIN_TAB_TITLES.jobs, ADMIN_TABS.jobs.length, 500).map(jobOut_).filter((j) => j.status === "Queued").sort((a, b) => a.position - b.position);
  const i = jobs.findIndex((j) => j.id === d.id), k = i + (Number(d.dir) < 0 ? -1 : 1);
  if (i < 0 || k < 0 || k >= jobs.length) return { ok: true };
  const a = jobs[i], b = jobs[k];
  sh.getRange(a.row || findRow_(sh, 1, a.id), 9).setValue(b.position);
  sh.getRange(b.row || findRow_(sh, 1, b.id), 9).setValue(a.position);
  return { ok: true };
}

/* ---- orders added in the app (WhatsApp, Instagram, calls, walk-ins) ---- */
// pure
function checkNewOrder(d) {
  const name = clean(d.name, 80), phone = digits(d.phone);
  if (!name) return { ok: false, error: "name", message: "Add the customer's name." };
  if (phone && !validPhone(phone)) return { ok: false, error: "phone", message: "That phone number doesn't look right." };
  const channel = ORDER_CHANNELS.indexOf(String(d.channel)) >= 0 ? String(d.channel) : "Other";
  const qty = Math.max(1, Math.min(100000, Math.round(Number(d.quantity) || 1)));
  const est = Number(String(d.estimate || "").replace(/[^\d.]/g, "")) || 0;
  return { ok: true, name: name, phone: phone, channel: channel, quantity: qty, estimate: est > 0 ? "₹" + est : "",
    material: clean(d.material, 20), colour: clean(d.colour, 30), size: clean(d.size, 40), weight: clean(d.weight, 20), notes: clean(d.notes, 1000) };
}
function adminCreateOrder_(ss, d, who) {
  const c = checkNewOrder(d);
  if (!c.ok) return c;
  const ref = makeRef("Q"), sh = ss.getSheetByName(TAB_TITLES.quote);
  const when = Utilities.formatDate(new Date(), "Asia/Kolkata", "dd MMM yyyy, HH:mm");
  sh.appendRow([when, ref, "New", cell(c.name), c.phone, cell(c.material), "", cell(c.colour), c.quantity, cell(c.weight), cell(c.size), c.estimate, cell(c.notes), "",
    "Added in the app · " + c.channel + " · " + who.email, "", "", "", "", ""]);
  return { ok: true, order: orderOut_({ row: sh.getLastRow(), v: sh.getRange(sh.getLastRow(), 1, 1, TABS.quote.length).getValues()[0] }) };
}

/* ---- order photos (shown to the customer on the Track order page) ---- */
// pure: file ids kept one per line in the Photos column
function photoIds(v) { return String(v || "").split(/[\s,]+/).map((x) => x.trim()).filter((x) => /^[\w-]{20,}$/.test(x)); }
function orderPhotoFolder_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty("ORDER_PHOTO_FOLDER_ID");
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { /* deleted: make a new one */ } }
  const f = child_(DriveApp.getFolderById(props.getProperty("FOLDER_ID")), "Order photos");
  props.setProperty("ORDER_PHOTO_FOLDER_ID", f.getId());
  return f;
}
function adminOrderPhoto_(ss, d, add) {
  const sh = ss.getSheetByName(TAB_TITLES.quote), row = findRow_(sh, 2, d.ref || "");
  if (!row) return { ok: false, error: "notfound", message: "Order " + d.ref + " wasn't found." };
  const cellRange = sh.getRange(row, 20), ids = photoIds(cellRange.getValue()), fileId = String(d.fileId || "");
  if (add) {
    let file;
    try { file = DriveApp.getFileById(fileId); } catch (e) { return { ok: false, error: "file", message: "The upload didn't finish. Try again." }; }
    const folderId = orderPhotoFolder_().getId(), parents = file.getParents();
    let inFolder = false;
    while (parents.hasNext()) if (parents.next().getId() === folderId) inFolder = true;
    if (!inFolder) return { ok: false, error: "file", message: "That file isn't in the order photos folder." };
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    if (ids.indexOf(fileId) < 0) ids.push(fileId);
  } else {
    const i = ids.indexOf(fileId);
    if (i >= 0) { ids.splice(i, 1); try { DriveApp.getFileById(fileId).setTrashed(true); } catch (e) { /* gone */ } }
  }
  cellRange.setValue(ids.slice(-12).join("\n"));
  return { ok: true, photos: ids };
}

/* ---- supplies (LEDs, magnets, boxes, packaging…) ---- */
function supplyOut_(r) {
  const v = r.v;
  return { id: txt_(v[0]), name: txt_(v[1]), unit: txt_(v[2]), quantity: Number(v[3]) || 0, lowAt: Number(v[4]) || 0, cost: Number(v[5]) || 0,
    note: txt_(v[6]), updated: txt_(v[7]), updatedBy: txt_(v[8]), perOrder: Number(v[9]) || 0 };
}
// pure
function checkSupply(d) {
  const name = clean(d.name, 60);
  if (!name) return { ok: false, error: "name", message: "Name the item, e.g. Warm white LED strip." };
  const n = (x) => Math.max(0, Math.round((Number(x) || 0) * 100) / 100);
  return { ok: true, name: name, unit: clean(d.unit, 20) || "pcs", quantity: Math.min(n(d.quantity), 1000000), lowAt: n(d.lowAt), cost: n(d.cost), note: clean(d.note, 200),
    perOrder: Math.min(n(d.perOrder), 1000) };
}
function adminSaveSupply_(ss, d, who) {
  const c = checkSupply(d);
  if (!c.ok) return c;
  const sh = ss.getSheetByName(ADMIN_TAB_TITLES.supplies);
  const row = d.id ? findRow_(sh, 1, d.id) : 0, id = row ? String(d.id) : shortId_("U");
  const values = [id, cell(c.name), cell(c.unit), c.quantity, c.lowAt, c.cost, cell(c.note), stamp_(), who.email, c.perOrder];
  if (row) sh.getRange(row, 1, 1, values.length).setValues([values]); else sh.appendRow(values);
  return { ok: true, id: id };
}

/* ---- printer log (servicing, repairs) ---- */
function logOut_(r) {
  const v = r.v;
  return { id: txt_(v[0]), date: day_(v[1]), printer: txt_(v[2]), type: txt_(v[3]), note: txt_(v[4]), cost: Number(v[5]) || 0, addedBy: txt_(v[6]), addedAt: txt_(v[7]) };
}
// pure
function checkLog(d) {
  const printer = clean(d.printer, 40);
  if (!printer) return { ok: false, error: "printer", message: "Pick the printer." };
  if (SERVICE_TYPES.indexOf(String(d.type)) < 0) return { ok: false, error: "type", message: "Pick what was done." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d.date || ""))) return { ok: false, error: "date", message: "Pick a date." };
  return { ok: true, printer: printer, type: String(d.type), date: String(d.date), note: clean(d.note, 300), cost: Math.max(0, Math.round((Number(d.cost) || 0) * 100) / 100) };
}
function adminAddLog_(ss, d, who) {
  const c = checkLog(d);
  if (!c.ok) return c;
  const sh = ss.getSheetByName(ADMIN_TAB_TITLES.printlog), id = shortId_("L");
  sh.appendRow([id, c.date, cell(c.printer), c.type, cell(c.note), c.cost, who.email, stamp_()]);
  sh.getRange(sh.getLastRow(), 2).setNumberFormat("dd MMM yyyy");
  return { ok: true, id: id };
}
// pure: printers that have printed more than [every] hours since their last log entry
function serviceDue(doneJobs, logs, every) {
  const printers = {};
  doneJobs.forEach((j) => { if (j.printer) printers[j.printer] = true; });
  return Object.keys(printers).map((p) => {
    const last = logs.filter((l) => l.printer === p).reduce((m, l) => Math.max(m, l.date || 0), 0);
    const hours = doneJobs.filter((j) => j.printer === p && (j.finished || 0) > last).reduce((n, j) => n + j.hours, 0);
    return { printer: p, hours: hours };
  }).filter((x) => x.hours >= every);
}

/* ---- app releases: GitHub Actions sends each signed APK here; the app checks for updates ---- */
function release_(b) {
  const key = PropertiesService.getScriptProperties().getProperty("RELEASE_KEY");
  if (!key || String(b.key || "") !== key) return { ok: false, error: "auth", message: "Not allowed." };
  const code = Math.round(Number(b.versionCode) || 0);
  if (!(code > 0) || !b.apk) return { ok: false, error: "release", message: "Missing version or APK." };
  const props = PropertiesService.getScriptProperties();
  let folder;
  const fid = props.getProperty("RELEASE_FOLDER_ID");
  try { folder = fid ? DriveApp.getFolderById(fid) : null; } catch (e) { folder = null; }
  if (!folder) { folder = child_(DriveApp.getFolderById(props.getProperty("FOLDER_ID")), "App releases"); props.setProperty("RELEASE_FOLDER_ID", folder.getId()); }
  const name = "makemeproto-ops-" + clean(b.versionName, 20) + ".apk";
  const file = folder.createFile(Utilities.newBlob(Utilities.base64Decode(String(b.apk)), "application/vnd.android.package-archive", name));
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  const info = { versionCode: code, versionName: clean(b.versionName, 20), notes: clean(b.notes, 1000), fileId: file.getId(), size: file.getSize(), date: stamp_() };
  props.setProperty("APP_RELEASE", JSON.stringify(info));
  // keep the last three APKs, bin older ones
  const all = [], it = folder.getFiles();
  while (it.hasNext()) all.push(it.next());
  all.sort((a, b2) => b2.getDateCreated() - a.getDateCreated()).slice(3).forEach((f) => f.setTrashed(true));
  return { ok: true, release: info };
}
function appRelease_() {
  try {
    const info = JSON.parse(PropertiesService.getScriptProperties().getProperty("APP_RELEASE") || "null");
    if (!info) return null;
    info.url = "https://drive.usercontent.google.com/download?id=" + info.fileId + "&export=download&confirm=t";
    return info;
  } catch (e) { return null; }
}

/* ---- media posts (website gallery; the app shares to Instagram and LinkedIn itself) ---- */
function galleryFolder_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty("GALLERY_FOLDER_ID");
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { /* deleted: make a new one */ } }
  const f = child_(DriveApp.getFolderById(props.getProperty("FOLDER_ID")), GALLERY_FOLDER);
  props.setProperty("GALLERY_FOLDER_ID", f.getId());
  return f;
}
function mediaOut_(r) {
  const v = r.v, fileId = txt_(v[5]), kind = txt_(v[6]) || "image";
  return { id: txt_(v[0]), date: day_(v[1]), type: txt_(v[2]), title: txt_(v[3]), caption: txt_(v[4]), fileId: fileId, kind: kind,
    website: txt_(v[7]) === "Yes", instagram: txt_(v[8]), linkedin: txt_(v[9]), addedBy: txt_(v[10]), addedAt: txt_(v[11]),
    url: fileId ? (kind === "video" ? "https://drive.google.com/file/d/" + fileId + "/preview" : "https://lh3.googleusercontent.com/d/" + fileId + "=w1600") : "",
    thumb: fileId ? "https://drive.google.com/thumbnail?id=" + fileId + "&sz=w800" : "" };
}
// pure
function checkUpload(d) {
  const mime = String(d.mime || "").toLowerCase(), size = Number(d.size) || 0;
  const isVideo = /^video\/(mp4|quicktime|webm|3gpp)$/.test(mime), isImage = /^image\/(jpeg|png|webp|heic|heif)$/.test(mime);
  if (!isVideo && !isImage) return { ok: false, error: "type", message: "Pick a photo (JPG, PNG, WebP, HEIC) or a video (MP4, MOV, WebM)." };
  const maxMb = isVideo ? 300 : 25;
  if (!(size > 0) || size > maxMb * 1048576) return { ok: false, error: "size", message: "That file is too big. The limit is " + maxMb + " MB for " + (isVideo ? "videos" : "photos") + "." };
  return { ok: true, mime: mime, size: size, name: safeName(d.name || (isVideo ? "video.mp4" : "photo.jpg")) };
}
function adminStartUpload_(d) {
  const c = checkUpload(d);
  if (!c.ok) return c;
  if (driveFull_()) return { ok: false, error: "drive", message: "Google Drive is almost full. Free up some space first." };
  const folder = d.folder === "orders" ? orderPhotoFolder_() : galleryFolder_();
  const stampName = Utilities.formatDate(new Date(), "Asia/Kolkata", "yyyy-MM-dd HHmm") + " " + c.name;
  const res = UrlFetchApp.fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id", {
    method: "post", contentType: "application/json; charset=UTF-8", muteHttpExceptions: true,
    headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken(), "X-Upload-Content-Type": c.mime, "X-Upload-Content-Length": String(c.size) },
    payload: JSON.stringify({ name: stampName, mimeType: c.mime, parents: [folder.getId()] }),
  });
  const h = res.getHeaders(), url = h.Location || h.location;
  if (res.getResponseCode() !== 200 || !url) { console.error(res.getContentText()); return { ok: false, error: "upload", message: "Couldn't start the upload. Try again." }; }
  return { ok: true, uploadUrl: url, chunk: 4 * 1024 * 1024 };   // the app sends the file straight to Drive in 4 MB pieces
}
function adminAddMedia_(ss, d, who) {
  const type = GALLERY_TYPES.indexOf(String(d.type)) >= 0 ? String(d.type) : "print";
  const title = clean(d.title, 100);
  if (!title) return { ok: false, error: "title", message: "Add a title." };
  let file;
  try { file = DriveApp.getFileById(String(d.fileId || "")); } catch (e) { return { ok: false, error: "file", message: "The upload didn't finish. Try again." }; }
  const folderId = galleryFolder_().getId(), parents = file.getParents();
  let inFolder = false;
  while (parents.hasNext()) if (parents.next().getId() === folderId) inFolder = true;
  if (!inFolder) return { ok: false, error: "file", message: "That file isn't in the gallery folder." };
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);   // so the website can show it
  const kind = /^video\//.test(file.getMimeType()) ? "video" : "image";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(d.date || "")) ? String(d.date) : Utilities.formatDate(new Date(), "Asia/Kolkata", "yyyy-MM-dd");
  const sh = ss.getSheetByName(ADMIN_TAB_TITLES.media), id = shortId_("M");
  sh.appendRow([id, date, type, cell(title), cell(clean(d.caption, 2000)), file.getId(), kind, d.website ? "Yes" : "No", "", "", who.email, stamp_()]);
  sh.getRange(sh.getLastRow(), 2).setNumberFormat("dd MMM yyyy");
  CacheService.getScriptCache().remove("gallery");
  return { ok: true, id: id };
}
function adminUpdateMedia_(ss, d) {
  const sh = ss.getSheetByName(ADMIN_TAB_TITLES.media), row = d.id ? findRow_(sh, 1, d.id) : 0;
  if (!row) return { ok: false, error: "notfound", message: "That post wasn't found." };
  if (d.title != null && clean(d.title, 100)) sh.getRange(row, 4).setValue(cell(clean(d.title, 100)));
  if (d.caption != null) sh.getRange(row, 5).setValue(cell(clean(d.caption, 2000)));
  if (d.type != null && GALLERY_TYPES.indexOf(String(d.type)) >= 0) sh.getRange(row, 3).setValue(String(d.type));
  if (d.website != null) sh.getRange(row, 8).setValue(d.website ? "Yes" : "No");
  if (d.instagram != null) sh.getRange(row, 9).setValue(d.instagram ? stamp_() : "");
  if (d.linkedin != null) sh.getRange(row, 10).setValue(d.linkedin ? stamp_() : "");
  CacheService.getScriptCache().remove("gallery");
  return { ok: true };
}
function adminDeleteMedia_(ss, d) {
  const sh = ss.getSheetByName(ADMIN_TAB_TITLES.media), row = d.id ? findRow_(sh, 1, d.id) : 0;
  if (!row) return { ok: false, error: "notfound", message: "That post wasn't found." };
  const fileId = String(sh.getRange(row, 6).getValue() || "");
  if (fileId) { try { DriveApp.getFileById(fileId).setTrashed(true); } catch (e) { /* already gone */ } }
  sh.deleteRow(row);
  CacheService.getScriptCache().remove("gallery");
  return { ok: true };
}
// public: what the website's Gallery page shows (cached for 5 minutes)
function gallery_() {
  const cache = CacheService.getScriptCache(), hit = cache.get("gallery");
  if (hit) return JSON.parse(hit);
  const ss = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty("SHEET_ID"));
  const sh = ss.getSheetByName(ADMIN_TAB_TITLES.media);
  const items = !sh ? [] : rows_(ss, ADMIN_TAB_TITLES.media, ADMIN_TABS.media.length, 300).map(mediaOut_).filter((m) => m.website && m.fileId).slice(0, 120)
    .map((m) => galleryItem(m));
  const out = { ok: true, items: items };
  try { cache.put("gallery", JSON.stringify(out), 300); } catch (e) { /* too big to cache */ }
  return out;
}
// pure: the shape the website's gallery code expects
function galleryItem(m) {
  const item = { id: m.id, type: m.type, title: m.title, titleEn: m.title, caption: m.caption, captionEn: m.caption, date: m.date, poster: m.thumb };
  if (m.kind === "video") item.drive = m.fileId; else item.image = m.url;
  return item;
}

/* ------------------------- Track order ------------------------- */
// Which step of the tracker a Status is on (works with the dropdown values and similar words)
function orderStage(status) {
  const t = String(status || "").toLowerCase();
  if (/cancel/.test(t)) return { stage: -1, state: "cancelled" };
  if (/hold|paused|waiting/.test(t)) return { stage: -1, state: "hold" };
  if (/deliver|picked up|collected|complete|done/.test(t)) return { stage: 5, state: "delivered" };
  if (/ship|dispatch|courier|out for/.test(t)) return { stage: 4, state: "active" };
  if (/ready|quality|packed|packing/.test(t)) return { stage: 3, state: "active" };
  if (/print|production|making/.test(t)) return { stage: 2, state: "active" };
  if (/confirm|paid|advance|accepted/.test(t)) return { stage: 1, state: "active" };
  return { stage: 0, state: /quote sent|quoted/.test(t) ? "quoted" : "active" };
}

function checkTrack(b) {
  const f = (b && b.fields) || {}, ref = String(f.ref || "").trim().toUpperCase(), phone = digits(f.phone);
  if (b.website) return { ok: false, silent: true };
  if (!/^[QCJN]-\d{4}-[A-Z0-9]{3}$/.test(ref)) return { ok: false, error: "ref", message: "That reference doesn't look right. It looks like Q-2411-ABC." };
  if (!/^Q/.test(ref)) return { ok: false, error: "not-order", message: "This reference is for a message or application, not an order. Order references start with Q." };
  if (!validPhone(phone)) return { ok: false, error: "phone", message: "Please add the mobile number you used for this order." };
  return { ok: true, ref: ref, phone: phone.slice(-10) };
}

function track_(b) {
  const c = checkTrack(b);
  if (c.silent) return { ok: false, error: "notfound", message: "We couldn't find an order with these details." };
  if (!c.ok) return c;
  const cache = CacheService.getScriptCache();
  const failKey = "tf" + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, c.phone)).slice(0, 20);
  const fails = Number(cache.get(failKey) || 0);
  if (fails >= 8) return { ok: false, error: "slow-down", message: "Too many tries. Please wait an hour, or WhatsApp us your reference." };
  const minuteKey = "t" + Math.floor(Date.now() / 60000), perMin = Number(cache.get(minuteKey) || 0);
  if (perMin >= 40) return { ok: false, error: "busy", message: "Lots of people are tracking right now. Please try again in a minute." };
  cache.put(minuteKey, String(perMin + 1), 120);

  const ss = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty("SHEET_ID"));
  ensureHeaders_(ss);
  const sh = ss.getSheetByName(TAB_TITLES.quote), last = sh.getLastRow();
  const rows = last > 1 ? sh.getRange(2, 1, last - 1, TABS.quote.length).getValues() : [];
  const row = rows.find((r) => String(r[1]).trim().toUpperCase() === c.ref && digits(r[4]).slice(-10) === c.phone);
  if (!row) {
    cache.put(failKey, String(fails + 1), 3600);
    return { ok: false, error: "notfound", message: "We couldn't find an order with this reference and phone number. Check both, or WhatsApp us." };
  }
  const fmt = (v) => v instanceof Date ? Utilities.formatDate(v, "Asia/Kolkata", "EEE d MMM yyyy") : String(v == null ? "" : v).trim();
  const st = orderStage(row[2]);
  return {
    ok: true, ref: c.ref, firstName: String(row[3]).trim().split(/\s+/)[0] || "",
    status: String(row[2] || "New"), stage: st.stage, state: st.state,
    received: fmt(row[0]),
    // Sheets turns "30%" into 0.3, so show it as a percentage again
    item: { material: fmt(row[5]), infill: typeof row[6] === "number" ? Math.round(row[6] * (row[6] <= 1 ? 100 : 1)) + "%" : fmt(row[6]), colour: fmt(row[7]), quantity: fmt(row[8]), weight: fmt(row[9]), size: fmt(row[10]) },
    estimate: fmt(row[11]),
    update: fmt(row[15]), courier: fmt(row[16]), tracking: fmt(row[17]), expected: fmt(row[18]),
    photos: photoIds(row[19]).map((id) => ({ thumb: "https://drive.google.com/thumbnail?id=" + id + "&sz=w600", full: "https://lh3.googleusercontent.com/d/" + id + "=w1600" })),
  };
}

/* ------------------------- The Proto Post (newsletter) ------------------------- */
function subscribersSheet_() {
  const ss = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty("SHEET_ID"));
  ensureHeaders_(ss);
  return ss.getSheetByName(TAB_TITLES.newsletter);
}

// where links in the emails should point: the page the visitor signed up on (test site or live), otherwise the live site
function siteBase_(b) {
  const base = String(b.base || "");
  return /^https:\/\/(makemeproto\.(com|in)|amkrys\.github\.io)\//.test(base) ? base : SETTINGS.siteUrl.replace(/\/?$/, "/");
}

function subscribe_(b) {
  const f = b.fields || {}, email = String(f.email).trim(), lower = email.toLowerCase();
  const sh = subscribersSheet_(), last = sh.getLastRow();
  const when = Utilities.formatDate(new Date(), "Asia/Kolkata", "dd MMM yyyy, HH:mm");
  if (last > 1) {
    const rows = sh.getRange(2, 1, last - 1, TABS.newsletter.length).getValues();
    for (let i = 0; i < rows.length; i++) {
      if (String(rows[i][3]).toLowerCase().trim() !== lower) continue;
      if (/^Subscribed/.test(String(rows[i][2]))) return { ok: true, ref: rows[i][1], already: true };
      sh.getRange(i + 2, 3).setValue("Subscribed again · " + when);          // they had unsubscribed and came back
      if (SETTINGS.sendWelcome) welcome_(b, email, clean(f.name, 60), rows[i][8]);
      return { ok: true, ref: rows[i][1], again: true };
    }
  }
  const ref = makeRef(PREFIX.newsletter), key = Utilities.getUuid().replace(/-/g, "");
  sh.appendRow([when, ref, "Subscribed", cell(email), cell(clean(f.name, 60)), cell(clean(f.topics, 200)), cell(clean(f.language, 20)), cell(clean(b.source, 80)), key]);
  if (SETTINGS.sendWelcome) welcome_(b, email, clean(f.name, 60), key);
  if (SETTINGS.notifyOnSubscribe && SETTINGS.notifyEmail) {
    try { MailApp.sendEmail(SETTINGS.notifyEmail, "💌 New subscriber · " + email, email + (f.name ? " (" + clean(f.name, 60) + ")" : "") + "\nInterests: " + (clean(f.topics, 200) || "none")); } catch (e) { logProblem_("Subscriber alert failed", e); }
  }
  return { ok: true, ref: ref };
}

function unsubscribe_(b) {
  const key = String(b.fields.key), sh = subscribersSheet_(), last = sh.getLastRow();
  if (last > 1) {
    const keys = sh.getRange(2, 9, last - 1, 1).getValues();
    for (let i = 0; i < keys.length; i++) {
      if (String(keys[i][0]) !== key) continue;
      sh.getRange(i + 2, 3).setValue("Unsubscribed · " + Utilities.formatDate(new Date(), "Asia/Kolkata", "dd MMM yyyy, HH:mm"));
      return { ok: true };
    }
  }
  return { ok: false, error: "key", message: "We couldn't find this subscription. Please email us and we'll remove you." };
}

function welcome_(b, email, name, key) {
  try {
    const base = siteBase_(b), mail = buildWelcome(name, base, base + "media.html?unsubscribe=" + key);
    MailApp.sendEmail({ to: email, subject: mail.subject, body: mail.text, htmlBody: mail.html });
  } catch (e) { logProblem_("Welcome email failed for " + email, e); }
}

function buildWelcome(name, base, unsubUrl) {
  const esc = (v) => String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const hi = name ? "Hi " + esc(name) + "," : "Hi there,";
  const perks = [["🖨️", "New prints", "and the stories behind them"], ["🎥", "New reels and vlogs", "before anyone else"], ["💡", "One practical tip", "on 3D printing or design"], ["🎁", "Early offers", "just for subscribers"]];
  const btn = (href, text, bg, fg) => `<a href="${href}" style="display:inline-block;margin:0 8px 8px 0;padding:13px 20px;border-radius:999px;background:${bg};color:${fg};font:700 14px/1 Arial,sans-serif;text-decoration:none">${text}</a>`;
  const social = socialRow_(base);
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;padding:0;background:#F6F1E7">
<div style="display:none;max-height:0;overflow:hidden">One email a month from our 3D printing workshop in Ahmedabad.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F1E7"><tr><td align="center" style="padding:28px 12px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">
    <tr><td style="padding:0 6px 14px;font:800 22px/1 Arial,sans-serif;color:#141414">make<span style="color:#FF5A1F">me</span>proto</td></tr>
    <tr><td style="background:#ffffff;border-radius:20px;border:1px solid #E8E0CF;overflow:hidden">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="height:6px;background:#FF5A1F;font-size:0;line-height:0">&nbsp;</td></tr>
        <tr><td style="padding:28px 28px 8px">
          <div style="display:inline-block;padding:6px 11px;border-radius:999px;background:#FF5A1F1A;color:#FF5A1F;font:700 12px/1 Arial,sans-serif">💌 The Proto Post</div>
          <div style="font:800 28px/1.2 Arial,sans-serif;color:#141414;margin-top:14px">Welcome to the workshop!</div>
          <p style="font:16px/1.6 Arial,sans-serif;color:#3a3a38;margin:14px 0 0">${hi}<br>Thanks for subscribing. We're two friends with a 3D printer in Ahmedabad, and once a month we'll send you what we've been making.</p>
        </td></tr>
        <tr><td style="padding:12px 28px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${perks.map(([e, t, d]) => `<tr><td style="width:44px;padding:8px 0;vertical-align:top"><div style="width:36px;height:36px;border-radius:10px;background:#FBF3E6;text-align:center;font:18px/36px Arial,sans-serif">${e}</div></td>
            <td style="padding:8px 0 8px 10px;font:15px/1.45 Arial,sans-serif;color:#1a1a1a"><b>${t}</b> <span style="color:#6d6a63">${d}</span></td></tr>`).join("")}
        </table></td></tr>
        <tr><td style="padding:22px 28px 8px">${btn(base + "media.html", "🎬 Watch our latest reels", "#141414", "#ffffff")}${btn(base + "pricing.html", "⚡ Get an instant price", "#FF5A1F", "#ffffff")}</td></tr>
        <tr><td style="padding:4px 28px 26px;font:14px/1.6 Arial,sans-serif;color:#6d6a63">Got something you want printed? Just reply to this email.<br>Krishna &amp; Deepak, MakeMeProto</td></tr>
      </table>
    </td></tr>
    <tr><td style="padding:22px 6px 4px">${social}</td></tr>
    <tr><td style="padding:10px 6px 16px;font:12px/1.6 Arial,sans-serif;color:#a39d90">MakeMeProto · 3D design and printing · Ahmedabad, Gujarat<br>You're receiving this because you subscribed to The Proto Post on makemeproto.com.<br>
      <a href="${esc(unsubUrl)}" style="color:#a39d90">Unsubscribe in one click</a> · <a href="${base}privacy.html#newsletter" style="color:#a39d90">Privacy Policy</a></td></tr>
  </table>
</td></tr></table></body></html>`;
  const text = `${name ? "Hi " + name : "Hi there"},\n\nWelcome to The Proto Post! Thanks for subscribing. Once a month we'll send you new prints, new reels and vlogs, one practical 3D tip and early offers.\n\nWatch our latest reels: ${base}media.html\nGet an instant price: ${base}pricing.html\n\nBal & Deepak, MakeMeProto\n\nFollow us:\nLinkedIn: ${SOCIAL.linkedin}\nInstagram: ${SOCIAL.instagram}\nEmail: ${SOCIAL.email}\n\nUnsubscribe in one click: ${unsubUrl}`;
  return { subject: "Welcome to The Proto Post 💌", html, text };
}

/* The same LinkedIn, Instagram and email links as the website footer, for every email a customer receives */
const SOCIAL = { linkedin: "https://www.linkedin.com/company/makemeproto", instagram: "https://instagram.com/makemeproto", email: "contact@makemeproto.com" };
function socialRow_(base) {
  const icon = (href, img, alt) => `<a href="${href}" style="display:inline-block;margin-right:10px;text-decoration:none"><img src="${base}assets/email/${img}.png" width="32" height="32" alt="${alt}" style="display:block;border:0;border-radius:50%"></a>`;
  return `<table role="presentation" cellpadding="0" cellspacing="0"><tr>
    <td style="padding-right:6px">${icon(SOCIAL.linkedin, "linkedin", "LinkedIn")}</td>
    <td style="padding-right:6px">${icon(SOCIAL.instagram, "instagram", "Instagram")}</td>
    <td style="padding-right:12px">${icon("mailto:" + SOCIAL.email, "email", "Email")}</td>
    <td style="font:13px/1.4 Arial,sans-serif;color:#6d6a63">Follow along: <a href="${SOCIAL.instagram}" style="color:#141414;font-weight:700;text-decoration:none">@makemeproto</a></td>
  </tr></table>`;
}

/* Run from the editor: logs every active subscriber's email, comma-separated, ready to paste into BCC or a mailing tool */
function exportSubscribers() {
  const sh = subscribersSheet_(), last = sh.getLastRow();
  const emails = last > 1 ? sh.getRange(2, 1, last - 1, TABS.newsletter.length).getValues().filter((r) => /^Subscribed/.test(String(r[2]))).map((r) => r[3]) : [];
  Logger.log(emails.length + " active subscribers:\n" + emails.join(", "));
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

if (typeof module !== "undefined") module.exports = { checkNewOrder, photoIds, checkSupply, checkLog, serviceDue, checkGoogleToken, checkExpense, checkSpool, checkSettings, mergeSettings, checkPayment, checkDocument, checkTask, checkJob, checkUpload, orderMoney, buildReminders, galleryItem, DEFAULT_OPS_SETTINGS, orderStage, checkTrack, buildEmail, buildWelcome, validEmail, checkEntry, looksLike, validPhone, cell, safeName, makeRef, SETTINGS };
