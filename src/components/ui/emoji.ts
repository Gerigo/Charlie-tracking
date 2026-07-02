// Single source of truth for emojis used across the app.
// Coherent per domain: a bottle for feeding, a thermometer for temp…

export const EVENT_EMOJI = {
  sleep: "😴",
  sleepActive: "🌙",
  feed: "🍼",
  pump: "🥛",
  diaper: "🧷",
  care: "🧴",
  temp: "🌡️",
  meal: "🥄",
} as const;

export const NAV_EMOJI = {
  tracker: "🏠",
  today: "📅",
  food: "🥕",
  growth: "📈",
  evolution: "📊",
} as const;

export type EventEmojiKey = keyof typeof EVENT_EMOJI;
export type NavEmojiKey = keyof typeof NAV_EMOJI;
