# Charlie Web

Base Expo / React Native Web pour la version Web de l'app Charlie.

## Objectif

- réutiliser intégralement la logique métier de la version mobile
- compiler vers une SPA Web statique (pas de natif iOS / Android)
- garder Firebase, Expo Router, react-native-web

## Démarrage

```bash
npm install
npm run start          # dev server (http://localhost:8081)
npm run build          # export statique → dist/
npm run serve          # sert dist/ via npx serve
npm run lint           # tsc --noEmit
npm test               # jest
```

Variables attendues dans `.env.local` :

- `EXPO_PUBLIC_FIREBASE_API_KEY`
- `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
- `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `EXPO_PUBLIC_FIREBASE_APP_ID`
- `EXPO_PUBLIC_APP_ENV`

Exemple complet : [`.env.example`](.env.example).

## Différences avec la version mobile

- pas de dossier `ios/` / `android/`, pas d'EAS Build
- `expo-dev-client`, `expo-device`, `expo-notifications`, `@sentry/react-native` retirés
- `notifications.ts` réécrit pour utiliser l'API Notification du navigateur
- `app.json` : seul le bloc `web` est conservé, `output: "single"` (SPA)
- scripts `npm run ios` / `npm run android` retirés

## Périmètre fonctionnel

Identique à la base mobile :

- Auth email / mot de passe
- Onboarding famille + bébé
- Tracker quotidien, historique, croissance, évolution, social
- Mode invité anonyme via code famille

## Collections Firestore

- `userProfiles`, `families`, `babies`, `events`, `activeSessions`
- `guestSessions`, `inviteCodes`
