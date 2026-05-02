const NIGHT_START_HOUR = 23;
const NIGHT_END_HOUR = 7;

type EncouragementTone = 'night' | 'day' | 'any';

interface BreastfeedingEncouragement {
  tone: EncouragementTone;
  message: string;
}

const ENCOURAGEMENTS: BreastfeedingEncouragement[] = [
  { tone: 'any', message: "Tu fais quelque chose de vraiment précieux pour Charlie." },
  { tone: 'any', message: "Tu peux être fière de toi. Cette tétée compte." },
  { tone: 'any', message: "Même une petite tétée a de la valeur : elle nourrit Charlie et soutient aussi ta lactation." },
  { tone: 'any', message: "Le savais-tu ? Ton lait est un aliment complet, pensé pour les besoins de Charlie." },
  { tone: 'any', message: "Ce que tu fais là est concret : tu nourris, tu hydrates et tu réconfortes Charlie en même temps." },
  { tone: 'any', message: "Tu ne fais pas “juste” un repas. Tu réponds à un vrai besoin de Charlie." },
  { tone: 'any', message: "Le savais-tu ? Le lait maternel apporte aussi des anticorps qui aident à protéger Charlie." },
  { tone: 'any', message: "Tu fais bien. Les tétées fréquentes aident ton corps à produire le lait dont Charlie a besoin." },
  { tone: 'any', message: "Ton corps et Charlie travaillent ensemble. Cette tétée participe aussi à ajuster ta lactation." },
  { tone: 'any', message: "Le savais-tu ? Le lait maternel évolue avec le temps pour continuer à s'adapter à Charlie." },
  { tone: 'any', message: "Tu fais plus que tu ne le crois. Une tétée peut nourrir et apaiser en même temps." },
  { tone: 'any', message: "Ce rythme peut être intense, mais ce que tu fais est vraiment utile." },
  { tone: 'day', message: "Tu fais bien : des tétées rapprochées peuvent être normales, surtout quand Charlie grandit vite." },
  { tone: 'day', message: "Les journées denses ne veulent pas dire que ça va mal. Parfois, elles font juste partie du rythme." },
  { tone: 'day', message: "Ta présence aide Charlie à se réguler, pas seulement à manger." },
  { tone: 'day', message: "Le savais-tu ? Les “grappes” de tétées peuvent être normales et souvent passagères." },
  { tone: 'day', message: "Tu lui offres aussi un repère de sécurité. Ça compte énormément." },
  { tone: 'day', message: "Quand Charlie réclame souvent, ce n'est pas forcément un problème. Cela peut aussi aider ta production à s'ajuster." },
  { tone: 'night', message: "Tu es réveillée, oui. Mais cette tétée de nuit a du sens et elle compte vraiment." },
  { tone: 'night', message: "Tu fais du bon boulot, même à cette heure-ci." },
  { tone: 'night', message: "Le savais-tu ? Les tétées de nuit participent aussi au maintien de la lactation." },
  { tone: 'night', message: "Même en pleine nuit, ce que tu fais aide Charlie ici et maintenant." },
  { tone: 'night', message: "La fatigue est réelle. Ce que tu fais l'est aussi." },
  { tone: 'night', message: "Cette tétée de nuit n'est pas “en trop”. Elle est utile." },
  { tone: 'night', message: "Tu peux te rappeler une chose simple : là, tu réponds exactement à ce dont Charlie a besoin." },
  { tone: 'night', message: "Le savais-tu ? Quand Charlie tète la nuit, ton corps continue d'ajuster la production à sa demande." },
  { tone: 'night', message: "Tu nourris Charlie, tu l'apaises, et tu soutiens aussi ta lactation. Même maintenant." },
  { tone: 'night', message: "Cette nuit est peut-être longue, mais ce moment a quand même du sens." },
  { tone: 'night', message: "Le savais-tu ? Les réveils de nuit peuvent aussi faire partie du rythme normal d'un bébé allaité." },
  { tone: 'night', message: "Tu tiens quelque chose de difficile, et tu le fais avec beaucoup de valeur pour Charlie." },
];

let encouragementIndex = 0;

function isNightHour(hour: number) {
  return hour >= NIGHT_START_HOUR || hour < NIGHT_END_HOUR;
}

export function getBreastfeedingEncouragement(timestamp = Date.now()) {
  const hour = new Date(timestamp).getHours();
  const useNightMessages = isNightHour(hour);
  const pool = ENCOURAGEMENTS.filter((entry) => entry.tone === 'any' || (useNightMessages ? entry.tone === 'night' : entry.tone === 'day'));
  const message = pool[encouragementIndex % pool.length]?.message ?? ENCOURAGEMENTS[0].message;
  encouragementIndex += 1;
  return message;
}
