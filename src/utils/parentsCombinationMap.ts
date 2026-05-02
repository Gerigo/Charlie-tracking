import type { AppLanguage, ParentsCombination } from '@/src/types/domain';

/** Pour chaque combinaison, la liste des libellés parentNames qui seront écrits
 *  dans le document Family. Utilisé pour auto-populer parentNames à chaque changement. */
export function comboToParentNames(combo: ParentsCombination): string[] {
  switch (combo) {
    case 'papa_maman':
      return ['Papa', 'Maman'];
    case 'papa_papa':
      return ['Papa', 'Papa'];
    case 'maman_maman':
      return ['Maman', 'Maman'];
    case 'papa':
      return ['Papa'];
    case 'maman':
      return ['Maman'];
  }
}

/** Libellé court affiché dans l'UI pour représenter la combinaison. */
export function comboLabel(combo: ParentsCombination, lang: AppLanguage): string {
  if (lang === 'en') {
    switch (combo) {
      case 'papa_maman':
        return 'Dad & Mom';
      case 'papa_papa':
        return 'Dad & Dad';
      case 'maman_maman':
        return 'Mom & Mom';
      case 'papa':
        return 'Dad';
      case 'maman':
        return 'Mom';
    }
  }
  switch (combo) {
    case 'papa_maman':
      return 'Papa & Maman';
    case 'papa_papa':
      return 'Papa & Papa';
    case 'maman_maman':
      return 'Maman & Maman';
    case 'papa':
      return 'Papa';
    case 'maman':
      return 'Maman';
  }
}

/** Ordre canonique des options dans les pickers (onboarding + settings). */
export const PARENTS_COMBINATION_OPTIONS: ParentsCombination[] = [
  'papa_maman',
  'papa_papa',
  'maman_maman',
  'papa',
  'maman',
];
