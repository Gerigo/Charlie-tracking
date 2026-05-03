import type { AppLanguage, Family, TrackedEvent } from '@/src/types/domain';

export const BUILT_IN_VISIT_KEYS = ['midwife', 'pediatrician', 'one'] as const;
export const BUILT_IN_CARE_KEYS = ['vitamin_d', 'bath', 'medication'] as const;

/**
 * Default care types seeded into a family the first time the Care Types editor
 * is opened. They become regular family.careTypes entries that the user can
 * edit or remove.
 */
export function getDefaultCareTypes(language: AppLanguage): string[] {
  if (language === 'en') return ['Bath', 'Shower', 'Vitamin D'];
  return ['Bain', 'Douche', 'Vitamine D'];
}

export function normalizeVisitTypes(values: string[] | undefined | null) {
  return (values ?? [])
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value, index, list) => list.findIndex((item) => item.toLowerCase() === value.toLowerCase()) === index);
}

export function normalizeCareTypes(values: string[] | undefined | null) {
  return (values ?? [])
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value, index, list) => list.findIndex((item) => item.toLowerCase() === value.toLowerCase()) === index);
}

export function inferMedicationCategory(value?: string, explicitCategory?: 'care' | 'visit') {
  if (explicitCategory === 'care' || explicitCategory === 'visit') return explicitCategory;
  if (!value) return 'care' as const;
  if ((BUILT_IN_VISIT_KEYS as readonly string[]).includes(value)) return 'visit' as const;
  return 'care' as const;
}

export function isVisitEvent(event: TrackedEvent) {
  return event.type === 'medication' && inferMedicationCategory(event.details?.medicationName, event.details?.careCategory) === 'visit';
}

export function isCareEvent(event: TrackedEvent) {
  return event.type === 'medication' && inferMedicationCategory(event.details?.medicationName, event.details?.careCategory) === 'care';
}

export function getVisitOptions(family: Family | null) {
  return [...BUILT_IN_VISIT_KEYS, ...normalizeVisitTypes(family?.visitTypes)];
}

export function getCareOptions(family: Family | null): string[] {
  // Returns family.careTypes (seeded with defaults from Settings).
  return normalizeCareTypes(family?.careTypes);
}

/**
 * Returns the user's care types, falling back to language-specific defaults
 * when the family hasn't seeded any yet. Useful for displaying chips before
 * the user has visited the Care Types editor.
 */
export function getCareOptionsWithDefaults(family: Family | null, language: AppLanguage): string[] {
  const list = normalizeCareTypes(family?.careTypes);
  return list.length > 0 ? list : getDefaultCareTypes(language);
}
