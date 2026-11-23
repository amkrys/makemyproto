# Website forms → Google Sheet + Drive

The quote, contact and careers forms on the website save every entry to a private Google Sheet, and attached files (STL, photo, resume) to a private Google Drive folder. A small Google Apps Script (`Code.gs`) receives them. It's free and needs no server.

If `CONFIG.forms.endpoint` in `js/main.js` is empty, the forms simply open WhatsApp, like before.

## One-time setup (about 5 minutes)

1. Sign in to the Google account that should own the entries. A dedicated MakeMeProto Gmail is best, because its 15 GB is shared with that account's Gmail and Photos.
2. Open <https://script.google.com> → **New project**. Rename it **MakeMeProto forms**.
3. Delete the sample code, paste the whole of `Code.gs`, and press **Save** (💾).
4. In the toolbar, pick the function **`setup`** and press **Run**.
   - Google asks for permission: **Review permissions** → pick the account → **Advanced** → **Go to MakeMeProto forms (unsafe)** → **Allow**.
   - It says "unsafe" only because Google hasn't reviewed your own private script. The script can only reach this account's Drive, Sheets and email.
5. **View → Logs** (or the Execution log) shows two links: the new **Sheet** and the **Drive folder**. Bookmark both.
6. **Deploy → New deployment** → ⚙️ **Web app**:
   - Description: `v1`
   - Execute as: **Me**
   - Who has access: **Anyone**
   - **Deploy**, then copy the **Web app URL** (it ends in `/exec`).
7. Put that URL in `js/main.js` → `CONFIG.forms.endpoint` (or send it to Claude).

To test, open the URL in a browser. It should show `{"ok":true,"service":"makemeproto-forms"}`.

## Changing the script later

Edit `Code.gs` → **Save** → **Deploy → Manage deployments** → ✏️ → Version: **New version** → **Deploy**. The URL stays the same.

## What lands where

| Form | Sheet tab | Files go to |
|---|---|---|
| Quote (pricing page) | Quotes | Drive › MakeMeProto · Website uploads › Quotes › yyyy-MM |
| Contact | Contact | — |
| Careers | Careers | Drive › … › Careers › yyyy-MM |
| Newsletter (Gallery page + every footer) | Subscribers | — |

Every entry gets a reference like `Q-2411-7GN`. The visitor sees the same reference in the confirmation card, so it matches what they mention on WhatsApp. Use the **Status** column (New → Replied → Ordered…) to track entries. An email goes to `SETTINGS.notifyEmail` for each entry, with a one-tap WhatsApp reply link. Entries from the test site or a local copy are marked `[TEST]`.

## Spam and storage protection

- **File checks, in the browser and again in the script:** only these file types are accepted: `.stl`, `jpg/png/webp/heic`, `pdf/doc/docx`. Each file's first bytes must match its type, so a renamed `.exe` is rejected. Size caps: STL 25 MB, photo 8 MB, resume 5 MB. Big photos are shrunk in the browser first.
- **Bots:** a hidden field that only bots fill in (entry silently dropped), a minimum of 3 seconds on the page, and checks on name, phone and number of links.
- **Rate limits:** 10 entries a minute site-wide, 4 an hour per phone number, 150 a day.
- **Drive budget:** at most 400 MB of uploads a day. Uploads pause when Drive is 85% full: entries still arrive in the sheet, and you get one alert email.
- **Auto clean-up:** a daily job moves quote files older than 120 days and resumes older than 365 days to the Drive trash, which empties itself after 30 days. ⭐ Star a file in Drive to keep it forever.
- **Privacy:** files are private to the owner account. No public links are created.

All of these numbers live in `SETTINGS` at the top of `Code.gs`.

## Limits worth knowing

- Google Apps Script quotas apply per account (for example, 100 emails a day on a free Gmail). They're far above what the site needs.
- A browser can't report real upload progress to Apps Script, so the progress bar is an estimate based on file size.
- STLs bigger than 25 MB are not uploaded. The entry is still saved with a note, and the visitor is asked to share the file on WhatsApp or as a Drive link.

## The Proto Post (newsletter)

- New subscribers land in the **Subscribers** tab. This tab is created automatically on the first sign-up after you update the script. If the same email signs up twice, it is kept only once.
- Each subscriber gets a branded **welcome email** with a one-click **unsubscribe** link (`media.html?unsubscribe=…`). Unsubscribing changes their **Status** to "Unsubscribed · date". Never email anyone whose status isn't "Subscribed".
- To send an issue, run **`exportSubscribers`** in the editor. It logs every active email, comma-separated, ready to paste into BCC. For a nicer setup later, import the tab into a free mailing tool (Brevo or MailerLite), which adds open tracking and unsubscribe handling.
- Settings: `sendWelcome` and `notifyOnSubscribe` (an email to you for each new subscriber) are in `SETTINGS`.

## Gallery content

Reels, BTS clips, photos and vlogs come from `js/media-data.js`. Add an entry with an Instagram reel link, a YouTube video id, or a file in `assets/media/`, then delete the `sample: true` placeholders before going live.
