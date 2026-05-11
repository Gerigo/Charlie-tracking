import type { ActivityIconKind } from '@/src/components/editorial/ActivityIcon';

const ACTIVITY_EMOJIS: Record<ActivityIconKind, string> = {
  sleep: '😴',
  breast: '🤱',
  bottle: '🍼',
  feed: '🍼',
  pumping: '💧',
  diaper: '🧷',
  care: '🩺',
  visit: '🗓️',
  temperature: '🌡️',
  growth: '📈',
  awake: '🌞',
  evolution: '📊',
  data: '🗂️',
};

export function getActivityEmoji(kind: ActivityIconKind) {
  return ACTIVITY_EMOJIS[kind] ?? '✨';
}
