/**
 * Demo data for showing the MakeMeProto Ops app.
 * Run addDemoData() to fill the sheet with sample orders, messages, applications, payments,
 * a quote and an invoice, tasks, print jobs, expenses, filament spools and a media post. Run removeDemoData() to delete them again.
 * Every demo row is tagged "Demo data", so real entries are never touched.
 */
const DEMO_TAG = "Demo data";

function addDemoData() {
  removeDemoData();   // never add twice
  const ss = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty("SHEET_ID"));
  const ago = (days, h) => { const d = new Date(); d.setDate(d.getDate() - days); d.setHours(h || 11, (days * 17) % 60, 0, 0); return d; };
  const ref = (p, d, code) => p + "-" + Utilities.formatDate(d, "Asia/Kolkata", "ddMM") + "-" + code;
  const fmt = (d) => Utilities.formatDate(d, "Asia/Kolkata", "EEE d MMM");

  // ---- Quotes (orders) ----
  const orders = [
    // daysAgo, code, status, name, phone, material, infill, colour, qty, weight, size, estimate, notes, update, courier, tracking, expectedInDays
    [0, "K7P", "New", "Riya Sharma", "9999900001", "PLA", 0.2, "White", 1, "85 g", "12 × 8 × 6 cm", "₹420", "Name lamp with 'RIYA' on the front, warm white LED please.", "", "", "", null],
    [2, "M2D", "New", "Arjun Mehta", "9999900002", "PETG", 0.4, "Black", 6, "220 g", "4 × 4 × 2 cm each", "₹960", "Replacement clips for my desk drawer. STL attached.", "", "", "", null],
    [4, "Z9Q", "Quote sent", "Neha Patel", "9999900003", "PLA", 0.15, "Not sure", 1, "310 g", "20 cm tall", "₹1,250", "Miniature of our house for my parents' anniversary, from photos.", "We've sent your quote on WhatsApp. Reply YES to start.", "", "", null],
    [2, "B4T", "Confirmed", "Karan Desai", "9999900004", "PLA", 0.2, "Red", 25, "500 g", "5 cm keychains", "₹2,100", "Company logo keychains for an event on Saturday.", "Design approved! Printing starts tomorrow morning.", "", "", 3],
    [4, "H8C", "Printing", "Ananya Iyer", "9999900005", "Silk PLA", 0.15, "Gold", 2, "180 g", "15 cm", "₹890", "Two trophies for a school chess tournament.", "Halfway there! The first trophy is done and looks great.", "", "", 1],
    [6, "R3W", "Ready", "Vikram Singh", "9999900006", "PETG", 0.3, "Grey", 1, "260 g", "18 × 10 × 7 cm", "₹780", "Phone stand for the car dashboard.", "Your phone stand is ready. Pickup from Bopal or delivery?", "", "", 0],
    [8, "T6N", "Shipped", "Pooja Nair", "9999900007", "PLA", 0.2, "Pastel pink", 4, "140 g", "8 cm", "₹640", "Cute planters for my balcony.", "Packed with care and on its way!", "Delhivery", "DLV2311459870", -2],
    [12, "F1L", "Delivered", "Rahul Joshi", "9999900008", "PLA", 0.2, "White", 1, "95 g", "10 cm", "₹450", "Custom lithophane of my dog.", "Delivered. Thank you for ordering!", "Self pickup", "", null],
    [15, "C5E", "Delivered", "Sneha Kulkarni", "9999900009", "TPU", 0.25, "Black", 10, "60 g", "3 cm", "₹520", "Rubber feet for a speaker.", "Delivered. Hope they fit perfectly!", "Shree Maruti", "SMC88412", null],
    [9, "X2A", "Cancelled", "Amit Verma", "9999900010", "ABS", 0.3, "Blue", 1, "400 g", "25 cm", "₹1,600", "Drone frame.", "Cancelled as requested.", "", "", null],
  ];
  const R = {}, NAME = {}, PHONE = {};
  appendDemo_(ss, "Quotes", TABS.quote, orders.map((o) => {
    const d = ago(o[0], 10 + (o[1].charCodeAt(0) % 9));
    R[o[1]] = ref("Q", d, o[1]); NAME[o[1]] = o[3]; PHONE[o[1]] = o[4];
    const exp = o[16] == null ? "" : fmt(ago(-o[16]));
    return [d, ref("Q", d, o[1]), o[2], o[3], o[4], o[5], o[6], o[7], o[8], o[9], o[10], o[11], o[12], "", DEMO_TAG, o[13], o[14], o[15], exp];
  }));

  // ---- Contact messages ----
  const msgs = [
    [0, "L4S", "New", "Mohit Rana", "9999900011", "3D design", "Can you design a custom enclosure for my Arduino project? I have rough measurements."],
    [1, "P8Y", "New", "Dr. Kavita Shah", "9999900012", "Bulk printing", "We need 200 dental model bases every month. Can we discuss a monthly rate?"],
    [3, "D7U", "Replied", "Sahil Gupta", "9999900013", "Other", "Do you do workshops for school kids? We'd love a 3D printing demo."],
    [7, "Q3J", "Done", "Meera Pillai", "9999900014", "3D printing", "What's the biggest size you can print in one piece?"],
  ];
  appendDemo_(ss, "Contact", TABS.contact, msgs.map((m) => { const d = ago(m[0], 15); return [d, ref("C", d, m[1]), m[2], m[3], m[4], m[5], m[6], DEMO_TAG]; }));

  // ---- Job applications ----
  const apps = [
    [1, "V5K", "New", "3D designer (intern)", "Ishaan Bhatt", "9999900015", "ishaan.demo@example.com", "Ahmedabad", "https://www.behance.net/", "I'm a 3rd-year mechanical student and I've been using Fusion 360 for two years. I'd love to work on real customer products."],
    [5, "G9M", "Replied", "Social media & reels", "Tanvi Joshi", "9999900016", "tanvi.demo@example.com", "Gandhinagar", "https://www.instagram.com/", "I edit reels for two local cafés and would love to show how your prints get made."],
  ];
  appendDemo_(ss, "Careers", TABS.careers, apps.map((a) => { const d = ago(a[0], 18); return [d, ref("J", d, a[1]), a[2], a[3], a[4], a[5], a[6], a[7], a[8], a[9], "", DEMO_TAG]; }));

  // ---- Expenses ----
  const exps = [
    [1, 1499, "Filament", "Krishna", "UPI", "2 × PLA 1 kg, black and white (Robu)"],
    [2, 780, "Courier", "Deepak", "UPI", "Delhivery pickups this week"],
    [4, 349, "Packaging", "Deepak", "Cash", "Bubble wrap and boxes"],
    [6, 2250, "Printer & parts", "Krishna", "Card", "Spare hotend and nozzles"],
    [8, 899, "Filament", "Deepak", "UPI", "Silk PLA gold 1 kg"],
    [10, 499, "Marketing", "Krishna", "UPI", "Instagram boost for the name-lamp reel"],
    [13, 1050, "Software & domains", "Krishna", "Card", "makemeproto.com renewal"],
    [16, 260, "Tools", "Deepak", "Cash", "Deburring tool and sandpaper"],
    [34, 1899, "Filament", "Krishna", "UPI", "PETG black and grey"],
    [38, 650, "Packaging", "Deepak", "UPI", "Branded stickers"],
  ];
  appendDemo_(ss, ADMIN_TAB_TITLES.expenses, ADMIN_TABS.expenses, exps.map((e, i) => {
    const d = ago(e[0]); d.setHours(0, 0, 0, 0);
    return ["E-D" + ("00" + (i + 1)).slice(-3), d, e[1], e[2], e[3], e[4], e[5], DEMO_TAG, new Date()];
  }));

  // ---- Filament stock ----
  const spools = [
    ["PLA", "Black", "eSUN", 1000, 640, 200, ""],
    ["PLA", "White", "eSUN", 1000, 150, 200, "Order more before the name-lamp rush"],
    ["PETG", "Grey", "Polymaker", 1000, 820, 200, ""],
    ["Silk PLA", "Gold", "Sunlu", 1000, 410, 150, "Trophies"],
    ["TPU", "Black", "Sunlu", 500, 90, 100, "Flexible parts only"],
    ["PLA", "Pastel pink", "Elegoo", 1000, 730, 200, ""],
    ["PLA", "Red", "eSUN", 1000, 880, 200, ""],
  ];
  const HEX = { "Black": "#1A1A1A", "White": "#F7F7F5", "Grey": "#8E8E8E", "Gold": "#C9A227", "Pastel pink": "#F8C8DC", "Red": "#D32F2F" };
  appendDemo_(ss, ADMIN_TAB_TITLES.stock, ADMIN_TABS.stock, spools.map((s, i) => ["S-D" + ("00" + (i + 1)).slice(-3), s[0], s[1], s[2], s[3], s[4], s[5], s[6], new Date(), DEMO_TAG, HEX[s[1]] || ""]));

  // ---- Payments (some orders fully paid, some with money still to collect) ----
  const day = (n) => { const d = ago(n); d.setHours(0, 0, 0, 0); return d; };
  const pays = [
    [2, 1000, "B4T", "Advance", "UPI", "50% advance"],
    [4, 500, "H8C", "Advance", "UPI", ""],
    [6, 780, "R3W", "Full payment", "Cash", "Paid at pickup"],
    [8, 640, "T6N", "Full payment", "UPI", ""],
    [12, 450, "F1L", "Full payment", "UPI", ""],
    [15, 300, "C5E", "Advance", "Cash", "Rest on delivery"],
    [3, 200, "", "Full payment", "UPI", "Walk-in: keychain"],
  ];
  appendDemo_(ss, ADMIN_TAB_TITLES.payments, ADMIN_TABS.payments, pays.map((p, i) => [
    "P-D" + ("00" + (i + 1)).slice(-3), day(p[0]), p[1], p[2] ? R[p[2]] : "", p[2] ? NAME[p[2]] : "Walk-in customer", p[2] ? PHONE[p[2]] : "",
    p[3], p[4], p[5], DEMO_TAG, new Date()]));

  // ---- A quote and an invoice ----
  appendDemo_(ss, ADMIN_TAB_TITLES.documents, ADMIN_TABS.documents, [
    ["QT-DEMO-0001", "Quote", day(3), R["Z9Q"], NAME["Z9Q"], PHONE["Z9Q"], "1 × House miniature, 20 cm, painted @ ₹1150\n1 × Gift box @ ₹100", 1250, 0, 0, 1250, DEMO_TAG, new Date()],
    ["INV-DEMO-0001", "Invoice", day(13), R["C5E"], NAME["C5E"], PHONE["C5E"], "10 × TPU speaker feet @ ₹52", 520, 0, 0, 520, DEMO_TAG, new Date()],
  ]);

  // ---- Tasks ----
  const iso = (n) => Utilities.formatDate(ago(-n), "Asia/Kolkata", "yyyy-MM-dd");
  appendDemo_(ss, ADMIN_TAB_TITLES.tasks, ADMIN_TABS.tasks, [
    ["T-D001", "Order 2 kg white PLA", "Deepak", iso(-1), "Open", "", "White spool is almost empty", DEMO_TAG, new Date(), ""],
    ["T-D002", "Post the name-lamp reel", "Krishna", iso(0), "Open", "", "", DEMO_TAG, new Date(), ""],
    ["T-D003", "Call Dr. Kavita about a monthly rate", "Krishna", iso(1), "Open", "", "200 dental bases a month", DEMO_TAG, new Date(), ""],
    ["T-D004", "Send Neha a reminder about her quote", "Deepak", iso(2), "Open", R["Z9Q"], "", DEMO_TAG, new Date(), ""],
    ["T-D005", "Clean and level the printer bed", "Deepak", iso(-3), "Done", "", "", DEMO_TAG, new Date(), Utilities.formatDate(ago(2), "Asia/Kolkata", "dd MMM yyyy, HH:mm")],
  ]);

  // ---- Print queue ----
  appendDemo_(ss, ADMIN_TAB_TITLES.jobs, ADMIN_TABS.jobs, [
    ["J-D001", "Ananya · 2 chess trophies", R["H8C"], "Printer 1", "S-D004", 180, 6, "Printing", 1, Utilities.formatDate(ago(0, 8), "Asia/Kolkata", "dd MMM yyyy, HH:mm"), "", "Supports on, 0.12 mm", DEMO_TAG],
    ["J-D002", "Karan · 25 logo keychains", R["B4T"], "Printer 1", "S-D007", 500, 9.5, "Queued", 2, "", "", "Two plates", DEMO_TAG],
    ["J-D003", "Arjun · 6 drawer clips", R["M2D"], "Printer 1", "S-D003", 220, 4, "Queued", 3, "", "", "", DEMO_TAG],
    ["J-D004", "Vikram · phone stand", R["R3W"], "Printer 1", "S-D003", 260, 5, "Done", 0, "", Utilities.formatDate(ago(6), "Asia/Kolkata", "dd MMM yyyy, HH:mm"), "", DEMO_TAG],
  ]);

  // ---- One media post (not shown on the website) ----
  try {
    const img = UrlFetchApp.fetch("https://amkrys.github.io/makemeproto-preview/develop/assets/og/thumb.png", { muteHttpExceptions: true });
    if (img.getResponseCode() === 200) {
      const file = galleryFolder_().createFile(img.getBlob().setName("demo-post.png"));
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      appendDemo_(ss, ADMIN_TAB_TITLES.media, ADMIN_TABS.media, [
        ["M-D001", day(1), "print", "Our new logo, printed", "Fresh off the printer. #3dprinting #makemeproto", file.getId(), "image", "No", "", "", DEMO_TAG, new Date()],
      ]);
    }
  } catch (e) { Logger.log("No demo media: " + e.message); }

  Logger.log("Demo data added. Open the app and pull down to refresh.");
}

function removeDemoData() {
  const ss = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty("SHEET_ID"));
  let n = 0;
  ["Quotes", "Contact", "Careers", ADMIN_TAB_TITLES.expenses, ADMIN_TAB_TITLES.stock, ADMIN_TAB_TITLES.payments, ADMIN_TAB_TITLES.documents,
    ADMIN_TAB_TITLES.tasks, ADMIN_TAB_TITLES.jobs, ADMIN_TAB_TITLES.media].forEach((title) => {
    const sh = ss.getSheetByName(title);
    if (!sh || sh.getLastRow() < 2) return;
    const vals = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
    for (let i = vals.length - 1; i >= 0; i--) {
      if (vals[i].some((c) => c === DEMO_TAG)) {
        if (title === ADMIN_TAB_TITLES.media && vals[i][5]) { try { DriveApp.getFileById(String(vals[i][5])).setTrashed(true); } catch (e) { /* gone */ } }
        sh.deleteRow(i + 2); n++;
      }
    }
  });
  Logger.log("Removed " + n + " demo rows.");
}

function appendDemo_(ss, title, headers, rows) {
  let sh = ss.getSheetByName(title);
  if (!sh) {
    sh = ss.insertSheet(title);
    sh.appendRow(headers);
    sh.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#FFE4D6");
    sh.setFrozenRows(1);
  }
  // oldest first, so the newest demo rows end up at the bottom like real entries
  const sorted = rows.slice().sort((a, b) => (a[1] instanceof Date && b[1] instanceof Date ? a[1] - b[1] : a[0] - b[0]));
  sh.getRange(sh.getLastRow() + 1, 1, sorted.length, headers.length).setValues(sorted.map((r) => r.slice(0, headers.length)));
}
