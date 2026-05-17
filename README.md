# Charlie v2

Reconstruction propre de l'app de suivi quotidien — React (web) + PWA.

## Stack

- Vite 6 + React 19 + TypeScript
- Tailwind CSS v3 + shadcn/ui (style "new-york", base color stone)
- Firebase Web SDK (Auth + Firestore avec persistance locale)
- `vite-plugin-pwa` (manifest + service worker auto)
- React Router v7

## Setup local

```bash
cd charlie-v2
cp .env.example .env
# Renseigne tes clés Firebase dans .env (mêmes valeurs que l'ancienne app)
npm install
npm run dev
```

## Scripts

| Script | Effet |
|--------|-------|
| `npm run dev` | Serveur de dev Vite (HMR) |
| `npm run build` | Build prod (typecheck + bundle dans `dist/`) |
| `npm run preview` | Sert le bundle prod localement |
| `npm run lint` | Typecheck seul (`tsc --noEmit`) |

## Structure

```
charlie-v2/
├── public/         # Assets statiques (favicons, icons PWA)
├── src/
│   ├── components/ # Composants UI (shadcn dans ./ui/)
│   ├── lib/        # firebase.ts, utils.ts
│   ├── pages/      # Écrans
│   ├── App.tsx     # Routing
│   ├── main.tsx    # Entry point
│   └── index.css   # Tailwind + variables shadcn
├── index.html
├── vite.config.ts
└── tailwind.config.js
```

## Statut

- **Phase 0** — scaffold ✅
- Phases 1–7 — à venir
