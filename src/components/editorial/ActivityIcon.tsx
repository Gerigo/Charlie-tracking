import Ionicons from '@expo/vector-icons/Ionicons';
import { Text } from 'react-native';
import type { FeedSide, FeedingMode } from '@/src/types/domain';
import { getActivityEmoji } from '@/src/constants/activityEmojis';

export type ActivityIconKind =
  | 'sleep'
  | 'breast'
  | 'bottle'
  | 'feed'
  | 'diaper'
  | 'care'
  | 'visit'
  | 'temperature'
  | 'growth'
  | 'awake'
  | 'evolution'
  | 'data';

export function resolveFeedIconKind(feedSide?: FeedSide, feedingMode?: FeedingMode): 'breast' | 'bottle' {
  if (feedSide === 'bottle' || feedingMode === 'bottle') return 'bottle';
  return 'breast';
}

export function ActivityIcon({ kind, size, color }: { kind: ActivityIconKind; size: number; color: string }) {
  switch (kind) {
    case 'sleep':
    case 'breast':
    case 'bottle':
    case 'feed':
    case 'diaper':
    case 'care':
    case 'visit':
    case 'temperature':
    case 'growth':
    case 'awake':
    case 'evolution':
    case 'data':
      return <Text style={{ fontSize: size, lineHeight: size * 1.3, textAlign: 'center', textAlignVertical: 'center' }}>{getActivityEmoji(kind)}</Text>;
    default:
      return <Ionicons name="sparkles-outline" size={size} color={color} />;
  }
}
