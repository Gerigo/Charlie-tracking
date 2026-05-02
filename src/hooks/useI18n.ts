import { feedingModeLabelKey, translate, type TranslationKey } from '@/src/constants/i18n';
import { useAppContext } from '@/src/providers/AppProvider';
import type { FeedingMode } from '@/src/types/domain';

export function useI18n() {
  const { language } = useAppContext();

  return {
    language,
    t: (key: TranslationKey, params?: Record<string, string | number | null | undefined>) => translate(language, key, params),
    feedingModeLabel: (mode: FeedingMode) => translate(language, feedingModeLabelKey(mode)),
  };
}
