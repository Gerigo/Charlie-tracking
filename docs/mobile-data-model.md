# Modèle de données mobile V1

## Entités

### `userProfiles/{userId}`
- `email`
- `displayName`
- `defaultFamilyId`
- `createdAt`
- `updatedAt`

### `families/{familyId}`
- `name`
- `ownerUserId`
- `inviteCode`
- `parentNames`
- `premiumStatus`
- `createdAt`
- `updatedAt`

### `babies/{babyId}`
- `familyId`
- `firstName`
- `birthDate`
- `sex`
- `createdAt`
- `updatedAt`

### `memberships/{membershipId}`
- `familyId`
- `userId`
- `role`
- `displayName`
- `status`
- `createdAt`
- `updatedAt`

Rôles V1 :
- `owner`
- `parent`
- `caregiver`

### `events/{eventId}`
- `familyId`
- `babyId`
- `type`
- `startTime`
- `endTime`
- `details`
- `notes`
- `createdByUserId`
- `createdByRole`
- `createdAt`
- `updatedAt`

Types V1 :
- `sleep`
- `feed`
- `diaper`
- `medication`
- `growth`
- `temperature`

### `activeSessions/{babyId}`
- `familyId`
- `babyId`
- `eventId`
- `type`
- `startTime`
- `details`
- `createdByUserId`
- `createdByRole`
- `updatedAt`

V1 : seule la session `sleep` est gérée comme session canonique active.

## Intentions produit

- toutes les données métiers appartiennent à un `babyId`
- l’accès se fait via `familyId`
- le créateur est toujours traçable via `createdByUserId` et `createdByRole`
- les permissions fines seront pilotées par `memberships`

## Pourquoi ce schéma

- compatible partage familial
- compatible aidant / caregiver
- compatible commercialisation multi-familles plus tard
- beaucoup plus propre que le modèle web historique centré sur le compte
