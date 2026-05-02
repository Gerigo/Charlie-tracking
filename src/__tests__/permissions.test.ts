/**
 * Tests de régression — système de permissions (2 rôles : manager / viewer)
 *
 * Chaque scénario valide un cas d'usage réel.
 * Ces tests sont la source de vérité des règles de permission.
 */
import {
  canEditEvent,
  canManageFamily,
  canManageMembers,
  canPromoteToManager,
  canRecordEvents,
  canRemoveMember,
  defaultJoinRole,
  type EventSnap,
  type MembershipSnap,
  type MembershipWithUser,
} from '@/src/utils/permissions';

// ── Fixtures ────────────────────────────────────────────────────────────────

const manager: MembershipSnap = { role: 'manager' };
const viewer: MembershipSnap = { role: 'viewer' };

const managerWithUser: MembershipWithUser = { role: 'manager', userId: 'user-manager' };
const viewerWithUser: MembershipWithUser = { role: 'viewer', userId: 'user-viewer' };

const ownEvent: EventSnap = { createdByUserId: 'user-manager' };
const otherEvent: EventSnap = { createdByUserId: 'user-other' };

// ── Scénario 1 : Manager — enregistrement d'événements ──────────────────────

describe('Manager — enregistrement', () => {
  it('peut enregistrer des événements', () => {
    expect(canRecordEvents(manager)).toBe(true);
  });

  it('peut modifier n\'importe quel événement', () => {
    expect(canEditEvent(managerWithUser, ownEvent)).toBe(true);
    expect(canEditEvent(managerWithUser, otherEvent)).toBe(true);
  });

  it('peut gérer la famille', () => {
    expect(canManageFamily('manager')).toBe(true);
  });

  it('peut gérer les membres', () => {
    expect(canManageMembers('manager')).toBe(true);
  });

  it('peut retirer un membre', () => {
    expect(canRemoveMember('manager')).toBe(true);
  });

  it('peut promouvoir un viewer en manager', () => {
    expect(canPromoteToManager('manager')).toBe(true);
  });
});

// ── Scénario 2 : Viewer — lecture seule ────────────────────────────────────

describe('Viewer — lecture seule', () => {
  it('ne peut pas enregistrer des événements', () => {
    expect(canRecordEvents(viewer)).toBe(false);
  });

  it('ne peut pas modifier des événements', () => {
    expect(canEditEvent(viewerWithUser, ownEvent)).toBe(false);
    expect(canEditEvent(viewerWithUser, otherEvent)).toBe(false);
  });

  it('ne peut pas gérer la famille', () => {
    expect(canManageFamily('viewer')).toBe(false);
  });

  it('ne peut pas gérer les membres', () => {
    expect(canManageMembers('viewer')).toBe(false);
  });

  it('ne peut pas retirer un membre', () => {
    expect(canRemoveMember('viewer')).toBe(false);
  });

  it('ne peut pas promouvoir', () => {
    expect(canPromoteToManager('viewer')).toBe(false);
  });
});

// ── Scénario 3 : Rôle par défaut au join ────────────────────────────────────

describe('defaultJoinRole', () => {
  it('retourne viewer (lecture seule)', () => {
    expect(defaultJoinRole()).toBe('viewer');
  });

  it('un nouveau viewer ne peut pas écrire', () => {
    const newMember: MembershipSnap = { role: defaultJoinRole() };
    expect(canRecordEvents(newMember)).toBe(false);
    expect(canManageFamily(newMember.role)).toBe(false);
  });
});

// ── Scénario 4 : Promotion viewer → manager ─────────────────────────────────

describe('Promotion viewer -> manager', () => {
  it('un manager peut déclencher la promotion', () => {
    expect(canPromoteToManager('manager')).toBe(true);
  });

  it('un viewer ne peut pas promouvoir quelqu\'un', () => {
    expect(canPromoteToManager('viewer')).toBe(false);
  });

  it('après promotion, le nouveau manager a tous les droits', () => {
    const promoted: MembershipSnap = { role: 'manager' };
    expect(canRecordEvents(promoted)).toBe(true);
    expect(canManageFamily(promoted.role)).toBe(true);
    expect(canManageMembers(promoted.role)).toBe(true);
  });
});

// ── Scénario 5 : Symétrie des managers ──────────────────────────────────────

describe('Symétrie des managers (co-parents)', () => {
  const manager1: MembershipSnap = { role: 'manager' };
  const manager2: MembershipSnap = { role: 'manager' };

  it('les deux managers ont les mêmes droits d\'enregistrement', () => {
    expect(canRecordEvents(manager1)).toBe(canRecordEvents(manager2));
  });

  it('les deux managers peuvent gérer la famille', () => {
    expect(canManageFamily(manager1.role)).toBe(true);
    expect(canManageFamily(manager2.role)).toBe(true);
  });

  it('les deux managers peuvent gérer les membres', () => {
    expect(canManageMembers(manager1.role)).toBe(true);
    expect(canManageMembers(manager2.role)).toBe(true);
  });
});

// ── Scénario 6 : Tentative d'escalade de privilèges ─────────────────────────

describe('Sécurité — pas d\'escalade de privilèges', () => {
  it('un viewer ne peut pas s\'auto-promouvoir', () => {
    expect(canPromoteToManager('viewer')).toBe(false);
  });

  it('un viewer ne peut pas modifier des événements', () => {
    expect(canEditEvent(viewerWithUser, ownEvent)).toBe(false);
  });

  it('un viewer ne peut pas retirer des membres', () => {
    expect(canRemoveMember('viewer')).toBe(false);
  });

  it('un viewer ne peut pas modifier la structure famille', () => {
    expect(canManageFamily('viewer')).toBe(false);
  });
});
