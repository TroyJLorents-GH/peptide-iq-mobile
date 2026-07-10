# Peptide IQ — Mobile

Cross-platform (iOS + Android) port of the [peptide-iq web app](../peptide-iq), built with Expo (React Native) + TypeScript. One codebase, both stores.

## Stack

- **Expo SDK 57** (React Native 0.86) + TypeScript
- **Expo Router** — file-based navigation mirroring the web app's routes
- **NativeWind v5 + Tailwind CSS v4** (`react-native-css`) — the web app's light/dark/auto theme and palette, as Tailwind tokens (see `src/global.css`)
- **Supabase JS** — same project, schema, and RLS as the web app; session persisted in AsyncStorage
- **react-native-svg** — serum/PK line charts and the U-100 syringe visual

## Run it

```bash
npm install
cp .env.example .env   # then fill in the Supabase URL + anon key (same as web app)
npx expo start
```

Scan the QR code with **Expo Go** (Android) or the Camera app (iOS), or press `a`/`i` to launch an emulator/simulator. Sign in with the same account you use on the web app — all data syncs through the shared Supabase project.

## Project layout

```
src/
  app/               Expo Router routes
    (tabs)/          Dashboard · Schedule · Calculator · My Peptides · More
    compound/[id]    Compound detail (user compound)
    library/logbook/progress/alerts   pushed from the More tab
    login.tsx        email/password auth (gated via Stack.Protected)
  components/        UI kit (ui.tsx), LineChart, SyringeVisual, modals…
  context/           AppContext (Supabase data), AuthContext, ThemeModeContext
  data/compounds.ts  compound library (copied verbatim from web)
  utils/             calculator, serumModel, schedule, blendMath, tracking (verbatim from web)
  theme/colors.ts    raw palette for charts/icons (mirrors global.css)
  global.css         Tailwind v4 theme — single source of truth for UI colors
```

## Builds

```bash
npm i -g eas-cli
eas login
eas build --platform ios --profile production      # .ipa
eas build --platform android --profile production  # .aab
```

Set the Supabase env vars for EAS builds first (they're not baked into the repo):

```bash
eas env:create --name EXPO_PUBLIC_SUPABASE_URL --value https://… --environment production
eas env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value eyJ… --environment production
```

See **HANDOFF.md** for the full store-submission checklist (accounts, credentials, listing copy, health-app review notes).

## Checks

```bash
npx tsc --noEmit                      # typecheck
npx expo export --platform android   # verify the bundle compiles
```
