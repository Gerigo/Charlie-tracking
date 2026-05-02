# Stratégie de migration depuis le web existant

## But

Migrer progressivement l’historique actuel vers le nouveau schéma mobile sans casser l’existant.

## Principe

1. garder le web en production tel quel
2. laisser le mobile écrire dans le nouveau schéma
3. migrer l’ancien historique par script dédié
4. faire coexister les deux schémas pendant une période de transition

## Étapes recommandées

### 1. Identifier le tracker partagé actuel
- retrouver le scope historique existant utilisé par le web
- relier ce scope à une nouvelle `family`
- créer un `baby` canonique correspondant à Charlie

### 2. Créer les memberships initiaux
- `owner`
- `parent`
- éventuellement `caregiver`

### 3. Migrer les événements historiques

Pour chaque événement historique :
- créer un `event` V1
- renseigner `familyId`
- renseigner `babyId`
- mapper `userId` vers `createdByUserId`
- mapper `actorRole` ou équivalent vers `createdByRole`

### 4. Reconstituer la session active
- si un sommeil est encore ouvert dans l’historique, peupler `activeSessions/{babyId}`

### 5. Vérification
- comparer les compteurs journaliers web vs mobile
- tester à deux appareils
- vérifier les permissions aidant

## À ne pas faire

- ne pas supprimer le schéma web immédiatement
- ne pas faire dépendre l’App Store d’une migration massive risquée le jour J
- ne pas lancer les permissions fines sans règles Firestore cohérentes
