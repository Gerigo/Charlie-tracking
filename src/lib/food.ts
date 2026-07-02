// ─── Diversification alimentaire ────────────────────────────────────
// Tout le "métier" repas/aliments vit ici pour garder un impact minimal
// sur les fichiers existants (events.ts n'apprend que le type `meal` et
// son mapping DB). Le catalogue est STATIQUE (comme CARE_OPTIONS /
// STOOL_COLORS) ; le journal des aliments et les stats sont DÉRIVÉS des
// events `meal` — zéro nouvelle collection, zéro migration.

import type { AppEvent, MealData } from "@/lib/events";

// ─── Barèmes d'encodage ───
export const MEAL_TEXTURES: { v: MealData["texture"]; l: string }[] = [
  { v: "puree", l: "Purée lisse" },
  { v: "morceaux", l: "Morceaux" },
  { v: "mixte", l: "Mixte" },
];

export const MEAL_AMOUNTS: { v: MealData["amount"]; l: string }[] = [
  { v: "goute", l: "Goûté" },
  { v: "un_peu", l: "Un peu" },
  { v: "moitie", l: "La moitié" },
  { v: "tout", l: "Tout" },
  { v: "refuse", l: "Refusé" },
];

export const MEAL_REACTIONS: {
  v: MealData["reaction"];
  l: string;
  emoji: string;
}[] = [
  { v: "adore", l: "Adore", emoji: "😍" },
  { v: "aime", l: "Aime", emoji: "🙂" },
  { v: "neutre", l: "Neutre", emoji: "😐" },
  { v: "refuse", l: "N'aime pas", emoji: "😖" },
];

export const MEAL_SYMPTOMS: { v: string; l: string }[] = [
  { v: "rougeurs", l: "Rougeurs" },
  { v: "boutons", l: "Boutons / eczéma" },
  { v: "vomissement", l: "Vomissement" },
  { v: "diarrhee", l: "Diarrhée" },
  { v: "gonflement", l: "Gonflement" },
  { v: "respiration", l: "Gêne respiratoire" },
  { v: "irritabilite", l: "Irritabilité" },
];

// ─── Catalogue d'aliments ───
export type FoodCat =
  | "legume"
  | "fruit"
  | "feculent"
  | "proteine"
  | "laitier"
  | "allergene";

export interface FoodItem {
  v: string;
  l: string;
  cat: FoodCat;
  emoji: string;
  /** Allergène majeur : à introduire tôt, un à la fois, sous surveillance. */
  allergen?: boolean;
}

export const FOOD_CATEGORIES: { cat: FoodCat; l: string; emoji: string }[] = [
  { cat: "legume", l: "Légumes", emoji: "🥦" },
  { cat: "fruit", l: "Fruits", emoji: "🍎" },
  { cat: "feculent", l: "Féculents", emoji: "🍚" },
  { cat: "proteine", l: "Protéines", emoji: "🍗" },
  { cat: "laitier", l: "Laitiers", emoji: "🧀" },
  { cat: "allergene", l: "Allergènes", emoji: "⚠️" },
];

export const FOOD_CATALOG: FoodItem[] = [
  // Légumes
  { v: "carotte", l: "Carotte", cat: "legume", emoji: "🥕" },
  { v: "courgette", l: "Courgette", cat: "legume", emoji: "🥒" },
  { v: "patate_douce", l: "Patate douce", cat: "legume", emoji: "🍠" },
  { v: "potiron", l: "Potiron", cat: "legume", emoji: "🎃" },
  { v: "brocoli", l: "Brocoli", cat: "legume", emoji: "🥦" },
  { v: "haricot_vert", l: "Haricot vert", cat: "legume", emoji: "🫛" },
  { v: "panais", l: "Panais", cat: "legume", emoji: "🥕" },
  { v: "epinard", l: "Épinard", cat: "legume", emoji: "🥬" },
  { v: "petit_pois", l: "Petits pois", cat: "legume", emoji: "🫛" },
  { v: "tomate", l: "Tomate", cat: "legume", emoji: "🍅" },
  // Fruits
  { v: "pomme", l: "Pomme", cat: "fruit", emoji: "🍎" },
  { v: "poire", l: "Poire", cat: "fruit", emoji: "🍐" },
  { v: "banane", l: "Banane", cat: "fruit", emoji: "🍌" },
  { v: "peche", l: "Pêche", cat: "fruit", emoji: "🍑" },
  { v: "abricot", l: "Abricot", cat: "fruit", emoji: "🍑" },
  { v: "prune", l: "Prune", cat: "fruit", emoji: "🫐" },
  { v: "mangue", l: "Mangue", cat: "fruit", emoji: "🥭" },
  { v: "fraise", l: "Fraise", cat: "fruit", emoji: "🍓" },
  { v: "myrtille", l: "Myrtille", cat: "fruit", emoji: "🫐" },
  // Féculents
  { v: "pomme_de_terre", l: "Pomme de terre", cat: "feculent", emoji: "🥔" },
  { v: "riz", l: "Riz", cat: "feculent", emoji: "🍚" },
  { v: "semoule", l: "Semoule (blé)", cat: "feculent", emoji: "🌾", allergen: true },
  { v: "pates", l: "Pâtes (blé)", cat: "feculent", emoji: "🍝", allergen: true },
  { v: "pain", l: "Pain (blé)", cat: "feculent", emoji: "🍞", allergen: true },
  { v: "avoine", l: "Avoine", cat: "feculent", emoji: "🌾", allergen: true },
  { v: "quinoa", l: "Quinoa", cat: "feculent", emoji: "🌾" },
  // Protéines
  { v: "poulet", l: "Poulet", cat: "proteine", emoji: "🍗" },
  { v: "dinde", l: "Dinde", cat: "proteine", emoji: "🍗" },
  { v: "boeuf", l: "Bœuf", cat: "proteine", emoji: "🥩" },
  { v: "jambon", l: "Jambon", cat: "proteine", emoji: "🍖" },
  { v: "poisson", l: "Poisson", cat: "proteine", emoji: "🐟", allergen: true },
  { v: "oeuf", l: "Œuf", cat: "proteine", emoji: "🥚", allergen: true },
  { v: "lentille", l: "Lentilles", cat: "proteine", emoji: "🫘" },
  // Laitiers
  { v: "yaourt", l: "Yaourt", cat: "laitier", emoji: "🥛", allergen: true },
  { v: "fromage", l: "Fromage", cat: "laitier", emoji: "🧀", allergen: true },
  { v: "petit_suisse", l: "Petit-suisse", cat: "laitier", emoji: "🥛", allergen: true },
  // Allergènes majeurs (à part)
  { v: "arachide", l: "Arachide", cat: "allergene", emoji: "🥜", allergen: true },
  { v: "fruits_coque", l: "Fruits à coque", cat: "allergene", emoji: "🌰", allergen: true },
  { v: "sesame", l: "Sésame", cat: "allergene", emoji: "🌰", allergen: true },
  { v: "soja", l: "Soja", cat: "allergene", emoji: "🫘", allergen: true },
  { v: "crustaces", l: "Crustacés", cat: "allergene", emoji: "🦐", allergen: true },
];

const FOOD_BY_ID: Record<string, FoodItem> = Object.fromEntries(
  FOOD_CATALOG.map((f) => [f.v, f]),
);

export function foodItem(id: string): FoodItem | undefined {
  return FOOD_BY_ID[id];
}
export function foodLabel(id: string, custom?: string | null): string {
  if (id === "custom") return custom?.trim() || "Autre";
  return FOOD_BY_ID[id]?.l ?? id;
}
export function foodEmoji(id: string): string {
  return FOOD_BY_ID[id]?.emoji ?? "🥄";
}
export function isAllergen(id: string): boolean {
  return FOOD_BY_ID[id]?.allergen === true;
}

/** Liste lisible des aliments d'un repas : "Carotte, Pomme". */
export function mealFoodsText(data: MealData): string {
  const parts = data.foods.map((f) => foodLabel(f, data.custom));
  return parts.length ? parts.join(", ") : "Repas";
}

export function amountLabel(v: MealData["amount"]): string {
  return MEAL_AMOUNTS.find((a) => a.v === v)?.l ?? v;
}
export function reactionEmoji(v: MealData["reaction"]): string {
  return MEAL_REACTIONS.find((r) => r.v === v)?.emoji ?? "";
}

/** Résumé complet d'un repas pour Le fil : "Carotte, Pomme — la moitié 🙂". */
export function mealText(data: MealData): string {
  const foods = mealFoodsText(data);
  const amt = data.amount === "refuse" ? "refusé" : amountLabel(data.amount).toLowerCase();
  return `${foods} — ${amt} ${reactionEmoji(data.reaction)}`.trim();
}

// ─── Registre des aliments (dérivé des events `meal`) ───
export interface FoodStat {
  id: string; // id catalogue, ou "custom:<label>" pour un aliment libre
  label: string;
  emoji: string;
  cat: FoodCat | "autre";
  allergen: boolean;
  firstTried: Date;
  lastTried: Date;
  times: number;
  everFlagged: boolean; // une réaction a-t-elle déjà été signalée ?
}

/** 3 jours = fenêtre d'observation classique après un nouvel aliment. */
export const OBSERVATION_MS = 3 * 86400000;

/**
 * Parcourt tous les repas et agrège, par aliment : 1ère fois, nb de fois,
 * dernière fois, réaction suspecte déjà vue. Les events arrivent triés
 * asc par start (cf. subscribeScopedEvents).
 */
export function foodStatsFor(events: AppEvent[]): FoodStat[] {
  const map = new Map<string, FoodStat>();
  for (const e of events) {
    if (e.type !== "meal") continue;
    const d = e.data as MealData;
    for (const f of d.foods) {
      // Un aliment "custom" est identifié par son texte libre.
      const id = f === "custom" ? `custom:${(d.custom ?? "").trim().toLowerCase()}` : f;
      if (f === "custom" && !(d.custom ?? "").trim()) continue;
      const item = f === "custom" ? undefined : FOOD_BY_ID[f];
      const existing = map.get(id);
      if (existing) {
        existing.times += 1;
        existing.lastTried = e.start;
        if (d.allergy) existing.everFlagged = true;
      } else {
        map.set(id, {
          id,
          label: f === "custom" ? (d.custom?.trim() || "Autre") : (item?.l ?? f),
          emoji: item?.emoji ?? "🥄",
          cat: item?.cat ?? "autre",
          allergen: item?.allergen === true,
          firstTried: e.start,
          lastTried: e.start,
          times: 1,
          everFlagged: d.allergy === true,
        });
      }
    }
  }
  return [...map.values()];
}

/** Ids catalogue déjà introduits au moins une fois. */
export function introducedIds(events: AppEvent[]): Set<string> {
  const s = new Set<string>();
  for (const st of foodStatsFor(events)) {
    if (!st.id.startsWith("custom:")) s.add(st.id);
  }
  return s;
}
