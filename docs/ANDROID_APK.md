# TRONX as an installable app

## 1. PWA (done — no store needed)

The web app is an installable PWA (manifest, service worker, offline page, install prompt).

| Platform | How to install |
| --- | --- |
| **iPhone / iPad (Safari)** | Open the site → tap **Share** → **Add to Home Screen** → **Add**. (iOS 16.4+ also allows this from Chrome/Edge.) The in-app "Install" card shows these steps. |
| **Android (Chrome)** | Tap **Install app** in the card/sidebar, or Chrome menu ⋮ → **Install app** / **Add to Home screen**. |
| **Desktop (Chrome / Edge)** | Click **Install app** in the sidebar/card, or the install icon in the address bar. |

Where it shows: guest menu footer (dismissible, remembered 30 days), Restaurant Admin sidebar, Super Admin sidebar.

* Global manifest: `app/manifest.ts` (scope `/`, name TRONX).
* Per-restaurant manifest: `/menu/<slug>/manifest.webmanifest` (name + theme colour from branding, scope `/menu/<slug>/`) — linked automatically from `app/menu/[slug]/layout.tsx`.
* Service worker: `public/sw.js`, registered only in production. It caches only `/_next/static/*` and `/icons/*`, and shows `public/offline.html` when a page navigation fails. It never touches `/api/*`, non-GET requests, HTML, or cross-origin media, so menus/orders/admin sessions are never served stale.
* Icons: `public/icons/*` (regenerate with `npm run pwa:icons`, needs Python Pillow).
* Requires HTTPS (production is). `localhost` works for testing a production build (`npm run build && npm start`).

## 2. Android APK / AAB via Trusted Web Activity (scaffold only — **not built**)

A TWA wraps `https://menu.tronx.co.in` in a Play-Store-ready Android app using Chrome, with no browser UI.
Status: configuration is provided; **no APK/AAB has been built** (this machine has no Android SDK).

Suggested package id: `in.co.tronx.menu` (change before first Play upload — it can't change later).

### Prerequisites
JDK 17, Node 18+, Android SDK (Android Studio or `sdkmanager`). Bubblewrap will offer to download them on first run.

### Steps
1. `npm run android:init` — generates `android-twa/project` from the live manifest (answer prompts; use package id above, host `menu.tronx.co.in`). A reference config is in `android-twa/twa-manifest.json` (copy it into `android-twa/project/` if you want to skip prompts).
2. Create a signing key when prompted (or `keytool -genkeypair -v -keystore android-twa/project/tronx-release.keystore -alias tronx -keyalg RSA -keysize 2048 -validity 10000`). **Back it up; never commit it** (`android-twa/.gitignore` blocks `*.keystore`).
3. `npm run android:build` — outputs `app-release-signed.apk` (sideload/testing) and `app-release-bundle.aab` (Play Store).
4. **Digital Asset Links** (removes the URL bar): get the SHA-256 fingerprint (`bubblewrap fingerprint` or `keytool -list -v -keystore ...`; if you use Play App Signing, use the *Play Console → App integrity* fingerprint too) and publish
   `https://menu.tronx.co.in/.well-known/assetlinks.json` using `android-twa/assetlinks.template.json`. Put the real file at `public/.well-known/assetlinks.json` and deploy. Verify with Google's Statement List tester.
5. Test: `adb install app-release-signed.apk`. Upload the `.aab` to Play Console (needs a $25 developer account).

Caveats: admin/captain pages work inside the TWA but the Android app is "just the website" — it needs connectivity for menus/orders (by design).

## 3. iOS App Store (optional, not set up)

Safari "Add to Home Screen" is the recommended iOS path. For a store listing, wrap the site with Capacitor (`npm i @capacitor/core @capacitor/cli @capacitor/ios`, `npx cap init TRONX in.co.tronx.menu`, set `server.url` to the production URL, `npx cap add ios`, open in Xcode). Apple may reject apps that are only a website wrapper (guideline 4.2) — add native value (push, camera/barcode, printing) first.
