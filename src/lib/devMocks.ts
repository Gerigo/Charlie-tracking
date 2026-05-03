import type { GrowthSpurtAnalysis } from '@/src/utils/growthSpurts';

/**
 * Dev-only mocks for the growth-spurt detection feature.
 *
 * When a mock is active, the GrowthSpurtBanner displays the mock analysis
 * instead of running detectGrowthSpurt() on real events. Useful to test
 * visual rendering + LLM call without waiting for actual signals.
 *
 * Stored in AsyncStorage under MOCK_STORAGE_KEY so the choice survives
 * a reload. Cleared automatically when the user signs out.
 */

export const MOCK_STORAGE_KEY = '@charlie:growth_spurt_mock';

export type GrowthSpurtMockKey =
  | 'off'
  | 'mild'
  | 'probable'
  | 'intense_3m'
  | 'cluster_only'
  | 'sleep_only';

export interface GrowthSpurtMockOption {
  key: GrowthSpurtMockKey;
  label: string;
  description: string;
}

export const GROWTH_SPURT_MOCK_OPTIONS: GrowthSpurtMockOption[] = [
  { key: 'off', label: 'Désactivé', description: 'Détection réelle sur les events encodés' },
  { key: 'mild', label: 'Pic léger', description: 'Confiance ~45 — bannière "Possibles signes"' },
  { key: 'probable', label: 'Pic probable', description: 'Confiance ~72 — bannière "Pic probable"' },
  { key: 'intense_3m', label: 'Pic intense + fenêtre 3 mois', description: 'Confiance ~95 — tous signaux + age window match' },
  { key: 'cluster_only', label: 'Cluster feeding seul', description: 'Un seul signal — confiance modérée' },
  { key: 'sleep_only', label: 'Sleep regression seule', description: 'Réveils nocturnes ↑, sommeil total ↓' },
];

export function getGrowthSpurtMockAnalysis(key: GrowthSpurtMockKey): GrowthSpurtAnalysis | null {
  switch (key) {
    case 'off':
      return null;

    case 'mild':
      return {
        confidence: 45,
        humanLabel: 'Possibles signes de pic',
        ageWindowMatch: false,
        ageWindowLabel: null,
        signals: [
          {
            key: 'cluster_feeding',
            strength: 0.5,
            label: 'Tétées plus fréquentes (8 sur 24h vs 6.0 en moyenne)',
          },
          {
            key: 'sleep_fragmentation',
            strength: 0.4,
            label: 'Plus de réveils nocturnes (3 cette nuit vs 1.7 en moyenne)',
          },
        ],
      };

    case 'probable':
      return {
        confidence: 72,
        humanLabel: 'Pic de croissance probable',
        ageWindowMatch: false,
        ageWindowLabel: null,
        signals: [
          {
            key: 'cluster_feeding',
            strength: 0.85,
            label: 'Tétées plus fréquentes (11 sur 24h vs 6.5 en moyenne)',
          },
          {
            key: 'shorter_feed_intervals',
            strength: 0.7,
            label: 'Intervalles entre tétées plus courts (~45 min de moins)',
          },
          {
            key: 'sleep_total_reduced',
            strength: 0.55,
            label: "Sommeil total réduit d'environ 2.3h sur 24h",
          },
        ],
      };

    case 'intense_3m':
      return {
        confidence: 95,
        humanLabel: 'Pic de croissance probable',
        ageWindowMatch: true,
        ageWindowLabel: '3 mois',
        signals: [
          {
            key: 'cluster_feeding',
            strength: 0.95,
            label: 'Tétées plus fréquentes (13 sur 24h vs 6.0 en moyenne)',
          },
          {
            key: 'shorter_feed_intervals',
            strength: 0.9,
            label: 'Intervalles entre tétées plus courts (~70 min de moins)',
          },
          {
            key: 'sleep_fragmentation',
            strength: 0.8,
            label: 'Plus de réveils nocturnes (5 cette nuit vs 1.4 en moyenne)',
          },
          {
            key: 'sleep_total_reduced',
            strength: 0.7,
            label: "Sommeil total réduit d'environ 3.2h sur 24h",
          },
        ],
      };

    case 'cluster_only':
      return {
        confidence: 52,
        humanLabel: 'Possibles signes de pic',
        ageWindowMatch: false,
        ageWindowLabel: null,
        signals: [
          {
            key: 'cluster_feeding',
            strength: 0.95,
            label: 'Tétées plus fréquentes (14 sur 24h vs 7.0 en moyenne)',
          },
          {
            key: 'shorter_feed_intervals',
            strength: 0.85,
            label: 'Intervalles entre tétées plus courts (~85 min de moins)',
          },
        ],
      };

    case 'sleep_only':
      return {
        confidence: 48,
        humanLabel: 'Possibles signes de pic',
        ageWindowMatch: false,
        ageWindowLabel: null,
        signals: [
          {
            key: 'sleep_fragmentation',
            strength: 0.9,
            label: 'Plus de réveils nocturnes (6 cette nuit vs 1.5 en moyenne)',
          },
          {
            key: 'sleep_total_reduced',
            strength: 0.85,
            label: "Sommeil total réduit d'environ 3.8h sur 24h",
          },
        ],
      };
  }
}
