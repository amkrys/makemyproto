/* =========================================================
   Gallery & vlogs: add your reels, BTS clips, photos and vlogs here.
   Newest first. The Gallery page (media.html) builds itself from this list.

   Each item:
     type:     "reel" | "bts" | "print" | "vlog"
     title:    Hinglish title        titleEn: English title
     date:     "YYYY-MM-DD"
     duration: "0:28" (videos only)
     ONE of these for what plays when someone taps it:
       instagram: "https://www.instagram.com/reel/XXXXXXXX/"   (a reel or post link)
       youtube:   "dQw4w9WgXcQ"                                 (the video id from the YouTube link)
       video:     "assets/media/clip.mp4"                       (a file in this repo, keep it under ~10 MB)
       image:     "assets/media/photo.jpg"                      (a photo in this repo)
     poster:   "assets/media/cover.jpg"   optional cover image (otherwise a coloured card with the emoji)
     emoji:    "🖨️"                        shown on the coloured card when there's no poster
     caption / captionEn: one or two lines shown in the viewer
     soon:     true    for something that isn't published yet (shows "Coming soon")

   Items marked  sample: true  are placeholders for the test site. Replace them with real posts
   (or delete them) before this goes live.
   ========================================================= */
window.MEDIA = [
  {
    type: "bts", title: "Humara logo zinda ho gaya ✨", titleEn: "Our logo comes to life ✨",
    date: "2026-11-20", duration: "0:04", video: "assets/brand/makemeproto-logo-animated-4k.mp4", emoji: "✨",
    caption: "Nozzle se nikla filament, aur ban gaya makemeproto. Humara naya animated logo.",
    captionEn: "Filament out of the nozzle, and makemeproto is born. Our new animated logo.",
  },
  {
    sample: true, type: "reel", title: "Phone stand: 0 se 100% tak", titleEn: "Phone stand: from 0 to 100%",
    date: "2026-11-19", duration: "0:28", emoji: "📱",
    caption: "4 ghante ka print, 28 second mein. PLA, 20% infill.", captionEn: "A 4-hour print in 28 seconds. PLA, 20% infill.",
  },
  {
    sample: true, type: "print", title: "Ganesh ji, silk gold PLA", titleEn: "Ganesh ji in silk gold PLA",
    date: "2026-11-18", emoji: "🪔",
    caption: "Humara pehla post, aur sabse pyaara print.", captionEn: "Our very first post, and our favourite print.",
  },
  {
    sample: true, type: "bts", title: "Pehli layer ka drama 😅", titleEn: "First-layer drama 😅",
    date: "2026-11-16", duration: "0:18", emoji: "🧵",
    caption: "Bed levelling se pehle vs baad. Har 3D printer wale ki kahani.", captionEn: "Before and after bed levelling. Every 3D printer owner's story.",
  },
  {
    sample: true, type: "reel", title: "Naam wala lamp kaise banta hai", titleEn: "How a name lamp is made",
    date: "2026-11-14", duration: "0:35", emoji: "💡",
    caption: "Design, print, LED, packing. Ek gift, chaar steps.", captionEn: "Design, print, LEDs, packing. One gift, four steps.",
  },
  {
    sample: true, type: "print", title: "Desk cable clips, matte black", titleEn: "Desk cable clips in matte black",
    date: "2026-11-12", emoji: "🔌",
    caption: "Chhoti cheez, bada sukoon. Ek set mein 4 clips.", captionEn: "Small thing, big relief. Four clips in a set.",
  },
  {
    sample: true, type: "reel", title: "Toota knob → naya knob", titleEn: "Broken knob → brand-new knob",
    date: "2026-11-10", duration: "0:30", emoji: "🔧",
    caption: "Customer ne toota piece bheja, humne measure karke naya print kiya.", captionEn: "A customer sent the broken piece; we measured it and printed a new one.",
  },
  {
    sample: true, type: "bts", title: "Packing day: har order aise jaata hai", titleEn: "Packing day: how every order leaves us",
    date: "2026-11-08", duration: "0:22", emoji: "📦",
  },
  {
    sample: true, soon: true, type: "vlog", title: "Ep 01 · Do dost, ek printer", titleEn: "Ep 01 · Two friends, one printer",
    date: "2026-12-01", duration: "8:40", emoji: "🎬",
    caption: "MakeMeProto kaise shuru hua: idea, naam, pehla printer.", captionEn: "How MakeMeProto started: the idea, the name, the first printer.",
  },
  {
    sample: true, soon: true, type: "vlog", title: "Ep 02 · Pehla customer order", titleEn: "Ep 02 · Our first customer order",
    date: "2026-12-15", duration: "10:15", emoji: "🧾",
    caption: "File se le kar delivery tak, poora safar.", captionEn: "From file to delivery, the whole journey.",
  },
  {
    sample: true, soon: true, type: "vlog", title: "Ep 03 · Printer tuning ke 5 sabak", titleEn: "Ep 03 · 5 lessons from tuning our printer",
    date: "2027-01-01", duration: "12:00", emoji: "🛠️",
    caption: "Jo galtiyan humne ki, taaki aap na karo.", captionEn: "The mistakes we made, so you don't have to.",
  },
];
