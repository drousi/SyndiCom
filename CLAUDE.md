# SyndiCom — Expo / React Native

## Stack
- Expo SDK 54, Expo Router 6, React Native
- Supabase (PostgreSQL + RLS)
- React Query v5, Zustand
- TypeScript strict

## Conventions
- Styles via `createStyles(Colors)` + `React.useMemo`
- Toujours `useThemeColors()` — jamais de couleurs hardcodées
- i18n via `useLanguageStore().t()`
- RTL : utiliser `start`/`end` au lieu de `left`/`right`
- Repositories dans `src/db/repositories/`
- Hooks React Query dans `src/hooks/`

## Supabase
- Project ID: mrbalhwgrlvjhvjpujfb
- Région: eu-west-1