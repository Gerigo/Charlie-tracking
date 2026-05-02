import type { Family, TrackedEvent } from '@/src/types/domain';

export const BUILT_IN_VISIT_KEYS = ['midwife', 'pediatrician', 'one'] as const;
export const BUILT_IN_CARE_KEYS = ['vitamin_d', 'bath', 'medication'] as const;

export function normalizeVisitTypes(values: string[] | undefined | null) {
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
