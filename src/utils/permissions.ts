/**
 * permissions.ts — Logique de contrôle d'accès (pure, sans effets de bord)
 *
 * 2 rôles :
 *   manager — parents, accès complet (enregistrement, édition, gestion famille)
 *   viewer  — famille élargie, lecture seule (Today / Historique / Croissance / Feed)
 *
 * Toutes les décisions de permission passent par ces fonctions.
 * Elles sont sans état et sans dépendances React pour être facilement testables.
 */
import type { MembershipRole, TrackedEvent } from '@/src/types/domain';

// ── Types de travail ────────────────────────────────────────────────────────

export type MembershipSnap = { role: MembershipRole };
export type MembershipWithUser = { role: MembershipRole; userId: string };
export type EventSnap = Pick<TrackedEvent, 'createdByUserId'>;

// ── Enregistrement d'événements ────────────────────────────────────────────

/**
 * L'utilisateur peut-il enregistrer de nouveaux événements ?
 * manager → oui. viewer → non.
 */
export function canRecordEvents(m: MembershipSnap): boolean {
  return m.role === 'manager';
}

// ── Modification / suppression d'événements ───────────────────────────────

/**
 * L'utilisateur peut-il modifier ou supprimer cet événement ?
 * manager → oui (tous les events).
 * viewer → jamais.
 */
export function canEditEvent(m: MembershipWithUser, _event: EventSnap): boolean {
  return m.role === 'manager';
}

// ── Gestion des membres ────────────────────────────────────────────────────

/**
 * L'utilisateur peut-il gérer les membres (inviter, modifier les rôles) ?
 * Tout manager peut gérer les membres.
 */
export function canManageMembers(actorRole: MembershipRole): boolean {
  return actorRole === 'manager';
}

/**
 * L'utilisateur peut-il supprimer un membre de la famille ?
 * Tout manager.
 */
export function canRemoveMember(actorRole: MembershipRole): boolean {
  return actorRole === 'manager';
}

/**
 * L'utilisateur peut-il promouvoir un viewer en manager ?
 * Tout manager.
 */
export function canPromoteToManager(actorRole: MembershipRole): boolean {
  return actorRole === 'manager';
}

/**
 * L'utilisateur peut-il gérer la structure famille (modifier bébés, paramètres) ?
 * Tout manager.
 */
export function canManageFamily(actorRole: MembershipRole): boolean {
  return actorRole === 'manager';
}

/**
 * Rôle initial assigné à tout nouveau membre rejoignant via code invite.
 * TOUJOURS viewer — un manager doit explicitement promouvoir en manager.
 */
export function defaultJoinRole(): MembershipRole {
  return 'viewer';
}
