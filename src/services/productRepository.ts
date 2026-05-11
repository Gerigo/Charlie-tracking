import {
  createUserWithEmailAndPassword,
  deleteUser as firebaseDeleteUser,
  onAuthStateChanged,
  reauthenticateWithCredential,
  EmailAuthProvider,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  type FirestoreError,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { firebaseAuth, firestore, storage } from '@/src/lib/firebase';
import type {
  ActiveSession,
  AppLanguage,
  BabyAvatarKey,
  BabyProfile,
  BabySex,
  EventDetails,
  FeedingMode,
  Family,
  FamilyMember,
  InitialSetupInput,
  MembershipRole,
  ParentsCombination,
  TrackedEvent,
  TrackedEventType,
  UserProfile,
} from '@/src/types/domain';
import { comboToParentNames } from '@/src/utils/parentsCombinationMap';

export const LEGACY_TRACKER_SCOPE_ID = 'charlie-shared';
export const LEGACY_TRACKER_FAMILY_ID = 'legacy-charlie-family';
export const LEGACY_TRACKER_BABY_ID = 'legacy-charlie-baby';
export const LEGACY_TRACKER_BIRTH_DATE = new Date('2026-03-03T12:00:00.000Z').toISOString();

export type LegacySnapshotErrorSource = 'shared-events' | 'user-events' | 'active-session';

export interface LegacySnapshotError {
  source: LegacySnapshotErrorSource;
  error: FirestoreError;
}

function requireAuth() {
  if (!firebaseAuth) throw new Error("L'authentification Firebase n'est pas configurée.");
  return firebaseAuth;
}

function requireFirestore() {
  if (!firestore) throw new Error("Firestore n'est pas configuré.");
  return firestore;
}

function now() {
  return Date.now();
}

function normalizeStoolColor(value: unknown): EventDetails['stoolColor'] | undefined {
  switch (value) {
    case 'jaune_pale':
    case 'beige':
    case 'blanc_mastic':
    case 'jaune_or':
    case 'ocre_bronze':
    case 'vert':
    case 'marron':
    case 'noir':
    case 'blanc':
    case 'rouge':
      return value;
    case 'yellow':
      return 'jaune_or';
    case 'green':
      return 'vert';
    case 'brown':
      return 'marron';
    case 'black':
      return 'noir';
    case 'white':
      return 'blanc';
    case 'red':
      return 'rouge';
    default:
      return undefined;
  }
}

function normalizeEventDetails(data: any): EventDetails | undefined {
  if (!data || typeof data !== 'object') return undefined;

  return {
    ...data,
    stoolColor: normalizeStoolColor(data.stoolColor),
    feedAmountMl: typeof data.feedAmountMl === 'number' ? data.feedAmountMl : undefined,
  };
}

/**
 * Normalise le rôle Firestore vers le modèle 2 rôles.
 * Assure la rétro-compatibilité avec l'ancien schéma 3 rôles (owner/parent/guest).
 * Gardé pour rétro-compat dans toTrackedEvent / toActiveSession.
 */
function normalizeMembershipRole(raw: unknown): MembershipRole {
  if (raw === 'manager' || raw === 'viewer') return raw;
  // Rétro-compatibilité : mapper les anciens rôles
  if (raw === 'owner' || raw === 'parent') return 'manager';
  if (raw === 'guest') return 'viewer';
  return 'viewer'; // fallback sécurisé
}

function toUserProfile(id: string, data: any): UserProfile {
  return {
    id,
    email: data.email ?? '',
    displayName: data.displayName ?? '',
    photoUrl: typeof data.photoUrl === 'string' ? data.photoUrl : null,
    defaultBabyId: data.defaultBabyId ?? null,
    // Rétro-compat : ancien schéma utilisait defaultFamilyId
    familyId: typeof data.familyId === 'string' ? data.familyId
            : typeof data.defaultFamilyId === 'string' ? data.defaultFamilyId
            : null,
    language: data.language === 'en' ? 'en' : 'fr',
    createdAt: typeof data.createdAt === 'number' ? data.createdAt : now(),
    updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : now(),
  };
}

function toFamilyMember(data: any): FamilyMember {
  return {
    uid: data.uid ?? '',
    displayName: data.displayName ?? '',
    parentLabel: typeof data.parentLabel === 'string' ? data.parentLabel : null,
    role: normalizeMembershipRole(data.role),
  };
}

function toFamily(id: string, data: any): Family {
  const rawMembers = Array.isArray(data.members) ? data.members : [];
  const combo = data.parentsCombination;
  const validCombo: ParentsCombination | undefined =
    combo === 'papa_maman' || combo === 'papa_papa' || combo === 'maman_maman' || combo === 'papa' || combo === 'maman'
      ? combo
      : undefined;
  return {
    id,
    name: data.name ?? 'Ma famille',
    ownerUserId: data.ownerUserId ?? '',
    inviteCode: data.inviteCode,
    managerCode: data.managerCode,
    viewerCode: data.viewerCode,
    parentsCombination: validCombo,
    // Legacy fields — lus mais plus écrits, gardés pour rétrocompat
    managerIds: Array.isArray(data.managerIds) && data.managerIds.length > 0
      ? data.managerIds
      : (data.ownerUserId ? [data.ownerUserId] : []),
    viewerIds: Array.isArray(data.viewerIds) ? data.viewerIds : [],
    members: rawMembers.map(toFamilyMember),
    parentNames: Array.isArray(data.parentNames) ? data.parentNames : [],
    visitTypes: Array.isArray(data.visitTypes) ? data.visitTypes.filter((value: unknown) => typeof value === 'string') : [],
    careTypes: Array.isArray(data.careTypes) ? data.careTypes.filter((value: unknown) => typeof value === 'string') : [],
    premiumStatus: data.premiumStatus === 'premium' ? 'premium' : 'free',
    createdAt: typeof data.createdAt === 'number' ? data.createdAt : now(),
    updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : now(),
  };
}

function toBabyProfile(id: string, data: any): BabyProfile {
  const avatarKey = data.avatarKey;
  return {
    id,
    familyId: data.familyId ?? '',
    firstName: data.firstName ?? 'Bébé',
    birthDate: data.birthDate ?? new Date().toISOString(),
    sex: data.sex === 'girl' ? 'girl' : 'boy',
    feedingMode: data.feedingMode === 'bottle' || data.feedingMode === 'mixed' ? data.feedingMode : 'breastfeeding',
    avatarKey:
      avatarKey === 'babyAvatar' || avatarKey === 'trackerBaby' || avatarKey === 'growthBaby' || avatarKey === 'childOne' || avatarKey === 'childTwo'
        ? avatarKey
        : 'babyAvatar',
    photoUrl: typeof data.photoUrl === 'string' ? data.photoUrl : null,
    createdAt: typeof data.createdAt === 'number' ? data.createdAt : now(),
    updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : now(),
  };
}

function toTrackedEvent(id: string, data: any): TrackedEvent {
  return {
    id,
    familyId: data.familyId ?? '',
    babyId: data.babyId ?? '',
    type: data.type,
    startTime: typeof data.startTime === 'number' ? data.startTime : now(),
    endTime: typeof data.endTime === 'number' ? data.endTime : null,
    notes: data.notes,
    details: normalizeEventDetails(data.details),
    createdByUserId: data.createdByUserId ?? data.userId ?? '',
    createdByRole: normalizeMembershipRole(data.createdByRole ?? 'manager'),
    createdByLabel: typeof data.createdByLabel === 'string' ? data.createdByLabel : null,
    createdAt: typeof data.createdAt === 'number' ? data.createdAt : now(),
    updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : now(),
  };
}

function toActiveSession(id: string, data: any): ActiveSession {
  return {
    id,
    familyId: data.familyId ?? '',
    babyId: data.babyId ?? id,
    eventId: data.eventId ?? '',
    type: 'sleep',
    startTime: typeof data.startTime === 'number' ? data.startTime : now(),
    details: data.details,
    createdByUserId: data.createdByUserId ?? data.userId ?? '',
    createdByRole: normalizeMembershipRole(data.createdByRole ?? 'manager'),
    updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : now(),
  };
}

function toLegacyMembershipRole(actorRole?: unknown): MembershipRole {
  return actorRole === 'guest' ? 'viewer' : 'manager';
}

function getLegacyActorRole(user: User): 'manager' | 'viewer' {
  if (user.isAnonymous) return 'viewer';
  const email = user.email?.trim().toLowerCase();
  if (email === 'invite@charlie.com') return 'viewer';
  return 'manager';
}

function toLegacyTrackedEvent(id: string, data: any): TrackedEvent {
  return {
    id,
    familyId: LEGACY_TRACKER_FAMILY_ID,
    babyId: LEGACY_TRACKER_BABY_ID,
    type: data.type,
    startTime: typeof data.startTime === 'number' ? data.startTime : now(),
    endTime: typeof data.endTime === 'number' ? data.endTime : null,
    notes: data.notes,
    details: normalizeEventDetails(data.details),
    createdByUserId: data.userId ?? '',
    createdByRole: toLegacyMembershipRole(data.actorRole),
    createdAt: typeof data.createdAt === 'number' ? data.createdAt : (typeof data.startTime === 'number' ? data.startTime : now()),
    updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : (typeof data.startTime === 'number' ? data.startTime : now()),
  };
}

function toLegacyActiveSession(id: string, data: any): ActiveSession | null {
  if (data.type !== 'sleep') return null;

  return {
    id,
    familyId: LEGACY_TRACKER_FAMILY_ID,
    babyId: LEGACY_TRACKER_BABY_ID,
    eventId: data.eventId ?? '',
    type: 'sleep',
    startTime: typeof data.startTime === 'number' ? data.startTime : now(),
    details: normalizeEventDetails(data.details),
    createdByUserId: data.userId ?? '',
    createdByRole: toLegacyMembershipRole(data.actorRole),
    updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : now(),
  };
}

const INVITE_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const INVITE_CODE_LENGTH = 6;

function generateSecureInviteCode(length: number = INVITE_CODE_LENGTH): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += INVITE_CODE_ALPHABET[Math.floor(Math.random() * INVITE_CODE_ALPHABET.length)];
  }
  return code;
}

async function generateUniqueInviteCode(
  db: ReturnType<typeof requireFirestore>,
  length: number = INVITE_CODE_LENGTH,
  maxAttempts = 10,
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = generateSecureInviteCode(length);
    const existing = await getDoc(doc(db, 'inviteCodes', candidate));
    if (!existing.exists()) return candidate;
  }
  throw new Error("Impossible de générer un code d'invitation unique.");
}

async function generateUniqueInviteCodePair(
  db: ReturnType<typeof requireFirestore>,
): Promise<{ managerCode: string; viewerCode: string }> {
  const managerCode = await generateUniqueInviteCode(db);
  let viewerCode = await generateUniqueInviteCode(db);

  while (viewerCode === managerCode) {
    viewerCode = await generateUniqueInviteCode(db);
  }

  return { managerCode, viewerCode };
}

async function createJoinRequest(userId: string, familyId: string, role: 'manager' | 'viewer', code: string): Promise<void> {
  await setDoc(doc(requireFirestore(), 'joinRequests', userId), {
    familyId,
    role,
    code: code.trim().toUpperCase(),
    updatedAt: now(),
  });
}

export function listenToAuth(callback: (user: User | null) => void) {
  return onAuthStateChanged(requireAuth(), callback);
}

export async function signIn(email: string, password: string) {
  const result = await signInWithEmailAndPassword(requireAuth(), email.trim(), password);
  return result.user;
}

export async function signUp(params: { email: string; password: string; displayName: string; language?: AppLanguage }) {
  const auth = requireAuth();
  const db = requireFirestore();
  const result = await createUserWithEmailAndPassword(auth, params.email.trim(), params.password);
  if (params.displayName.trim()) {
    await updateProfile(result.user, { displayName: params.displayName.trim() });
  }

  const timestamp = now();
  await setDoc(doc(db, 'userProfiles', result.user.uid), {
    email: params.email.trim(),
    displayName: params.displayName.trim(),
    defaultBabyId: null,
    familyId: null,
    language: params.language === 'en' ? 'en' : 'fr',
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  return result.user;
}

export async function signOut() {
  await firebaseSignOut(requireAuth());
}

/**
 * RGPD — cascade-deletes all data the user owns:
 *  - if owner of a family: family, babies, events, activeSessions, inviteCodes,
 *    guestSessions tied to that family
 *  - userProfile
 *  - guestSession (if user was a guest)
 *  - finally the Firebase Auth account itself
 *
 * Re-authentication is required immediately before because Firebase Auth
 * forbids `deleteUser` after a long-lived session for security reasons.
 */
export async function deleteAccount(input: { password: string }): Promise<void> {
  const auth = requireAuth();
  const db = requireFirestore();
  const user = auth.currentUser;
  if (!user) throw new Error('Aucun utilisateur connecté.');
  if (!user.email) throw new Error("Suppression auto impossible pour ce type de compte.");

  // Re-auth — required by Firebase before deleting an account
  const credential = EmailAuthProvider.credential(user.email, input.password);
  await reauthenticateWithCredential(user, credential);

  const uid = user.uid;

  // 1. Resolve the user's familyId (if any) to scope the cascade
  const profileSnap = await getDoc(doc(db, 'userProfiles', uid));
  const profileData = profileSnap.exists() ? profileSnap.data() : null;
  const familyId: string | null =
    typeof profileData?.familyId === 'string'
      ? profileData.familyId
      : typeof profileData?.defaultFamilyId === 'string'
        ? profileData.defaultFamilyId
        : null;

  // 2. If owner of the family → cascade family-scoped data
  if (familyId) {
    const familySnap = await getDoc(doc(db, 'families', familyId));
    const isOwner = familySnap.exists() && familySnap.data().ownerUserId === uid;
    if (isOwner) {
      await cascadeDeleteFamily(db, familyId);
    }
  }

  // 3. Delete guest session if any
  try { await deleteDoc(doc(db, 'guestSessions', uid)); } catch { /* not a guest */ }

  // 4. Delete the user profile
  try { await deleteDoc(doc(db, 'userProfiles', uid)); } catch { /* tolerate */ }

  // 5. Finally delete the Firebase Auth account — this also signs the user out
  await firebaseDeleteUser(user);
}

async function cascadeDeleteFamily(db: ReturnType<typeof requireFirestore>, familyId: string): Promise<void> {
  // Delete in chunks of 400 to stay under the Firestore 500-write batch limit.
  const BATCH = 400;
  async function deleteWhere(collectionName: string, fieldName: string, value: string) {
    const snap = await getDocs(query(collection(db, collectionName), where(fieldName, '==', value)));
    let buffer: Array<{ ref: ReturnType<typeof doc> }> = snap.docs.map((d) => ({ ref: d.ref }));
    while (buffer.length > 0) {
      const chunk = buffer.slice(0, BATCH);
      buffer = buffer.slice(BATCH);
      const batch = writeBatch(db);
      chunk.forEach((c) => batch.delete(c.ref));
      await batch.commit();
    }
  }

  await deleteWhere('events', 'familyId', familyId);
  await deleteWhere('activeSessions', 'familyId', familyId);
  await deleteWhere('babies', 'familyId', familyId);
  await deleteWhere('inviteCodes', 'familyId', familyId);
  await deleteWhere('guestSessions', 'familyId', familyId);
  // Finally the family itself
  try { await deleteDoc(doc(db, 'families', familyId)); } catch { /* tolerate */ }
}

/** Met à jour la combinaison de parents de la famille et synchronise parentNames. */
export async function updateFamilyParentsCombination(
  familyId: string,
  combination: ParentsCombination,
): Promise<void> {
  await updateDoc(doc(requireFirestore(), 'families', familyId), {
    parentsCombination: combination,
    parentNames: comboToParentNames(combination),
    updatedAt: now(),
  });
}

export function listenUserProfile(userId: string, callback: (profile: UserProfile | null) => void): Unsubscribe {
  return onSnapshot(
    doc(requireFirestore(), 'userProfiles', userId),
    (snapshot) => { callback(snapshot.exists() ? toUserProfile(snapshot.id, snapshot.data()) : null); },
    (err) => { console.warn('[listenUserProfile]', err.code); callback(null); },
  );
}

export function listenFamily(familyId: string, callback: (family: Family | null) => void): Unsubscribe {
  return onSnapshot(
    doc(requireFirestore(), 'families', familyId),
    (snapshot) => { callback(snapshot.exists() ? toFamily(snapshot.id, snapshot.data()) : null); },
    (err) => { console.warn('[listenFamily]', err.code); callback(null); },
  );
}

export function listenBabies(familyId: string, callback: (babies: BabyProfile[]) => void): Unsubscribe {
  const babiesQuery = query(collection(requireFirestore(), 'babies'), where('familyId', '==', familyId));
  return onSnapshot(
    babiesQuery,
    (snapshot) => { callback(snapshot.docs.map((item) => toBabyProfile(item.id, item.data())).sort((a, b) => a.createdAt - b.createdAt)); },
    (err) => { console.warn('[listenBabies]', err.code); callback([]); },
  );
}

export function listenEvents(
  babyId: string,
  familyId: string,
  callback: (events: TrackedEvent[]) => void,
  onError?: (err: FirestoreError) => void,
  sinceTimestamp?: number,
): Unsubscribe {
  // When `sinceTimestamp` is provided, the realtime listener only follows
  // recent events (Today / Tracker / GrowthSpurt detection only need ~14 d).
  // Older events are loaded on demand via `fetchEventsBeforeTimestamp` when
  // the user opens Évolution / Croissance / Historique / Export.
  const eventsQuery = typeof sinceTimestamp === 'number'
    ? query(
        collection(requireFirestore(), 'events'),
        where('babyId', '==', babyId),
        where('familyId', '==', familyId),
        where('startTime', '>=', sinceTimestamp),
      )
    : query(
        collection(requireFirestore(), 'events'),
        where('babyId', '==', babyId),
        where('familyId', '==', familyId),
      );
  return onSnapshot(
    eventsQuery,
    (snapshot) => { callback(snapshot.docs.map((item) => toTrackedEvent(item.id, item.data())).sort((a, b) => b.startTime - a.startTime)); },
    (err) => { console.warn('[listenEvents]', err.code); onError?.(err); },
  );
}

/**
 * One-shot fetch for events strictly older than `beforeTimestamp`. Used to
 * back-fill the full history when a screen explicitly needs it (lifetime
 * stats, growth curves, full-history journal). Subsequent reads are served
 * from Firestore's IndexedDB cache thanks to `persistentLocalCache`.
 */
export async function fetchEventsBeforeTimestamp(
  babyId: string,
  familyId: string,
  beforeTimestamp: number,
): Promise<TrackedEvent[]> {
  const olderQuery = query(
    collection(requireFirestore(), 'events'),
    where('babyId', '==', babyId),
    where('familyId', '==', familyId),
    where('startTime', '<', beforeTimestamp),
  );
  const snapshot = await getDocs(olderQuery);
  return snapshot.docs
    .map((item) => toTrackedEvent(item.id, item.data()))
    .sort((a, b) => b.startTime - a.startTime);
}

export function listenActiveSession(babyId: string, callback: (session: ActiveSession | null) => void): Unsubscribe {
  return onSnapshot(
    doc(requireFirestore(), 'activeSessions', babyId),
    (snapshot) => { callback(snapshot.exists() ? toActiveSession(snapshot.id, snapshot.data()) : null); },
    (err) => { console.warn('[listenActiveSession]', err.code); },
  );
}

export function listenLegacyEvents(
  userId: string,
  callback: (events: TrackedEvent[]) => void,
  onError?: (payload: LegacySnapshotError) => void,
): Unsubscribe {
  const db = requireFirestore();
  const sharedQuery = query(collection(db, 'events'), where('trackerId', '==', LEGACY_TRACKER_SCOPE_ID));
  const userQuery = query(collection(db, 'events'), where('userId', '==', userId));

  let sharedDocs: Array<{ id: string; data: any }> = [];
  let userDocs: Array<{ id: string; data: any }> = [];

  const emit = () => {
    const byId = new Map<string, { id: string; data: any }>();

    [...sharedDocs, ...userDocs].forEach((item) => {
      const existing = byId.get(item.id);
      const shouldReplace = !existing || (!existing.data?.trackerId && Boolean(item.data?.trackerId));
      if (shouldReplace) {
        byId.set(item.id, item);
      }
    });

    callback(
      [...byId.values()]
        .map((item) => toLegacyTrackedEvent(item.id, item.data))
        .sort((left, right) => right.startTime - left.startTime),
    );
  };

  const unsubscribeShared = onSnapshot(
    sharedQuery,
    (snapshot) => {
      sharedDocs = snapshot.docs.map((item) => ({ id: item.id, data: item.data() }));
      emit();
    },
    (error) => {
      sharedDocs = [];
      onError?.({ source: 'shared-events', error });
      emit();
    },
  );

  const unsubscribeUser = onSnapshot(
    userQuery,
    (snapshot) => {
      userDocs = snapshot.docs.map((item) => ({ id: item.id, data: item.data() }));
      emit();
    },
    (error) => {
      userDocs = [];
      onError?.({ source: 'user-events', error });
      emit();
    },
  );

  return () => {
    try { unsubscribeShared(); } catch {}
    try { unsubscribeUser(); } catch {}
  };
}

export function listenLegacyActiveSession(
  callback: (session: ActiveSession | null) => void,
  onError?: (payload: LegacySnapshotError) => void,
): Unsubscribe {
  return onSnapshot(
    doc(requireFirestore(), 'activeSessions', LEGACY_TRACKER_SCOPE_ID),
    (snapshot) => {
      callback(snapshot.exists() ? toLegacyActiveSession(snapshot.id, snapshot.data()) : null);
    },
    (error) => {
      onError?.({ source: 'active-session', error });
      callback(null);
    },
  );
}

export async function createInitialSetup(user: User, input: InitialSetupInput) {
  const db = requireFirestore();
  const familyRef = doc(collection(db, 'families'));
  const babyRef = doc(collection(db, 'babies'));
  const profileRef = doc(db, 'userProfiles', user.uid);
  const timestamp = now();
  const isEnglish = input.language === 'en';
  const ownerDisplayName = input.ownerDisplayName.trim() || user.displayName || user.email || 'Parent';
  const familyName = input.familyName.trim() || `${isEnglish ? 'Family' : 'Famille'} ${ownerDisplayName.split(' ')[0] || 'Parent'}`;

  const { managerCode, viewerCode } = await generateUniqueInviteCodePair(db);
  const managerCodeRef = doc(db, 'inviteCodes', managerCode);
  const viewerCodeRef = doc(db, 'inviteCodes', viewerCode);

  const setupBatch = writeBatch(db);

  setupBatch.set(familyRef, {
    name: familyName,
    ownerUserId: user.uid,
    managerCode,
    viewerCode,
    managerIds: [user.uid],
    viewerIds: [],
    members: [{
      uid: user.uid,
      displayName: ownerDisplayName,
      parentLabel: null,
      role: 'manager',
    }],
    // Par défaut Papa & Maman — l'utilisateur peut changer depuis Settings
    parentsCombination: 'papa_maman',
    parentNames: comboToParentNames('papa_maman'),
    visitTypes: [],
    careTypes: [],
    premiumStatus: 'free',
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  setupBatch.set(babyRef, {
    familyId: familyRef.id,
    firstName: input.babyName.trim() || (isEnglish ? 'Baby' : 'Bébé'),
    birthDate: input.birthDate,
    sex: input.sex,
    feedingMode: input.feedingMode,
    avatarKey: 'babyAvatar',
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  setupBatch.set(profileRef, {
    email: user.email ?? '',
    displayName: ownerDisplayName,
    defaultBabyId: babyRef.id,
    familyId: familyRef.id,
    language: input.language === 'en' ? 'en' : 'fr',
    createdAt: timestamp,
    updatedAt: timestamp,
  }, { merge: true });

  await setupBatch.commit();

  const inviteCodeBatch = writeBatch(db);
  inviteCodeBatch.set(managerCodeRef, {
    familyId: familyRef.id,
    familyName,
    type: 'manager',
    createdAt: timestamp,
  });

  inviteCodeBatch.set(viewerCodeRef, {
    familyId: familyRef.id,
    familyName,
    type: 'viewer',
    createdAt: timestamp,
  });

  try {
    await inviteCodeBatch.commit();
  } catch (error) {
    const retryResults = await Promise.allSettled([
      setDoc(managerCodeRef, {
        familyId: familyRef.id,
        familyName,
        type: 'manager',
        createdAt: timestamp,
      }),
      setDoc(viewerCodeRef, {
        familyId: familyRef.id,
        familyName,
        type: 'viewer',
        createdAt: timestamp,
      }),
    ]);

    if (retryResults.some((result) => result.status === 'rejected')) {
      throw error;
    }
  }

  return { familyId: familyRef.id, babyId: babyRef.id };
}

export async function selectDefaultBaby(userId: string, babyId: string) {
  await setDoc(doc(requireFirestore(), 'userProfiles', userId), {
    defaultBabyId: babyId,
    updatedAt: now(),
  }, { merge: true });
}

interface ScopedActionParams {
  familyId: string;
  babyId: string;
  userId: string;
  role: MembershipRole;
  /** Libellé dénormalisé — stocké sur l'event pour affichage sans lookup */
  createdByLabel?: string | null;
}

async function createInstantEvent(
  scope: ScopedActionParams,
  type: Exclude<TrackedEventType, 'sleep'>,
  details?: EventDetails,
  notes?: string,
  timestamp = now(),
) {
  await addDoc(collection(requireFirestore(), 'events'), {
    familyId: scope.familyId,
    babyId: scope.babyId,
    type,
    startTime: timestamp,
    endTime: timestamp,
    details: details ? sanitizeDetails(details) : {},
    notes: notes?.trim() || null,
    createdByUserId: scope.userId,
    createdByRole: scope.role,
    ...(scope.createdByLabel ? { createdByLabel: scope.createdByLabel } : {}),
    createdAt: timestamp,
    updatedAt: timestamp,
    serverCreatedAt: serverTimestamp(),
  });
}

export async function addFeedEvent(
  scope: ScopedActionParams,
  details: EventDetails,
  notes?: string,
  timestamp = now(),
) {
  await createInstantEvent(scope, 'feed', details, notes, timestamp);
}

export async function addDiaperEvent(scope: ScopedActionParams, details: EventDetails, notes?: string, timestamp = now()) {
  await createInstantEvent(scope, 'diaper', details, notes, timestamp);
}

export async function addMedicationEvent(scope: ScopedActionParams, details: EventDetails, notes?: string, timestamp = now()) {
  await createInstantEvent(scope, 'medication', details, notes, timestamp);
}

export async function addTemperatureEvent(scope: ScopedActionParams, details: EventDetails, notes?: string, timestamp = now()) {
  await createInstantEvent(scope, 'temperature', details, notes, timestamp);
}

export async function addGrowthEvent(scope: ScopedActionParams, details: EventDetails, notes?: string, timestamp = now()) {
  await createInstantEvent(scope, 'growth', details, notes, timestamp);
}

export async function addPumpingEvent(scope: ScopedActionParams, details: EventDetails, notes?: string, timestamp = now()) {
  await createInstantEvent(scope, 'pumping', details, notes, timestamp);
}

/**
 * Manual past sleep event — used when a parent retroactively logs a sleep
 * they forgot to track live. Writes a completed sleep doc (both start +
 * end set) without touching `activeSessions`.
 */
export async function addPastSleepEvent(
  scope: ScopedActionParams,
  startTime: number,
  endTime: number,
  notes?: string,
) {
  await addDoc(collection(requireFirestore(), 'events'), {
    familyId: scope.familyId,
    babyId: scope.babyId,
    type: 'sleep',
    startTime,
    endTime,
    details: {},
    notes: notes?.trim() || null,
    createdByUserId: scope.userId,
    createdByRole: scope.role,
    ...(scope.createdByLabel ? { createdByLabel: scope.createdByLabel } : {}),
    createdAt: startTime,
    updatedAt: startTime,
    serverCreatedAt: serverTimestamp(),
  });
}

export async function startSleepSession(scope: ScopedActionParams, notes?: string, timestamp = now()) {
  const db = requireFirestore();
  const activeSessionRef = doc(db, 'activeSessions', scope.babyId);
  const eventRef = doc(collection(db, 'events'));

  await runTransaction(db, async (transaction) => {
    const activeSnapshot = await transaction.get(activeSessionRef);
    if (activeSnapshot.exists()) {
      throw new Error('Un sommeil est déjà en cours pour ce bébé.');
    }

    transaction.set(eventRef, {
      familyId: scope.familyId,
      babyId: scope.babyId,
      type: 'sleep',
      startTime: timestamp,
      endTime: null,
      notes: notes?.trim() || null,
      details: {},
      createdByUserId: scope.userId,
      createdByRole: scope.role,
      ...(scope.createdByLabel ? { createdByLabel: scope.createdByLabel } : {}),
      createdAt: timestamp,
      updatedAt: timestamp,
      serverCreatedAt: serverTimestamp(),
    });

    transaction.set(activeSessionRef, {
      familyId: scope.familyId,
      babyId: scope.babyId,
      eventId: eventRef.id,
      type: 'sleep',
      startTime: timestamp,
      details: {},
      createdByUserId: scope.userId,
      createdByRole: scope.role,
      ...(scope.createdByLabel ? { createdByLabel: scope.createdByLabel } : {}),
      updatedAt: timestamp,
    });
  });
}

export async function stopSleepSession(scope: ScopedActionParams, timestamp = now()) {
  const db = requireFirestore();
  const activeSessionRef = doc(db, 'activeSessions', scope.babyId);

  await runTransaction(db, async (transaction) => {
    const activeSnapshot = await transaction.get(activeSessionRef);
    if (!activeSnapshot.exists()) {
      throw new Error('Aucun sommeil actif à terminer.');
    }

    const activeSession = toActiveSession(activeSnapshot.id, activeSnapshot.data());
    const eventRef = doc(db, 'events', activeSession.eventId);
    const eventSnapshot = await transaction.get(eventRef);

    if (!eventSnapshot.exists()) {
      transaction.delete(activeSessionRef);
      throw new Error('La session active est introuvable. Elle a été nettoyée.');
    }

    transaction.update(eventRef, {
      endTime: timestamp,
      updatedAt: timestamp,
    });
    transaction.delete(activeSessionRef);
  });
}

export async function updateFamilyInviteCode(familyId: string) {
  const db = requireFirestore();
  const familySnapshot = await getDoc(doc(db, 'families', familyId));
  if (!familySnapshot.exists()) return;

  const rawData = familySnapshot.data() as any;
  const family = toFamily(familySnapshot.id, rawData);
  // Ensure both codes exist and the denormalized membership arrays are present
  const ts = now();
  const updates: Record<string, unknown> = { updatedAt: ts };
  let needsUpdate = false;

  // Option B migration: écrit managerIds/viewerIds/members si absents
  if (!Array.isArray(rawData.managerIds)) {
    updates.managerIds = rawData.ownerUserId ? [rawData.ownerUserId] : [];
    needsUpdate = true;
  }
  if (!Array.isArray(rawData.viewerIds)) {
    updates.viewerIds = [];
    needsUpdate = true;
  }
  if (!Array.isArray(rawData.members)) {
    const parentLabels: string[] = Array.isArray(rawData.parentNames) ? rawData.parentNames : [];
    const firstLabel = parentLabels.length > 0 ? parentLabels[0] : null;
    updates.members = rawData.ownerUserId
      ? [{
          uid: rawData.ownerUserId,
          displayName: firstLabel ?? 'Parent',
          parentLabel: firstLabel,
          role: 'manager',
        }]
      : [];
    needsUpdate = true;
  }

  if (!family.managerCode) {
    const newCode = await generateUniqueInviteCode(db);
    updates.managerCode = newCode;
    needsUpdate = true;
    await setDoc(doc(db, 'inviteCodes', newCode), {
      familyId,
      familyName: family.name,
      type: 'manager',
      createdAt: ts,
    });
  }

  if (!family.viewerCode) {
    const newCode = await generateUniqueInviteCode(db);
    updates.viewerCode = newCode;
    needsUpdate = true;
    await setDoc(doc(db, 'inviteCodes', newCode), {
      familyId,
      familyName: family.name,
      type: 'viewer',
      createdAt: ts,
    });
  }

  if (needsUpdate) {
    await updateDoc(doc(db, 'families', familyId), updates);
  }
}

export async function regenerateManagerCode(familyId: string): Promise<string> {
  const db = requireFirestore();
  const familySnapshot = await getDoc(doc(db, 'families', familyId));
  if (!familySnapshot.exists()) throw new Error('Family not found');

  const family = toFamily(familySnapshot.id, familySnapshot.data());
  const oldCode = family.managerCode;
  const newCode = await generateUniqueInviteCode(db);
  const ts = now();

  await updateDoc(doc(db, 'families', familyId), {
    managerCode: newCode,
    updatedAt: ts,
  });

  await setDoc(doc(db, 'inviteCodes', newCode), {
    familyId,
    familyName: family.name,
    type: 'manager',
    createdAt: ts,
  });

  if (oldCode) {
    await deleteDoc(doc(db, 'inviteCodes', oldCode)).catch(() => undefined);
  }

  return newCode;
}

export async function regenerateViewerCode(familyId: string): Promise<string> {
  const db = requireFirestore();
  const familySnapshot = await getDoc(doc(db, 'families', familyId));
  if (!familySnapshot.exists()) throw new Error('Family not found');

  const family = toFamily(familySnapshot.id, familySnapshot.data());
  const oldCode = family.viewerCode;
  const newCode = await generateUniqueInviteCode(db);
  const ts = now();

  await updateDoc(doc(db, 'families', familyId), {
    viewerCode: newCode,
    updatedAt: ts,
  });

  await setDoc(doc(db, 'inviteCodes', newCode), {
    familyId,
    familyName: family.name,
    type: 'viewer',
    createdAt: ts,
  });

  if (oldCode) {
    await deleteDoc(doc(db, 'inviteCodes', oldCode)).catch(() => undefined);
  }

  return newCode;
}

/** @deprecated Alias de regenerateManagerCode pour compatibilité */
export async function regenerateInviteCode(familyId: string): Promise<string> {
  return regenerateManagerCode(familyId);
}

export async function updateUserLanguage(userId: string, language: AppLanguage) {
  await setDoc(doc(requireFirestore(), 'userProfiles', userId), {
    language,
    updatedAt: now(),
  }, { merge: true });
}

export async function updateBabyFeedingMode(babyId: string, feedingMode: FeedingMode) {
  await setDoc(doc(requireFirestore(), 'babies', babyId), {
    feedingMode,
    updatedAt: now(),
  }, { merge: true });
}

export async function createBabyProfile(params: {
  familyId: string;
  firstName: string;
  birthDate: string;
  sex: BabySex;
  feedingMode: FeedingMode;
  avatarKey?: BabyAvatarKey;
}) {
  const babyRef = doc(collection(requireFirestore(), 'babies'));
  const timestamp = now();

  await setDoc(babyRef, {
    familyId: params.familyId,
    firstName: params.firstName.trim() || 'Bébé',
    birthDate: params.birthDate,
    sex: params.sex,
    feedingMode: params.feedingMode,
    avatarKey: params.avatarKey ?? 'babyAvatar',
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  return babyRef.id;
}

export async function updateFamilyProfile(
  familyId: string,
  updates: Partial<Pick<Family, 'name' | 'parentNames' | 'visitTypes' | 'careTypes'>>
) {
  await setDoc(doc(requireFirestore(), 'families', familyId), {
    ...(updates.name ? { name: updates.name.trim() } : {}),
    ...(updates.parentNames ? { parentNames: updates.parentNames.filter(Boolean) } : {}),
    ...(updates.visitTypes ? { visitTypes: updates.visitTypes.map((value) => value.trim()).filter(Boolean) } : {}),
    ...(updates.careTypes ? { careTypes: updates.careTypes.map((value) => value.trim()).filter(Boolean) } : {}),
    updatedAt: now(),
  }, { merge: true });
}

// ─── Photo uploads ────────────────────────────────────────────────────────────

async function uriToBlob(uri: string): Promise<Blob> {
  const response = await fetch(uri);
  if (!response.ok) throw new Error('Impossible de lire le fichier image');
  return response.blob();
}

async function uploadPhoto(path: string, uri: string): Promise<string> {
  if (!storage) throw new Error('Firebase Storage non configuré');
  const blob = await uriToBlob(uri);
  const ref = storageRef(storage, path);
  await uploadBytes(ref, blob);
  const url = await getDownloadURL(ref);
  if (typeof (blob as any).close === 'function') (blob as any).close();
  return url;
}

export async function uploadBabyPhoto(userId: string, babyId: string, uri: string): Promise<string> {
  return uploadPhoto(`users/${userId}/babies/${babyId}/avatar`, uri);
}

export async function uploadUserPhoto(userId: string, uri: string): Promise<string> {
  return uploadPhoto(`users/${userId}/avatar`, uri);
}

// ─── User profile update ──────────────────────────────────────────────────────

export async function updateUserProfile(
  userId: string,
  updates: { displayName?: string; photoUrl?: string },
): Promise<void> {
  const auth = firebaseAuth;
  if (auth?.currentUser) {
    await updateProfile(auth.currentUser, {
      ...(updates.displayName !== undefined ? { displayName: updates.displayName.trim() } : {}),
      ...(updates.photoUrl !== undefined ? { photoURL: updates.photoUrl } : {}),
    });
  }
  await setDoc(doc(requireFirestore(), 'userProfiles', userId), {
    ...(updates.displayName !== undefined ? { displayName: updates.displayName.trim() } : {}),
    ...(updates.photoUrl !== undefined ? { photoUrl: updates.photoUrl } : {}),
    updatedAt: now(),
  }, { merge: true });
}

export async function updateBabyProfile(
  babyId: string,
  updates: Partial<Pick<BabyProfile, 'firstName' | 'birthDate' | 'sex' | 'feedingMode' | 'avatarKey' | 'photoUrl'>>
) {
  await setDoc(doc(requireFirestore(), 'babies', babyId), {
    ...(updates.firstName ? { firstName: updates.firstName.trim() } : {}),
    ...(updates.birthDate ? { birthDate: updates.birthDate } : {}),
    ...(updates.sex ? { sex: updates.sex } : {}),
    ...(updates.feedingMode ? { feedingMode: updates.feedingMode } : {}),
    ...(updates.avatarKey ? { avatarKey: updates.avatarKey } : {}),
    ...(updates.photoUrl !== undefined ? { photoUrl: updates.photoUrl } : {}),
    updatedAt: now(),
  }, { merge: true });
}

/** Firestore rejette les valeurs `undefined` — on les supprime avant toute écriture */
function sanitizeDetails(details: EventDetails): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(details).filter(([, v]) => v !== undefined)
  );
}

export async function updateTrackedEvent(
  eventId: string,
  updates: Partial<Pick<TrackedEvent, 'startTime' | 'endTime' | 'notes' | 'details'>>,
  /**
   * Passing the baby id lets us also sync the activeSessions doc when
   * the edited event is the in-progress sleep session. Without it, the
   * live "Charlie dort depuis…" counter keeps using the original
   * startTime even after the parent corrects it from the history.
   */
  babyId?: string,
) {
  const db = requireFirestore();
  const timestamp = now();
  await setDoc(doc(db, 'events', eventId), {
    ...(typeof updates.startTime === 'number' ? { startTime: updates.startTime } : {}),
    ...(updates.endTime === null || typeof updates.endTime === 'number' ? { endTime: updates.endTime } : {}),
    ...(Object.prototype.hasOwnProperty.call(updates, 'notes') ? { notes: updates.notes?.trim() || null } : {}),
    ...(updates.details ? { details: sanitizeDetails(updates.details) } : {}),
    updatedAt: timestamp,
  }, { merge: true });

  // Mirror startTime / endTime onto the activeSessions doc when this
  // event IS the in-progress session. Editing endTime to a real number
  // would stop the session, so we only mirror when endTime stays null
  // or is omitted.
  if (!babyId) return;
  const hasStartChange = typeof updates.startTime === 'number';
  if (!hasStartChange) return;
  const activeSessionRef = doc(db, 'activeSessions', babyId);
  const activeSnapshot = await getDoc(activeSessionRef);
  if (!activeSnapshot.exists()) return;
  const session = activeSnapshot.data() as { eventId?: string } | undefined;
  if (session?.eventId !== eventId) return;
  await setDoc(activeSessionRef, {
    startTime: updates.startTime,
    updatedAt: timestamp,
  }, { merge: true });
}

export async function deleteTrackedEvent(eventId: string, babyId?: string) {
  const db = requireFirestore();
  await deleteDoc(doc(db, 'events', eventId));

  if (!babyId) return;

  const activeSessionRef = doc(db, 'activeSessions', babyId);
  const activeSnapshot = await getDoc(activeSessionRef);
  if (!activeSnapshot.exists()) return;

  const activeSession = toActiveSession(activeSnapshot.id, activeSnapshot.data());
  if (activeSession.eventId === eventId) {
    await deleteDoc(activeSessionRef);
  }
}

/**
 * Re-creates a previously-deleted event with its original ID. Used by the
 * "Undo" toast pattern after deleteEvent. Caller must hold the original
 * TrackedEvent shape captured before delete.
 */
export async function restoreTrackedEvent(event: TrackedEvent): Promise<void> {
  const db = requireFirestore();
  await setDoc(doc(db, 'events', event.id), {
    type: event.type,
    familyId: event.familyId,
    babyId: event.babyId,
    startTime: event.startTime,
    endTime: event.endTime ?? null,
    details: sanitizeDetails(event.details ?? {}),
    notes: event.notes ?? null,
    createdAt: event.createdAt,
    updatedAt: now(),
    createdByUserId: event.createdByUserId,
    createdByRole: event.createdByRole,
    ...(event.createdByLabel ? { createdByLabel: event.createdByLabel } : {}),
    serverCreatedAt: serverTimestamp(),
  });
}

async function createLegacyInstantEvent(
  user: User,
  type: Exclude<TrackedEventType, 'sleep'>,
  details?: EventDetails,
  notes?: string,
  timestamp = now(),
  createdByLabel?: string,
) {
  await addDoc(collection(requireFirestore(), 'events'), {
    type,
    startTime: timestamp,
    endTime: timestamp,
    userId: user.uid,
    trackerId: LEGACY_TRACKER_SCOPE_ID,
    actorRole: getLegacyActorRole(user),
    ...(details ? { details } : {}),
    notes: notes?.trim() || null,
    ...(createdByLabel ? { createdByLabel } : {}),
  });
}

export async function addLegacyFeedEvent(user: User, details: EventDetails, notes?: string, timestamp = now(), createdByLabel?: string) {
  await createLegacyInstantEvent(user, 'feed', details, notes, timestamp, createdByLabel);
}

export async function addLegacyDiaperEvent(user: User, details: EventDetails, notes?: string, timestamp = now(), createdByLabel?: string) {
  await createLegacyInstantEvent(user, 'diaper', details, notes, timestamp, createdByLabel);
}

export async function addLegacyMedicationEvent(user: User, details: EventDetails, notes?: string, timestamp = now(), createdByLabel?: string) {
  await createLegacyInstantEvent(user, 'medication', details, notes, timestamp, createdByLabel);
}

export async function addLegacyTemperatureEvent(user: User, details: EventDetails, timestamp = now(), createdByLabel?: string) {
  await createLegacyInstantEvent(user, 'temperature', details, undefined, timestamp, createdByLabel);
}

export async function addLegacyGrowthEvent(user: User, details: EventDetails, timestamp = now(), createdByLabel?: string) {
  await createLegacyInstantEvent(user, 'growth', details, undefined, timestamp, createdByLabel);
}

export async function startLegacySleepSession(user: User, notes?: string, timestamp = now()) {
  const db = requireFirestore();
  const activeSessionRef = doc(db, 'activeSessions', LEGACY_TRACKER_SCOPE_ID);
  const eventRef = doc(collection(db, 'events'));

  await runTransaction(db, async (transaction) => {
    const activeSnapshot = await transaction.get(activeSessionRef);
    if (activeSnapshot.exists()) {
      const activeData = activeSnapshot.data();
      const activeEventRef = activeData?.eventId ? doc(db, 'events', String(activeData.eventId)) : null;
      const activeEventSnapshot = activeEventRef ? await transaction.get(activeEventRef) : null;
      const activeEvent = activeEventSnapshot?.exists() ? activeEventSnapshot.data() : null;

      if (activeEvent && activeEvent.endTime == null && activeData?.type === 'sleep') {
        throw new Error('Un sommeil est déjà en cours pour Charlie.');
      }

      transaction.delete(activeSessionRef);
    }

    transaction.set(eventRef, {
      type: 'sleep',
      startTime: timestamp,
      endTime: null,
      userId: user.uid,
      trackerId: LEGACY_TRACKER_SCOPE_ID,
      actorRole: getLegacyActorRole(user),
      details: {},
      notes: notes?.trim() || null,
    });

    transaction.set(activeSessionRef, {
      eventId: eventRef.id,
      type: 'sleep',
      startTime: timestamp,
      userId: user.uid,
      trackerId: LEGACY_TRACKER_SCOPE_ID,
      actorRole: getLegacyActorRole(user),
      details: {},
      updatedAt: timestamp,
    });
  });
}

export async function stopLegacySleepSession(timestamp = now()) {
  const db = requireFirestore();
  const activeSessionRef = doc(db, 'activeSessions', LEGACY_TRACKER_SCOPE_ID);

  await runTransaction(db, async (transaction) => {
    const activeSnapshot = await transaction.get(activeSessionRef);
    if (!activeSnapshot.exists()) {
      throw new Error('Aucun sommeil actif à terminer.');
    }

    const activeData = activeSnapshot.data();
    const eventId = activeData?.eventId;
    if (eventId) {
      const eventRef = doc(db, 'events', String(eventId));
      const eventSnapshot = await transaction.get(eventRef);
      if (eventSnapshot.exists() && eventSnapshot.data().endTime == null) {
        transaction.update(eventRef, { endTime: timestamp });
      }
    }

    transaction.delete(activeSessionRef);
  });
}

export async function updateLegacyTrackedEvent(
  eventId: string,
  updates: Partial<Pick<TrackedEvent, 'startTime' | 'endTime' | 'notes' | 'details'>>
) {
  const db = requireFirestore();

  await setDoc(doc(db, 'events', eventId), {
    ...(typeof updates.startTime === 'number' ? { startTime: updates.startTime } : {}),
    ...(updates.endTime === null || typeof updates.endTime === 'number' ? { endTime: updates.endTime } : {}),
    ...(Object.prototype.hasOwnProperty.call(updates, 'notes') ? { notes: updates.notes?.trim() || null } : {}),
    ...(updates.details ? { details: sanitizeDetails(updates.details) } : {}),
    trackerId: LEGACY_TRACKER_SCOPE_ID,
  }, { merge: true });

  if (updates.endTime !== null && updates.endTime !== undefined) {
    const activeSessionRef = doc(db, 'activeSessions', LEGACY_TRACKER_SCOPE_ID);
    const activeSnapshot = await getDoc(activeSessionRef);
    if (activeSnapshot.exists() && activeSnapshot.data().eventId === eventId) {
      await deleteDoc(activeSessionRef);
    }
  }
}

export async function deleteLegacyTrackedEvent(eventId: string) {
  const db = requireFirestore();
  await deleteDoc(doc(db, 'events', eventId));

  const activeSessionRef = doc(db, 'activeSessions', LEGACY_TRACKER_SCOPE_ID);
  const activeSnapshot = await getDoc(activeSessionRef);
  if (activeSnapshot.exists() && activeSnapshot.data().eventId === eventId) {
    await deleteDoc(activeSessionRef);
  }
}

/**
 * Ensure invite code lookup documents exist in the inviteCodes collection.
 * Call this when a family is loaded to migrate old codes.
 */
export async function ensureInviteCodeLookup(family: Family): Promise<void> {
  const db = requireFirestore();
  const ts = now();

  if (family.managerCode) {
    const ref = doc(db, 'inviteCodes', family.managerCode);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        familyId: family.id,
        familyName: family.name,
        type: 'manager',
        createdAt: ts,
      });
    }
  }

  if (family.viewerCode) {
    const ref = doc(db, 'inviteCodes', family.viewerCode);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        familyId: family.id,
        familyName: family.name,
        type: 'viewer',
        createdAt: ts,
      });
    }
  }
}

/**
 * Validate an invite code before joining.
 * Returns familyId, familyName and the code type (manager | viewer).
 */
export async function validateInviteCode(code: string): Promise<{ familyId: string; familyName: string; type: 'manager' | 'viewer' } | null> {
  const normalised = code.trim().toUpperCase();
  if (normalised.length < 4) return null;

  const snap = await getDoc(doc(requireFirestore(), 'inviteCodes', normalised));
  if (!snap.exists()) return null;

  const data = snap.data();
  if (!data || typeof data.familyId !== 'string') return null;

  const rawType = data.type;
  if (rawType !== 'manager' && rawType !== 'viewer') return null;
  const type: 'manager' | 'viewer' = rawType;

  return {
    familyId: data.familyId,
    familyName: typeof data.familyName === 'string' ? data.familyName : '',
    type,
  };
}

/**
 * Join a family as manager (full access / co-parent).
 * The invite code must be of type 'manager'.
 */
export async function joinFamilyAsManager(params: {
  code: string;
  userId: string;
  displayName: string;
  parentLabel?: string;
}): Promise<string | null> {
  const db = requireFirestore();
  const { code, userId, displayName, parentLabel } = params;

  const normalised = code.trim().toUpperCase();
  const codeSnap = await getDoc(doc(db, 'inviteCodes', normalised));
  if (!codeSnap.exists()) return null;

  const codeData = codeSnap.data();
  if (codeData.type !== 'manager') return null;

  const familyId = codeData.familyId as string;
  const ts = now();
  await createJoinRequest(userId, familyId, 'manager', normalised);

  const familyRef = doc(db, 'families', familyId);
  const familySnap = await getDoc(familyRef);
  if (!familySnap.exists()) return null;
  const family = toFamily(familySnap.id, familySnap.data());
  const managerIds = Array.from(new Set([...(family.managerIds ?? []), userId]));
  const viewerIds = (family.viewerIds ?? []).filter((uid) => uid !== userId);
  const existingMember = (family.members ?? []).find((member) => member.uid === userId);
  const nextMember: FamilyMember = {
    uid: userId,
    displayName,
    parentLabel: parentLabel ?? existingMember?.parentLabel ?? null,
    role: 'manager',
  };
  const members = existingMember
    ? (family.members ?? []).map((member) => member.uid === userId ? nextMember : member)
    : [...(family.members ?? []), nextMember];

  await updateDoc(familyRef, {
    managerIds,
    viewerIds,
    members,
    updatedAt: ts,
  });

  await setDoc(doc(db, 'userProfiles', userId), {
    familyId,
    updatedAt: ts,
  }, { merge: true });

  // Set defaultBabyId if not already set
  const profileSnap = await getDoc(doc(db, 'userProfiles', userId));
  const alreadyHasBaby = profileSnap.exists() && !!profileSnap.data().defaultBabyId;

  if (!alreadyHasBaby) {
    const babiesQuery = query(collection(db, 'babies'), where('familyId', '==', familyId), limit(1));
    const babiesSnap = await getDocs(babiesQuery);
    const firstBabyId = babiesSnap.docs[0]?.id ?? null;
    if (firstBabyId) {
      await setDoc(doc(db, 'userProfiles', userId), {
        defaultBabyId: firstBabyId,
        updatedAt: ts,
      }, { merge: true });
    }
  }

  await deleteDoc(doc(db, 'joinRequests', userId)).catch(() => undefined);

  return familyId;
}

/**
 * Join a family as viewer (read-only / extended family).
 * The invite code must be of type 'viewer'.
 */
export async function joinFamilyAsViewer(params: {
  code: string;
  userId: string;
  displayName: string;
  parentLabel?: string;
}): Promise<string | null> {
  const db = requireFirestore();
  const { code, userId, displayName, parentLabel } = params;

  const normalised = code.trim().toUpperCase();
  const codeSnap = await getDoc(doc(db, 'inviteCodes', normalised));
  if (!codeSnap.exists()) return null;

  const codeData = codeSnap.data();
  if (codeData.type !== 'viewer') return null;

  const familyId = codeData.familyId as string;
  const ts = now();
  await createJoinRequest(userId, familyId, 'viewer', normalised);

  const familyRef = doc(db, 'families', familyId);
  const familySnap = await getDoc(familyRef);
  if (!familySnap.exists()) return null;
  const family = toFamily(familySnap.id, familySnap.data());
  const viewerIds = Array.from(new Set([...(family.viewerIds ?? []), userId]));
  const existingMember = (family.members ?? []).find((member) => member.uid === userId);
  const nextMember: FamilyMember = {
    uid: userId,
    displayName,
    parentLabel: parentLabel ?? existingMember?.parentLabel ?? null,
    role: 'viewer',
  };
  const members = existingMember
    ? (family.members ?? []).map((member) => member.uid === userId ? nextMember : member)
    : [...(family.members ?? []), nextMember];

  await updateDoc(familyRef, {
    viewerIds,
    members,
    updatedAt: ts,
  });

  await setDoc(doc(db, 'userProfiles', userId), {
    familyId,
    updatedAt: ts,
  }, { merge: true });

  // Set defaultBabyId if not already set
  const profileSnap = await getDoc(doc(db, 'userProfiles', userId));
  const alreadyHasBaby = profileSnap.exists() && !!profileSnap.data().defaultBabyId;

  if (!alreadyHasBaby) {
    const babiesQuery = query(collection(db, 'babies'), where('familyId', '==', familyId), limit(1));
    const babiesSnap = await getDocs(babiesQuery);
    const firstBabyId = babiesSnap.docs[0]?.id ?? null;
    if (firstBabyId) {
      await setDoc(doc(db, 'userProfiles', userId), {
        defaultBabyId: firstBabyId,
        updatedAt: ts,
      }, { merge: true });
    }
  }

  await deleteDoc(doc(db, 'joinRequests', userId)).catch(() => undefined);

  return familyId;
}

/**
 * Join a family by invite code — auto-detects type (manager or viewer).
 */
export async function joinFamilyByCode(params: {
  code: string;
  userId: string;
  displayName: string;
  parentLabel?: string;
}): Promise<string | null> {
  const db = requireFirestore();
  const normalised = params.code.trim().toUpperCase();
  const codeSnap = await getDoc(doc(db, 'inviteCodes', normalised));
  if (!codeSnap.exists()) return null;

  const codeType = codeSnap.data().type;
  if (codeType === 'viewer') {
    return joinFamilyAsViewer(params);
  }
  return joinFamilyAsManager(params);
}

/**
 * Promote a viewer to manager within a family.
 */
export async function promoteViewerToManager(familyId: string, viewerUid: string): Promise<void> {
  const db = requireFirestore();
  const ts = now();

  // Update the role in the members array requires reading the current state
  const familySnap = await getDoc(doc(db, 'families', familyId));
  if (!familySnap.exists()) throw new Error('Family not found');

  const family = toFamily(familySnap.id, familySnap.data());
  const updatedMembers = (family.members ?? []).map((m) =>
    m.uid === viewerUid ? { ...m, role: 'manager' as MembershipRole } : m
  );
  const managerIds = Array.from(new Set([...(family.managerIds ?? []), viewerUid]));
  const viewerIds = (family.viewerIds ?? []).filter((uid) => uid !== viewerUid);

  await updateDoc(doc(db, 'families', familyId), {
    managerIds,
    viewerIds,
    members: updatedMembers,
    updatedAt: ts,
  });
}

/**
 * Update the parentLabel for a member in the family's members array.
 */
export async function updateFamilyMemberLabel(familyId: string, uid: string, parentLabel: string, currentMembers: FamilyMember[]): Promise<void> {
  const db = requireFirestore();
  const updatedMembers = currentMembers.map((m) =>
    m.uid === uid ? { ...m, parentLabel: parentLabel || null } : m
  );
  await updateDoc(doc(db, 'families', familyId), {
    members: updatedMembers,
    updatedAt: now(),
  });
}

/**
 * Remove a member from a family (from both managerIds and viewerIds arrays).
 */
export async function removeFromFamily(familyId: string, memberUid: string): Promise<void> {
  const db = requireFirestore();
  const ts = now();

  const familySnap = await getDoc(doc(db, 'families', familyId));
  if (!familySnap.exists()) throw new Error('Family not found');

  const family = toFamily(familySnap.id, familySnap.data());
  const updatedMembers = (family.members ?? []).filter((m) => m.uid !== memberUid);
  const managerIds = (family.managerIds ?? []).filter((uid) => uid !== memberUid);
  const viewerIds = (family.viewerIds ?? []).filter((uid) => uid !== memberUid);

  await updateDoc(doc(db, 'families', familyId), {
    managerIds,
    viewerIds,
    members: updatedMembers,
    updatedAt: ts,
  });
}
