# SyndiCom – Documentation

## Présentation

**SyndiCom** est une application mobile de gestion de syndic d'immeuble, développée avec Expo React Native.

**Architecture** : Communication directe et en temps réel avec Supabase (Supabase Client `@supabase/supabase-js`).

---

## Prérequis

- Node.js ≥ 18
- npm ≥ 9
- Expo CLI : `npm install -g expo-cli`
- Un projet Supabase configuré

---

## Installation

```bash
cd D:\DEV_PROJECTS\SyndiCom
npm install
```

---

## Configuration Supabase

### 1. Créer le projet Supabase
1. Aller sur [supabase.com](https://supabase.com) → New project
2. Copier l'URL et la clé anon

### 2. Importer le schéma SQL
1. Aller dans **SQL Editor** sur Supabase
2. Coller le contenu de `supabase/schema.sql`
3. Exécuter

### 3. Configurer les variables d'environnement
```env
EXPO_PUBLIC_SUPABASE_URL=https://votre-projet.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=votre-clé-anon
```

---

## Lancer l'application

```bash
# Mode développement
npm start

# Android (nécessite Android Studio ou appareil physique)
npx expo run:android

# APK de test
npx expo build:android
```

---

## Architecture

```
app/
├── (auth)/          # Écrans non protégés (login, reset)
├── (app)/           # Écrans protégés (tabs)
│   ├── index.tsx    # Dashboard (relances WhatsApp, stats rapides)
│   ├── contributions/
│   ├── expenses/
│   ├── apartments/
│   └── settings/
src/
├── db/              
│   └── repositories/ # Couche d'accès aux données directe Supabase
├── supabase/        # Client Supabase
├── store/           # État global (Zustand)
├── components/ui/   # Composants réutilisables
├── schemas/         # Validation Zod
├── types/           # TypeScript interfaces
└── constants/       # Thème, constantes
supabase/
└── schema.sql       # Schéma PostgreSQL + RLS
```

---

## Rôles utilisateurs

| Action | Admin | Gérant | Résident |
|---|---|---|---|
| Voir les données | ✅ | ✅ | ✅ |
| Créer / Modifier | ✅ | ✅ | ❌ |
| Supprimer | ✅ | ❌ | ❌ |
| Gérer les utilisateurs | ✅ | ❌ | ❌ |

---

## Multi-résidence

- Un utilisateur peut être associé à plusieurs résidences
- La sélection de la résidence active se fait dans **Paramètres**
- Toutes les données sont filtrées par `residence_id`
- Les politiques RLS Supabase garantissent l'isolation des données

---

## Fonctionnalités principales

- Suivi dynamique des cotisations selon la fréquence choisie (mensuelle, trimestrielle, annuelle)
- Export PDF des bilans complets
- Relances de paiement semi-automatiques via WhatsApp
- Rappels locaux de relance sur l'appareil de l'administrateur
