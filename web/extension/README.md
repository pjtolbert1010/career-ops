# career-ops Apply (Chrome extension)

Apply from the dashboard opens the posting in a new tab of your own Chrome, so
Google sign-in and saved site logins work. On a posting page with no form yet,
the extension presses the site's own Apply button once. Once the application
form shows (after you sign in), it reads it, asks career-ops for drafted
answers, and fills the empty fields. It attaches the tailored CV to the resume
upload. It never clicks Submit or Next, never presses Apply on a page that has
a form, never uses "Apply with LinkedIn"-style buttons, never overwrites what is already
on the page, and leaves legal, visa, salary and demographic questions blank,
outlined in orange.

Without the extension, Apply falls back to the Playwright apply window.

## Install (once)

1. Open `chrome://extensions` and turn on **Developer mode** (top right).
2. Click **Load unpacked** and pick this folder (`web/extension`).
3. Make sure `web/.env.local` has the line below, then restart the dashboard:

   ```
   CAREER_OPS_ALLOWED_ORIGINS=chrome-extension://baiobcpkfadkeaelfggkidnnpcigpbdl
   ```

   The ID is fixed by the `key` in `manifest.json`, so it is the same on every
   machine.
4. Pick an AI CLI on the dashboard's Config page if you have not: drafting uses it.

## Use

Press **Apply** on the pipeline. The new tab presses the site's own Apply
button for you; sign in if asked. If the site's button is worded differently
and nothing happens, click it yourself. A career-ops badge in the bottom-right corner shows
progress. On a multi-page form, each new page is filled when it appears. Review
every field, then submit it yourself.

## Files

- `bridge.js` runs on the dashboard and passes the Apply click to the extension.
- `background.js` opens the tab, remembers which tabs career-ops opened, and calls `/api/apply/extension/draft`.
- `filler.js` runs only in those tabs: waits out sign-in, reads the form, fills it.
