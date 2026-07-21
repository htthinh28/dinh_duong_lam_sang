# dinh_duong_lam_sang (CDSS Dinh dưỡng lâm sàng)

Clinical Decision Support System for clinical nutrition (Vietnamese), built as a
Google Apps Script (GAS) web app, plus a static reference library and an Android
WebView wrapper.

## Cursor Cloud specific instructions

### Components & how to run them
- **Main web app (Google Apps Script)** — backend `Mã.js`, frontend `index.html`
  / `css.html` / `js.html` / `logoB64.html`. This is the core product but it
  **cannot run locally**: it executes on Google's servers (uses `HtmlService`,
  `SpreadsheetApp`, `google.script.run`, and GAS templating like
  `<?!= include('css') ?>`). Opening `index.html` directly in a browser will NOT
  render. The dev workflow is edit → push → test in browser on Google.
  - Dev tooling is `@google/clasp` (installed via `npm install`).
  - `npx clasp status` works offline and lists the 6 files that get pushed
    (filtered by `.claspignore`): `appsscript.json`, `css.html`, `index.html`,
    `js.html`, `logoB64.html`, `Mã.js`.
  - Pushing/deploying (`npm run push:script` → `clasp push -f`) requires Google
    OAuth credentials, provided as the `CLASPRC_JSON` env var (written to
    `~/.clasprc.json`) or via `npx clasp login`. Without these, you can develop
    and lint code locally but cannot deploy. The `CLASPRC_JSON` secret is also
    used by the `clasp-push.yml` GitHub Action.
- **`thu-vien/` reference library** — a self-contained static site (the library
  the CDSS embeds via iframe). This is the only part that runs fully locally:
  serve it with any static server, e.g. `python3 -m http.server 8910` from the
  `thu-vien/` directory, then open `http://localhost:8910/index.html`.
  Note: `thu-vien/index.html` is ~31MB, so first load takes 10–30s.
- **`android-webview/`** — a thin Android wrapper around the deployed web app URL
  (set in `gradle.properties` `WEB_APP_URL`). Building requires the Android SDK
  (NOT part of the base image) plus Java (Java 21 is available). Build with
  `./gradlew assembleDebug` after installing the SDK.

### Lint / test / build
- No linters or automated tests are configured in this repo.
- "Build/deploy" for the main app = `clasp push` (needs OAuth, deploys to Google).
- The `thu-vien/` library has no build step — it is plain static HTML/JS.

### Gotchas
- `thu-vien/` is intentionally excluded from clasp (`.claspignore`). Data files
  under `thu-vien/chandoan-html/` use the `.mjs` extension on purpose so clasp
  does not push them to Apps Script (which would cause `window is not defined`).
- The main source file is named `Mã.js` (with Vietnamese diacritics) — keep the
  exact filename; clasp maps it to the `Mã` script file.
