import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '@/src/components/ui/Icon';
import { DashedDivider, Stamp, TapeStrip } from '@/src/components/decor';
import { radii, spacing } from '@/src/constants/theme';
import { env } from '@/src/lib/env';
import { getGrowthSpurtMockAnalysis } from '@/src/lib/devMocks';
import { getQuotaSnapshot, type QuotaSnapshot } from '@/src/lib/llmQuota';
import { useAppContext } from '@/src/providers/AppProvider';
import { useAppTheme } from '@/src/providers/ThemeProvider';
import { triggerSelectionFeedback } from '@/src/lib/feedback';
import type { BabyProfile, TrackedEvent } from '@/src/types/domain';
import { detectGrowthSpurt, type GrowthSpurtAnalysis } from '@/src/utils/growthSpurts';
import {
  isGrowthSpurtLLMConfigured,
  requestGrowthSpurtAnalysis,
} from '@/src/services/growthSpurtLLM';

interface Props {
  events: TrackedEvent[];
  baby: BabyProfile;
}

/**
 * Always-on contextual card.
 * - If the local detector finds a probable growth spurt → highlights it.
 * - If something looks unusual but inconclusive → shows it softly.
 * - If nothing stands out → shows a calm "rien à signaler" state.
 * In every state the LLM analysis CTA stays available (when configured),
 * so the parent can ask for an interpretation at any time.
 */
export function GrowthSpurtBanner({ events, baby }: Props) {
  const { theme } = useAppTheme();
  const { growthSpurtMock } = useAppContext();

  const realAnalysis = useMemo(() => detectGrowthSpurt(events, baby), [events, baby]);
  const mockAnalysis = useMemo(() => getGrowthSpurtMockAnalysis(growthSpurtMock), [growthSpurtMock]);
  const analysis = mockAnalysis ?? realAnalysis;
  const isMocked = mockAnalysis !== null;

  const [llmState, setLlmState] = useState<
    | { kind: 'idle' }
    | { kind: 'loading' }
    | { kind: 'success'; text: string }
    | { kind: 'error'; message: string }
  >({ kind: 'idle' });

  const [quota, setQuota] = useState<QuotaSnapshot | null>(null);

  const refreshQuota = useCallback(() => {
    getQuotaSnapshot(env.mistralDailyLimit).then(setQuota).catch(() => {
      /* AsyncStorage unavailable — degrade silently */
    });
  }, []);

  // Initial load + refresh whenever the LLM state settles back to a
  // non-loading state (so the counter mirrors what the user just did).
  useEffect(() => {
    if (!isGrowthSpurtLLMConfigured()) return;
    if (llmState.kind === 'loading') return;
    refreshQuota();
  }, [llmState.kind, refreshQuota]);

  const requestLLM = async () => {
    if (llmState.kind === 'loading') return;
    triggerSelectionFeedback();
    setLlmState({ kind: 'loading' });
    try {
      const text = await requestGrowthSpurtAnalysis({ events, baby, analysis });
      setLlmState({ kind: 'success', text });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue';
      setLlmState({ kind: 'error', message: msg });
    }
  };

  const isQuiet = !analysis.humanLabel;
  const isProbable = analysis.confidence >= 60;
  const accent = isProbable ? theme.mint : isQuiet ? theme.textSoft : theme.primary;
  const accentSoft = isProbable ? theme.mintSoft : `${accent}26`;

  const titleText = analysis.humanLabel ?? 'Rien à signaler actuellement';

  const subtitleText = isQuiet
    ? analysis.ageWindowMatch && analysis.ageWindowLabel
      ? `Fenêtre typique en cours (${analysis.ageWindowLabel}) mais aucun signal marqué.`
      : `Le rythme de bébé semble stable sur les derniers jours.`
    : analysis.ageWindowMatch && analysis.ageWindowLabel
      ? `Fenêtre typique : ${analysis.ageWindowLabel}. Confiance ${Math.round(analysis.confidence)}/100.`
      : `Confiance ${Math.round(analysis.confidence)}/100.`;

  return (
    <View
      style={[
        styles.shell,
        {
          backgroundColor: theme.surfaceLowest,
          borderColor: theme.cardBorder,
          shadowColor: theme.shadow,
          // Slight handmade rotation — the banner sits on the page like a
          // page from a journal, not a perfectly aligned UI tile. Negligible
          // for tap-targets (~0.4°) but does the editorial heavy lifting.
          transform: [{ rotate: isProbable ? '-0.4deg' : '0deg' }],
        },
      ]}
    >
      <View pointerEvents="none" style={[styles.accentStripe, { backgroundColor: accent }]} />

      {/* Decorative "tape" pinning the journal page in the top-left corner.
          Always present — it's the silent identity marker of the banner. */}
      <TapeStrip
        color={isProbable ? theme.mintSoft : theme.primaryContainer}
        width={86}
        height={18}
        rotate="-8deg"
        opacity={0.55}
        top={-6}
        left={18}
      />

      {/* Active state earns a stamp — "indice en cours" as a hand-applied
          mark on the page. Quiet state stays bare. */}
      {isProbable ? (
        <View style={styles.stampWrap} pointerEvents="none">
          <Stamp
            label="indice en cours"
            color={accent}
            background={theme.surfaceLowest}
            rotate="3deg"
          />
        </View>
      ) : null}

      <View style={styles.headerRow}>
        <View style={[styles.iconBubble, { backgroundColor: accentSoft }]}>
          <Icon name="sparkles-outline" size={18} color={accent} />
        </View>
        <View style={styles.headerText}>
          <View style={styles.titleRow}>
            <Text
              numberOfLines={1}
              style={[styles.title, { color: theme.text, fontFamily: theme.fontDisplayItalic }]}
            >
              {titleText}
            </Text>
            {isMocked ? (
              <View style={[styles.mockBadge, { backgroundColor: theme.warning }]}>
                <Text style={[styles.mockBadgeLabel, { color: theme.onPrimary, fontFamily: theme.fontBold }]}>
                  MOCK
                </Text>
              </View>
            ) : null}
          </View>
          <Text
            numberOfLines={2}
            style={[styles.subtitle, { color: theme.textMuted, fontFamily: theme.fontMedium }]}
          >
            {subtitleText}
          </Text>
        </View>
      </View>

      {analysis.signals.length > 0 ? (
        <>
          <DashedDivider color={theme.cardBorder} marginVertical={2} />
          <View style={styles.signalsList}>
            {analysis.signals.slice(0, 4).map((signal) => (
              <View key={signal.key} style={styles.signalRow}>
                <View style={[styles.signalDot, { backgroundColor: accent, opacity: 0.4 + signal.strength * 0.6 }]} />
                <Text
                  style={[styles.signalLabel, { color: theme.textMuted, fontFamily: theme.fontRegular }]}
                >
                  {signal.label}
                </Text>
              </View>
            ))}
          </View>
        </>
      ) : null}

      {/* LLM section */}
      {llmState.kind === 'idle' && isGrowthSpurtLLMConfigured() ? (
        <View style={styles.llmCtaRow}>
          <Pressable
            onPress={() => void requestLLM()}
            disabled={quota?.remaining === 0}
            style={({ pressed }) => [
              styles.llmCta,
              {
                backgroundColor: accentSoft,
                opacity: quota?.remaining === 0 ? 0.5 : pressed ? 0.85 : 1,
              },
            ]}
          >
            <Icon name="sparkles-outline" size={14} color={accent} />
            <Text style={[styles.llmCtaLabel, { color: accent, fontFamily: theme.fontSemiBold }]}>
              {quota?.remaining === 0 ? 'Limite quotidienne atteinte' : 'Demander une analyse'}
            </Text>
          </Pressable>
          {quota && quota.limit > 0 ? (
            <Text style={[styles.quotaHint, { color: theme.textSoft, fontFamily: theme.fontRegular }]}>
              {quota.used}/{quota.limit} aujourd'hui
            </Text>
          ) : null}
        </View>
      ) : null}

      {llmState.kind === 'loading' ? (
        <View style={styles.llmLoadingRow}>
          <ActivityIndicator size="small" color={accent} />
          <Text style={[styles.llmLoadingLabel, { color: theme.textMuted, fontFamily: theme.fontMedium }]}>
            Analyse en cours…
          </Text>
        </View>
      ) : null}

      {llmState.kind === 'success' ? (
        <View style={[styles.llmResultBlock, { backgroundColor: accentSoft, borderColor: `${accent}40` }]}>
          <Text style={[styles.llmResultLabel, { color: accent, fontFamily: theme.fontBold }]}>
            ANALYSE
          </Text>
          <Text style={[styles.llmResultBody, { color: theme.text, fontFamily: theme.fontRegular }]}>
            {llmState.text}
          </Text>
        </View>
      ) : null}

      {llmState.kind === 'error' ? (
        <View style={[styles.llmResultBlock, { backgroundColor: `${theme.danger}1F`, borderColor: `${theme.danger}40` }]}>
          <Text style={[styles.llmResultLabel, { color: theme.danger, fontFamily: theme.fontBold }]}>
            ERREUR
          </Text>
          <Text style={[styles.llmResultBody, { color: theme.text, fontFamily: theme.fontRegular }]}>
            {llmState.message}
          </Text>
        </View>
      ) : null}

      <Text style={[styles.disclaimer, { color: theme.textSoft, fontFamily: theme.fontRegular }]}>
        {isQuiet
          ? 'Outil informatif, pas un avis médical.'
          : 'Indice non médical, à vérifier avec votre pédiatre.'}
      </Text>
    </View>
  );
}

// Helper to keep TS happy if analysis type is needed elsewhere
export type { GrowthSpurtAnalysis };

const styles = StyleSheet.create({
  shell: {
    borderRadius: 22,
    borderWidth: 1,
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.md,
    paddingLeft: spacing.md + 6,
    paddingTop: spacing.md + 4, // make room for tape + stamp peeking
    gap: spacing.xs,
    // More present shadow — paper resting on cream paper.
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
    position: 'relative',
    // Visible so the tape strip and stamp can peek over the top edge,
    // hand-applied feel. The accent stripe itself is internally clipped
    // by its absolute positioning aligned to the shell's edges.
    overflow: 'visible',
  },
  stampWrap: {
    position: 'absolute',
    top: -12,
    right: 16,
    zIndex: 2,
  },
  accentStripe: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    opacity: 0.85,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    gap: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  mockBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  mockBadgeLabel: {
    fontSize: 9,
    letterSpacing: 0.6,
  },
  subtitle: {
    fontSize: 11.5,
    letterSpacing: 0.1,
  },
  divider: {
    height: 1,
    opacity: 0.5,
  },
  signalsList: {
    gap: 4,
  },
  signalRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  signalDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginTop: 6,
  },
  signalLabel: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 17,
    letterSpacing: 0.05,
  },
  llmCtaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  llmCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: radii.pill,
  },
  llmCtaLabel: {
    fontSize: 12,
    letterSpacing: 0.2,
  },
  quotaHint: {
    fontSize: 11,
    letterSpacing: 0.2,
    opacity: 0.85,
  },
  llmLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  llmLoadingLabel: {
    fontSize: 12.5,
  },
  llmResultBlock: {
    marginTop: 4,
    padding: spacing.sm + 2,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: 6,
  },
  llmResultLabel: {
    fontSize: 10,
    letterSpacing: 0.6,
  },
  llmResultBody: {
    fontSize: 13,
    lineHeight: 19,
    letterSpacing: 0.05,
  },
  disclaimer: {
    fontSize: 10.5,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
    opacity: 0.7,
    marginTop: 2,
  },
});
