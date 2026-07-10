# HANDOFF — What you (Troy) must do manually

Everything automatable is done: the app runs, typechecks, and bundles; `app.json`/`eas.json` are configured. The rest requires your accounts, money, or judgment.

---

## 1. Accounts (one-time)

| Step | Cost | Where |
|---|---|---|
| Apple Developer Program | $99/yr | https://developer.apple.com/programs/enroll/ |
| Google Play Developer | $25 one-time | https://play.google.com/console/signup |
| Expo account (free tier fine to start) | free | https://expo.dev/signup |

Apple enrollment can take 24–48 h (identity verification). Enroll as an **individual** unless you have an LLC you want the store listing under.

## 2. EAS setup + credentials

```bash
npm i -g eas-cli
eas login
eas init                 # links this folder to an EAS project (writes projectId into app.json)
```

Set build-time env vars (the repo does not embed them; local dev uses `.env`):

```bash
eas env:create --name EXPO_PUBLIC_SUPABASE_URL --value https://hpwkmfxcmwuvbczpmdkh.supabase.co --environment production --visibility plaintext
eas env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <anon key from web .env> --environment production --visibility plaintext
```

(Repeat for `preview`/`development` environments if you use those profiles.)

Then build — EAS will offer to **generate and manage signing credentials for you** (say yes; it creates the iOS distribution cert/profile and Android keystore in the cloud):

```bash
eas build --platform ios --profile production
eas build --platform android --profile production
```

iOS builds require your Apple Developer account login during the first build so EAS can register the bundle ID `com.troylorents.peptideiq` and create certs.

Submission (after store listings exist):

```bash
eas submit --platform ios
eas submit --platform android
```

Android first submission must be uploaded manually through the Play Console UI once before `eas submit` works.

## 3. Store listings (both stores)

You must write/upload:

- **App name**: "Peptide IQ" (check availability; Apple rejects near-duplicates)
- **Subtitle/short description**, **full description** — describe it as an *educational peptide-tracking journal/calculator*. Do NOT claim it treats, diagnoses, or doses medication for the user.
- **Screenshots** — iPhone 6.7" and 6.5" sets (Apple), phone + 7"/10" tablet (Google, tablet optional since `supportsTablet: false` on iOS). Run the app in a simulator and capture Dashboard, Calculator (with syringe filled), Schedule, Library.
- **App icon** is already in the binary (adapted from the web favicon — a proper 1024×1024 source designed for iOS would look crisper; current one is an upscaled 512px asset).
- **Category**: Health & Fitness (or Medical — see §4; Health & Fitness draws less review scrutiny)
- **Privacy policy URL** — REQUIRED by both stores. Host one (e.g. peptideiq site /privacy). It must cover: account email, dose logs, weight logs stored in Supabase (US region), no sale of data, deletion on request.
- **Apple privacy "nutrition label"**: declares collection of Health & Fitness data + identifiers (email), linked to identity, not used for tracking.
- **Google Data safety form**: same content, Play Console.
- **Account deletion**: Apple REQUIRES in-app account deletion for apps with account creation (guideline 5.1.1(v)). **The app does not have this yet** — add a "Delete Account" action (More tab) that calls a Supabase edge function or RPC to delete the user + rows, or link to a hosted deletion request page, before iOS submission.

## 4. Health-app review risk (read this)

This app does dose math for research peptides. Expect extra scrutiny, especially from Apple:

- **Position it as an educational logbook/calculator**, like a diabetes-syringe or TRT tracker. The in-app medical disclaimer (shown on first launch, ported from web) helps.
- Apple guideline 1.4.1 (medical apps): apps giving dosing calculations "must come from the drug manufacturer, hospitals, insurance companies, …" — *strictly read*, an independent peptide-dose calculator can be rejected. Mitigations: educational framing everywhere, no purchase links, no compound sourcing, keep the "not medical advice" disclaimer prominent (it already is), and answer App Review questions conservatively.
- Have a demo account ready for review notes (email+password that has a couple of compounds and logs) — reviewers won't sign up.
- If rejected under 1.4.1, the fallback is repositioning copy ("reference library + personal journal") and appealing; several similar peptide trackers are live on both stores.
- Google Play is more lenient but fill the **Health apps declaration** in Play Console (added 2024): declare it's a wellness/tracking app, not a medical device.

## 5. Product decisions I made without you (change freely)

- **Tab layout**: 8 web sidebar items → 5 tabs (Dashboard, Schedule, Calculator, My Peptides, More). Library/Activity/Progress/Alerts + theme/sign-out live under **More**.
- **Landing page + public (no-auth) calculator not ported** — mobile boots straight to sign-in. The web/public marketing page doesn't fit an installed app; App Store users are already "acquired". Calculator is inside auth.
- **Sign-up email confirmation** completes via the web app's redirect URL (Supabase project setting), then the user signs in on mobile with email+password. No deep-link/magic-link flow was wired since the web app only uses email+password. If you later add OAuth or magic links, the app scheme `peptideiq://` is registered and ready.
- **Contact Support** is a `mailto:` link on mobile (web used a Web3Forms form).

## 6. Feature parity gaps vs web (known, deliberate)

- **Charts**: custom SVG line charts — no pinch-zoom/pan, no zoom slider, no tap tooltips, no area fill (web used MUI X Charts Pro). Dashboard's "Daily Range" stacked-bar mode was dropped (line mode only).
- **Logbook**: web's calendar card (day/week/month/agenda) replaced by a grouped-by-day feed with type/peptide/search filters; CSV export dropped; feed capped at 100 most-recent events.
- **Compound detail**: CSV export of dose history dropped.
- **Progress**: goal *target date* preserved but not editable; recent entries list shows 8.
- **Color picker**: curated palette swatches only (web also allowed free-form hex).
- **Library**: compound details open in a bottom-sheet modal instead of inline accordions.
- Everything else — compound library data, PK/serum math, reconstitution math, scheduling, vial tracking, stacks/blends, alerts generation, weight tracking — is at parity (the pure logic is copied verbatim from the web repo).

## 7. Nice-to-haves not started

- Push notifications for scheduled doses (expo-notifications; the schedule data model already supports it)
- In-app account deletion (required for iOS — see §3)
- Chart interactivity (victory-native or a gesture layer on the SVG charts)
- Widget/watch complications
