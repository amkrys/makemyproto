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
  quote:   ["Received", "Reference", "Status", "Customer name", "WhatsApp number", "Material", "Infill density", "Colour", "Quantity", "Estimated weight", "Dimensions", "Website estimate", "Customer notes", "Attachments", "Submitted from"],
  contact: ["Received", "Reference", "Status", "Customer name", "Phone number", "Service required", "Message", "Submitted from"],
  careers: ["Received", "Reference", "Status", "Position", "Applicant name", "Phone number", "Email address", "City", "Portfolio link", "Cover note", "Attachments", "Submitted from"],
  newsletter: ["Subscribed", "Reference", "Status", "Email address", "First name", "Interests", "Language", "Submitted from", "Unsubscribe key"],
};
const HEADER_VERSION = "3";   // bump when the headers above change; the sheet is updated on the next entry
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
  Object.keys(TABS).forEach((form) => {
    const sh = ss.getSheetByName(TAB_TITLES[form]) || ss.insertSheet(TAB_TITLES[form]);
    sh.getRange(1, 1, 1, TABS[form].length).setValues([TABS[form]]).setFontWeight("bold").setBackground("#FFE4D6");
    sh.setFrozenRows(1);
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
        <tr><td style="padding:4px 28px 26px;font:14px/1.6 Arial,sans-serif;color:#6d6a63">Got something you want printed? Just reply to this email.<br>Bal &amp; Deepak, MakeMeProto</td></tr>
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

if (typeof module !== "undefined") module.exports = { buildEmail, buildWelcome, validEmail, checkEntry, looksLike, validPhone, cell, safeName, makeRef, SETTINGS };
