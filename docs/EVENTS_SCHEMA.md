# Schéma DB — Événements (Firestore)

> Référence portable du modèle de données **événements** (alimentation,
> sommeil, croissance, couches, médicaments, température, tire-lait).
> Extrait du code de l'app legacy (`src/services/productRepository.ts`,
> `src/types/domain.ts`). À réutiliser tel quel dans un autre projet.

> ⚠️ **Point critique** : la collection `events` contient **deux formats**
> qui coexistent. Les données réelles sont probablement en **format legacy**
> (voir §5).

## 1. Collections concernées

| Collection      | Doc ID                                  | Rôle                                              |
| --------------- | --------------------------------------- | ------------------------------------------------- |
| `events`        | auto-généré                             | Tous les événements (1 doc = 1 événement)         |
| `activeSessions`| `babyId` (ou `"charlie-shared"` legacy) | Sommeil en cours (1 seul doc actif à la fois)     |

Tout est au **niveau racine** (pas de sous-collections). Filtrage par
`babyId`+`familyId` (format actuel) ou `trackerId`+`userId` (legacy).

## 2. Document `events` — format actuel

```ts
{
  // — identité / scope —
  familyId: string,
  babyId: string,
  type: 'sleep' | 'feed' | 'diaper' | 'medication' | 'growth' | 'temperature' | 'pumping',

  // — temps (epoch millisecondes, Date.now()) —
  startTime: number,
  endTime: number | null,     // null = sommeil en cours ; = startTime pour events instantanés

  // — contenu —
  notes: string | null,
  details: EventDetails,      // objet, voir §3 (jamais de undefined : champs absents si vides)

  // — métadonnées —
  createdByUserId: string,
  createdByRole: 'manager' | 'viewer',
  createdByLabel?: string,    // dénormalisé ("Papa", "Maman"…)
  createdAt: number,          // epoch ms
  updatedAt: number,          // epoch ms
  serverCreatedAt: Timestamp  // Firestore serverTimestamp()
}
```

## 3. `EventDetails` — sous-objet selon `type`

Tous les champs sont optionnels ; seuls ceux pertinents au `type` sont remplis.

| Champ                                | Type                              | Unité            | Type d'event                       |
| ------------------------------------ | --------------------------------- | ---------------- | ---------------------------------- |
| `feedSide`                           | `'left' \| 'right' \| 'bottle'`   | —                | feed                               |
| `feedAmountMl`                       | number                            | ml               | feed (biberon)                     |
| `bottleSupplement`                   | number                            | ml               | feed (allaitement + complément)    |
| `diaperType`                         | `'wet' \| 'dirty' \| 'both'`      | —                | diaper                             |
| `stoolColor`                         | enum (10 valeurs ↓)               | —                | diaper                             |
| `medicationName`                     | string                            | —                | medication                         |
| `careCategory`                       | `'care' \| 'visit'`               | —                | (soin/visite — voir note)          |
| `temperature`                        | number                            | °C               | temperature                        |
| `temperaturePeriod`                  | `'morning' \| 'evening'`          | —                | temperature                        |
| `weight`                             | number                            | **kg** (ex 4.2)  | growth                             |
| `height`                             | number                            | **cm** (ex 55.4) | growth                             |
| `head`                               | number                            | **cm** (ex 37.5) | growth (périmètre crânien)         |
| `pumpingSide`                        | `'left' \| 'right' \| 'both'`     | —                | pumping                            |
| `pumpingVolumeMl`                    | number                            | ml               | pumping                            |
| `pumpingLeftMl` / `pumpingRightMl`   | number                            | ml               | pumping (si side `both`)           |
| `pumpingDurationMin`                 | number                            | min              | pumping                            |
| `mealTexture`                        | `'puree' \| 'morceaux' \| 'mixte'`| —                | meal (diversification)             |
| `mealFoods`                          | string[]                          | ids catalogue    | meal (peut contenir `"custom"`)    |
| `mealCustom`                         | string                            | —                | meal (aliment libre)               |
| `mealAmount`                         | `goute\|un_peu\|moitie\|tout\|refuse` | —            | meal (quantité qualitative)        |
| `mealGrams`                          | number                            | g (optionnel)    | meal                               |
| `mealReaction`                       | `adore\|aime\|neutre\|refuse`     | —                | meal (appréciation)                |
| `mealAllergy`                        | boolean                           | —                | meal (réaction à surveiller)       |
| `mealSymptoms`                       | string[]                          | —                | meal (si mealAllergy)              |

> Le catalogue d'aliments (`src/lib/food.ts`) est **statique côté code**
> (comme `careKinds`) : la DB ne stocke que des ids. Le "journal des
> aliments" et le suivi allergènes sont **dérivés** des events `meal`.

**`stoolColor`** : `jaune_pale | beige | blanc_mastic | jaune_or | ocre_bronze | vert | marron | noir | blanc | rouge`

Anciennes valeurs anglaises encore tolérées en lecture et normalisées :
`yellow→jaune_or`, `green→vert`, `brown→marron`, `black→noir`, `white→blanc`,
`red→rouge`.

> Note : "soin" et "visite" ne sont **pas** des `type` à part dans l'ancien
> modèle. Le champ `careCategory` existe dans le type mais n'est quasi pas
> écrit. Dans la v2, ils deviendront de vrais types d'events.

## 4. Document `activeSessions` (sommeil live)

Doc ID = `babyId`. Existe **uniquement** pendant un sommeil en cours,
supprimé à l'arrêt.

```ts
{
  familyId: string,
  babyId: string,
  eventId: string,        // pointe vers le doc events correspondant (endTime: null)
  type: 'sleep',
  startTime: number,
  details: {},
  createdByUserId: string,
  createdByRole: 'manager' | 'viewer',
  updatedAt: number
}
```

Logique : démarrer sommeil = transaction qui crée 1 doc `events`
(`endTime: null`) + 1 doc `activeSessions`. Arrêter = set `endTime` sur
l'event + delete le doc `activeSessions`.

## 5. ⚠️ Format LEGACY (probablement les vraies données)

Beaucoup de docs `events` n'ont **ni `familyId` ni `babyId`**, mais :

```ts
{
  type: '...',
  startTime: number,
  endTime: number | null,
  userId: string,                   // au lieu de createdByUserId
  trackerId: 'charlie-shared',      // ← marqueur legacy (LEGACY_TRACKER_SCOPE_ID)
  actorRole: 'manager' | 'viewer',  // au lieu de createdByRole
  details: EventDetails,
  notes: string | null,
  createdByLabel?: string
  // PAS de createdAt/updatedAt/serverCreatedAt garantis
}
```

Constantes de mapping (dans `productRepository.ts`) :

- `trackerId` legacy = `'charlie-shared'`
- mappé vers `familyId = 'legacy-charlie-family'`, `babyId = 'legacy-charlie-baby'`
- date de naissance Charlie : `2026-03-03T12:00:00.000Z`
- `activeSessions` legacy : doc ID = `'charlie-shared'` (pas le babyId)

**Pour migrer/lire dans un autre projet** : interroger `events` où
`trackerId == 'charlie-shared'` **et** où `userId == <uid>`, puis dédupliquer
par doc id (les deux requêtes peuvent se recouvrir). C'est exactement ce que
fait `listenLegacyEvents`. Quand un doc existe en double, garder la version
qui porte `trackerId` (partagée) plutôt que la version `userId` seule.

## 6. Index Firestore requis

Un seul index composite sur `events` :

```
babyId ASC, familyId ASC, startTime DESC
```

Le format legacy n'a pas besoin d'index composite (requêtes mono-champ sur
`trackerId` ou `userId`).

## 7. Conventions

- **Tous les temps** : epoch **millisecondes** (`Date.now()`), pas des
  `Timestamp` Firestore (sauf `serverCreatedAt`).
- **Event instantané** (feed, diaper, growth…) : `endTime === startTime`.
- **Sommeil terminé** : `startTime < endTime`. **En cours** : `endTime === null`.
- Firestore refuse `undefined` → les champs vides sont **absents** de
  `details`, jamais `undefined`.
- Décimales saisies avec `,` converties en `.` avant stockage.

## 8. Type TypeScript prêt à copier

```ts
export type TrackedEventType =
  | 'sleep' | 'feed' | 'diaper' | 'medication'
  | 'growth' | 'temperature' | 'pumping' | 'meal';

export type FeedSide = 'left' | 'right' | 'bottle';
export type DiaperType = 'wet' | 'dirty' | 'both';
export type PumpingSide = 'left' | 'right' | 'both';
export type TemperaturePeriod = 'morning' | 'evening';
export type StoolColor =
  | 'jaune_pale' | 'beige' | 'blanc_mastic' | 'jaune_or' | 'ocre_bronze'
  | 'vert' | 'marron' | 'noir' | 'blanc' | 'rouge';

export interface EventDetails {
  feedSide?: FeedSide;
  feedAmountMl?: number;
  bottleSupplement?: number;
  diaperType?: DiaperType;
  stoolColor?: StoolColor;
  medicationName?: string;
  careCategory?: 'care' | 'visit';
  temperature?: number;        // °C
  temperaturePeriod?: TemperaturePeriod;
  weight?: number;             // kg
  height?: number;             // cm
  head?: number;               // cm
  pumpingSide?: PumpingSide;
  pumpingVolumeMl?: number;
  pumpingLeftMl?: number;
  pumpingRightMl?: number;
  pumpingDurationMin?: number;
}

export interface TrackedEvent {
  id: string;
  familyId: string;
  babyId: string;
  type: TrackedEventType;
  startTime: number;           // epoch ms
  endTime: number | null;
  notes?: string;
  details?: EventDetails;
  createdByUserId: string;
  createdByRole: 'manager' | 'viewer';
  createdByLabel?: string | null;
  createdAt: number;
  updatedAt: number;
}
```
