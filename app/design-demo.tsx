/**
 * Design comparison playground — `/design-demo`
 *
 * Side-by-side rendering of the three proposed palette directions
 * (A “Resserrer”, B “Éditorial assumé”, C “Pivot neutre”) using real
 * components close to what the app actually shows: a Today hero card,
 * the GrowthSpurtBanner in two states, an action row, a stats triplet.
 *
 * Each column is fully self-themed via its own palette object so the
 * demo doesn't pollute the global ThemeProvider — open the page, scan,
 * pick one. No auth required.
 */

import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Stack } from 'expo-router';
import { Icon } from '@/src/components/ui/Icon';

// ─── Palette definitions ────────────────────────────────────────────────────
//
// Only the colors that actually differ between options. Each palette is a
// flat record so we can pass it around as a prop and skip the AppTheme dance.

interface DemoPalette {
  key: 'current' | 'A' | 'B' | 'C';
  name: string;
  tagline: string;
  bullet: string;
  // Surfaces
  background: string;
  surface: string;
  surfaceSoft: string;
  cardBorder: string;
  cardBorderStrong: string;
  shadow: string;
  hairline: string;
  // Type
  text: string;
  textMuted: string;
  textSoft: string;
  // Brand
  primary: string;
  primarySoft: string;
  onPrimary: string;
  // Semantic
  mint: string;
  mintSoft: string;
  warning: string;
  // Display fonts (same across options — pure type still works)
  fontDisplay: string;
  fontDisplayItalic: string;
  fontRegular: string;
  fontMedium: string;
  fontSemiBold: string;
  fontBold: string;
}

const PALETTES: DemoPalette[] = [
  {
    key: 'current',
    name: 'Actuel',
    tagline: 'Le design qui tourne aujourd\'hui',
    bullet: 'Référence — pour comparer',
    background: '#FCF9F7',
    surface: '#FFFFFF',
    surfaceSoft: '#F1EBE8',
    cardBorder: 'rgba(180, 158, 160, 0.30)',
    cardBorderStrong: 'rgba(180, 158, 160, 0.45)',
    shadow: 'rgba(124, 83, 87, 0.12)',
    hairline: 'rgba(124, 83, 87, 0.14)',
    text: '#2A2324',
    textMuted: '#534547',
    textSoft: '#736366',
    primary: '#805354',
    primarySoft: 'rgba(232, 180, 184, 0.22)',
    onPrimary: '#FFFFFF',
    mint: '#A8C4A2',
    mintSoft: '#CCDCC6',
    warning: '#C99462',
    fontDisplay: 'Fraunces_300Light',
    fontDisplayItalic: 'Fraunces_300Light_Italic',
    fontRegular: 'Manrope_400Regular',
    fontMedium: 'Manrope_500Medium',
    fontSemiBold: 'Manrope_600SemiBold',
    fontBold: 'Manrope_700Bold',
  },
  {
    key: 'A',
    name: 'Resserrer',
    tagline: 'Même esprit, plus net',
    bullet: 'Cream légèrement plus saturé, bordures lisibles, hiérarchie texte clarifiée',
    background: '#F4ECE5',
    surface: '#FFFFFF',
    surfaceSoft: '#EDE3DA',
    cardBorder: 'rgba(124, 83, 87, 0.18)',
    cardBorderStrong: 'rgba(124, 83, 87, 0.32)',
    shadow: 'rgba(124, 83, 87, 0.18)',
    hairline: 'rgba(124, 83, 87, 0.16)',
    text: '#2A2324',
    textMuted: '#3F3335',
    textSoft: '#6B5C5F',
    primary: '#805354',
    primarySoft: 'rgba(128, 83, 84, 0.14)',
    onPrimary: '#FFFFFF',
    mint: '#A8C4A2',
    mintSoft: '#CCDCC6',
    warning: '#C99462',
    fontDisplay: 'Fraunces_300Light',
    fontDisplayItalic: 'Fraunces_300Light_Italic',
    fontRegular: 'Manrope_400Regular',
    fontMedium: 'Manrope_500Medium',
    fontSemiBold: 'Manrope_600SemiBold',
    fontBold: 'Manrope_700Bold',
  },
  {
    key: 'B',
    name: 'Éditorial assumé',
    tagline: 'Magazine pour parents, structuré',
    bullet: 'Cream présent, primary sombre, bordures + ombres profondes, italique tranchée',
    background: '#F1E8DF',
    surface: '#FFFFFF',
    surfaceSoft: '#E9DFD3',
    cardBorder: 'rgba(110, 66, 68, 0.24)',
    cardBorderStrong: 'rgba(110, 66, 68, 0.48)',
    shadow: 'rgba(56, 28, 32, 0.22)',
    hairline: 'rgba(110, 66, 68, 0.22)',
    text: '#1F1819',
    textMuted: '#3A2E30',
    textSoft: '#6F5E62',
    primary: '#6E4244',
    primarySoft: 'rgba(110, 66, 68, 0.16)',
    onPrimary: '#FFF7F0',
    mint: '#8FA988',
    mintSoft: '#C8D6C2',
    warning: '#B57948',
    fontDisplay: 'Fraunces_300Light',
    fontDisplayItalic: 'Fraunces_300Light_Italic',
    fontRegular: 'Manrope_400Regular',
    fontMedium: 'Manrope_500Medium',
    fontSemiBold: 'Manrope_600SemiBold',
    fontBold: 'Manrope_700Bold',
  },
  {
    key: 'C',
    name: 'Pivot neutre',
    tagline: 'iOS-like, lisibilité maximale',
    bullet: 'Stone neutre, accents rose ponctuels, ombres épurées, esprit moderne',
    background: '#F5F5F4',
    surface: '#FFFFFF',
    surfaceSoft: '#EFEEEC',
    cardBorder: 'rgba(28, 25, 23, 0.10)',
    cardBorderStrong: 'rgba(28, 25, 23, 0.20)',
    shadow: 'rgba(28, 25, 23, 0.10)',
    hairline: 'rgba(28, 25, 23, 0.08)',
    text: '#1C1917',
    textMuted: '#44403C',
    textSoft: '#78716C',
    primary: '#805354',
    primarySoft: 'rgba(128, 83, 84, 0.10)',
    onPrimary: '#FFFFFF',
    mint: '#65A30D',
    mintSoft: 'rgba(101, 163, 13, 0.14)',
    warning: '#D97706',
    fontDisplay: 'Fraunces_300Light',
    fontDisplayItalic: 'Fraunces_300Light_Italic',
    fontRegular: 'Manrope_400Regular',
    fontMedium: 'Manrope_500Medium',
    fontSemiBold: 'Manrope_600SemiBold',
    fontBold: 'Manrope_700Bold',
  },
];

// ─── Demo content blocks ────────────────────────────────────────────────────

function HeroToday({ p }: { p: DemoPalette }) {
  return (
    <View
      style={[
        s.card,
        {
          backgroundColor: p.surface,
          borderColor: p.cardBorder,
          shadowColor: p.shadow,
        },
      ]}
    >
      <Text style={[s.eyebrow, { color: p.textSoft, fontFamily: p.fontMedium }]}>
        AUJOURD'HUI · 14H32
      </Text>
      <Text style={[s.heroTitle, { color: p.text, fontFamily: p.fontDisplayItalic }]}>
        Une matinée tendre
      </Text>
      <Text style={[s.heroBody, { color: p.textMuted, fontFamily: p.fontRegular }]}>
        3 tétées espacées, sieste de 1h45, deux couches.
        Le rythme se pose doucement sur la semaine.
      </Text>
      <View style={[s.divider, { backgroundColor: p.hairline }]} />
      <View style={s.row}>
        <View style={[s.miniDot, { backgroundColor: p.primary }]} />
        <Text style={[s.metaLine, { color: p.textSoft, fontFamily: p.fontMedium }]}>
          Dernière sieste · il y a 12 min
        </Text>
      </View>
    </View>
  );
}

function GrowthBannerActive({ p }: { p: DemoPalette }) {
  return (
    <View
      style={[
        s.card,
        {
          backgroundColor: p.surface,
          borderColor: p.cardBorder,
          shadowColor: p.shadow,
        },
      ]}
    >
      <View style={[s.accentStripe, { backgroundColor: p.mint }]} />
      <View style={s.headerRow}>
        <View style={[s.iconBubble, { backgroundColor: p.mintSoft }]}>
          <Icon name="sparkles-outline" size={18} color={p.mint} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.bannerTitle, { color: p.text, fontFamily: p.fontDisplayItalic }]}>
            Pic probable détecté
          </Text>
          <Text style={[s.bannerSub, { color: p.textMuted, fontFamily: p.fontMedium }]}>
            Fenêtre typique : 3 mois. Confiance 78/100.
          </Text>
        </View>
      </View>
      <View style={[s.divider, { backgroundColor: p.hairline }]} />
      <View style={s.signalsList}>
        {['Tétées rapprochées (×2 en 6h)', 'Sommeil fragmenté la nuit', 'Couches mouillées en hausse'].map(
          (label, idx) => (
            <View key={idx} style={s.signalRow}>
              <View
                style={[
                  s.signalDot,
                  { backgroundColor: p.mint, opacity: 0.4 + (idx + 1) * 0.18 },
                ]}
              />
              <Text style={[s.signalLabel, { color: p.textMuted, fontFamily: p.fontRegular }]}>
                {label}
              </Text>
            </View>
          )
        )}
      </View>
      <View style={[s.ctaPill, { backgroundColor: p.mintSoft }]}>
        <Icon name="sparkles-outline" size={14} color={p.mint} />
        <Text style={[s.ctaLabel, { color: p.mint, fontFamily: p.fontSemiBold }]}>
          Demander une analyse
        </Text>
      </View>
    </View>
  );
}

function GrowthBannerQuiet({ p }: { p: DemoPalette }) {
  return (
    <View
      style={[
        s.card,
        {
          backgroundColor: p.surface,
          borderColor: p.cardBorder,
          shadowColor: p.shadow,
        },
      ]}
    >
      <View style={[s.accentStripe, { backgroundColor: p.textSoft, opacity: 0.4 }]} />
      <View style={s.headerRow}>
        <View style={[s.iconBubble, { backgroundColor: p.surfaceSoft }]}>
          <Icon name="sparkles-outline" size={18} color={p.textSoft} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.bannerTitle, { color: p.text, fontFamily: p.fontDisplayItalic }]}>
            Rien à signaler
          </Text>
          <Text style={[s.bannerSub, { color: p.textMuted, fontFamily: p.fontMedium }]}>
            Le rythme semble stable sur les derniers jours.
          </Text>
        </View>
      </View>
      <View style={[s.ctaPill, { backgroundColor: p.surfaceSoft, marginTop: 4 }]}>
        <Icon name="sparkles-outline" size={14} color={p.textMuted} />
        <Text style={[s.ctaLabel, { color: p.textMuted, fontFamily: p.fontSemiBold }]}>
          Demander une analyse
        </Text>
      </View>
    </View>
  );
}

function StatsTriplet({ p }: { p: DemoPalette }) {
  const stats = [
    { label: 'TÉTÉES', value: '8' },
    { label: 'SOMMEIL', value: '14h' },
    { label: 'COUCHES', value: '6' },
  ];
  return (
    <View style={s.statsRow}>
      {stats.map((stat) => (
        <View
          key={stat.label}
          style={[
            s.statCard,
            {
              backgroundColor: p.surface,
              borderColor: p.cardBorder,
              shadowColor: p.shadow,
            },
          ]}
        >
          <Text style={[s.statLabel, { color: p.textSoft, fontFamily: p.fontMedium }]}>
            {stat.label}
          </Text>
          <Text style={[s.statValue, { color: p.text, fontFamily: p.fontDisplay }]}>
            {stat.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

function ActionRow({ p }: { p: DemoPalette }) {
  return (
    <View style={s.actionRow}>
      <View style={[s.btnPrimary, { backgroundColor: p.primary }]}>
        <Text style={[s.btnPrimaryLabel, { color: p.onPrimary, fontFamily: p.fontSemiBold }]}>
          Ajouter
        </Text>
      </View>
      <View
        style={[
          s.btnGhost,
          { borderColor: p.cardBorderStrong, backgroundColor: p.surface },
        ]}
      >
        <Text style={[s.btnGhostLabel, { color: p.text, fontFamily: p.fontSemiBold }]}>
          Détails
        </Text>
      </View>
    </View>
  );
}

function ColorSwatches({ p }: { p: DemoPalette }) {
  const swatches: Array<{ key: string; color: string; label: string }> = [
    { key: 'bg', color: p.background, label: 'Fond' },
    { key: 'surface', color: p.surface, label: 'Surface' },
    { key: 'primary', color: p.primary, label: 'Primary' },
    { key: 'text', color: p.text, label: 'Texte' },
    { key: 'mint', color: p.mint, label: 'Accent' },
  ];
  return (
    <View style={s.swatchRow}>
      {swatches.map((sw) => (
        <View key={sw.key} style={s.swatchItem}>
          <View
            style={[
              s.swatchChip,
              { backgroundColor: sw.color, borderColor: p.cardBorderStrong },
            ]}
          />
          <Text style={[s.swatchLabel, { color: p.textSoft, fontFamily: p.fontMedium }]}>
            {sw.label}
          </Text>
          <Text style={[s.swatchHex, { color: p.textSoft, fontFamily: p.fontRegular }]}>
            {sw.color.startsWith('rgba') ? 'rgba…' : sw.color.toUpperCase()}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ─── Column ─────────────────────────────────────────────────────────────────

function PalettePreview({
  palette,
  highlighted,
  onPick,
}: {
  palette: DemoPalette;
  highlighted: boolean;
  onPick: (key: DemoPalette['key']) => void;
}) {
  return (
    <View
      style={[
        s.column,
        {
          backgroundColor: palette.background,
          borderColor: highlighted ? palette.primary : palette.cardBorderStrong,
          borderWidth: highlighted ? 2 : 1,
        },
      ]}
    >
      {/* Header */}
      <View style={s.colHeader}>
        <View style={s.colHeaderTop}>
          <View
            style={[
              s.colBadge,
              { backgroundColor: palette.primarySoft, borderColor: palette.cardBorder },
            ]}
          >
            <Text
              style={[
                s.colBadgeLabel,
                { color: palette.primary, fontFamily: palette.fontBold },
              ]}
            >
              {palette.key === 'current' ? 'RÉF' : `OPT ${palette.key}`}
            </Text>
          </View>
          <Text style={[s.colName, { color: palette.text, fontFamily: palette.fontDisplayItalic }]}>
            {palette.name}
          </Text>
        </View>
        <Text style={[s.colTagline, { color: palette.textMuted, fontFamily: palette.fontMedium }]}>
          {palette.tagline}
        </Text>
        <Text style={[s.colBullet, { color: palette.textSoft, fontFamily: palette.fontRegular }]}>
          {palette.bullet}
        </Text>
      </View>

      {/* Live components */}
      <View style={s.colBody}>
        <HeroToday p={palette} />
        <GrowthBannerActive p={palette} />
        <GrowthBannerQuiet p={palette} />
        <StatsTriplet p={palette} />
        <ActionRow p={palette} />
      </View>

      {/* Footer with swatches + pick button */}
      <View style={[s.colFooter, { borderTopColor: palette.hairline }]}>
        <ColorSwatches p={palette} />
        {palette.key !== 'current' ? (
          <Pressable
            onPress={() => onPick(palette.key)}
            style={({ pressed }) => [
              s.pickBtn,
              {
                backgroundColor: highlighted ? palette.primary : palette.surface,
                borderColor: palette.primary,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Text
              style={[
                s.pickBtnLabel,
                {
                  color: highlighted ? palette.onPrimary : palette.primary,
                  fontFamily: palette.fontBold,
                },
              ]}
            >
              {highlighted ? '✓ Sélectionnée' : 'Choisir cette direction'}
            </Text>
          </Pressable>
        ) : (
          <View style={{ height: 8 }} />
        )}
      </View>
    </View>
  );
}

// ─── Fantasy palettes ───────────────────────────────────────────────────────
//
// These three directions push way past the pragmatic A/B/C. They're not
// "tweak the warm grey" but "what if the app had a real point of view" —
// a paper journal, a vintage star chart, a brutalist designer object.
//
// Each scene is full-width with its own decor system, not a column. Skim
// them as moods rather than swatch comparisons.

const FANTASY = {
  carnet: {
    key: 'D' as const,
    name: 'Carnet d\'aquarelle',
    poetic: 'Comme un journal peint à la main',
    bg: '#FAF3E8',
    surface: '#FFFFFF',
    paper: '#FBF5EC',
    text: '#3A2F2C',
    textMuted: '#5A4945',
    textSoft: '#8C766F',
    primary: '#A8624D',
    primaryDark: '#7E4533',
    rose: '#E8A8A8',
    sage: '#9DAB8E',
    ochre: '#D4A857',
    border: 'rgba(168, 98, 77, 0.22)',
    shadow: 'rgba(94, 53, 41, 0.18)',
  },
  cosmo: {
    key: 'E' as const,
    name: 'Cosmographie',
    poetic: 'Une carte céleste pour mesurer le temps',
    bg: '#0F1729',
    bgDeep: '#080D18',
    surface: '#F5EDD8',
    text: '#F5EDD8',
    textOnCard: '#1F1A14',
    textMuted: '#A89878',
    textSoft: '#7A6E58',
    primary: '#D4A857',
    primaryGlow: 'rgba(212, 168, 87, 0.18)',
    starDim: 'rgba(245, 237, 216, 0.30)',
    star: 'rgba(245, 237, 216, 0.85)',
    accentSlate: '#7A8B9C',
    border: 'rgba(212, 168, 87, 0.30)',
    cardBorder: 'rgba(31, 26, 20, 0.18)',
    shadow: 'rgba(0, 0, 0, 0.50)',
  },
  brutal: {
    key: 'F' as const,
    name: 'Brutalisme tendre',
    poetic: 'Designer-energy, sans s\'excuser',
    bg: '#F2EDE5',
    surface: '#FFFFFF',
    text: '#0C0A09',
    textMuted: '#3F3A35',
    textSoft: '#7A6F65',
    primary: '#C2410C',
    primaryDark: '#9A3308',
    accent: '#1C1917',
    border: '#0C0A09',
    surfaceTint: '#FBF7F0',
  },
};

// ─── Decorative atoms ───────────────────────────────────────────────────────

// All decorative atoms accept either a px number or a percent string for
// positioning. RN Web handles both at runtime, but the strict types only
// allow `${number}%` template literals — we cast to ViewStyle's expected
// shape to keep the call-sites readable.

type PosValue = number | string;

/** Watercolor wash: a soft circle with very low opacity, layered with siblings. */
function Wash({ color, size, top, left, opacity = 0.35 }: {
  color: string;
  size: number;
  top: PosValue;
  left: PosValue;
  opacity?: number;
}) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        opacity,
        top,
        left,
      } as any}
    />
  );
}

/** Concentric orbital ring — for the cosmo scene. */
function Orbit({ size, top, left, color, thickness = 1, opacity = 0.25 }: {
  size: number;
  top: PosValue;
  left: PosValue;
  color: string;
  thickness?: number;
  opacity?: number;
}) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: thickness,
        borderColor: color,
        opacity,
        top,
        left,
      } as any}
    />
  );
}

/** Tiny star — used to dust the cosmo background. */
function Star({ top, left, size = 2, color, opacity = 0.7 }: {
  top: PosValue;
  left: PosValue;
  size?: number;
  color: string;
  opacity?: number;
}) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        opacity,
        top,
        left,
      } as any}
    />
  );
}

/** Masking tape strip — used to "tape" the carnet cards to the page. */
function TapeStrip({ color, top, left, width, rotate }: {
  color: string;
  top: PosValue;
  left: PosValue;
  width: number;
  rotate: string;
}) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width,
        height: 22,
        backgroundColor: color,
        opacity: 0.55,
        transform: [{ rotate }],
        top,
        left,
      } as any}
    />
  );
}

// ─── Scene D · Carnet d'aquarelle ───────────────────────────────────────────

function CarnetScene({ picked, onPick }: { picked: boolean; onPick: () => void }) {
  const c = FANTASY.carnet;
  return (
    <View
      style={[
        sf.scene,
        {
          backgroundColor: c.bg,
          borderColor: picked ? c.primary : 'transparent',
          borderWidth: picked ? 3 : 0,
        },
      ]}
    >
      {/* Watercolor washes scattered like wet pigment on paper */}
      <Wash color={c.rose} size={280} top={-80} left={-60} opacity={0.30} />
      <Wash color={c.sage} size={220} top={40} left="60%" opacity={0.28} />
      <Wash color={c.ochre} size={180} top="55%" left={-40} opacity={0.22} />
      <Wash color={c.rose} size={140} top="70%" left="75%" opacity={0.22} />

      {/* Tape strips — top corners */}
      <TapeStrip color={c.ochre} top={20} left={36} width={110} rotate="-8deg" />
      <TapeStrip color={c.sage} top={28} left="78%" width={90} rotate="6deg" />

      <View style={sf.sceneInner}>
        <View style={sf.sceneHeader}>
          <Text style={[sf.sceneEyebrow, { color: c.textSoft, fontFamily: 'Manrope_500Medium' }]}>
            DIRECTION D · OFFRANDE PAPIER
          </Text>
          <Text style={[sf.sceneTitle, { color: c.text, fontFamily: 'Fraunces_300Light_Italic' }]}>
            {c.name}
          </Text>
          <Text style={[sf.scenePoetic, { color: c.primaryDark, fontFamily: 'Fraunces_300Light_Italic' }]}>
            {c.poetic}
          </Text>
          <Text style={[sf.sceneDesc, { color: c.textMuted, fontFamily: 'Manrope_400Regular' }]}>
            Le quotidien comme un cahier qu'on garde précieusement. Lavis pastels qui
            se touchent à peine, scotch couleur tenant les souvenirs, pages blanches
            qui respirent. Charlie comme une chronique tendre, manuscrite.
          </Text>
        </View>

        <View style={sf.sceneBody}>
          {/* Card: hand-painted journal entry */}
          <View
            style={[
              sf.carnetCard,
              { backgroundColor: c.surface, borderColor: c.border, shadowColor: c.shadow },
            ]}
          >
            <View style={[sf.carnetStamp, { borderColor: c.primary }]}>
              <Text style={[sf.carnetStampText, { color: c.primary, fontFamily: 'Fraunces_300Light_Italic' }]}>
                ce matin
              </Text>
            </View>
            <Text style={[sf.carnetCardEyebrow, { color: c.textSoft, fontFamily: 'Manrope_500Medium' }]}>
              JOURNAL · 7H42
            </Text>
            <Text style={[sf.carnetCardTitle, { color: c.text, fontFamily: 'Fraunces_300Light_Italic' }]}>
              Charlie a sourcé la lumière
            </Text>
            <View style={[sf.dashedDivider, { borderColor: c.border }]} />
            <Text style={[sf.carnetBody, { color: c.textMuted, fontFamily: 'Manrope_400Regular' }]}>
              Trois tétées espacées, une sieste tranquille. La maison sent encore le
              tilleul du dîner d'hier. Tout va bien.
            </Text>
            <View style={sf.carnetMetaRow}>
              <View style={[sf.miniBadge, { backgroundColor: c.rose }]} />
              <Text style={[sf.metaText, { color: c.textSoft, fontFamily: 'Manrope_500Medium' }]}>
                14H DE SOMMEIL · 8 TÉTÉES
              </Text>
            </View>
          </View>

          {/* Mini palette ribbon */}
          <View style={sf.carnetPalette}>
            {[
              { c: c.rose, label: 'Rose lavé' },
              { c: c.sage, label: 'Sauge fanée' },
              { c: c.ochre, label: 'Ocre miel' },
              { c: c.primary, label: 'Terre cuite' },
              { c: c.text, label: 'Encre brune' },
            ].map((item) => (
              <View key={item.c} style={sf.carnetPaletteItem}>
                <View
                  style={[
                    sf.carnetPaletteChip,
                    { backgroundColor: item.c, borderColor: c.border },
                  ]}
                />
                <Text style={[sf.carnetPaletteLabel, { color: c.textSoft, fontFamily: 'Manrope_500Medium' }]}>
                  {item.label}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <Pressable
          onPress={onPick}
          style={({ pressed }) => [
            sf.scenePickBtn,
            {
              backgroundColor: picked ? c.primary : 'transparent',
              borderColor: c.primary,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text
            style={[
              sf.scenePickLabel,
              {
                color: picked ? '#FFFFFF' : c.primary,
                fontFamily: 'Fraunces_300Light_Italic',
              },
            ]}
          >
            {picked ? '✓ J\'épingle ce carnet' : 'Choisir cette direction'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Scene E · Cosmographie ─────────────────────────────────────────────────

function CosmoScene({ picked, onPick }: { picked: boolean; onPick: () => void }) {
  const c = FANTASY.cosmo;
  // Scattered stars — fixed positions for stable rendering
  const stars: Array<{ top: string | number; left: string | number; size?: number; opacity?: number }> = [
    { top: '8%', left: '12%', size: 2, opacity: 0.7 },
    { top: '14%', left: '32%', size: 1, opacity: 0.5 },
    { top: '6%', left: '58%', size: 3, opacity: 0.85 },
    { top: '20%', left: '78%', size: 2, opacity: 0.6 },
    { top: '38%', left: '8%', size: 1, opacity: 0.5 },
    { top: '52%', left: '24%', size: 2, opacity: 0.7 },
    { top: '74%', left: '48%', size: 1, opacity: 0.45 },
    { top: '88%', left: '14%', size: 2, opacity: 0.6 },
    { top: '82%', left: '72%', size: 3, opacity: 0.8 },
    { top: '64%', left: '88%', size: 1, opacity: 0.5 },
    { top: '24%', left: '92%', size: 2, opacity: 0.55 },
    { top: '46%', left: '64%', size: 1, opacity: 0.4 },
  ];
  return (
    <View
      style={[
        sf.scene,
        {
          backgroundColor: c.bg,
          borderColor: picked ? c.primary : 'transparent',
          borderWidth: picked ? 3 : 0,
        },
      ]}
    >
      {/* Concentric orbital rings — large, anchored bottom-right */}
      <Orbit size={520} top="40%" left="50%" color={c.primary} thickness={1} opacity={0.20} />
      <Orbit size={380} top="48%" left="58%" color={c.primary} thickness={1} opacity={0.30} />
      <Orbit size={240} top="56%" left="66%" color={c.primary} thickness={1} opacity={0.45} />
      <Orbit size={120} top="64%" left="74%" color={c.primary} thickness={1} opacity={0.6} />

      {/* Soft glow center for the orbits */}
      <Wash color={c.primary} size={80} top="71%" left="78%" opacity={0.4} />

      {/* Star field */}
      {stars.map((star, i) => (
        <Star
          key={i}
          top={star.top}
          left={star.left}
          size={star.size}
          color={c.star}
          opacity={star.opacity}
        />
      ))}

      <View style={sf.sceneInner}>
        <View style={sf.sceneHeader}>
          <Text style={[sf.sceneEyebrow, { color: c.primary, fontFamily: 'Manrope_500Medium' }]}>
            DIRECTION E · OBSERVATOIRE
          </Text>
          <Text style={[sf.sceneTitle, { color: c.text, fontFamily: 'Fraunces_300Light_Italic' }]}>
            {c.name}
          </Text>
          <Text style={[sf.scenePoetic, { color: c.primary, fontFamily: 'Fraunces_300Light_Italic' }]}>
            {c.poetic}
          </Text>
          <Text style={[sf.sceneDesc, { color: c.textMuted, fontFamily: 'Manrope_400Regular' }]}>
            La nuit comme métaphore. Les rythmes du nourrisson en orbites concentriques,
            tétées comme étoiles, sommeil comme constellations. Cartes de papier ivoire
            posées sur un ciel d'encre — feuille d'or pour les détails qui comptent.
          </Text>
        </View>

        <View style={sf.sceneBody}>
          {/* Cream parchment card floating in midnight */}
          <View
            style={[
              sf.cosmoCard,
              { backgroundColor: c.surface, borderColor: c.cardBorder, shadowColor: c.shadow },
            ]}
          >
            <View style={sf.cosmoCardHeader}>
              <Text style={[sf.cosmoEyebrow, { color: c.textSoft, fontFamily: 'Manrope_700Bold' }]}>
                ✦ CARTE CÉLESTE — JOUR 84
              </Text>
              <View style={[sf.cosmoOrbitBadge, { borderColor: c.primary }]}>
                <View style={[sf.cosmoOrbitDot, { backgroundColor: c.primary }]} />
              </View>
            </View>
            <Text style={[sf.cosmoTitle, { color: c.textOnCard, fontFamily: 'Fraunces_300Light_Italic' }]}>
              Pic de croissance imminent
            </Text>
            <Text style={[sf.cosmoBody, { color: c.textOnCard, fontFamily: 'Manrope_400Regular' }]}>
              Les signaux convergent : tétées rapprochées, sommeil fragmenté.
              La fenêtre des trois mois s'ouvre.
            </Text>
            <View style={[sf.cosmoOrnament, { backgroundColor: c.primary }]} />
            <View style={sf.cosmoStatGrid}>
              {[
                { label: '✦ TÉTÉES', value: '8' },
                { label: '☾ SOMMEIL', value: '14h' },
                { label: '○ COUCHES', value: '6' },
              ].map((stat) => (
                <View key={stat.label} style={sf.cosmoStat}>
                  <Text style={[sf.cosmoStatLabel, { color: c.textSoft, fontFamily: 'Manrope_500Medium' }]}>
                    {stat.label}
                  </Text>
                  <Text style={[sf.cosmoStatValue, { color: c.primary, fontFamily: 'Fraunces_300Light_Italic' }]}>
                    {stat.value}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* Gold detail strip */}
          <View style={sf.cosmoFooterRow}>
            <View style={[sf.cosmoGoldDot, { backgroundColor: c.primary }]} />
            <Text style={[sf.cosmoFooterLabel, { color: c.text, fontFamily: 'Manrope_500Medium' }]}>
              Indigo · Or · Ivoire · Slate
            </Text>
            <View style={[sf.cosmoGoldDot, { backgroundColor: c.primary }]} />
          </View>
        </View>

        <Pressable
          onPress={onPick}
          style={({ pressed }) => [
            sf.scenePickBtn,
            {
              backgroundColor: picked ? c.primary : 'transparent',
              borderColor: c.primary,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text
            style={[
              sf.scenePickLabel,
              {
                color: picked ? c.bgDeep : c.primary,
                fontFamily: 'Fraunces_300Light_Italic',
              },
            ]}
          >
            {picked ? '✓ Suivre cette étoile' : 'Choisir cette direction'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Scene F · Brutalisme tendre ────────────────────────────────────────────

function BrutalScene({ picked, onPick }: { picked: boolean; onPick: () => void }) {
  const c = FANTASY.brutal;
  return (
    <View
      style={[
        sf.scene,
        {
          backgroundColor: c.bg,
          borderColor: picked ? c.primary : c.border,
          borderWidth: picked ? 3 : 2,
        },
      ]}
    >
      {/* Massive italic backdrop letter */}
      <Text
        pointerEvents="none"
        style={[
          sf.brutalBackdrop,
          { color: c.text, fontFamily: 'Fraunces_300Light_Italic' },
        ]}
      >
        C
      </Text>

      {/* Bold accent square decoration */}
      <View style={[sf.brutalSquare, { backgroundColor: c.primary }]} />
      <View style={[sf.brutalSquareSm, { borderColor: c.text }]} />

      <View style={sf.sceneInner}>
        <View style={sf.sceneHeader}>
          <View style={sf.brutalEyebrowRow}>
            <View style={[sf.brutalDot, { backgroundColor: c.primary }]} />
            <Text style={[sf.sceneEyebrow, { color: c.text, fontFamily: 'Manrope_800ExtraBold' }]}>
              DIRECTION F / BRUTALIST PARENTING
            </Text>
          </View>
          <Text
            style={[
              sf.sceneTitle,
              {
                color: c.text,
                fontFamily: 'Fraunces_300Light_Italic',
                fontSize: 64,
                lineHeight: 64,
                letterSpacing: -2,
              },
            ]}
          >
            {c.name}
          </Text>
          <Text style={[sf.scenePoetic, { color: c.primary, fontFamily: 'Manrope_700Bold' }]}>
            {c.poetic.toUpperCase()}
          </Text>
          <Text style={[sf.sceneDesc, { color: c.textMuted, fontFamily: 'Manrope_400Regular' }]}>
            On arrête de chuchoter. Bordures épaisses, italiques tranchées,
            une seule couleur d'accent qui claque. Less Aesop, more Bernhardt.
            Pour les parents qui font Linear et Are.na.
          </Text>
        </View>

        <View style={sf.sceneBody}>
          {/* Heavy-bordered card */}
          <View
            style={[
              sf.brutalCard,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            <View style={[sf.brutalCardCorner, { backgroundColor: c.primary }]} />
            <View style={[sf.brutalLabel, { borderColor: c.text }]}>
              <Text style={[sf.brutalLabelText, { color: c.text, fontFamily: 'Manrope_800ExtraBold' }]}>
                ANALYSE / 78
              </Text>
            </View>
            <Text
              style={[
                sf.brutalCardTitle,
                {
                  color: c.text,
                  fontFamily: 'Fraunces_300Light_Italic',
                },
              ]}
            >
              Pic probable.
            </Text>
            <Text style={[sf.brutalCardBody, { color: c.textMuted, fontFamily: 'Manrope_500Medium' }]}>
              Tétées rapprochées (×2/6h). Sommeil fragmenté. Couches en hausse.
              Fenêtre 3 mois ouverte.
            </Text>
            <View style={[sf.brutalThickRule, { backgroundColor: c.text }]} />
            <View style={sf.brutalStatStack}>
              <View style={sf.brutalBigStat}>
                <Text style={[sf.brutalBigStatValue, { color: c.text, fontFamily: 'Fraunces_300Light_Italic' }]}>
                  78
                </Text>
                <Text style={[sf.brutalBigStatLabel, { color: c.textSoft, fontFamily: 'Manrope_700Bold' }]}>
                  CONFIANCE / 100
                </Text>
              </View>
              <View style={sf.brutalSmallStats}>
                <View style={sf.brutalSmallStat}>
                  <Text style={[sf.brutalSmallStatValue, { color: c.text, fontFamily: 'Manrope_800ExtraBold' }]}>
                    8
                  </Text>
                  <Text style={[sf.brutalSmallStatLabel, { color: c.textSoft, fontFamily: 'Manrope_500Medium' }]}>
                    TÉTÉES
                  </Text>
                </View>
                <View style={sf.brutalSmallStat}>
                  <Text style={[sf.brutalSmallStatValue, { color: c.text, fontFamily: 'Manrope_800ExtraBold' }]}>
                    14h
                  </Text>
                  <Text style={[sf.brutalSmallStatLabel, { color: c.textSoft, fontFamily: 'Manrope_500Medium' }]}>
                    SOMMEIL
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Manifesto strip */}
          <View style={[sf.brutalManifesto, { borderColor: c.text }]}>
            <Text style={[sf.brutalManifestoText, { color: c.text, fontFamily: 'Fraunces_300Light_Italic' }]}>
              «&nbsp;Tracker bébé n'a pas besoin d'être joli. Ça doit être&nbsp;
              <Text style={{ fontFamily: 'Manrope_800ExtraBold', fontStyle: 'normal' }}>HONNÊTE</Text>.&nbsp;»
            </Text>
          </View>
        </View>

        <Pressable
          onPress={onPick}
          style={({ pressed }) => [
            sf.scenePickBtn,
            {
              backgroundColor: picked ? c.primary : c.surface,
              borderColor: c.text,
              borderWidth: 2,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text
            style={[
              sf.scenePickLabel,
              {
                color: picked ? '#FFFFFF' : c.text,
                fontFamily: 'Manrope_800ExtraBold',
                letterSpacing: 0.6,
              },
            ]}
          >
            {picked ? '✓ ASSUMÉ' : 'CHOISIR / DIRECTION F'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Fantasy section wrapper ────────────────────────────────────────────────

function FantasySection({
  picked,
  onPick,
}: {
  picked: 'D' | 'E' | 'F' | null;
  onPick: (k: 'D' | 'E' | 'F') => void;
}) {
  return (
    <View style={sf.fantasyWrap}>
      <View style={sf.fantasyDivider}>
        <View style={sf.fantasyDividerLine} />
        <Text style={sf.fantasyDividerLabel}>ET SI ON OSAIT DAVANTAGE</Text>
        <View style={sf.fantasyDividerLine} />
      </View>

      <Text style={sf.fantasyIntro}>
        Trois directions qui ne rentrent pas dans la grille pragmatique du
        haut. Pas des palettes — des partis-pris. À regarder comme des
        spreads de magazine, pas des swatches.
      </Text>

      <View style={sf.scenes}>
        <CarnetScene picked={picked === 'D'} onPick={() => onPick('D')} />
        <CosmoScene picked={picked === 'E'} onPick={() => onPick('E')} />
        <BrutalScene picked={picked === 'F'} onPick={() => onPick('F')} />
      </View>
    </View>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function DesignDemo() {
  const { width } = useWindowDimensions();
  const stacked = width < 1100;
  const [picked, setPicked] = useState<DemoPalette['key'] | null>(null);
  const [fantasyPicked, setFantasyPicked] = useState<'D' | 'E' | 'F' | null>(null);
  const intro = PALETTES[0]; // use Current's fonts/colors for the page chrome

  return (
    <>
      <Stack.Screen options={{ title: 'Design demo', headerShown: false }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: intro.background }}
        contentContainerStyle={s.page}
      >
        {/* Page header */}
        <View style={s.pageHeader}>
          <Text
            style={[s.eyebrow, { color: intro.textSoft, fontFamily: intro.fontMedium }]}
          >
            ATELIER · CHARLIE
          </Text>
          <Text
            style={[s.pageTitle, { color: intro.text, fontFamily: intro.fontDisplayItalic }]}
          >
            Trois directions pour le design
          </Text>
          <Text
            style={[s.pageSub, { color: intro.textMuted, fontFamily: intro.fontRegular }]}
          >
            Mêmes composants, mêmes données, trois palettes. Choisis celle qui te
            parle — ce que tu sélectionnes ici me dit dans quelle direction
            propager les changements à toute l'app.
          </Text>
        </View>

        {/* Picked indicator */}
        {picked || fantasyPicked ? (
          <View
            style={[
              s.pickedBanner,
              { backgroundColor: intro.primary, shadowColor: intro.shadow },
            ]}
          >
            <Text style={[s.pickedLabel, { color: intro.onPrimary, fontFamily: intro.fontBold }]}>
              ✓ Direction {fantasyPicked ?? picked} sélectionnée
            </Text>
            <Text style={[s.pickedHint, { color: intro.onPrimary, fontFamily: intro.fontRegular }]}>
              Reviens dans le chat et dis-moi : « j'ai choisi {fantasyPicked ?? picked} » — je
              propage l'identité visuelle complète à l'app.
            </Text>
          </View>
        ) : null}

        {/* Columns */}
        <View style={[s.columns, stacked && s.columnsStacked]}>
          {PALETTES.map((palette) => (
            <PalettePreview
              key={palette.key}
              palette={palette}
              highlighted={picked === palette.key}
              onPick={setPicked}
            />
          ))}
        </View>

        {/* Trade-offs table */}
        <View
          style={[
            s.tradeoffs,
            {
              backgroundColor: intro.surface,
              borderColor: intro.cardBorder,
              shadowColor: intro.shadow,
            },
          ]}
        >
          <Text
            style={[s.tradeoffsTitle, { color: intro.text, fontFamily: intro.fontDisplayItalic }]}
          >
            Compromis en un coup d'œil
          </Text>
          <View style={s.tradeoffsList}>
            {[
              {
                opt: 'A',
                label: 'Resserrer',
                pros: 'Identité préservée. Effort 30 min. Risque zéro.',
                cons: 'Reste discret — pas le saut visuel que tu cherches peut-être.',
              },
              {
                opt: 'B',
                label: 'Éditorial assumé',
                pros: 'Personnalité forte, hiérarchie claire, ADN warm respecté.',
                cons: 'Plus de mordant — peut sembler moins « apaisant » qu\'avant.',
              },
              {
                opt: 'C',
                label: 'Pivot neutre',
                pros: 'Lisibilité maximale, esprit iOS moderne, rigueur.',
                cons: 'Tu perds le chaud-éditorial. Effort 2-3h, plus de fichiers à toucher.',
              },
            ].map((row) => (
              <View key={row.opt} style={[s.tradeoffRow, { borderTopColor: intro.hairline }]}>
                <View
                  style={[
                    s.tradeoffBadge,
                    { backgroundColor: intro.primarySoft, borderColor: intro.cardBorder },
                  ]}
                >
                  <Text
                    style={[s.tradeoffBadgeLabel, { color: intro.primary, fontFamily: intro.fontBold }]}
                  >
                    {row.opt}
                  </Text>
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={[s.tradeoffLabel, { color: intro.text, fontFamily: intro.fontSemiBold }]}>
                    {row.label}
                  </Text>
                  <Text style={[s.tradeoffPros, { color: intro.textMuted, fontFamily: intro.fontRegular }]}>
                    + {row.pros}
                  </Text>
                  <Text style={[s.tradeoffCons, { color: intro.textSoft, fontFamily: intro.fontRegular }]}>
                    − {row.cons}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Fantasy section — bolder, more poetic */}
        <FantasySection picked={fantasyPicked} onPick={setFantasyPicked} />

        {/* Footer note */}
        <Text
          style={[
            s.footerNote,
            { color: intro.textSoft, fontFamily: intro.fontRegular },
          ]}
        >
          Cette page est un terrain de comparaison — elle ne modifie pas le theme
          global de l'app. Quand tu auras choisi, je migre `src/constants/theme.ts`
          et je propage l'identité aux composants critiques.
        </Text>
      </ScrollView>
    </>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: {
    paddingVertical: 40,
    paddingHorizontal: 24,
    gap: 32,
    maxWidth: 1600,
    alignSelf: 'center',
    width: '100%',
  },
  pageHeader: {
    gap: 8,
    maxWidth: 720,
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  pageTitle: {
    fontSize: 42,
    letterSpacing: -1,
    lineHeight: 48,
  },
  pageSub: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 4,
  },
  pickedBanner: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 16,
    gap: 4,
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  pickedLabel: {
    fontSize: 14,
    letterSpacing: 0.3,
  },
  pickedHint: {
    fontSize: 13,
    opacity: 0.92,
    lineHeight: 18,
  },
  columns: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'stretch',
  },
  columnsStacked: {
    flexDirection: 'column',
  },
  column: {
    flex: 1,
    minWidth: 280,
    borderRadius: 24,
    padding: 18,
    gap: 18,
    overflow: 'hidden',
  },
  colHeader: {
    gap: 6,
  },
  colHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  colBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  colBadgeLabel: {
    fontSize: 10,
    letterSpacing: 1,
  },
  colName: {
    fontSize: 24,
    letterSpacing: -0.5,
    flexShrink: 1,
  },
  colTagline: {
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.1,
  },
  colBullet: {
    fontSize: 12,
    lineHeight: 16,
    opacity: 0.85,
  },
  colBody: {
    gap: 12,
  },
  colFooter: {
    gap: 14,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  // Card primitives
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    paddingLeft: 18,
    gap: 8,
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    position: 'relative',
    overflow: 'hidden',
  },
  accentStripe: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  heroTitle: {
    fontSize: 26,
    letterSpacing: -0.6,
    lineHeight: 30,
  },
  heroBody: {
    fontSize: 13,
    lineHeight: 19,
  },
  divider: {
    height: 1,
    marginVertical: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  miniDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  metaLine: {
    fontSize: 11,
    letterSpacing: 0.2,
  },
  // Banner
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
  bannerTitle: {
    fontSize: 18,
    letterSpacing: -0.3,
  },
  bannerSub: {
    fontSize: 11.5,
    letterSpacing: 0.1,
    marginTop: 1,
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
  },
  ctaPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
    marginTop: 6,
  },
  ctaLabel: {
    fontSize: 12,
    letterSpacing: 0.2,
  },
  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 4,
    shadowOpacity: 0.10,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  statLabel: {
    fontSize: 9,
    letterSpacing: 0.8,
  },
  statValue: {
    fontSize: 24,
    letterSpacing: -0.5,
  },
  // Buttons
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  btnPrimary: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
  },
  btnPrimaryLabel: {
    fontSize: 13,
    letterSpacing: 0.3,
  },
  btnGhost: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
  },
  btnGhostLabel: {
    fontSize: 13,
    letterSpacing: 0.3,
  },
  // Swatches
  swatchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  swatchItem: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 3,
    minWidth: 56,
  },
  swatchChip: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
  },
  swatchLabel: {
    fontSize: 9,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  swatchHex: {
    fontSize: 10,
    letterSpacing: 0.2,
    opacity: 0.85,
  },
  pickBtn: {
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  pickBtnLabel: {
    fontSize: 13,
    letterSpacing: 0.3,
  },
  // Trade-offs
  tradeoffs: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    gap: 18,
    shadowOpacity: 0.10,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  tradeoffsTitle: {
    fontSize: 26,
    letterSpacing: -0.6,
  },
  tradeoffsList: {
    gap: 0,
  },
  tradeoffRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tradeoffBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    minWidth: 36,
    alignItems: 'center',
  },
  tradeoffBadgeLabel: {
    fontSize: 11,
    letterSpacing: 0.6,
  },
  tradeoffLabel: {
    fontSize: 15,
    letterSpacing: -0.1,
  },
  tradeoffPros: {
    fontSize: 13,
    lineHeight: 18,
  },
  tradeoffCons: {
    fontSize: 13,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  footerNote: {
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    opacity: 0.7,
    maxWidth: 600,
    alignSelf: 'center',
  },
});

// ─── Fantasy styles (sf) ────────────────────────────────────────────────────

const sf = StyleSheet.create({
  // Wrapper
  fantasyWrap: {
    gap: 24,
    marginTop: 24,
  },
  fantasyDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 16,
    marginBottom: 4,
  },
  fantasyDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(42, 35, 36, 0.18)',
  },
  fantasyDividerLabel: {
    fontSize: 11,
    letterSpacing: 2.4,
    color: '#2A2324',
    fontFamily: 'Manrope_700Bold',
  },
  fantasyIntro: {
    fontSize: 15,
    lineHeight: 22,
    color: '#534547',
    fontFamily: 'Fraunces_300Light_Italic',
    maxWidth: 720,
    fontStyle: 'italic',
  },
  scenes: {
    gap: 28,
  },
  // Generic scene shell
  scene: {
    borderRadius: 32,
    overflow: 'hidden',
    position: 'relative',
    minHeight: 540,
  },
  sceneInner: {
    padding: 40,
    gap: 28,
    position: 'relative',
    zIndex: 2,
  },
  sceneHeader: {
    gap: 8,
    maxWidth: 720,
  },
  sceneEyebrow: {
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  sceneTitle: {
    fontSize: 56,
    letterSpacing: -1.4,
    lineHeight: 60,
  },
  scenePoetic: {
    fontSize: 20,
    letterSpacing: -0.2,
    lineHeight: 26,
    marginTop: 4,
  },
  sceneDesc: {
    fontSize: 14,
    lineHeight: 22,
    marginTop: 10,
    maxWidth: 620,
  },
  sceneBody: {
    gap: 20,
  },
  scenePickBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 999,
    borderWidth: 1.5,
    marginTop: 8,
  },
  scenePickLabel: {
    fontSize: 16,
    letterSpacing: 0.2,
  },

  // ─── Carnet d'aquarelle ────────────────────────────────────────────────
  carnetCard: {
    maxWidth: 560,
    borderRadius: 6,
    borderWidth: 1,
    padding: 28,
    paddingTop: 32,
    gap: 12,
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
    transform: [{ rotate: '-0.4deg' }],
    position: 'relative',
  },
  carnetStamp: {
    position: 'absolute',
    top: -14,
    right: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1.5,
    backgroundColor: '#FFFFFF',
    transform: [{ rotate: '4deg' }],
  },
  carnetStampText: {
    fontSize: 13,
    letterSpacing: 0.2,
  },
  carnetCardEyebrow: {
    fontSize: 10,
    letterSpacing: 1.8,
  },
  carnetCardTitle: {
    fontSize: 30,
    letterSpacing: -0.6,
    lineHeight: 34,
  },
  dashedDivider: {
    height: 0,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    marginVertical: 4,
  },
  carnetBody: {
    fontSize: 14,
    lineHeight: 22,
  },
  carnetMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  miniBadge: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  metaText: {
    fontSize: 10,
    letterSpacing: 1.4,
  },
  carnetPalette: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 18,
    maxWidth: 560,
  },
  carnetPaletteItem: {
    alignItems: 'center',
    gap: 6,
    minWidth: 70,
  },
  carnetPaletteChip: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
  },
  carnetPaletteLabel: {
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },

  // ─── Cosmographie ──────────────────────────────────────────────────────
  cosmoCard: {
    maxWidth: 540,
    borderRadius: 18,
    borderWidth: 1,
    padding: 28,
    gap: 14,
    shadowOpacity: 0.5,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 16 },
    elevation: 8,
  },
  cosmoCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  cosmoEyebrow: {
    fontSize: 10,
    letterSpacing: 1.8,
  },
  cosmoOrbitBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cosmoOrbitDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  cosmoTitle: {
    fontSize: 32,
    letterSpacing: -0.6,
    lineHeight: 36,
  },
  cosmoBody: {
    fontSize: 14,
    lineHeight: 22,
  },
  cosmoOrnament: {
    height: 1,
    marginVertical: 8,
    opacity: 0.5,
  },
  cosmoStatGrid: {
    flexDirection: 'row',
    gap: 24,
    marginTop: 4,
  },
  cosmoStat: {
    gap: 4,
  },
  cosmoStatLabel: {
    fontSize: 9,
    letterSpacing: 1.2,
  },
  cosmoStatValue: {
    fontSize: 32,
    letterSpacing: -0.6,
  },
  cosmoFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 6,
  },
  cosmoGoldDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  cosmoFooterLabel: {
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },

  // ─── Brutalisme tendre ─────────────────────────────────────────────────
  brutalBackdrop: {
    position: 'absolute',
    fontSize: 600,
    lineHeight: 600,
    top: -120,
    right: -100,
    opacity: 0.06,
    zIndex: 1,
    fontStyle: 'italic',
  },
  brutalSquare: {
    position: 'absolute',
    width: 80,
    height: 80,
    bottom: 60,
    right: 80,
    zIndex: 1,
  },
  brutalSquareSm: {
    position: 'absolute',
    width: 40,
    height: 40,
    bottom: 110,
    right: 60,
    borderWidth: 2,
    zIndex: 1,
  },
  brutalEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brutalDot: {
    width: 10,
    height: 10,
  },
  brutalCard: {
    maxWidth: 580,
    borderWidth: 2,
    padding: 32,
    gap: 14,
    position: 'relative',
  },
  brutalCardCorner: {
    position: 'absolute',
    width: 24,
    height: 24,
    top: -12,
    left: -12,
  },
  brutalLabel: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 2,
  },
  brutalLabelText: {
    fontSize: 10,
    letterSpacing: 1.4,
  },
  brutalCardTitle: {
    fontSize: 48,
    letterSpacing: -1,
    lineHeight: 52,
  },
  brutalCardBody: {
    fontSize: 15,
    lineHeight: 22,
  },
  brutalThickRule: {
    height: 4,
    marginVertical: 10,
  },
  brutalStatStack: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 32,
    marginTop: 6,
  },
  brutalBigStat: {
    gap: 0,
  },
  brutalBigStatValue: {
    fontSize: 88,
    lineHeight: 84,
    letterSpacing: -3,
  },
  brutalBigStatLabel: {
    fontSize: 10,
    letterSpacing: 1.2,
    marginTop: -4,
  },
  brutalSmallStats: {
    flexDirection: 'column',
    gap: 14,
    marginTop: 12,
  },
  brutalSmallStat: {
    gap: 2,
  },
  brutalSmallStatValue: {
    fontSize: 28,
    letterSpacing: -0.5,
  },
  brutalSmallStatLabel: {
    fontSize: 10,
    letterSpacing: 1,
  },
  brutalManifesto: {
    maxWidth: 560,
    borderLeftWidth: 4,
    paddingLeft: 18,
    paddingVertical: 8,
  },
  brutalManifestoText: {
    fontSize: 22,
    lineHeight: 30,
    letterSpacing: -0.4,
  },
});
