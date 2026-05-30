# SyndiCom – Documentation

## Présentation

**SyndiCom** est une application mobile de gestion de syndic d'immeuble, développée avec Expo React Native.

**Architecture** : Local-first (SQLite) + synchronisation automatique Supabase.

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
npx expo install expo-router expo-sqlite expo-secure-store expo-network expo-image-picker expo-file-system expo-constants expo-linking expo-font expo-splash-screen react-native-reanimated react-native-gesture-handler react-native-safe-area-context react-native-screens
npm install -D babel-plugin-module-resolver
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

### 4. Créer le premier utilisateur admin
1. Aller dans **Authentication > Users** sur Supabase
2. Inviter un utilisateur
3. Dans **SQL Editor**, exécuter :
```sql
INSERT INTO user_residences (user_id, residence_id, role)
VALUES ('uuid-de-l-utilisateur', 'uuid-de-la-residence', 'admin');
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
│   ├── index.tsx    # Dashboard
│   ├── contributions/
│   ├── expenses/
│   ├── apartments/
│   └── settings/
src/
├── db/              # SQLite (local-first)
│   └── repositories/ # Couche d'accès aux données
├── supabase/        # Client + moteur de sync
├── store/           # État global (Zustand)
├── components/ui/   # Composants réutilisables
├── schemas/         # Validation Zod
├── types/           # TypeScript interfaces
└── constants/       # Thème, constantes
supabase/
└── schema.sql       # Schéma PostgreSQL + RLS
```

---

## Synchronisation

### Fonctionnement
1. Toute écriture (création/modification/suppression) est d'abord sauvegardée dans SQLite
2. Un enregistrement est ajouté dans la table `sync_queue`
3. Dès qu'une connexion internet est disponible, le moteur de sync traite la queue
4. En cas d'échec, la sync est retentée jusqu'à 3 fois
5. Les éléments synchronisés sont marqués comme `synced=1`

### Déclenchement
- Au lancement de l'app (si réseau disponible)
- Sur changement de connectivité (via `expo-network`)
- Manuellement via **Paramètres → Synchroniser maintenant**

### Indicateur de sync
Un badge discret dans le header indique l'état : syncing / success / error / offline.

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

## Fonctionnalités futures prévues

- [ ] Export PDF des bilans
- [ ] Export Excel
- [ ] Notifications WhatsApp
- [ ] Rappels de paiement automatiques
- [ ] Scan de justificatifs (OCR)
- [ ] Dashboard statistiques avancé
- [ ] Version web admin
