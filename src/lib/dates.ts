export const BIRTH = new Date(2026, 2, 3); // Charlie — 3 mars 2026

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}
export function fmtTime(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
export function fmtDur(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h${pad2(m)}`;
}
const DAYS = [
  "dimanche",
  "lundi",
  "mardi",
  "mercredi",
  "jeudi",
  "vendredi",
  "samedi",
];
const MONTHS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];
export function fmtDateFull(d: Date): string {
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}
export function ageLabel(d = new Date()): string {
  const days = Math.floor((d.getTime() - BIRTH.getTime()) / 86400000);
  const months = Math.floor(days / 30.4375);
  const remDays = Math.floor(days - months * 30.4375);
  if (months < 1) return `${days} jours`;
  return `${months} mois ${remDays} j`;
}
export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}
export function durationMin(start: Date, end: Date): number {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
}
export function dateAtTime(base: Date, h: number, m: number): Date {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m, 0, 0);
}
export function ageInDays(d: Date): number {
  return Math.floor((startOfDay(d).getTime() - startOfDay(BIRTH).getTime()) / 86400000);
}
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
/** "à l'instant", "il y a 25 min", "il y a 2h10". */
export function timeAgo(d: Date, now = new Date()): string {
  const min = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h < 24) return `il y a ${h}h${m ? pad2(m) : ""}`;
  const days = Math.floor(h / 24);
  return `il y a ${days} j`;
}
