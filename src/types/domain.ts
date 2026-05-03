/** manager = accès complet (parents) | viewer = lecture seule (famille élargie) */
export type MembershipRole = 'manager' | 'viewer';
export type BabySex = 'boy' | 'girl';
export type TrackedEventType = 'sleep' | 'feed' | 'diaper' | 'medication' | 'growth' | 'temperature';
export type AppLanguage = 'fr' | 'en';
export type FeedingMode = 'breastfeeding' | 'bottle' | 'mixed';
export type BabyAvatarKey = 'babyAvatar' | 'trackerBaby' | 'growthBaby' | 'childOne' | 'childTwo';
export type FeedSide = 'left' | 'right' | 'bottle';
export type DiaperType = 'wet' | 'dirty' | 'both';
export type CareCategory = 'care' | 'visit';
export type StoolColor =
  | 'jaune_pale'
  | 'beige'
  | 'blanc_mastic'
  | 'jaune_or'
  | 'ocre_bronze'
  | 'vert'
  | 'marron'
  | 'noir'
  | 'blanc'
  | 'rouge';
export type TemperaturePeriod = 'morning' | 'evening';
/** Combinaison de parents sur un seul compte famille */
export type ParentsCombination = 'papa_maman' | 'papa_papa' | 'maman_maman' | 'papa' | 'maman';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  photoUrl?: string | null;
  /** Bébé actif — utile si la famille a plusieurs enfants */
  defaultBabyId?: string | null;
  /** Famille unique de l'utilisateur */
  familyId: string | null;
  language: AppLanguage;
  createdAt: number;
  updatedAt: number;
}

export interface Family {
  id: string;
  name: string;
  ownerUserId: string;
  /** @deprecated utiliser managerCode à la place */
  inviteCode?: string;
  /** Code de partage manager/parent */
  managerCode?: string;
  /** Code de partage lecture seule */
  viewerCode?: string;
  /** Combinaison de parents sur ce compte (Papa & Maman / Papa seul / etc.) */
  parentsCombination?: ParentsCombination;
  /** @deprecated legacy — plus lu, gardé pour ne pas casser les anciens docs */
  managerIds?: string[];
  /** @deprecated legacy — plus lu */
  viewerIds?: string[];
  /** @deprecated legacy — plus lu */
  members?: FamilyMember[];
  parentNames: string[];
  visitTypes: string[];
  careTypes: string[];
  premiumStatus: 'free' | 'premium';
  createdAt: number;
  updatedAt: number;
}

/** Membre de la famille (dénormalisé dans le document Family) */
export interface FamilyMember {
  uid: string;
  displayName: string;
  parentLabel?: string | null;
  role: MembershipRole;
}

export interface BabyProfile {
  id: string;
  familyId: string;
  firstName: string;
  birthDate: string;
  sex: BabySex;
  feedingMode: FeedingMode;
  avatarKey?: BabyAvatarKey;
  photoUrl?: string | null;
  createdAt: number;
  updatedAt: number;
}

/** @deprecated Utiliser FamilyMember à la place — plus de collection memberships */
export interface FamilyMembership {
  id: string;
  familyId: string;
  userId: string;
  role: MembershipRole;
  displayName: string;
  /** Libellé libre choisi par le membre ("Papa", "Maman", "Grand-mère"…) */
  parentLabel?: string | null;
  status: 'active' | 'invited';
  createdAt: number;
  updatedAt: number;
}

export interface EventDetails {
  feedSide?: FeedSide;
  feedAmountMl?: number;
  /** ml de biberon donné en complément d'un allaitement (allaitement hybride) */
  bottleSupplement?: number;
  diaperType?: DiaperType;
  stoolColor?: StoolColor;
  medicationName?: string;
  careCategory?: CareCategory;
  temperature?: number;
  temperaturePeriod?: TemperaturePeriod;
  weight?: number;
  height?: number;
  head?: number;
}

export interface TrackedEvent {
  id: string;
  familyId: string;
  babyId: string;
  type: TrackedEventType;
  startTime: number;
  endTime: number | null;
  notes?: string;
  details?: EventDetails;
  createdByUserId: string;
  createdByRole: MembershipRole;
  /** Libellé dénormalisé de la personne qui a enregistré ("Papa", "Maman"…) */
  createdByLabel?: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface ActiveSession {
  id: string;
  familyId: string;
  babyId: string;
  eventId: string;
  type: 'sleep';
  startTime: number;
  details?: EventDetails;
  createdByUserId: string;
  createdByRole: MembershipRole;
  updatedAt: number;
}

export interface ProductContext {
  family: Family;
  baby: BabyProfile;
  member: FamilyMember;
  profile: UserProfile;
}

export interface InitialSetupInput {
  familyName: string;
  babyName: string;
  birthDate: string;
  sex: BabySex;
  feedingMode: FeedingMode;
  ownerDisplayName: string;
  partnerDisplayName?: string;
  language?: AppLanguage;
}
