/**
 * Tests des contrats de type pour les memberships (2 rôles : manager / viewer)
 *
 * Vérifie que les fonctions de permission traitent correctement les rôles
 * tels qu'ils arrivent d'un document Firestore (y compris les anciens rôles
 * normalisés par normalizeMembershipRole).
 */

import {
  canRecordEvents,
  canEditEvent,
  canManageFamily,
  canManageMembers,
  canRemoveMember,
} from '@/src/utils/permissions';
import type { MembershipSnap, MembershipWithUser } from '@/src/utils/permissions';

describe('Contrat Firestore — rôle manager', () => {
  const m: MembershipSnap = { role: 'manager' };
  const mu: MembershipWithUser = { role: 'manager', userId: 'u1' };

  it('peut enregistrer', () => expect(canRecordEvents(m)).toBe(true));
  it('peut modifier tout event', () => expect(canEditEvent(mu, { createdByUserId: 'anyone' })).toBe(true));
  it('peut gérer la famille', () => expect(canManageFamily('manager')).toBe(true));
  it('peut gérer les membres', () => expect(canManageMembers('manager')).toBe(true));
  it('peut supprimer un membre', () => expect(canRemoveMember('manager')).toBe(true));
});

describe('Contrat Firestore — rôle viewer (lecture seule)', () => {
  const m: MembershipSnap = { role: 'viewer' };
  const mu: MembershipWithUser = { role: 'viewer', userId: 'u2' };

  it('ne peut pas enregistrer', () => expect(canRecordEvents(m)).toBe(false));
  it('ne peut pas modifier ses propres events', () => expect(canEditEvent(mu, { createdByUserId: 'u2' })).toBe(false));
  it("ne peut pas modifier les events d'autrui", () => expect(canEditEvent(mu, { createdByUserId: 'u-other' })).toBe(false));
  it('ne peut pas gérer la famille', () => expect(canManageFamily('viewer')).toBe(false));
  it('ne peut pas gérer les membres', () => expect(canManageMembers('viewer')).toBe(false));
  it('ne peut pas supprimer un membre', () => expect(canRemoveMember('viewer')).toBe(false));
});

describe('Symétrie manager / manager (co-parents)', () => {
  it('les deux peuvent enregistrer', () => {
    expect(canRecordEvents({ role: 'manager' })).toBe(true);
    expect(canRecordEvents({ role: 'manager' })).toBe(true);
  });
  it('les deux peuvent modifier tout event', () => {
    expect(canEditEvent({ role: 'manager', userId: 'a' }, { createdByUserId: 'b' })).toBe(true);
    expect(canEditEvent({ role: 'manager', userId: 'c' }, { createdByUserId: 'b' })).toBe(true);
  });
  it('les deux peuvent gérer la famille', () => {
    expect(canManageFamily('manager')).toBe(true);
  });
  it('les deux peuvent gérer les membres', () => {
    expect(canManageMembers('manager')).toBe(true);
  });
});

describe('Rétro-compatibilité — anciens rôles Firestore normalisés', () => {
  // normalizeMembershipRole mappe owner/parent → manager, guest → viewer
  // Ces tests vérifient que les fonctions de permission fonctionnent
  // correctement après normalisation (simulation de ce que toMembership fait).
  it('owner normalisé en manager peut enregistrer', () => {
    const normalized: MembershipSnap = { role: 'manager' }; // owner → manager
    expect(canRecordEvents(normalized)).toBe(true);
  });
  it('parent normalisé en manager peut enregistrer', () => {
    const normalized: MembershipSnap = { role: 'manager' }; // parent → manager
    expect(canRecordEvents(normalized)).toBe(true);
  });
  it('guest normalisé en viewer ne peut pas enregistrer', () => {
    const normalized: MembershipSnap = { role: 'viewer' }; // guest → viewer
    expect(canRecordEvents(normalized)).toBe(false);
  });
});
