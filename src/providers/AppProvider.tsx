import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { Icon } from '@/src/components/ui/Icon';
import { ActivityIndicator, Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { User } from 'firebase/auth';
import { translate } from '@/src/constants/i18n';
import { MOCK_STORAGE_KEY, type GrowthSpurtMockKey } from '@/src/lib/devMocks';

const GROWTH_BANNER_HIDDEN_KEY = '@charlie:growth_banner_hidden';
import type {
  ActiveSession,
  AppLanguage,
  BabyAvatarKey,
  BabyProfile,
  BabySex,
  CareCategory,
  EventDetails,
  FeedingMode,
  Family,
  FamilyMember,
  FamilyMembership,
  InitialSetupInput,
  MembershipRole,
  ParentsCombination,
  StoolColor,
  TrackedEvent,
  TrackedEventType,
  UserProfile,
} from '@/src/types/domain';
import { radii, spacing } from '@/src/constants/theme';
import { getBreastfeedingEncouragement } from '@/src/utils/breastfeedingEncouragements';
import { comboLabel } from '@/src/utils/parentsCombinationMap';
import {
  addDiaperEvent,
  addFeedEvent,
  addGrowthEvent,
  addPumpingEvent,
  addLegacyDiaperEvent,
  addLegacyFeedEvent,
  addLegacyGrowthEvent,
  addLegacyMedicationEvent,
  addLegacyTemperatureEvent,
  addMedicationEvent,
  addPastSleepEvent,
  addTemperatureEvent,
  createBabyProfile,
  createInitialSetup,
  deleteTrackedEvent,
  restoreTrackedEvent,
  deleteLegacyTrackedEvent,
  LEGACY_TRACKER_BABY_ID,
  LEGACY_TRACKER_BIRTH_DATE,
  LEGACY_TRACKER_FAMILY_ID,
  LEGACY_TRACKER_SCOPE_ID,
  type LegacySnapshotError,
  listenActiveSession,
  listenBabies,
  listenEvents,
  fetchEventsBeforeTimestamp,
  listenFamily,
  listenLegacyActiveSession,
  listenLegacyEvents,
  listenToAuth,
  listenUserProfile,
  selectDefaultBaby,
  signIn,
  signOut,
  deleteAccount as deleteAccountRepo,
  signUp,
  startSleepSession,
  stopSleepSession,
  stopLegacySleepSession,
  updateBabyProfile,
  updateBabyFeedingMode,
  updateFamilyProfile,
  updateFamilyInviteCode,
  updateLegacyTrackedEvent,
  updateTrackedEvent,
  updateUserLanguage,
  updateUserProfile,
  uploadBabyPhoto,
  uploadUserPhoto,
  startLegacySleepSession,
  joinFamilyAsManager,
  joinFamilyAsViewer,
  ensureInviteCodeLookup,
  promoteViewerToManager,
  removeFromFamily,
  updateFamilyMemberLabel,
  updateFamilyParentsCombination,
} from '@/src/services/productRepository';
import { requestNotificationsPermission } from '@/src/lib/notifications';
import { canUseDevTools } from '@/src/lib/env';
import { triggerErrorFeedback, triggerSuccessFeedback } from '@/src/lib/feedback';
import { useAppTheme } from '@/src/providers/ThemeProvider';
import { logger } from '@/src/utils/logger';
import { canEditEvent, canRecordEvents, canRemoveMember } from '@/src/utils/permissions';

export type SyncStatus = 'syncing' | 'live' | 'error' | 'offline';

/**
 * Discriminated union for manually creating a past event. Each variant
 * carries exactly the fields its type needs — the editor modal builds
 * one of these from its form state and hands it to `createManualEvent`.
 */
export type ManualEventInput =
  | { type: 'feed'; startTime: number; details: { feedSide: 'left' | 'right' | 'bottle'; feedAmountMl?: number; bottleSupplement?: number }; notes?: string }
  | { type: 'diaper'; startTime: number; details: { diaperType: 'wet' | 'dirty' | 'both'; stoolColor?: StoolColor }; notes?: string }
  | { type: 'medication'; startTime: number; details: { medicationName?: string; careCategory: CareCategory }; notes?: string }
  | { type: 'temperature'; startTime: number; details: { temperature: number; temperaturePeriod?: 'morning' | 'evening' }; notes?: string }
  | { type: 'growth'; startTime: number; details: { weight?: number; height?: number; head?: number }; notes?: string }
  | { type: 'sleep'; startTime: number; endTime: number; notes?: string }
  | {
      type: 'pumping';
      startTime: number;
      details: {
        pumpingSide: 'left' | 'right' | 'both';
        pumpingVolumeMl: number;
        pumpingLeftMl?: number;
        pumpingRightMl?: number;
        pumpingDurationMin?: number;
      };
      notes?: string;
    };
type ToastKind = 'success' | 'error';
// Realtime listener window: today / tracker / growth-spurt detection only
// need ~14 days. Older events are loaded on demand via `loadFullHistory`.
const RECENT_EVENTS_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const LANGUAGE_STORAGE_KEY = 'charlie-mobile-language';
const LEGACY_OVERRIDES_STORAGE_PREFIX = 'charlie-mobile-legacy-overrides';

interface LegacyWorkspaceOverrides {
  familyName?: string;
  babyAvatarKey?: BabyAvatarKey;
  visitTypes?: string[];
  babyFirstName?: string;
  babyBirthDate?: string;
  babySex?: BabySex;
  babyFeedingMode?: FeedingMode;
  babyPhotoUrl?: string;
  parentLabel?: string;
}

interface ToastState {
  id: number;
  title: string;
  message?: string;
  kind: ToastKind;
  /** Optional action button (e.g. "Undo" after a destructive action) */
  action?: {
    label: string;
    onPress: () => void;
  };
  /** Override the default 4s auto-dismiss (ms) */
  duration?: number;
}

interface SandboxState {
  profile: UserProfile;
  /** Représentation du membership courant pour la sandbox (role + userId) */
  memberRole: MembershipRole;
  /** parentLabel de la personne sandbox courante */
  parentLabel: string | null;
  family: Family;
  babies: BabyProfile[];
  events: TrackedEvent[];
  activeSessions: Record<string, ActiveSession>;
}

interface AppContextValue {
  authUser: User | null;
  profile: UserProfile | null;
  /** @deprecated utiliser currentMembership à la place */
  memberships: { role: MembershipRole; userId: string }[];
  currentMembership: { role: MembershipRole; userId: string; parentLabel?: string | null } | null;
  currentFamily: Family | null;
  currentBaby: BabyProfile | null;
  babies: BabyProfile[];
  events: TrackedEvent[];
  activeSession: ActiveSession | null;
  authReady: boolean;
  workspaceLoading: boolean;
  needsOnboarding: boolean;
  /** True once the live data listeners have produced at least one
   * snapshot since this auth session started (or immediately in sandbox
   * mode, or when the user has no family yet). Used by the SPA shell to
   * keep the FullScreenLoader visible while Firestore is still hydrating
   * — without this, the UI becomes interactive before the events list
   * has loaded and taps hit empty timelines. */
  initialSyncDone: boolean;
  syncStatus: SyncStatus;
  /** Increments each time a fresh event arrives via Firestore listener.
   * Lets UI fragments (e.g. SyncDot) trigger a brief animation. */
  livePulseToken: number;
  /** Dev-only growth-spurt mock — when not 'off', the GrowthSpurtBanner
   * displays the corresponding mock analysis instead of running detection. */
  growthSpurtMock: GrowthSpurtMockKey;
  setGrowthSpurtMock: (key: GrowthSpurtMockKey) => void;
  /** User-controlled visibility of the GrowthSpurtBanner on the Today
   * screen. Persists across reloads via AsyncStorage. */
  growthBannerHidden: boolean;
  setGrowthBannerHidden: (hidden: boolean) => void;
  lastSyncedAt: number | null;
  saving: boolean;
  notificationsGranted: boolean;
  toast: ToastState | null;
  viewerRole: MembershipRole | null;
  isViewer: boolean;
  isSandbox: boolean;
  language: AppLanguage;
  feedingMode: FeedingMode;
  familyMembers: FamilyMember[];
  signInWithPassword: (email: string, password: string) => Promise<boolean>;
  registerWithPassword: (email: string, password: string, displayName: string) => Promise<boolean>;
  /** Met à jour la combinaison de parents (Papa & Maman / etc.) */
  setParentsCombination: (combo: ParentsCombination) => Promise<void>;
  completeInitialSetup: (input: InitialSetupInput) => Promise<boolean>;
  triggerSleep: () => Promise<void>;
  stopSleep: () => Promise<void>;
  recordFeed: (feedSide: 'left' | 'right' | 'bottle', amountMl?: number, bottleSupplement?: number) => Promise<void>;
  recordDiaper: (input: { diaperType: 'wet' | 'dirty' | 'both'; stoolColor?: StoolColor; notes?: string }) => Promise<void>;
  recordMedication: (input: { medicationName: string; careCategory?: CareCategory; notes?: string }) => Promise<void>;
  recordTemperature: (temperature: number) => Promise<void>;
  recordGrowth: (details: EventDetails) => Promise<void>;
  /** Encode une session de tirage du lait. `side: 'both'` peut éventuellement
   *  porter `leftMl` et `rightMl` pour ventiler le volume; sinon seul
   *  `volumeMl` (total) est utilisé. */
  recordPumping: (input: {
    side: 'left' | 'right' | 'both';
    volumeMl: number;
    leftMl?: number;
    rightMl?: number;
    durationMin?: number;
    notes?: string;
  }) => Promise<void>;
  selectBaby: (babyId: string) => Promise<void>;
  addBaby: (input: { firstName: string; birthDate: string; sex: BabySex; feedingMode: FeedingMode; avatarKey?: BabyAvatarKey; setAsActive?: boolean }) => Promise<void>;
  updateBabyAvatar: (babyId: string, avatarKey: BabyAvatarKey) => Promise<void>;
  updateBabyInfo: (babyId: string, updates: { firstName?: string; birthDate?: string; sex?: BabySex; feedingMode?: FeedingMode; photoUri?: string }) => Promise<void>;
  updateUserInfo: (updates: { displayName?: string; photoUri?: string }) => Promise<void>;
  updateMyFamilyLabel: (label: string) => Promise<void>;
  joinFamily: (code: string, parentLabel?: string) => Promise<void>;
  removeFamilyMember: (memberUid: string) => Promise<void>;
  updateMemberRole: (memberUid: string, role: MembershipRole) => Promise<void>;
  updateEvent: (eventId: string, updates: Partial<Pick<TrackedEvent, 'startTime' | 'endTime' | 'notes' | 'details'>>) => Promise<void>;
  deleteEvent: (eventId: string) => Promise<void>;
  /** Manually create a past event (e.g. parent forgot to log live).
   * For sleep, both startTime and endTime are required (completed session).
   * Other types use the chosen startTime as the moment of the action. */
  createManualEvent: (input: ManualEventInput) => Promise<void>;
  /** Load events older than the realtime listener window (~14 d) for the
   * current baby. Idempotent — only fetches once per baby per session.
   * Subsequent reads are served from Firestore's IndexedDB cache. Call from
   * any screen that needs the lifetime history (Évolution, Croissance,
   * Historique, Export). */
  loadFullHistory: () => Promise<void>;
  /** True once the full history has been merged into `events` for the
   * current baby. Screens that gate UI on completeness can read this. */
  fullHistoryLoaded: boolean;
  /** True while the on-demand full-history fetch is in flight. */
  fullHistoryLoading: boolean;
  updateFamilyDetails: (input: { name?: string; visitTypes?: string[]; careTypes?: string[] }) => Promise<void>;
  setLanguagePreference: (nextLanguage: AppLanguage) => Promise<void>;
  setFeedingModePreference: (nextMode: FeedingMode) => Promise<void>;
  dismissToast: () => void;
  refreshData: () => void;
  requestNotificationAccess: () => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: (password: string) => Promise<void>;
  enterSandbox: () => void;
  exitSandbox: () => void;
  debugSetSyncStatus?: (status: SyncStatus) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

function mapError(error: unknown, language: AppLanguage) {
  const message = error instanceof Error ? error.message : translate(language, 'error.unexpected');

  if (message.includes('auth/invalid-credential')) return translate(language, 'error.invalid_credentials');
  if (message.includes('auth/email-already-in-use')) return translate(language, 'error.email_in_use');
  if (message.includes('auth/weak-password')) return translate(language, 'error.weak_password');
  if (message.includes('auth/invalid-email')) return translate(language, 'error.invalid_email');
  if (message.includes('Firestore')) return translate(language, 'error.firestore');

  return message;
}

function now() {
  return Date.now();
}

function inferTemperaturePeriod(timestamp = Date.now()): 'morning' | 'evening' {
  const hour = new Date(timestamp).getHours();
  return hour < 15 ? 'morning' : 'evening';
}

function inferLegacyFeedingMode(events: TrackedEvent[]): FeedingMode {
  const feedEvents = events.filter((event) => event.type === 'feed');
  const hasBottle = feedEvents.some((event) => event.details?.feedSide === 'bottle');
  const hasBreast = feedEvents.some((event) => event.details?.feedSide === 'left' || event.details?.feedSide === 'right');

  if (hasBottle && hasBreast) return 'mixed';
  if (hasBottle) return 'bottle';
  return 'breastfeeding';
}

function isLegacyGuestUser(user: User | null) {
  if (!user) return false;
  if (user.isAnonymous) return true;
  return user.email?.trim().toLowerCase() === 'invite@charlie.com';
}

function createSandboxState(language: AppLanguage): SandboxState {
  const ts = now();
  // Minuit du jour courant pour ancrer les heures précisément
  const today = new Date(ts);
  today.setHours(0, 0, 0, 0);
  const T = today.getTime();
  const DAY = 86_400_000;
  const H = 3_600_000;

  const familyId = 'sandbox-family';
  const charlieId = 'sandbox-baby-charlie';
  const leaId = 'sandbox-baby-lea';
  const guillaumeId = 'sandbox-user-guillaume';
  const sophieId = 'sandbox-user-sophie';
  // Sophie/Maman is the default current user in sandbox mode
  const userId = sophieId;

  const profile: UserProfile = {
    id: sophieId,
    email: 'maman@local.charlie',
    displayName: 'Sophie',
    familyId: familyId,
    defaultBabyId: charlieId,
    language,
    createdAt: T - 30 * DAY,
    updatedAt: T,
  };

  const grandMamaId = 'sandbox-user-grandmama';

  const family: Family = {
    id: familyId,
    name: 'Famille Dupont',
    ownerUserId: guillaumeId,
    managerCode: 'TESTMGR',
    viewerCode: 'TESTVIW',
    managerIds: [guillaumeId, sophieId],
    viewerIds: [grandMamaId],
    members: [
      { uid: guillaumeId, displayName: 'Guillaume', parentLabel: 'Papa', role: 'manager' },
      { uid: sophieId, displayName: 'Sophie', parentLabel: 'Maman', role: 'manager' },
      { uid: grandMamaId, displayName: 'Marie', parentLabel: 'Grand-mère', role: 'viewer' },
    ],
    parentNames: ['Guillaume', 'Sophie'],
    visitTypes: ['Sage-femme', 'Pédiatre'],
    careTypes: [],
    premiumStatus: 'free',
    createdAt: T - 30 * DAY,
    updatedAt: T,
  };

  const charlie: BabyProfile = {
    id: charlieId,
    familyId,
    firstName: 'Charlie',
    birthDate: new Date('2026-03-11T12:00:00.000Z').toISOString(),
    sex: 'boy',
    feedingMode: 'mixed',
    avatarKey: 'babyAvatar',
    createdAt: T - 26 * DAY,
    updatedAt: T,
  };

  const lea: BabyProfile = {
    id: leaId,
    familyId,
    firstName: 'Léa',
    birthDate: new Date('2024-03-15T12:00:00.000Z').toISOString(),
    sex: 'girl',
    feedingMode: 'bottle',
    avatarKey: 'childTwo',
    createdAt: T - 30 * DAY,
    updatedAt: T,
  };

  // Sophie/Maman est l'utilisatrice courante en mode sandbox

  /** Fabrique un TrackedEvent sans valeurs undefined */
  function ev(
    id: string,
    babyId: string,
    type: TrackedEventType,
    start: number,
    end: number | null,
    details: EventDetails,
    opts?: { notes?: string; byUserId?: string; byLabel?: string },
  ): TrackedEvent {
    const byUserId = opts?.byUserId ?? userId;
    return {
      id,
      familyId,
      babyId,
      type,
      startTime: start,
      endTime: end,
      details,
      notes: opts?.notes,
      createdByUserId: byUserId,
      createdByRole: 'manager',
      createdByLabel: opts?.byLabel ?? (byUserId === guillaumeId ? 'Papa' : 'Maman'),
      createdAt: start,
      updatedAt: start,
    };
  }
  const mama = { byUserId: sophieId, byLabel: 'Maman' };
  const papa = { byUserId: guillaumeId, byLabel: 'Papa' };

  // ── Events d'aujourd'hui pour Charlie ──────────────────────────────────────
  const todayRaw: TrackedEvent[] = [
    ev('sb-sleep-nt1', charlieId, 'sleep', T + 0.5 * H, T + 2 * H, {}, papa),
    ev('sb-feed-nt1',  charlieId, 'feed',  T + 2.25 * H, T + 2.25 * H, { feedSide: 'left', bottleSupplement: 40 }, papa),
    ev('sb-diaper-nt1',charlieId, 'diaper',T + 2.5 * H,  T + 2.5 * H,  { diaperType: 'wet' }, papa),
    ev('sb-sleep-nt2', charlieId, 'sleep', T + 2.75 * H, T + 5.5 * H, {}, papa),
    ev('sb-feed-nt2',  charlieId, 'feed',  T + 5.75 * H, T + 5.75 * H, { feedSide: 'right' }, mama),
    ev('sb-diaper-nt2',charlieId, 'diaper',T + 6 * H,    T + 6 * H,    { diaperType: 'both', stoolColor: 'jaune_or' }, mama),
    ev('sb-sleep-m1',  charlieId, 'sleep', T + 6.25 * H, T + 8.5 * H, {}, papa),
    ev('sb-feed-m1',   charlieId, 'feed',  T + 8.75 * H, T + 8.75 * H, { feedSide: 'left', bottleSupplement: 60 }, papa),
    ev('sb-temp-m1',   charlieId, 'temperature', T + 9.25 * H, T + 9.25 * H, { temperature: 37.1, temperaturePeriod: 'morning' }, papa),
    ev('sb-diaper-m1', charlieId, 'diaper',T + 9.5 * H,  T + 9.5 * H,  { diaperType: 'wet' }, papa),
    ev('sb-care-m1',   charlieId, 'medication', T + 10 * H, T + 10 * H, { medicationName: 'vitamin_d', careCategory: 'care' }, mama),
    ev('sb-sleep-m2',  charlieId, 'sleep', T + 10.25 * H, T + 12 * H, {}, mama),
    ev('sb-feed-m2',   charlieId, 'feed',  T + 12.25 * H, T + 12.25 * H, { feedSide: 'right' }, mama),
    ev('sb-diaper-m2', charlieId, 'diaper',T + 13 * H,   T + 13 * H,   { diaperType: 'dirty', stoolColor: 'jaune_pale' }, mama),
    ev('sb-sleep-a1',  charlieId, 'sleep', T + 13.5 * H, T + 15 * H, {}, mama),
    ev('sb-feed-a1',   charlieId, 'feed',  T + 15.25 * H, T + 15.25 * H, { feedSide: 'left' }),
    ev('sb-diaper-a1', charlieId, 'diaper',T + 15.5 * H, T + 15.5 * H, { diaperType: 'wet' }),
    ev('sb-temp-a1',   charlieId, 'temperature', T + 15.75 * H, T + 15.75 * H, { temperature: 37.3, temperaturePeriod: 'evening' }),
    ev('sb-feed-a2',   charlieId, 'feed',  T + 18 * H,   T + 18 * H,   { feedSide: 'right', bottleSupplement: 50 }, mama),
    ev('sb-diaper-a2', charlieId, 'diaper',T + 18.5 * H, T + 18.5 * H, { diaperType: 'wet' }, mama),
    ev('sb-sleep-s1',  charlieId, 'sleep', T + 19 * H,   T + 20.5 * H, {}),
    ev('sb-feed-e1',   charlieId, 'feed',  T + 21 * H,   T + 21 * H,   { feedSide: 'left' }),
  ];
  const todayEvents = todayRaw.filter((e) => e.startTime <= ts && (e.endTime === null || e.endTime <= ts));

  // ── Historique Charlie (30 derniers jours) ─────────────────────────────────
  const hist: TrackedEvent[] = [];

  // Croissance
  hist.push(ev('sb-gr-0', charlieId, 'growth', T - 26 * DAY, T - 26 * DAY, { weight: 3.2, height: 50.0, head: 35.0 }, papa));
  hist.push(ev('sb-gr-1', charlieId, 'growth', T - 19 * DAY, T - 19 * DAY, { weight: 3.5, height: 52.0, head: 36.0 }, papa));
  hist.push(ev('sb-gr-2', charlieId, 'growth', T - 12 * DAY, T - 12 * DAY, { weight: 3.9, height: 53.5, head: 37.0 }, mama));
  hist.push(ev('sb-gr-3', charlieId, 'growth', T - 5 * DAY,  T - 5 * DAY,  { weight: 4.3, height: 55.0, head: 37.5 }, mama));
  hist.push(ev('sb-gr-4', charlieId, 'growth', T - 1 * DAY,  T - 1 * DAY,  { weight: 4.7, height: 56.5, head: 38.2 }, papa));

  // Visites / soins
  hist.push(ev('sb-vis-1', charlieId, 'medication', T - 21 * DAY, T - 21 * DAY, { medicationName: 'midwife',     careCategory: 'visit' }, mama));
  hist.push(ev('sb-vis-2', charlieId, 'medication', T - 14 * DAY, T - 14 * DAY, { medicationName: 'midwife',     careCategory: 'visit' }, papa));
  hist.push(ev('sb-vis-3', charlieId, 'medication', T - 7 * DAY,  T - 7 * DAY,  { medicationName: 'pediatrician',careCategory: 'visit' }, mama));
  hist.push(ev('sb-bath-1',charlieId, 'medication', T - 3 * DAY,  T - 3 * DAY,  { medicationName: 'bath',        careCategory: 'care' }, mama));

  // Quelques journées historiques détaillées (J-1, J-2, J-3)
  for (let day = 1; day <= 3; day++) {
    const d = T - day * DAY;
    hist.push(ev(`sb-sl-h${day}-1`, charlieId, 'sleep',  d + 1 * H,  d + 2.5 * H, {}, papa));
    hist.push(ev(`sb-fe-h${day}-1`, charlieId, 'feed',   d + 2.75 * H, d + 2.75 * H, { feedSide: 'left', bottleSupplement: day === 1 ? 60 : day === 2 ? 40 : undefined }, papa));
    hist.push(ev(`sb-di-h${day}-1`, charlieId, 'diaper', d + 3 * H,   d + 3 * H, { diaperType: 'wet' }, papa));
    hist.push(ev(`sb-sl-h${day}-2`, charlieId, 'sleep',  d + 3.25 * H, d + 5.5 * H, {}, papa));
    hist.push(ev(`sb-fe-h${day}-2`, charlieId, 'feed',   d + 5.75 * H, d + 5.75 * H, { feedSide: 'right' }, mama));
    hist.push(ev(`sb-di-h${day}-2`, charlieId, 'diaper', d + 6 * H,   d + 6 * H, { diaperType: 'both', stoolColor: 'jaune_pale' }, mama));
    hist.push(ev(`sb-sl-h${day}-3`, charlieId, 'sleep',  d + 7 * H,   d + 9 * H, {}, papa));
    hist.push(ev(`sb-fe-h${day}-3`, charlieId, 'feed',   d + 9.25 * H, d + 9.25 * H, { feedSide: 'left' }, papa));
    hist.push(ev(`sb-te-h${day}`,   charlieId, 'temperature', d + 9.5 * H, d + 9.5 * H, { temperature: 37.0 + (day % 3) * 0.1, temperaturePeriod: 'morning' }, mama));
    hist.push(ev(`sb-di-h${day}-3`, charlieId, 'diaper', d + 10 * H,  d + 10 * H, { diaperType: 'wet' }, mama));
    hist.push(ev(`sb-ca-h${day}`,   charlieId, 'medication', d + 10.25 * H, d + 10.25 * H, { medicationName: 'vitamin_d', careCategory: 'care' }, mama));
    hist.push(ev(`sb-sl-h${day}-4`, charlieId, 'sleep',  d + 11 * H,  d + 13.5 * H, {}, mama));
    hist.push(ev(`sb-fe-h${day}-4`, charlieId, 'feed',   d + 13.75 * H, d + 13.75 * H, { feedSide: 'right', bottleSupplement: day === 1 ? 50 : undefined }, mama));
    hist.push(ev(`sb-di-h${day}-4`, charlieId, 'diaper', d + 14 * H,  d + 14 * H, { diaperType: 'wet' }));
    hist.push(ev(`sb-sl-h${day}-5`, charlieId, 'sleep',  d + 14.5 * H, d + 16.5 * H, {}));
    hist.push(ev(`sb-fe-h${day}-5`, charlieId, 'feed',   d + 16.75 * H, d + 16.75 * H, { feedSide: 'left' }));
    hist.push(ev(`sb-di-h${day}-5`, charlieId, 'diaper', d + 17 * H,  d + 17 * H, { diaperType: 'wet' }));
    hist.push(ev(`sb-sl-h${day}-6`, charlieId, 'sleep',  d + 18 * H,  d + 19.5 * H, {}, papa));
    hist.push(ev(`sb-fe-h${day}-6`, charlieId, 'feed',   d + 19.75 * H, d + 19.75 * H, { feedSide: 'right' }, papa));
    hist.push(ev(`sb-sl-h${day}-7`, charlieId, 'sleep',  d + 21 * H,  d + 23.5 * H, {}, papa));
  }

  // ── Events de Léa ─────────────────────────────────────────────────────────
  const leaRaw: TrackedEvent[] = [
    ev('sb-lea-gr-1', leaId, 'growth', T - 30 * DAY, T - 30 * DAY, { weight: 12.4, height: 87.5, head: 48.0 }, papa),
    ev('sb-lea-gr-2', leaId, 'growth', T - 1 * DAY,  T - 1 * DAY,  { weight: 12.7, height: 88.0, head: 48.2 }, mama),
    ev('sb-lea-fe-1', leaId, 'feed',   T + 8 * H, T + 8 * H, { feedSide: 'bottle', feedAmountMl: 180 }, mama),
    ev('sb-lea-fe-2', leaId, 'feed',   T + 12 * H, T + 12 * H, { feedSide: 'bottle', feedAmountMl: 200 }, papa),
    ev('sb-lea-fe-3', leaId, 'feed',   T + 17 * H, T + 17 * H, { feedSide: 'bottle', feedAmountMl: 180 }, mama),
  ];
  const leaEvents = leaRaw.filter((e) => e.startTime <= ts);

  return {
    profile,
    family,
    babies: [charlie, lea],
    memberRole: 'manager' as MembershipRole,
    parentLabel: 'Maman',
    events: [...todayEvents, ...hist, ...leaEvents],
    activeSessions: {},
  };
}

function remoteEventLabel(type: TrackedEvent['type'], language: AppLanguage): string {
  if (language === 'fr') {
    switch (type) {
      case 'sleep': return 'Sommeil';
      case 'feed': return 'Tétée';
      case 'diaper': return 'Couche';
      case 'temperature': return 'Température';
      case 'medication': return 'Soin';
      case 'growth': return 'Mesure';
      default: return 'Événement';
    }
  }
  switch (type) {
    case 'sleep': return 'Sleep';
    case 'feed': return 'Feed';
    case 'diaper': return 'Diaper';
    case 'temperature': return 'Temperature';
    case 'medication': return 'Care';
    case 'growth': return 'Growth';
    default: return 'Event';
  }
}

export function AppProvider({ children }: PropsWithChildren) {
  const { theme } = useAppTheme();
  const [languageState, setLanguageState] = useState<AppLanguage>('fr');
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [profileState, setProfileState] = useState<UserProfile | null>(null);
  const [familyState, setFamilyState] = useState<Family | null>(null);
  const [babiesState, setBabiesState] = useState<BabyProfile[]>([]);
  const [currentBabyState, setCurrentBabyState] = useState<BabyProfile | null>(null);
  const [eventsState, setEventsState] = useState<TrackedEvent[]>([]);
  // Older events fetched on demand (Évolution, Croissance, Historique, Export).
  // The realtime listener only follows the last 14 days for performance —
  // this slice fills in the lifetime history when a screen requests it.
  const [historicalEventsState, setHistoricalEventsState] = useState<TrackedEvent[]>([]);
  const [fullHistoryLoadedFor, setFullHistoryLoadedFor] = useState<string | null>(null);
  const [fullHistoryLoading, setFullHistoryLoading] = useState(false);
  const recentCutoffRef = useRef<number>(0);
  const [activeSessionState, setActiveSessionState] = useState<ActiveSession | null>(null);
  const [legacyEventsState, setLegacyEventsState] = useState<TrackedEvent[]>([]);
  const [legacyActiveSessionState, setLegacyActiveSessionState] = useState<ActiveSession | null>(null);
  const [legacyEventsReady, setLegacyEventsReady] = useState(false);
  const [legacySessionReady, setLegacySessionReady] = useState(false);
  const [legacyErrorState, setLegacyErrorState] = useState<LegacySnapshotError | null>(null);
  const [legacyOverrides, setLegacyOverrides] = useState<LegacyWorkspaceOverrides>({});
  const [authReady, setAuthReady] = useState(false);
  const [workspaceLoading, setWorkspaceLoading] = useState(true);
  // True once the live data listeners have produced at least one snapshot
  // since this auth session started. Used to keep the FullScreenLoader up
  // during the initial sync phase — otherwise the SPA shell becomes
  // interactive a fraction of a second before any events are visible, and
  // taps land on a screen that's still hydrating from Firestore.
  // We never reset this back to false on subsequent baby switches or
  // mutation syncs: only sign-out / sign-in resets it.
  const [initialSyncDone, setInitialSyncDone] = useState(false);
  const [optimisticEvents, setOptimisticEvents] = useState<TrackedEvent[]>([]);
  const optimisticEventsRef = useRef<TrackedEvent[]>([]);
  useEffect(() => {
    optimisticEventsRef.current = optimisticEvents;
  }, [optimisticEvents]);
  const seenEventIdsRef = useRef<Set<string>>(new Set());
  const seenEventIdsInitialisedRef = useRef(false);
  const [livePulseToken, setLivePulseToken] = useState(0);
  const [growthSpurtMock, setGrowthSpurtMockState] = useState<GrowthSpurtMockKey>('off');
  const [growthBannerHidden, setGrowthBannerHiddenState] = useState<boolean>(false);

  // Hydrate the growth-spurt mock from AsyncStorage on first mount
  useEffect(() => {
    void AsyncStorage.getItem(MOCK_STORAGE_KEY)
      .then((stored) => {
        if (stored && [
          'off', 'mild', 'probable', 'intense_3m', 'cluster_only', 'sleep_only',
        ].includes(stored)) {
          setGrowthSpurtMockState(stored as GrowthSpurtMockKey);
        }
      })
      .catch(() => undefined);
  }, []);

  // Hydrate the banner hidden flag.
  useEffect(() => {
    void AsyncStorage.getItem(GROWTH_BANNER_HIDDEN_KEY)
      .then((stored) => {
        if (stored === 'true') setGrowthBannerHiddenState(true);
      })
      .catch(() => undefined);
  }, []);

  const setGrowthSpurtMock = useCallback((key: GrowthSpurtMockKey) => {
    setGrowthSpurtMockState(key);
    void AsyncStorage.setItem(MOCK_STORAGE_KEY, key).catch(() => undefined);
  }, []);

  const setGrowthBannerHidden = useCallback((hidden: boolean) => {
    setGrowthBannerHiddenState(hidden);
    void AsyncStorage.setItem(GROWTH_BANNER_HIDDEN_KEY, hidden ? 'true' : 'false').catch(() => undefined);
  }, []);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('syncing');
  const [isNetworkOffline, setIsNetworkOffline] = useState(false);
  const [debugSyncOverride, setDebugSyncOverride] = useState<SyncStatus | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [saving, setSaving] = useState(false);
  const [notificationsGranted, setNotificationsGranted] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [sandbox, setSandbox] = useState<SandboxState | null>(null);
  const mutationLockRef = useRef(false);
  const legacyToastKeyRef = useRef<string | null>(null);
  const emptyWorkspaceToastShownRef = useRef(false);

  const isSandbox = Boolean(sandbox);

  // Network connectivity detection
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsNetworkOffline(!(state.isConnected ?? true));
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    void AsyncStorage.getItem(LANGUAGE_STORAGE_KEY)
      .then((stored) => {
        if (stored === 'fr' || stored === 'en') {
          setLanguageState(stored);
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!authUser) {
      setLegacyOverrides({});
      return;
    }

    void AsyncStorage.getItem(`${LEGACY_OVERRIDES_STORAGE_PREFIX}:${authUser.uid}`)
      .then((stored) => {
        if (!stored) {
          setLegacyOverrides({});
          return;
        }

        try {
          const parsed = JSON.parse(stored) as LegacyWorkspaceOverrides;
          setLegacyOverrides(parsed ?? {});
        } catch {
          setLegacyOverrides({});
        }
      })
      .catch(() => setLegacyOverrides({}));
  }, [authUser]);

  const showToast = (
    title: string,
    message?: string,
    kind: ToastKind = 'success',
    options?: { action?: { label: string; onPress: () => void }; duration?: number },
  ) => {
    const id = Date.now();
    setToast({ id, title, message, kind, action: options?.action, duration: options?.duration });
    if (kind === 'error') triggerErrorFeedback();
    if (kind === 'success') triggerSuccessFeedback();
    setTimeout(() => {
      setToast((current) => (current?.id === id ? null : current));
    }, options?.duration ?? 8000);
  };

  useEffect(() => {
    const unsubscribe = listenToAuth((user) => {
      setAuthUser(user);
      setAuthReady(true);
      logger.setUserId(user?.uid);
      if (user) {
        logger.info('auth', 'Utilisateur connecté', { uid: user.uid });
      } else {
        logger.info('auth', 'Utilisateur déconnecté');
      }
      setWorkspaceLoading(Boolean(user));
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!profileState?.language) return;
    setLanguageState(profileState.language);
    void AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, profileState.language).catch(() => undefined);
  }, [profileState?.language]);

  useEffect(() => {
    if (isSandbox) {
      setWorkspaceLoading(false);
      setSyncStatus('live');
      setLastSyncedAt(now());
      setInitialSyncDone(true);
      return;
    }

    if (!authUser) {
      setProfileState(null);
      setFamilyState(null);
      setBabiesState([]);
      setCurrentBabyState(null);
      setEventsState([]);
      setActiveSessionState(null);
      setLastSyncedAt(null);
      setWorkspaceLoading(false);
      setInitialSyncDone(false);
      return;
    }

    if (authUser.isAnonymous) {
      setProfileState(null);
      setWorkspaceLoading(false);
      void signOut();
      return;
    }

    setWorkspaceLoading(true);
    const unsubscribeProfile = listenUserProfile(authUser.uid, (nextProfile) => {
      setProfileState(nextProfile);
      // Le profil contient familyId — dès qu'il est chargé on peut arrêter le loading
      // si pas de famille encore, on attend le listener famille
      if (!nextProfile?.familyId) {
        setWorkspaceLoading(false);
        // No family attached → onboarding path, no live data to wait for.
        setInitialSyncDone(true);
      }
    });

    return () => {
      try { unsubscribeProfile(); } catch {}
    };
  }, [authUser, isSandbox]);

  // Legacy mode disabled — all accounts use the new schema after migration.
  const isLegacyAccount = false;

  useEffect(() => {
    if (isSandbox || !authUser || !isLegacyAccount) {
      setLegacyEventsState([]);
      setLegacyActiveSessionState(null);
      setLegacyEventsReady(true);
      setLegacySessionReady(true);
      setLegacyErrorState(null);
      legacyToastKeyRef.current = null;
      emptyWorkspaceToastShownRef.current = false;
      return;
    }

    setLegacyEventsReady(false);
    setLegacySessionReady(false);
    setLegacyErrorState(null);
    legacyToastKeyRef.current = null;
    emptyWorkspaceToastShownRef.current = false;

    const unsubscribeLegacyEvents = listenLegacyEvents(
      authUser.uid,
      (nextEvents) => {
        setLegacyEventsState(nextEvents);
        setLegacyEventsReady(true);
        setLastSyncedAt(now());
        setSyncStatus('live');
        setInitialSyncDone(true);
      },
      (payload) => {
        setLegacyErrorState(payload);
        setLegacyEventsReady(true);
        setSyncStatus('error');
        setInitialSyncDone(true);
        logger.error('firestore', `Erreur snapshot legacy-events (${payload.error.code})`, payload.error, {
          source: payload.source,
          userId: authUser.uid,
        });
      },
    );

    const unsubscribeLegacySession = listenLegacyActiveSession(
      (nextSession) => {
        setLegacyActiveSessionState(nextSession);
        setLegacySessionReady(true);
        setLastSyncedAt(now());
        setSyncStatus('live');
        setInitialSyncDone(true);
      },
      (payload) => {
        setLegacyErrorState(payload);
        setLegacySessionReady(true);
        setSyncStatus('error');
        logger.error('firestore', `Erreur snapshot legacy-session (${payload.error.code})`, payload.error, {
          source: payload.source,
          userId: authUser.uid,
        });
      },
    );

    return () => {
      unsubscribeLegacyEvents();
      unsubscribeLegacySession();
    };
  }, [authUser, isSandbox, isLegacyAccount]);

  const currentFamilyId = profileState?.familyId ?? null;

  // Le rôle courant.
  const currentMembershipState = useMemo(() => {
    if (!authUser || !familyState) return null;
    const managerIds = familyState.managerIds ?? [];
    const members = familyState.members ?? [];
    const isOwner = familyState.ownerUserId === authUser.uid;
    const role: MembershipRole = isOwner || managerIds.includes(authUser.uid) ? 'manager' : 'viewer';
    const memberEntry = members.find((m) => m.uid === authUser.uid);
    return { role, userId: authUser.uid, parentLabel: memberEntry?.parentLabel ?? null };
  }, [authUser, familyState]);

  // Effect 1 : ouvre les listeners Firestore uniquement quand la famille change.
  // Dépend de familyId (string) et non de l'objet membership entier pour éviter
  // le listener churn qui provoque le crash SDK ca9/ve:-1.
  useEffect(() => {
    if (isSandbox) return;

    if (!authUser || !currentFamilyId) {
      setFamilyState(null);
      setBabiesState([]);
      setCurrentBabyState(null);
      return;
    }

    const unsubscribeFamily = listenFamily(currentFamilyId, (family) => {
      setFamilyState(family);
      setWorkspaceLoading(false);
    });

    const unsubscribeBabies = listenBabies(currentFamilyId, (nextBabies) => {
      setBabiesState(nextBabies);
    });

    return () => {
      try { unsubscribeFamily(); } catch {}
      try { unsubscribeBabies(); } catch {}
    };
  }, [authUser, currentFamilyId, isSandbox]);

  // Effect 2 : sélectionne le bébé actif quand la liste de bébés ou la préférence change.
  // Séparé de l'effect listeners pour ne pas recréer les subscriptions Firestore
  // à chaque changement de préférence.
  const defaultBabyId = profileState?.defaultBabyId ?? null;
  useEffect(() => {
    if (isSandbox || !authUser || babiesState.length === 0) return;

    const preferredBaby = defaultBabyId
      ? babiesState.find((baby) => baby.id === defaultBabyId) ?? null
      : null;
    const fallbackBaby = preferredBaby ?? babiesState[0] ?? null;

    setCurrentBabyState((current) => {
      if (preferredBaby) return preferredBaby;
      if (current && babiesState.some((baby) => baby.id === current.id)) return current;
      return fallbackBaby;
    });

    if (fallbackBaby && defaultBabyId !== fallbackBaby.id) {
      void selectDefaultBaby(authUser.uid, fallbackBaby.id);
    }
  }, [authUser, babiesState, defaultBabyId, isSandbox]);

  const refreshData = useCallback(() => {
    setSyncStatus('syncing');
    setRefreshToken((n) => n + 1);
  }, []);

  useEffect(() => {
    if (isSandbox) return;

    if (!currentBabyState) {
      setEventsState([]);
      setHistoricalEventsState([]);
      setFullHistoryLoadedFor(null);
      setActiveSessionState(null);
      setLastSyncedAt(null);
      recentCutoffRef.current = 0;
      return;
    }

    setSyncStatus('syncing');
    // Reset historical slice when switching baby — the previous baby's
    // older events are not relevant.
    setHistoricalEventsState([]);
    setFullHistoryLoadedFor(null);

    // Listener takes the full history for now — capping it at 14 days
    // depends on a Firestore composite index that may not be deployed
    // (and on every event having a sane `startTime`). Until that's
    // verified, we keep the original behaviour to avoid hiding data.
    // The on-demand `loadFullHistory()` becomes redundant in this mode
    // but stays in place so we can flip back without UI changes.
    const recentCutoff = Date.now() - RECENT_EVENTS_WINDOW_MS;
    recentCutoffRef.current = recentCutoff;

    const unsubscribeEvents = listenEvents(
      currentBabyState.id,
      currentBabyState.familyId,
      (nextEvents) => {
        // Detect events that are new since last snapshot AND likely from
        // another device (not matched by a recent optimistic). Used to
        // trigger a subtle live-pulse + cross-device toast.
        //
        // We previously gated this on `ageMs < 60_000`, but that caused
        // late-arriving events (e.g. encoded 10 min ago on another device
        // but only reaching this client after reconnection or after the
        // initial snapshot returned partial data) to slip in silently,
        // leaving the parent wondering where the event came from. We now
        // surface ANY event that's new to this session after the initial
        // fetch — the `seenEventIdsInitialisedRef` guard already filters
        // out the initial-fetch noise.
        const seen = seenEventIdsRef.current;
        const remoteNew: TrackedEvent[] = [];
        nextEvents.forEach((event) => {
          if (!seen.has(event.id)) {
            seen.add(event.id);
            if (seenEventIdsInitialisedRef.current) {
              remoteNew.push(event);
            }
          }
        });
        if (remoteNew.length > 0) {
          setLivePulseToken((n) => n + 1);
          remoteNew.forEach((event) => {
            const matchesOptimistic = optimisticEventsRef.current.some(
              (opt) =>
                opt.type === event.type &&
                opt.babyId === event.babyId &&
                Math.abs(opt.startTime - event.startTime) < 8000,
            );
            if (matchesOptimistic) return;
            const label = remoteEventLabel(event.type, language);
            // Distinguish "live" arrivals (just encoded) from "delayed"
            // arrivals (encoded a while ago, only just reaching us) so
            // the parent isn't confused when an old timestamp appears in
            // the timeline out of nowhere.
            const ageMs = Date.now() - event.startTime;
            const isDelayed = ageMs >= 60_000;
            showToast(
              language === 'fr' ? 'Nouvelle activité' : 'New activity',
              isDelayed
                ? language === 'fr'
                  ? `${label} synchronisé depuis un autre appareil`
                  : `${label} synced from another device`
                : language === 'fr'
                  ? `${label} enregistré sur un autre appareil`
                  : `${label} recorded from another device`,
              'success',
              { duration: 3500 },
            );
          });
        }
        seenEventIdsInitialisedRef.current = true;
        setEventsState(nextEvents);
        setSyncStatus('live');
        setLastSyncedAt(now());
        setInitialSyncDone(true);
      },
      (err) => {
        setSyncStatus('error');
        // Surface the error to the UI even if no snapshot ever arrives, so
        // the user is not stuck behind the sync loader forever.
        setInitialSyncDone(true);
        logger.error('firestore', `Erreur snapshot events (${err.code})`, err, { babyId: currentBabyState.id });
      },
    );

    const unsubscribeSession = listenActiveSession(currentBabyState.id, (session) => {
      setActiveSessionState(session);
      setSyncStatus('live');
      setLastSyncedAt(now());
      setInitialSyncDone(true);
    });

    return () => {
      try { unsubscribeEvents(); } catch {}
      try { unsubscribeSession(); } catch {}
    };
  }, [currentBabyState, isSandbox, refreshToken]);

  const legacyWorkspace = useMemo(() => {
    if (!authUser) return null;
    if (legacyEventsState.length === 0 && !legacyActiveSessionState) return null;

    const displayName =
      profileState?.displayName?.trim() ||
      authUser.displayName?.trim() ||
      authUser.email?.split('@')[0] ||
      'Parent';
    const role: MembershipRole = isLegacyGuestUser(authUser) ? 'viewer' : 'manager';
    const updatedAt = Math.max(
      ...legacyEventsState.map((event) => event.updatedAt || event.startTime),
      legacyActiveSessionState?.updatedAt ?? 0,
      now(),
    );
    const feedingMode = inferLegacyFeedingMode(legacyEventsState);

    const profile: UserProfile = {
      id: authUser.uid,
      email: authUser.email ?? '',
      displayName,
      photoUrl: profileState?.photoUrl,
      defaultBabyId: LEGACY_TRACKER_BABY_ID,
      familyId: LEGACY_TRACKER_FAMILY_ID,
      language: profileState?.language ?? languageState,
      createdAt: updatedAt,
      updatedAt,
    };

    const family: Family = {
      id: LEGACY_TRACKER_FAMILY_ID,
      name: legacyOverrides.familyName?.trim() || 'Charlie',
      ownerUserId: authUser.uid,
      managerCode: LEGACY_TRACKER_SCOPE_ID.toUpperCase(),
      viewerCode: '',
      managerIds: role === 'manager' ? [authUser.uid] : [],
      viewerIds: role === 'viewer' ? [authUser.uid] : [],
      members: [{ uid: authUser.uid, displayName, parentLabel: legacyOverrides.parentLabel ?? null, role }],
      parentNames: [displayName],
      visitTypes: legacyOverrides.visitTypes ?? [],
      careTypes: [],
      premiumStatus: 'premium',
      createdAt: updatedAt,
      updatedAt,
    };

    const baby: BabyProfile = {
      id: LEGACY_TRACKER_BABY_ID,
      familyId: LEGACY_TRACKER_FAMILY_ID,
      firstName: legacyOverrides.babyFirstName?.trim() || 'Charlie',
      birthDate: legacyOverrides.babyBirthDate || LEGACY_TRACKER_BIRTH_DATE,
      sex: legacyOverrides.babySex || 'boy',
      feedingMode: legacyOverrides.babyFeedingMode || feedingMode,
      avatarKey: legacyOverrides.babyAvatarKey ?? 'babyAvatar',
      photoUrl: legacyOverrides.babyPhotoUrl,
      createdAt: updatedAt,
      updatedAt,
    };

    const membership = { role, userId: authUser.uid, parentLabel: legacyOverrides.parentLabel ?? null };

    return { profile, family, baby, membership };
  }, [authUser, languageState, legacyActiveSessionState, legacyEventsState, legacyOverrides, profileState?.displayName, profileState?.language]);

  const sandboxCurrentBaby = useMemo(() => {
    if (!sandbox) return null;
    const preferredBabyId = sandbox.profile.defaultBabyId;
    return sandbox.babies.find((baby) => baby.id === preferredBabyId) ?? sandbox.babies[0] ?? null;
  }, [sandbox]);

  const legacyProfile = legacyWorkspace?.profile ?? null;
  const legacyMembership = legacyWorkspace?.membership ?? null;
  const legacyFamily = legacyWorkspace?.family ?? null;
  const legacyBaby = legacyWorkspace?.baby ?? null;
  const preferLegacyWorkspace =
    !isSandbox &&
    Boolean(legacyWorkspace) &&
    (
      !currentMembershipState ||
      !currentBabyState
    );
  const usingLegacyWorkspace = Boolean(preferLegacyWorkspace);

  // Membership courant (sandbox > legacy > live)
  const sandboxMembership = sandbox
    ? { role: sandbox.memberRole, userId: sandbox.profile.id, parentLabel: sandbox.parentLabel }
    : null;
  const profile = sandbox?.profile ?? (usingLegacyWorkspace ? legacyProfile : null) ?? profileState;
  const memberships = sandboxMembership ? [sandboxMembership] : (usingLegacyWorkspace && legacyMembership) ? [legacyMembership] : (currentMembershipState ? [currentMembershipState] : []);
  const currentMembership = sandboxMembership ?? (usingLegacyWorkspace ? legacyMembership : null) ?? currentMembershipState;
  const currentFamily = sandbox?.family ?? (usingLegacyWorkspace ? legacyFamily : null) ?? familyState;

  // familyMembers dérivés du document famille (tableau dénormalisé members)
  const familyMembersLive: FamilyMember[] = usingLegacyWorkspace
    ? (legacyFamily?.members ?? [])
    : (familyState?.members ?? []);
  const familyMembersResolved: FamilyMember[] = isSandbox
    ? (sandbox?.family.members ?? [])
    : familyMembersLive;

  const babies = sandbox ? sandbox.babies : (usingLegacyWorkspace && legacyBaby) ? [legacyBaby] : babiesState;
  const currentBaby = sandboxCurrentBaby ?? (usingLegacyWorkspace ? legacyBaby : null) ?? currentBabyState;
  const liveEvents = useMemo(() => {
    if (historicalEventsState.length === 0) return eventsState;
    // Dedupe by id (eventsState wins on conflict — it's the live listener)
    const map = new Map<string, TrackedEvent>();
    for (const e of historicalEventsState) map.set(e.id, e);
    for (const e of eventsState) map.set(e.id, e);
    return Array.from(map.values()).sort((a, b) => b.startTime - a.startTime);
  }, [eventsState, historicalEventsState]);

  const baseEvents = sandbox && sandboxCurrentBaby
    ? sandbox.events.filter((event) => event.babyId === sandboxCurrentBaby.id).sort((left, right) => right.startTime - left.startTime)
    : usingLegacyWorkspace
      ? legacyEventsState
      : legacyEventsState.length > 0
        ? [...liveEvents, ...legacyEventsState].sort((a, b) => b.startTime - a.startTime)
        : liveEvents;
  // Optimistic merge — events created locally appear instantly, hidden once
  // the Firestore listener delivers a matching real event (same type + babyId
  // within an 8s window).
  const events = useMemo(() => {
    if (optimisticEvents.length === 0) return baseEvents;
    const survivors = optimisticEvents.filter((opt) => {
      return !baseEvents.some((real) =>
        real.type === opt.type &&
        real.babyId === opt.babyId &&
        Math.abs(real.startTime - opt.startTime) < 8000,
      );
    });
    if (survivors.length === 0) return baseEvents;
    return [...survivors, ...baseEvents].sort((a, b) => b.startTime - a.startTime);
  }, [baseEvents, optimisticEvents]);
  const activeSession = sandbox && sandboxCurrentBaby
    ? sandbox.activeSessions[sandboxCurrentBaby.id] ?? null
    : usingLegacyWorkspace
      ? legacyActiveSessionState
      : activeSessionState;
  const language = sandbox?.profile.language ?? legacyProfile?.language ?? profileState?.language ?? languageState;
  const feedingMode = sandboxCurrentBaby?.feedingMode ?? currentBaby?.feedingMode ?? 'breastfeeding';

  const needsOnboarding = !isSandbox && authReady && !!authUser && !profileState?.familyId && !usingLegacyWorkspace;
  const effectiveWorkspaceLoading =
    isSandbox
      ? false
      : workspaceLoading || (Boolean(authUser) && !profileState && (!legacyEventsReady || !legacySessionReady));

  useEffect(() => {
    if (!authUser || isSandbox || !legacyErrorState) return;

    const errorKey = `${legacyErrorState.source}:${legacyErrorState.error.code}:${legacyErrorState.error.message}`;
    if (legacyToastKeyRef.current === errorKey) return;

    legacyToastKeyRef.current = errorKey;
    showToast(
      translate(language, 'toast.legacy_sync_failed.title'),
      translate(language, 'toast.legacy_sync_failed.body'),
      'error',
    );
  }, [authUser, isSandbox, language, legacyErrorState]);

  useEffect(() => {
    if (!authUser || isSandbox || needsOnboarding || effectiveWorkspaceLoading) return;
    if (emptyWorkspaceToastShownRef.current) return;
    // Only show empty workspace toast for legacy admin account
    if (!isLegacyAccount) return;
    if (legacyWorkspace || legacyErrorState) return;
    if (eventsState.length > 0 || activeSessionState || legacyEventsState.length > 0 || legacyActiveSessionState) return;

    emptyWorkspaceToastShownRef.current = true;
    showToast(
      translate(language, 'toast.empty_workspace.title'),
      translate(language, 'toast.empty_workspace.body'),
      'success',
    );
  }, [
    activeSessionState,
    authUser,
    effectiveWorkspaceLoading,
    eventsState.length,
    isSandbox,
    language,
    legacyActiveSessionState,
    legacyErrorState,
    legacyEventsState.length,
    legacyWorkspace,
    needsOnboarding,
  ]);

  const runMutation = async (operation: () => Promise<void>) => {
    if (mutationLockRef.current) return;
    if (!currentFamily || !currentBaby || (!authUser && !isSandbox) || !currentMembership || !profile) {
      showToast(translate(language, 'toast.incomplete_context.title'), translate(language, 'toast.incomplete_context.body'), 'error');
      return;
    }

    mutationLockRef.current = true;
    setSaving(true);
    if (!isSandbox) {
      setSyncStatus('syncing');
    }
    try {
      await operation();
      if (isSandbox) {
        setSyncStatus('live');
        setLastSyncedAt(now());
      }
    } catch (error) {
      setSyncStatus('error');
      logger.error('tracker', 'Action échouée', error, { mapped: mapError(error, language) });
      showToast(translate(language, 'toast.action_failed.title'), mapError(error, language), 'error');
    } finally {
      mutationLockRef.current = false;
      setSaving(false);
    }
  };

  const appendSandboxEvent = (event: TrackedEvent) => {
    setSandbox((current) => current ? { ...current, events: [event, ...current.events] } : current);
  };

  const updateSandboxEvent = (eventId: string, updater: (event: TrackedEvent) => TrackedEvent) => {
    setSandbox((current) => {
      if (!current) return current;
      const events = current.events.map((event) => event.id === eventId ? updater(event) : event);
      // If the edited event is the in-progress sleep session, mirror
      // its startTime onto the active session so the live counter on
      // Today picks the corrected value up immediately.
      const nextActiveSessions = { ...current.activeSessions };
      Object.entries(nextActiveSessions).forEach(([babyId, session]) => {
        if (session.eventId !== eventId) return;
        const updatedEvent = events.find((e) => e.id === eventId);
        if (!updatedEvent) return;
        nextActiveSessions[babyId] = {
          ...session,
          startTime: updatedEvent.startTime,
          updatedAt: Date.now(),
        };
      });
      return { ...current, events, activeSessions: nextActiveSessions };
    });
  };

  const deleteSandboxEventById = (eventId: string) => {
    setSandbox((current) => {
      if (!current) return current;

      const nextActiveSessions = { ...current.activeSessions };
      Object.entries(nextActiveSessions).forEach(([babyId, session]) => {
        if (session.eventId === eventId) {
          delete nextActiveSessions[babyId];
        }
      });

      return {
        ...current,
        events: current.events.filter((event) => event.id !== eventId),
        activeSessions: nextActiveSessions,
      };
    });
  };

  const sandboxScope = () => {
    if (!sandboxCurrentBaby || !sandbox) return null;
    return {
      familyId: sandbox.family.id,
      babyId: sandboxCurrentBaby.id,
      userId: sandbox.profile.id,
      role: sandbox.memberRole,
      createdByLabel: sandbox.parentLabel ?? undefined,
    };
  };

  /**
   * Push an optimistic event to the local state so the UI updates instantly.
   * Auto-cleanup after 4s — by then the Firestore listener will have delivered
   * the real event (matched by type+babyId+timestamp window in the events
   * memo, see baseEvents/events declaration).
   */
  const pushOptimistic = useCallback(
    (
      type: TrackedEvent['type'],
      details: EventDetails,
      notes?: string,
      endTime?: number | null,
      startTime?: number,
    ) => {
      if (isSandbox || usingLegacyWorkspace) return;
      if (!currentBaby || !currentFamily || !authUser || !currentMembership) return;
      const id = `__opt_${type}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const ts = typeof startTime === 'number' ? startTime : Date.now();
      const event: TrackedEvent = {
        id,
        type,
        babyId: currentBaby.id,
        familyId: currentFamily.id,
        startTime: ts,
        endTime: endTime ?? null,
        details,
        notes,
        createdAt: ts,
        updatedAt: ts,
        createdByUserId: authUser.uid,
        createdByRole: currentMembership.role,
        createdByLabel: undefined,
      };
      setOptimisticEvents((prev) => [...prev, event]);
      setTimeout(() => {
        setOptimisticEvents((prev) => prev.filter((e) => e.id !== id));
      }, 4000);
    },
    [isSandbox, usingLegacyWorkspace, currentBaby, currentFamily, authUser, currentMembership],
  );

  const loadFullHistory = useCallback(async () => {
    // Sandbox / legacy already hold the full slice locally — nothing to do.
    if (isSandbox || usingLegacyWorkspace) return;
    if (!currentBabyState) return;
    if (fullHistoryLoadedFor === currentBabyState.id) return;
    if (fullHistoryLoading) return;
    if (recentCutoffRef.current === 0) return; // listener not yet started
    setFullHistoryLoading(true);
    try {
      const older = await fetchEventsBeforeTimestamp(
        currentBabyState.id,
        currentBabyState.familyId,
        recentCutoffRef.current,
      );
      setHistoricalEventsState(older);
      setFullHistoryLoadedFor(currentBabyState.id);
    } catch (error) {
      logger.error('firestore', 'fetchEventsBeforeTimestamp failed', error, {
        babyId: currentBabyState.id,
      });
    } finally {
      setFullHistoryLoading(false);
    }
  }, [isSandbox, usingLegacyWorkspace, currentBabyState, fullHistoryLoadedFor, fullHistoryLoading]);

  const liveScope = () => {
    if (!currentFamily || !currentBaby || !authUser || !currentMembership) return null;
    // L'auteur d'un event est le "compte famille" — identifié par la combinaison de parents
    // (Papa & Maman / Papa seul / etc.) plutôt que par le parentLabel individuel.
    // Fallbacks : parentNames[0] (ancien modèle) puis displayName du profil.
    const accountLabel = currentFamily.parentsCombination
      ? comboLabel(currentFamily.parentsCombination, language)
      : (currentFamily.parentNames?.[0] ?? profileState?.displayName ?? undefined);
    return {
      familyId: currentFamily.id,
      babyId: currentBaby.id,
      userId: authUser.uid,
      role: currentMembership.role,
      createdByLabel: accountLabel,
    };
  };

  const createSandboxEvent = (params: {
    type: TrackedEvent['type'];
    endTime?: number | null;
    details?: EventDetails;
    notes?: string;
    startTime?: number;
  }): TrackedEvent | null => {
    const scope = sandboxScope();
    if (!scope) return null;
    const timestamp = params.startTime ?? now();
    return {
      id: `sandbox-${timestamp}-${Math.random().toString(36).slice(2, 8)}`,
      familyId: scope.familyId,
      babyId: scope.babyId,
      type: params.type,
      startTime: timestamp,
      endTime: params.endTime ?? timestamp,
      details: params.details,
      notes: params.notes,
      createdByUserId: scope.userId,
      createdByRole: scope.role,
      createdByLabel: scope.createdByLabel,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  };

  const showLegacyStructureLocked = () => {
    showToast(translate(language, 'toast.action_failed.title'), translate(language, 'error.legacy_structure_locked'), 'success');
  };

  const value = useMemo<AppContextValue>(() => ({
    authUser,
    profile,
    memberships,
    familyMembers: familyMembersResolved,
    currentMembership,
    currentFamily,
    currentBaby,
    babies,
    events,
    activeSession,
    authReady,
    workspaceLoading: effectiveWorkspaceLoading,
    needsOnboarding,
    initialSyncDone,
    syncStatus: debugSyncOverride ?? (isNetworkOffline ? 'offline' : isSandbox ? 'live' : syncStatus),
    livePulseToken,
    growthSpurtMock,
    setGrowthSpurtMock,
    growthBannerHidden,
    setGrowthBannerHidden,
    lastSyncedAt,
    saving,
    notificationsGranted,
    toast,
    viewerRole: currentMembership?.role ?? null,
    isViewer: currentMembership?.role === 'viewer',
    isSandbox,
    language,
    feedingMode,
    signInWithPassword: async (email, password) => {
      try {
        await signIn(email, password);
        return true;
      } catch (error) {
        showToast(translate(language, 'toast.sign_in_failed.title'), mapError(error, language), 'error');
        return false;
      }
    },
    registerWithPassword: async (email, password, displayName) => {
      try {
        await signUp({ email, password, displayName, language });
        return true;
      } catch (error) {
        showToast(translate(language, 'toast.sign_up_failed.title'), mapError(error, language), 'error');
        return false;
      }
    },
    setParentsCombination: async (combo: ParentsCombination) => {
      if (!currentFamily) return;
      setSaving(true);
      try {
        await updateFamilyParentsCombination(currentFamily.id, combo);
        showToast(translate(language, 'toast.family_updated.title'), translate(language, 'toast.family_updated.body'), 'success');
      } catch (error) {
        showToast(translate(language, 'toast.action_failed.title'), mapError(error, language), 'error');
      } finally {
        setSaving(false);
      }
    },
    completeInitialSetup: async (input) => {
      if (!authUser) return false;
      setSaving(true);
      try {
        await createInitialSetup(authUser, { ...input, language });
        // Immediately update local state so needsOnboarding becomes false
        // before the Firestore listener fires — prevents redirect loop.
        // profileState will be updated by the listener with familyId set.
        showToast(translate(language, 'toast.setup_created.title'), translate(language, 'toast.setup_created.body'));
        return true;
      } catch (error) {
        showToast(translate(language, 'toast.setup_failed.title'), mapError(error, language), 'error');
        return false;
      } finally {
        setSaving(false);
      }
    },
    triggerSleep: async () => {
      if (currentMembership && !canRecordEvents(currentMembership)) {
        showToast(language === 'fr' ? 'Accès lecture seule' : 'Read-only access', language === 'fr' ? 'Demandez au responsable de vous accorder l\'accès.' : 'Ask the family manager to grant you access.', 'error');
        return;
      }
      if (isSandbox) {
        await runMutation(async () => {
          const event = createSandboxEvent({ type: 'sleep', endTime: null });
          const scope = sandboxScope();
          if (!event || !scope) return;
          appendSandboxEvent(event);
          setSandbox((current) => current ? {
            ...current,
            activeSessions: {
              ...current.activeSessions,
              [scope.babyId]: {
                id: scope.babyId,
                familyId: scope.familyId,
                babyId: scope.babyId,
                eventId: event.id,
                type: 'sleep',
                startTime: event.startTime,
                details: {},
                createdByUserId: scope.userId,
                createdByRole: scope.role,
                updatedAt: event.startTime,
              },
            },
          } : current);
          showToast(translate(language, 'toast.sleep_started.title'), translate(language, 'toast.sleep_started.test'));
        });
        return;
      }

      if (usingLegacyWorkspace) {
        if (!authUser) return;
        await runMutation(async () => {
          await startLegacySleepSession(authUser);
          showToast(translate(language, 'toast.sleep_started.title'), translate(language, 'toast.sleep_started.body'));
        });
        return;
      }

      const scope = liveScope();
      if (!scope) return;
      await runMutation(async () => {
        await startSleepSession(scope);
        showToast(translate(language, 'toast.sleep_started.title'), translate(language, 'toast.sleep_started.body'));
      });
    },
    stopSleep: async () => {
      if (currentMembership && !canRecordEvents(currentMembership)) {
        showToast(language === 'fr' ? 'Accès lecture seule' : 'Read-only access', language === 'fr' ? 'Demandez au responsable de vous accorder l\'accès.' : 'Ask the family manager to grant you access.', 'error');
        return;
      }
      if (isSandbox) {
        await runMutation(async () => {
          if (!activeSession) return;
          const timestamp = now();
          updateSandboxEvent(activeSession.eventId, (event) => ({
            ...event,
            endTime: timestamp,
            updatedAt: timestamp,
          }));
          setSandbox((current) => {
            if (!current || !currentBaby) return current;
            const nextActiveSessions = { ...current.activeSessions };
            delete nextActiveSessions[currentBaby.id];
            return { ...current, activeSessions: nextActiveSessions };
          });
          showToast(translate(language, 'toast.sleep_stopped.title'), translate(language, 'toast.sleep_stopped.test'));
        });
        return;
      }

      if (usingLegacyWorkspace) {
        await runMutation(async () => {
          await stopLegacySleepSession();
          setLegacyActiveSessionState(null); // optimistic: don't wait for listener
          showToast(translate(language, 'toast.sleep_stopped.title'), translate(language, 'toast.sleep_stopped.body'));
        });
        return;
      }

      const scope = liveScope();
      if (!scope) return;
      await runMutation(async () => {
        await stopSleepSession(scope);
        setActiveSessionState(null); // optimistic: don't wait for listener
        showToast(translate(language, 'toast.sleep_stopped.title'), translate(language, 'toast.sleep_stopped.body'));
      });
    },
    recordFeed: async (feedSide, amountMl, bottleSupplement) => {
      if (currentMembership && !canRecordEvents(currentMembership)) {
        showToast(language === 'fr' ? 'Accès lecture seule' : 'Read-only access', language === 'fr' ? 'Demandez au responsable de vous accorder l\'accès.' : 'Ask the family manager to grant you access.', 'error');
        return;
      }
      const details = {
        feedSide,
        ...(typeof amountMl === 'number' ? { feedAmountMl: amountMl } : {}),
        ...(typeof bottleSupplement === 'number' ? { bottleSupplement } : {}),
      };
      const isBreastfeeding = feedSide === 'left' || feedSide === 'right';
      const isHybrid = isBreastfeeding && typeof bottleSupplement === 'number';

      if (isSandbox) {
        await runMutation(async () => {
          const event = createSandboxEvent({ type: 'feed', details });
          if (!event) return;
          appendSandboxEvent(event);
          showToast(
            translate(language, isHybrid ? 'toast.feed_hybrid_saved.title' : feedSide === 'bottle' ? 'toast.bottle_saved.title' : 'toast.feed_saved.title'),
            isBreastfeeding && language === 'fr' ? getBreastfeedingEncouragement() : translate(language, 'toast.feed_saved.test')
          );
        });
        return;
      }

      if (usingLegacyWorkspace) {
        if (!authUser) return;
        const legacyLabel = legacyMembership?.parentLabel ?? profileState?.displayName ?? undefined;
        await runMutation(async () => {
          await addLegacyFeedEvent(authUser, details, undefined, undefined, legacyLabel);
          showToast(
            translate(language, isHybrid ? 'toast.feed_hybrid_saved.title' : feedSide === 'bottle' ? 'toast.bottle_saved.title' : 'toast.feed_saved.title'),
            isBreastfeeding && language === 'fr' ? getBreastfeedingEncouragement() : translate(language, 'toast.feed_saved.body'),
          );
        });
        return;
      }

      const scope = liveScope();
      if (!scope) return;
      pushOptimistic('feed', details);
      await runMutation(async () => {
        await addFeedEvent(scope, details);
        showToast(
          translate(language, isHybrid ? 'toast.feed_hybrid_saved.title' : feedSide === 'bottle' ? 'toast.bottle_saved.title' : 'toast.feed_saved.title'),
          isBreastfeeding && language === 'fr' ? getBreastfeedingEncouragement() : translate(language, 'toast.feed_saved.body')
        );
      });
    },
    recordDiaper: async ({ diaperType, stoolColor, notes }) => {
      if (currentMembership && !canRecordEvents(currentMembership)) {
        showToast(language === 'fr' ? 'Accès lecture seule' : 'Read-only access', language === 'fr' ? 'Demandez au responsable de vous accorder l\'accès.' : 'Ask the family manager to grant you access.', 'error');
        return;
      }
      if (isSandbox) {
        await runMutation(async () => {
          const event = createSandboxEvent({ type: 'diaper', details: { diaperType, ...(stoolColor ? { stoolColor } : {}) }, notes });
          if (!event) return;
          appendSandboxEvent(event);
          showToast(translate(language, 'toast.diaper_saved.title'), translate(language, 'toast.local_test'));
        });
        return;
      }

      if (usingLegacyWorkspace) {
        if (!authUser) return;
        const legacyLabel = legacyMembership?.parentLabel ?? profileState?.displayName ?? undefined;
        await runMutation(async () => {
          await addLegacyDiaperEvent(authUser, { diaperType, ...(stoolColor ? { stoolColor } : {}) }, notes, undefined, legacyLabel);
          showToast(translate(language, 'toast.diaper_saved.title'));
        });
        return;
      }

      const scope = liveScope();
      if (!scope) return;
      pushOptimistic('diaper', { diaperType, ...(stoolColor ? { stoolColor } : {}) }, notes);
      await runMutation(async () => {
        await addDiaperEvent(scope, { diaperType, ...(stoolColor ? { stoolColor } : {}) }, notes);
        showToast(translate(language, 'toast.diaper_saved.title'));
      });
    },
    recordMedication: async ({ medicationName, careCategory = 'care', notes }) => {
      if (currentMembership && !canRecordEvents(currentMembership)) {
        showToast(language === 'fr' ? 'Accès lecture seule' : 'Read-only access', language === 'fr' ? 'Demandez au responsable de vous accorder l\'accès.' : 'Ask the family manager to grant you access.', 'error');
        return;
      }
      if (isSandbox) {
        await runMutation(async () => {
          const event = createSandboxEvent({ type: 'medication', details: { medicationName, careCategory }, notes });
          if (!event) return;
          appendSandboxEvent(event);
          showToast(translate(language, careCategory === 'visit' ? 'toast.visit_saved.title' : 'toast.care_saved.title'), translate(language, 'toast.local_test'));
        });
        return;
      }

      if (usingLegacyWorkspace) {
        if (!authUser) return;
        const legacyLabel = legacyMembership?.parentLabel ?? profileState?.displayName ?? undefined;
        await runMutation(async () => {
          await addLegacyMedicationEvent(authUser, { medicationName, careCategory }, notes, undefined, legacyLabel);
          showToast(translate(language, careCategory === 'visit' ? 'toast.visit_saved.title' : 'toast.care_saved.title'));
        });
        return;
      }

      const scope = liveScope();
      if (!scope) return;
      pushOptimistic('medication', { medicationName, careCategory }, notes);
      await runMutation(async () => {
        await addMedicationEvent(scope, { medicationName, careCategory }, notes);
        showToast(translate(language, careCategory === 'visit' ? 'toast.visit_saved.title' : 'toast.care_saved.title'));
      });
    },
    recordTemperature: async (temperature) => {
      if (currentMembership && !canRecordEvents(currentMembership)) {
        showToast(language === 'fr' ? 'Accès lecture seule' : 'Read-only access', language === 'fr' ? 'Demandez au responsable de vous accorder l\'accès.' : 'Ask the family manager to grant you access.', 'error');
        return;
      }
      const resolvedPeriod = inferTemperaturePeriod();
      if (isSandbox) {
        await runMutation(async () => {
          const event = createSandboxEvent({ type: 'temperature', details: { temperature, temperaturePeriod: resolvedPeriod } });
          if (!event) return;
          appendSandboxEvent(event);
          showToast(translate(language, 'toast.temperature_saved.title'), translate(language, 'toast.local_test'));
        });
        return;
      }

      if (usingLegacyWorkspace) {
        if (!authUser) return;
        const legacyLabel = legacyMembership?.parentLabel ?? profileState?.displayName ?? undefined;
        await runMutation(async () => {
          await addLegacyTemperatureEvent(authUser, { temperature, temperaturePeriod: resolvedPeriod }, undefined, legacyLabel);
          showToast(translate(language, 'toast.temperature_saved.title'));
        });
        return;
      }

      const scope = liveScope();
      if (!scope) return;
      pushOptimistic('temperature', { temperature, temperaturePeriod: resolvedPeriod });
      await runMutation(async () => {
        await addTemperatureEvent(scope, { temperature, temperaturePeriod: resolvedPeriod });
        showToast(translate(language, 'toast.temperature_saved.title'));
      });
    },
    recordPumping: async ({ side, volumeMl, leftMl, rightMl, durationMin, notes }) => {
      if (currentMembership && !canRecordEvents(currentMembership)) {
        showToast(language === 'fr' ? 'Accès lecture seule' : 'Read-only access', language === 'fr' ? 'Demandez au responsable de vous accorder l\'accès.' : 'Ask the family manager to grant you access.', 'error');
        return;
      }
      const details: EventDetails = {
        pumpingSide: side,
        pumpingVolumeMl: volumeMl,
        ...(side === 'both' && typeof leftMl === 'number' ? { pumpingLeftMl: leftMl } : {}),
        ...(side === 'both' && typeof rightMl === 'number' ? { pumpingRightMl: rightMl } : {}),
        ...(typeof durationMin === 'number' ? { pumpingDurationMin: durationMin } : {}),
      };

      if (isSandbox) {
        await runMutation(async () => {
          const event = createSandboxEvent({ type: 'pumping', details, notes });
          if (!event) return;
          appendSandboxEvent(event);
          showToast(translate(language, 'toast.pumping_saved.title'), translate(language, 'toast.local_test'));
        });
        return;
      }

      // Legacy workspace has no first-class pumping schema; bail out
      // softly so we never write malformed legacy docs. (Legacy is
      // already in the process of being phased out.)
      if (usingLegacyWorkspace) {
        showToast(translate(language, 'toast.pumping_saved.title'), language === 'fr' ? 'Indisponible dans le mode hérité.' : 'Not available in legacy mode.', 'error');
        return;
      }

      const scope = liveScope();
      if (!scope) return;
      pushOptimistic('pumping', details, notes);
      await runMutation(async () => {
        await addPumpingEvent(scope, details, notes);
        showToast(translate(language, 'toast.pumping_saved.title'));
      });
    },
    recordGrowth: async (details) => {
      if (currentMembership && !canRecordEvents(currentMembership)) {
        showToast(language === 'fr' ? 'Accès lecture seule' : 'Read-only access', language === 'fr' ? 'Demandez au responsable de vous accorder l\'accès.' : 'Ask the family manager to grant you access.', 'error');
        return;
      }
      if (isSandbox) {
        await runMutation(async () => {
          const event = createSandboxEvent({ type: 'growth', details });
          if (!event) return;
          appendSandboxEvent(event);
          showToast(translate(language, 'toast.measure_saved.title'), translate(language, 'toast.local_test'));
        });
        return;
      }

      if (usingLegacyWorkspace) {
        if (!authUser) return;
        const legacyLabel = legacyMembership?.parentLabel ?? profileState?.displayName ?? undefined;
        await runMutation(async () => {
          await addLegacyGrowthEvent(authUser, details, undefined, legacyLabel);
          showToast(translate(language, 'toast.measure_saved.title'));
        });
        return;
      }

      const scope = liveScope();
      if (!scope) return;
      await runMutation(async () => {
        await addGrowthEvent(scope, details);
        showToast(translate(language, 'toast.measure_saved.title'));
      });
    },
    selectBaby: async (babyId) => {
      if (isSandbox) {
        const selected = sandbox?.babies.find((baby) => baby.id === babyId) ?? null;
        setSandbox((current) => current ? {
          ...current,
          profile: {
            ...current.profile,
            defaultBabyId: babyId,
            updatedAt: now(),
          },
        } : current);
        showToast(
          translate(language, 'toast.child_selected.title'),
          translate(language, 'toast.child_selected.body', { name: selected?.firstName ?? '—' }),
          'success',
        );
        return;
      }

      if (usingLegacyWorkspace) {
        const selected = babies.find((baby) => baby.id === babyId) ?? legacyBaby ?? null;
        showToast(
          translate(language, 'toast.child_selected.title'),
          translate(language, 'toast.child_selected.body', { name: selected?.firstName ?? 'Charlie' }),
          'success',
        );
        return;
      }

      if (!authUser) return;
      setSaving(true);
      try {
        await selectDefaultBaby(authUser.uid, babyId);
        const selected = babies.find((baby) => baby.id === babyId) ?? null;
        setCurrentBabyState(selected);
        setLastSyncedAt(now());
        setSyncStatus('live');
        showToast(
          translate(language, 'toast.child_selected.title'),
          translate(language, 'toast.child_selected.body', { name: selected?.firstName ?? '—' }),
          'success',
        );
      } catch (error) {
        setSyncStatus('error');
        showToast(translate(language, 'toast.action_failed.title'), mapError(error, language), 'error');
      } finally {
        setSaving(false);
      }
    },
    addBaby: async ({ firstName, birthDate, sex, feedingMode: nextFeedingMode, avatarKey, setAsActive }) => {
      if (isSandbox) {
        const timestamp = now();
        const babyId = `sandbox-baby-${timestamp}`;
        const nextBaby: BabyProfile = {
          id: babyId,
          familyId: sandbox?.family.id ?? 'sandbox-family',
          firstName: firstName.trim() || 'Bébé',
          birthDate,
          sex,
          feedingMode: nextFeedingMode,
          avatarKey: avatarKey ?? 'babyAvatar',
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        setSandbox((current) => current ? {
          ...current,
          babies: [...current.babies, nextBaby],
          profile: setAsActive ? {
            ...current.profile,
            defaultBabyId: babyId,
            updatedAt: timestamp,
          } : current.profile,
        } : current);
        showToast(
          translate(language, 'toast.child_added.title'),
          translate(language, 'toast.child_added.body', { name: nextBaby.firstName }),
          'success',
        );
        return;
      }

      if (currentMembership?.role !== 'manager') return;

      if (usingLegacyWorkspace) {
        showLegacyStructureLocked();
        return;
      }

      if (!authUser || !currentFamily) return;
      setSaving(true);
      setSyncStatus('syncing');
      try {
        const babyId = await createBabyProfile({
          familyId: currentFamily.id,
          firstName,
          birthDate,
          sex,
          feedingMode: nextFeedingMode,
          avatarKey,
        });
        if (setAsActive) {
          await selectDefaultBaby(authUser.uid, babyId);
        }
        setLastSyncedAt(now());
        setSyncStatus('live');
        showToast(
          translate(language, 'toast.child_added.title'),
          translate(language, 'toast.child_added.body', { name: firstName.trim() || 'Bébé' }),
          'success',
        );
      } catch (error) {
        setSyncStatus('error');
        showToast(translate(language, 'toast.action_failed.title'), mapError(error, language), 'error');
      } finally {
        setSaving(false);
      }
    },
    updateBabyInfo: async (babyId, updates) => {
      if (isSandbox) {
        setSandbox((current) => current ? {
          ...current,
          babies: current.babies.map((baby) => baby.id === babyId ? {
            ...baby,
            ...(updates.firstName ? { firstName: updates.firstName } : {}),
            ...(updates.birthDate ? { birthDate: updates.birthDate } : {}),
            ...(updates.sex ? { sex: updates.sex } : {}),
            ...(updates.feedingMode ? { feedingMode: updates.feedingMode } : {}),
            updatedAt: now(),
          } : baby),
        } : current);
        showToast(translate(language, 'toast.family_updated.title'), translate(language, 'toast.family_updated.body'), 'success');
        return;
      }

      if (currentMembership?.role !== 'manager') return;
      if (!authUser) return;

      if (usingLegacyWorkspace) {
        setSaving(true);
        let babyPhotoUrl: string | undefined;
        if (updates.photoUri) {
          try {
            babyPhotoUrl = await uploadBabyPhoto(authUser.uid, babyId, updates.photoUri);
          } catch {
            // Storage non disponible en mode legacy, photo ignorée
          }
        }
        const nextOverrides: LegacyWorkspaceOverrides = {
          ...legacyOverrides,
          ...(updates.firstName ? { babyFirstName: updates.firstName } : {}),
          ...(updates.birthDate ? { babyBirthDate: updates.birthDate } : {}),
          ...(updates.sex ? { babySex: updates.sex } : {}),
          ...(updates.feedingMode ? { babyFeedingMode: updates.feedingMode } : {}),
          ...(babyPhotoUrl !== undefined ? { babyPhotoUrl } : {}),
        };
        setLegacyOverrides(nextOverrides);
        if (authUser) {
          void AsyncStorage.setItem(`${LEGACY_OVERRIDES_STORAGE_PREFIX}:${authUser.uid}`, JSON.stringify(nextOverrides)).catch(() => undefined);
        }
        setSaving(false);
        showToast(translate(language, 'toast.family_updated.title'), translate(language, 'toast.family_updated.body'), 'success');
        return;
      }

      try {
        setSaving(true);
        let photoUrl: string | undefined;
        if (updates.photoUri) {
          photoUrl = await uploadBabyPhoto(authUser.uid, babyId, updates.photoUri);
        }
        await updateBabyProfile(babyId, {
          ...(updates.firstName ? { firstName: updates.firstName } : {}),
          ...(updates.birthDate ? { birthDate: updates.birthDate } : {}),
          ...(updates.sex ? { sex: updates.sex } : {}),
          ...(updates.feedingMode ? { feedingMode: updates.feedingMode } : {}),
          ...(photoUrl !== undefined ? { photoUrl } : {}),
        });
        setLastSyncedAt(now());
        setSyncStatus('live');
        showToast(translate(language, 'toast.family_updated.title'), translate(language, 'toast.family_updated.body'), 'success');
      } catch (error) {
        setSyncStatus('error');
        showToast(translate(language, 'toast.action_failed.title'), mapError(error, language), 'error');
      } finally {
        setSaving(false);
      }
    },
    updateUserInfo: async (updates) => {
      if (!authUser) return;
      try {
        setSaving(true);
        let photoUrl: string | undefined;
        if (updates.photoUri) {
          photoUrl = await uploadUserPhoto(authUser.uid, updates.photoUri);
        }
        await updateUserProfile(authUser.uid, {
          ...(updates.displayName !== undefined ? { displayName: updates.displayName } : {}),
          ...(photoUrl !== undefined ? { photoUrl } : {}),
        });
        showToast(translate(language, 'toast.family_updated.title'), translate(language, 'toast.family_updated.body'), 'success');
      } catch (error) {
        showToast(translate(language, 'toast.action_failed.title'), mapError(error, language), 'error');
      } finally {
        setSaving(false);
      }
    },
    updateMyFamilyLabel: async (label) => {
      if (!authUser || !currentFamily) return;

      if (isSandbox) {
        setSandbox((current) => {
          if (!current) return current;
          const updatedMembers = (current.family.members ?? []).map((m) =>
            m.uid === current.profile.id ? { ...m, parentLabel: label.trim() } : m
          );
          return {
            ...current,
            parentLabel: label.trim(),
            family: { ...current.family, members: updatedMembers },
          };
        });
        showToast(translate(language, 'toast.family_updated.title'), translate(language, 'toast.family_updated.body'), 'success');
        return;
      }

      if (usingLegacyWorkspace) {
        const nextOverrides: LegacyWorkspaceOverrides = { ...legacyOverrides, parentLabel: label.trim() };
        setLegacyOverrides(nextOverrides);
        if (authUser) {
          void AsyncStorage.setItem(`${LEGACY_OVERRIDES_STORAGE_PREFIX}:${authUser.uid}`, JSON.stringify(nextOverrides)).catch(() => undefined);
        }
        return;
      }

      try {
        // Update the parentLabel in the members array of the family document
        await updateFamilyMemberLabel(currentFamily.id, authUser.uid, label.trim(), familyState?.members ?? []);
      } catch (error) {
        showToast(translate(language, 'toast.action_failed.title'), mapError(error, language), 'error');
      }
    },
    joinFamily: async (code, parentLabel) => {
      if (!authUser || !profile) return;
      setSaving(true);
      try {
        // Detect code type to use the right join function
        const { validateInviteCode } = await import('@/src/services/productRepository');
        const codeInfo = await validateInviteCode(code);
        if (!codeInfo) {
          showToast(
            translate(language, 'toast.action_failed.title'),
            language === 'fr' ? 'Code famille introuvable' : 'Family code not found',
            'error',
          );
          return;
        }

        const joinParams = { code, userId: authUser.uid, displayName: profile.displayName, parentLabel };
        const familyId = codeInfo.type === 'viewer'
          ? await joinFamilyAsViewer(joinParams)
          : await joinFamilyAsManager(joinParams);

        if (!familyId) {
          showToast(
            translate(language, 'toast.action_failed.title'),
            language === 'fr' ? 'Code famille introuvable' : 'Family code not found',
            'error',
          );
        } else {
          showToast(
            translate(language, 'toast.family_updated.title'),
            language === 'fr' ? 'Famille rejointe !' : 'Family joined!',
            'success',
          );
        }
      } catch (error) {
        showToast(translate(language, 'toast.action_failed.title'), mapError(error, language), 'error');
      } finally {
        setSaving(false);
      }
    },
    removeFamilyMember: async (memberUid) => {
      if (isSandbox || usingLegacyWorkspace) return;
      if (!currentMembership || !canRemoveMember(currentMembership.role)) return;
      if (!currentFamily) return;
      await runMutation(async () => {
        await removeFromFamily(currentFamily.id, memberUid);
        showToast(
          translate(language, 'toast.family_updated.title'),
          language === 'fr' ? 'Membre retiré de la famille' : 'Member removed from family',
          'success',
        );
      });
    },
    updateMemberRole: async (memberUid, role) => {
      if (isSandbox || usingLegacyWorkspace) return;
      if (currentMembership?.role !== 'manager') return;
      if (!currentFamily) return;
      await runMutation(async () => {
        if (role === 'manager') {
          await promoteViewerToManager(currentFamily.id, memberUid);
        } else {
          // Demote manager to viewer
          const familySnap = familyState;
          if (!familySnap) return;
          const { updateDoc, doc: fbDoc, arrayUnion, arrayRemove } = await import('firebase/firestore');
          const { firestore: _db } = await import('@/src/lib/firebase');
          if (!_db) return;
          const updatedMembers = (familySnap.members ?? []).map((m) =>
            m.uid === memberUid ? { ...m, role: 'viewer' as MembershipRole } : m
          );
          await updateDoc(fbDoc(_db, 'families', currentFamily.id), {
            managerIds: arrayRemove(memberUid),
            viewerIds: arrayUnion(memberUid),
            members: updatedMembers,
            updatedAt: now(),
          });
        }
        showToast(translate(language, 'toast.family_updated.title'), translate(language, 'toast.family_updated.body'), 'success');
      });
    },
    updateBabyAvatar: async (babyId, avatarKey) => {
      if (isSandbox) {
        setSandbox((current) => current ? {
          ...current,
          babies: current.babies.map((baby) => baby.id === babyId ? { ...baby, avatarKey, updatedAt: now() } : baby),
        } : current);
        showToast(translate(language, 'toast.family_updated.title'), translate(language, 'toast.family_updated.body'), 'success');
        return;
      }

      if (usingLegacyWorkspace) {
        const nextOverrides = { ...legacyOverrides, babyAvatarKey: avatarKey };
        setLegacyOverrides(nextOverrides);
        if (authUser) {
          void AsyncStorage.setItem(`${LEGACY_OVERRIDES_STORAGE_PREFIX}:${authUser.uid}`, JSON.stringify(nextOverrides)).catch(() => undefined);
        }
        showToast(translate(language, 'toast.family_updated.title'), translate(language, 'toast.family_updated.body'), 'success');
        return;
      }

      if (currentMembership?.role !== 'manager') return;

      try {
        await updateBabyProfile(babyId, { avatarKey });
        setLastSyncedAt(now());
        setSyncStatus('live');
        showToast(translate(language, 'toast.family_updated.title'), translate(language, 'toast.family_updated.body'), 'success');
      } catch (error) {
        setSyncStatus('error');
        showToast(translate(language, 'toast.action_failed.title'), mapError(error, language), 'error');
      }
    },
    updateEvent: async (eventId, updates) => {
      if (currentMembership && authUser) {
        const event = events.find((e) => e.id === eventId);
        if (!event || !canEditEvent({ ...currentMembership, userId: authUser.uid }, event)) {
          showToast(translate(language, 'toast.action_failed.title'), translate(language, 'error.read_only_role'), 'error');
          return;
        }
      }

      if (isSandbox) {
        updateSandboxEvent(eventId, (event) => ({
          ...event,
          ...updates,
          details: updates.details ? { ...event.details, ...updates.details } : event.details,
          notes: Object.prototype.hasOwnProperty.call(updates, 'notes') ? updates.notes : event.notes,
          updatedAt: now(),
        }));
        showToast(translate(language, 'toast.event_updated.title'), translate(language, 'toast.event_updated.body'), 'success');
        return;
      }

      if (usingLegacyWorkspace) {
        await runMutation(async () => {
          await updateLegacyTrackedEvent(eventId, updates);
          showToast(translate(language, 'toast.event_updated.title'), translate(language, 'toast.event_updated.body'), 'success');
        });
        return;
      }

      await runMutation(async () => {
        // Forward the baby id so updateTrackedEvent can also keep the
        // activeSessions doc in sync when this event is the live sleep
        // session — without that, editing the start time from history
        // didn't update the "Charlie dort depuis…" counter on Today.
        await updateTrackedEvent(eventId, updates, currentBaby?.id);
        showToast(translate(language, 'toast.event_updated.title'), translate(language, 'toast.event_updated.body'), 'success');
      });
    },
    deleteEvent: async (eventId) => {
      // Capture full snapshot BEFORE deletion so we can offer an Undo path
      const eventSnapshot = events.find((e) => e.id === eventId) ?? null;

      if (currentMembership && authUser) {
        if (!eventSnapshot || !canEditEvent({ ...currentMembership, userId: authUser.uid }, eventSnapshot)) {
          showToast(translate(language, 'toast.action_failed.title'), translate(language, 'error.read_only_role'), 'error');
          return;
        }
      }

      if (isSandbox) {
        deleteSandboxEventById(eventId);
        showToast(
          translate(language, 'toast.event_deleted.title'),
          translate(language, 'toast.event_deleted.body'),
          'success',
          eventSnapshot
            ? {
                duration: 5000,
                action: {
                  label: language === 'fr' ? 'Annuler' : 'Undo',
                  onPress: () => {
                    appendSandboxEvent(eventSnapshot);
                  },
                },
              }
            : undefined,
        );
        return;
      }

      if (usingLegacyWorkspace) {
        await runMutation(async () => {
          await deleteLegacyTrackedEvent(eventId);
          showToast(translate(language, 'toast.event_deleted.title'), translate(language, 'toast.event_deleted.body'), 'success');
        });
        return;
      }

      await runMutation(async () => {
        await deleteTrackedEvent(eventId, currentBaby?.id);
        showToast(
          translate(language, 'toast.event_deleted.title'),
          translate(language, 'toast.event_deleted.body'),
          'success',
          eventSnapshot
            ? {
                duration: 5000,
                action: {
                  label: language === 'fr' ? 'Annuler' : 'Undo',
                  onPress: () => {
                    void restoreTrackedEvent(eventSnapshot).catch(() => {
                      showToast(
                        translate(language, 'toast.action_failed.title'),
                        language === 'fr' ? "Impossible d'annuler" : 'Could not undo',
                        'error',
                      );
                    });
                  },
                },
              }
            : undefined,
        );
      });
    },
    createManualEvent: async (input) => {
      if (currentMembership && !canRecordEvents(currentMembership)) {
        showToast(
          language === 'fr' ? 'Accès lecture seule' : 'Read-only access',
          language === 'fr' ? 'Demandez au responsable de vous accorder l\'accès.' : 'Ask the family manager to grant you access.',
          'error',
        );
        return;
      }
      const scope = liveScope();
      if (!scope) {
        showToast(
          translate(language, 'toast.action_failed.title'),
          language === 'fr' ? 'Famille non chargée.' : 'Family not loaded.',
          'error',
        );
        return;
      }
      // Show the event right away so the user gets immediate feedback,
      // even when the Firestore listener is slow to fire.
      pushOptimistic(
        input.type,
        'details' in input ? input.details : {},
        input.notes,
        input.type === 'sleep' ? input.endTime : null,
        input.startTime,
      );
      await runMutation(async () => {
        switch (input.type) {
          case 'feed':
            await addFeedEvent(scope, input.details, input.notes, input.startTime);
            break;
          case 'diaper':
            await addDiaperEvent(scope, input.details, input.notes, input.startTime);
            break;
          case 'medication':
            await addMedicationEvent(scope, input.details, input.notes, input.startTime);
            break;
          case 'temperature':
            await addTemperatureEvent(scope, input.details, input.notes, input.startTime);
            break;
          case 'growth':
            await addGrowthEvent(scope, input.details, input.notes, input.startTime);
            break;
          case 'sleep':
            await addPastSleepEvent(scope, input.startTime, input.endTime, input.notes);
            break;
          case 'pumping':
            await addPumpingEvent(scope, input.details, input.notes, input.startTime);
            break;
        }
        showToast(
          language === 'fr' ? 'Événement ajouté' : 'Event added',
          language === 'fr' ? 'Il apparaît dans le fil de la journée.' : 'It now appears in the timeline.',
          'success',
        );
      });
    },
    loadFullHistory,
    fullHistoryLoaded:
      isSandbox || usingLegacyWorkspace
        ? true
        : currentBabyState !== null && fullHistoryLoadedFor === currentBabyState.id,
    fullHistoryLoading,
    updateFamilyDetails: async ({ name, visitTypes, careTypes }) => {
      if (isSandbox) {
        setSandbox((current) => current ? {
          ...current,
          family: {
            ...current.family,
            name: name?.trim() || current.family.name,
            visitTypes: visitTypes ?? current.family.visitTypes,
            careTypes: careTypes ?? current.family.careTypes,
            updatedAt: now(),
          },
        } : current);
        showToast(translate(language, 'toast.family_updated.title'), translate(language, 'toast.family_updated.body'), 'success');
        return;
      }

      if (usingLegacyWorkspace) {
        const nextOverrides = {
          ...legacyOverrides,
          familyName: name?.trim() || legacyOverrides.familyName || currentFamily?.name || 'Charlie',
          visitTypes: visitTypes ?? legacyOverrides.visitTypes ?? currentFamily?.visitTypes ?? [],
        };
        setLegacyOverrides(nextOverrides);
        if (authUser) {
          void AsyncStorage.setItem(`${LEGACY_OVERRIDES_STORAGE_PREFIX}:${authUser.uid}`, JSON.stringify(nextOverrides)).catch(() => undefined);
        }
        showToast(translate(language, 'toast.family_updated.title'), translate(language, 'toast.family_updated.body'), 'success');
        return;
      }

      if (currentMembership?.role !== 'manager') return;

      if (!currentFamily) {
        showToast(translate(language, 'toast.action_failed.title'), translate(language, 'error.unexpected'), 'error');
        return;
      }
      setSaving(true);
      setSyncStatus('syncing');
      try {
        await updateFamilyProfile(currentFamily.id, { name, visitTypes, careTypes });
        setLastSyncedAt(now());
        setSyncStatus('live');
        showToast(translate(language, 'toast.family_updated.title'), translate(language, 'toast.family_updated.body'), 'success');
      } catch (error) {
        setSyncStatus('error');
        showToast(translate(language, 'toast.action_failed.title'), mapError(error, language), 'error');
      } finally {
        setSaving(false);
      }
    },
    setLanguagePreference: async (nextLanguage) => {
      setLanguageState(nextLanguage);
      void AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage).catch(() => undefined);

      if (isSandbox) {
        setSandbox((current) => current ? { ...current, profile: { ...current.profile, language: nextLanguage, updatedAt: now() } } : current);
        showToast(translate(nextLanguage, 'toast.language_updated.title'), translate(nextLanguage, 'toast.language_updated.body'), 'success');
        return;
      }

      if (authUser) {
        try {
          await updateUserLanguage(authUser.uid, nextLanguage);
          setLastSyncedAt(now());
          setSyncStatus('live');
          showToast(translate(nextLanguage, 'toast.language_updated.title'), translate(nextLanguage, 'toast.language_updated.body'), 'success');
        } catch (error) {
          setSyncStatus('error');
          showToast(translate(language, 'toast.action_failed.title'), mapError(error, language), 'error');
        }
      }
    },
    setFeedingModePreference: async (nextMode) => {
      if (isSandbox) {
        setSandbox((current) => {
          if (!current || !sandboxCurrentBaby) return current;
          return {
            ...current,
            babies: current.babies.map((baby) => baby.id === sandboxCurrentBaby.id ? { ...baby, feedingMode: nextMode, updatedAt: now() } : baby),
          };
        });
        showToast(translate(language, 'toast.feeding_updated.title'), translate(language, 'toast.feeding_updated.body'), 'success');
        return;
      }

      if (usingLegacyWorkspace) {
        showLegacyStructureLocked();
        return;
      }

      if (currentMembership?.role !== 'manager') return;

      if (!currentBaby) return;
      try {
        await updateBabyFeedingMode(currentBaby.id, nextMode);
        setLastSyncedAt(now());
        setSyncStatus('live');
        showToast(translate(language, 'toast.feeding_updated.title'), translate(language, 'toast.feeding_updated.body'), 'success');
      } catch (error) {
        setSyncStatus('error');
        showToast(translate(language, 'toast.action_failed.title'), mapError(error, language), 'error');
      }
    },
    dismissToast: () => setToast(null),
    refreshData,
    requestNotificationAccess: async () => {
      const result = await requestNotificationsPermission();
      setNotificationsGranted(result.granted);
      showToast(
        translate(language, result.granted ? 'toast.notifications_on.title' : 'toast.notifications_off.title'),
        translate(language, result.granted ? 'toast.notifications_on.body' : 'toast.notifications_off.later'),
        result.granted ? 'success' : 'error'
      );
    },
    logout: async () => {
      if (isSandbox) {
        setSandbox(null);
        showToast(translate(language, 'toast.sandbox_closed.title'), translate(language, 'toast.sandbox_logout.body'), 'success');
        return;
      }
      if (authUser) {
        void AsyncStorage.removeItem(`${LEGACY_OVERRIDES_STORAGE_PREFIX}:${authUser.uid}`).catch(() => undefined);
      }
      await signOut();
      showToast(translate(language, 'toast.logout.title'), translate(language, 'toast.logout.body'), 'success');
    },
    deleteAccount: async (password: string) => {
      if (isSandbox) {
        setSandbox(null);
        return;
      }
      if (!authUser) throw new Error('Aucun utilisateur connecté');
      try {
        setSaving(true);
        if (authUser) {
          void AsyncStorage.removeItem(`${LEGACY_OVERRIDES_STORAGE_PREFIX}:${authUser.uid}`).catch(() => undefined);
        }
        await deleteAccountRepo({ password });
        showToast(
          language === 'fr' ? 'Compte supprimé' : 'Account deleted',
          language === 'fr' ? 'Toutes vos données ont été effacées.' : 'All your data has been erased.',
          'success',
        );
      } catch (error) {
        showToast(translate(language, 'toast.action_failed.title'), mapError(error, language), 'error');
        throw error;
      } finally {
        setSaving(false);
      }
    },
    debugSetSyncStatus: canUseDevTools
      ? (status: SyncStatus) => {
          setDebugSyncOverride(status);
        }
      : undefined,
    enterSandbox: () => {
      if (!canUseDevTools) return;
      setSandbox(createSandboxState(language));
      showToast(translate(language, 'toast.sandbox_entered.title'), translate(language, 'toast.sandbox_entered.body'), 'success');
    },
    exitSandbox: () => {
      setSandbox(null);
      showToast(translate(language, 'toast.sandbox_closed.title'), translate(language, 'toast.sandbox_closed.body'), 'success');
    },
  }), [
    activeSession,
    authReady,
    authUser,
    babies,
    currentBaby,
    currentFamily,
    currentMembership,
    debugSyncOverride,
    isNetworkOffline,
    events,
    effectiveWorkspaceLoading,
    familyMembersResolved,
    familyState,
    feedingMode,
    initialSyncDone,
    isSandbox,
    language,
    languageState,
    lastSyncedAt,
    legacyBaby,
    legacyWorkspace,
    memberships,
    needsOnboarding,
    notificationsGranted,
    profile,
    refreshData,
    sandbox,
    saving,
    usingLegacyWorkspace,
    syncStatus,
    toast,
  ]);

  return (
    <AppContext.Provider value={value}>
      {children}
      {saving ? (
        <View style={styles.savingOverlay} pointerEvents="none">
          <ActivityIndicator size="small" color={theme.primary} />
        </View>
      ) : null}
      {toast ? (
        <Pressable style={styles.toastWrap} onPress={() => setToast(null)}>
          {(() => {
            const isError = toast.kind === 'error';
            const tint = isError ? theme.danger : theme.success;
            const icon = isError ? 'alert-circle' : 'checkmark-circle';
            // Carnet d'aquarelle: solid white paper card with a coloured
            // accent stripe on the left — same idiom as timeline cards.
            // The previous tint-wash background was illegible whenever
            // it landed on top of existing text.
            return (
          <View
            style={[
              styles.toast,
              {
                backgroundColor: theme.surfaceLowest,
                borderColor: `${tint}55`,
                shadowColor: theme.shadow,
              },
            ]}
          >
            <View style={[styles.toastMarker, { backgroundColor: tint }]} />
            <View style={styles.toastContent}>
              <View style={[styles.toastIcon, { backgroundColor: `${tint}18` }]}>
                <Icon name={icon} size={18} color={tint} />
              </View>
              <View style={styles.toastTextBlock}>
                <Text style={[styles.toastTitle, { color: theme.text, fontFamily: theme.fontBold }]}>{toast.title}</Text>
                {toast.message ? (
                  <Text style={[styles.toastMessage, { color: theme.textMuted, fontFamily: theme.fontRegular }]}>
                    {toast.message}
                  </Text>
                ) : null}
              </View>
              {toast.action ? (
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    toast.action?.onPress();
                    setToast((current) => (current?.id === toast.id ? null : current));
                  }}
                  style={({ pressed }) => [
                    styles.toastAction,
                    { backgroundColor: `${tint}1F`, opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <Text style={[styles.toastActionLabel, { color: tint, fontFamily: theme.fontSemiBold }]}>
                    {toast.action.label}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>
            );
          })()}
        </Pressable>
      ) : null}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppProvider');
  }
  return context;
}

function LoaderDot({ delay, color }: { delay: number; color: string }) {
  const value = useRef(new Animated.Value(0.25)).current;
  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(value, { toValue: 1, duration: 450, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
        Animated.timing(value, { toValue: 0.25, duration: 450, useNativeDriver: true, easing: Easing.in(Easing.quad) }),
        Animated.delay(450),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [delay, value]);
  return (
    <Animated.View
      style={[
        styles.loaderDot,
        { backgroundColor: color, opacity: value, transform: [{ scale: value }] },
      ]}
    />
  );
}

/**
 * The animated "Charlie." wordmark + label + bouncing dots. Used both
 * by the full-screen boot loader (FullScreenLoader) and by the in-shell
 * sync loader (BodyLoader) — extracted so the visual identity stays in
 * one place.
 */
function LoaderContent({ label }: { label: string }) {
  const { theme } = useAppTheme();
  const breath = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(breath, { toValue: 1, duration: 1100, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
        Animated.timing(breath, { toValue: 0.5, duration: 1100, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
      ]),
    ).start();
  }, [breath]);

  return (
    <View style={styles.loaderScreen}>
      <Animated.Text
        style={[
          styles.loaderBrand,
          {
            color: theme.primary,
            fontFamily: theme.fontDisplayItalic,
            opacity: breath,
          },
        ]}
      >
        Charlie.
      </Animated.Text>
      <Text style={[styles.loaderLabel, { color: theme.textSoft, fontFamily: theme.fontMedium }]}>{label}</Text>
      <View style={styles.loaderDotsRow}>
        <LoaderDot delay={0} color={theme.primary} />
        <LoaderDot delay={180} color={theme.primary} />
        <LoaderDot delay={360} color={theme.primary} />
      </View>
    </View>
  );
}

/**
 * Full-viewport loader used during the early boot phase — before auth
 * is ready and before we know which baby's hero banner to render.
 * Covers the cream background edge-to-edge so the iOS status-bar /
 * notch area doesn't show a different shade.
 */
export function FullScreenLoader({ label }: { label: string }) {
  const { theme } = useAppTheme();
  return (
    <SafeAreaView style={[styles.loaderSafe, { backgroundColor: theme.background }]} edges={['top', 'bottom', 'left', 'right']}>
      <LoaderContent label={label} />
    </SafeAreaView>
  );
}

/**
 * Body-only loader used during the initial Firestore sync, AFTER the
 * SPA shell + hero banner are ready to render. Caller wraps this in
 * the usual Screen / EditorialTopBar so the parent still sees who they
 * are while data hydrates underneath.
 */
export function BodyLoader({ label }: { label: string }) {
  return <LoaderContent label={label} />;
}

const styles = StyleSheet.create({
  loaderSafe: {
    flex: 1,
  },
  loaderScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  loaderBrand: {
    fontSize: 56,
    lineHeight: 60,
    letterSpacing: -1.4,
  },
  loaderLabel: {
    fontSize: 12,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    opacity: 0.85,
  },
  loaderDotsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: spacing.md,
  },
  loaderDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  savingOverlay: {
    position: 'absolute',
    top: 60,
    right: spacing.md,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    zIndex: 999,
  },
  toastWrap: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: 110,
  },
  toast: {
    position: 'relative',
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingVertical: spacing.md,
    paddingLeft: spacing.lg,
    paddingRight: spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
  },
  toastMarker: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 5,
    borderTopLeftRadius: radii.lg,
    borderBottomLeftRadius: radii.lg,
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  toastIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  toastTextBlock: {
    flex: 1,
  },
  toastTitle: {
    fontSize: 15,
  },
  toastMessage: {
    marginTop: spacing.xs,
    lineHeight: 20,
  },
  toastAction: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 7,
    borderRadius: radii.pill,
    alignSelf: 'center',
    marginLeft: spacing.sm,
  },
  toastActionLabel: {
    fontSize: 13,
    letterSpacing: 0.1,
  },
});
