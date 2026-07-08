# RN Template — Expo SDK 54 + NativeWind v4 + TypeScript

A full-featured React Native starter using **Expo Router**, **NativeWind v4** (Tailwind CSS for RN), and **TypeScript**, with a working 5-tab navigation setup styled like a social app.

## Stack

- **Expo SDK 54** (React Native 0.76, New Architecture enabled)
- **Expo Router v4** — file-based routing
- **NativeWind v4** — Tailwind CSS classes on native components
- **TypeScript** — strict mode
- **lucide-react-native** — icon set
- **react-native-reanimated** + **gesture-handler** — preconfigured

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Copy env file
cp .env.example .env

# 3. Start the dev server
npx expo start
```

Press `i` for iOS simulator, `a` for Android emulator, or scan the QR code with Expo Go on a physical device.

> Note: this was scaffolded outside of `create-expo-app`, so on first run Expo may ask to install missing native modules — accept the prompt, or run `npx expo install --check` to align all versions with SDK 54.

## Project structure

```
app/
  _layout.tsx           # Root layout: fonts, splash screen, stack navigator
  modal.tsx             # Example modal route
  +not-found.tsx         # 404 fallback
  (tabs)/
    _layout.tsx          # Tab bar config (icons, colors, styles)
    index.tsx            # Home — feed list
    search.tsx           # Search — filterable list
    create.tsx           # Create — post composer
    notifications.tsx    # Notifications list
    profile.tsx           # Profile — stats + menu
  components/
    Button.tsx           # Variant-based button (primary/secondary/ghost/danger)
    Card.tsx              # Reusable surface container
    ScreenHeader.tsx       # Title + subtitle header used per screen

src/
  lib/utils.ts           # cn() className combiner
  types/index.ts         # Shared TS interfaces (User, Post, Notification...)
  hooks/useDebouncedValue.ts
  constants/index.ts     # Color tokens, API base URL

tailwind.config.js       # Color tokens, NativeWind preset
global.css               # Tailwind directives, imported once in root layout
babel.config.js          # nativewind/babel + reanimated plugin
metro.config.js          # withNativeWind wrapper
```

## Styling

Tailwind classes work directly on RN components via NativeWind:

```tsx
<View className="flex-1 bg-background px-4">
  <Text className="text-textPrimary text-lg font-bold">Hello</Text>
</View>
```

Custom color tokens (`background`, `surface`, `primary`, `textPrimary`, etc.) are defined in `tailwind.config.js` — adjust them there to re-theme the whole app.

## Tabs

Tab icons and styling live in `app/(tabs)/_layout.tsx`. To add a tab:

1. Create `app/(tabs)/your-screen.tsx`
2. Add a `<Tabs.Screen name="your-screen" options={{...}} />` entry

## Adding a connector to your own backend (e.g. ally-jis)

The `src/constants/index.ts` file reads `EXPO_PUBLIC_API_URL` from env — point this at your Express backend. For Supabase auth, add `@supabase/supabase-js` and create a client in `src/lib/supabase.ts`, mirroring the pattern from your backend's `supabasePublic` client.

## Known SDK 54 notes

- New Architecture is enabled by default in `app.json` (`newArchEnabled: true`).
- `expo-router` typed routes are turned on via `experiments.typedRoutes` — route names get autocompletion.
- If you hit a native module mismatch, run `npx expo install --check` to auto-align dependency versions with SDK 54.
