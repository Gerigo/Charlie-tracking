import { differenceInDays, endOfDay, format, isSameDay, parseISO, startOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { AppLanguage } from '@/src/types/domain';

export function formatClock(timestamp: number) {
  return format(timestamp, 'HH:mm');
}

export function formatDay(timestamp: number) {
  return format(timestamp, 'dd MMM', { locale: fr });
}

export function formatDateTime(timestamp: number) {
  return format(timestamp, 'dd/MM/yyyy HH:mm');
}

export function formatLongDate(timestamp: number) {
  return format(timestamp, 'EEEE d MMMM', { locale: fr });
}

export function getAgeLabel(birthDateIso: string) {
  const birthDate = parseISO(birthDateIso);
  const days = differenceInDays(new Date(), birthDate);
  if (days < 7) return `${days} j`;
  const weeks = Math.floor(days / 7);
  const remainingDays = days % 7;
  if (weeks < 8) {
    return remainingDays > 0 ? `${weeks} sem ${remainingDays} j` : `${weeks} sem`;
  }
  const months = Math.floor(days / 30.4);
  return `${months} mois`;
}

export function formatDuration(startTime: number, endTime: number) {
  const minutes = Math.max(0, Math.round((endTime - startTime) / 60000));
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours > 0) return `${hours}h ${remainder}m`;
  return `${minutes}m`;
}

export function formatRelativeShort(timestamp: number, language: AppLanguage, referenceTime = Date.now()) {
  const diffMinutes = Math.max(0, Math.round((referenceTime - timestamp) / 60000));

  if (diffMinutes < 1) {
    return language === 'fr' ? "À l'instant" : 'Just now';
  }

  if (diffMinutes < 60) {
    return language === 'fr' ? `Il y a ${diffMinutes}m` : `${diffMinutes}m ago`;
  }

  const hours = Math.floor(diffMinutes / 60);
  if (hours < 24) {
    return language === 'fr' ? `Il y a ${hours}h` : `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  return language === 'fr' ? `Il y a ${days}j` : `${days}d ago`;
}

export function getTodayRange() {
  const now = new Date();
  return {
    start: startOfDay(now).getTime(),
    end: endOfDay(now).getTime(),
  };
}

export function isToday(timestamp: number) {
  return isSameDay(timestamp, Date.now());
}

export function isYesterday(timestamp: number) {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return isSameDay(timestamp, yesterday);
}

export function clampPercentage(value: number) {
  return Math.max(0, Math.min(100, value));
}
