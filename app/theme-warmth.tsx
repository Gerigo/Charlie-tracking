/**
 * Day-mode warmth comparison — `/theme-warmth`
 *
 * Three side-by-side previews of palette tweaks aimed at making the light
 * theme feel less "blanc clinique". The current palette sits as a control
 * on the left so the eye can compare against today's app.
 *
 * Hidden in production via a NODE_ENV redirect — keeps the route out of
 * shipped builds without needing a separate dev-only file convention.
 */

import { Redirect, Stack } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

interface DemoPalette {
  key: 'current' | 'greige' | 'kraft' | 'twilight' | 'sunken';
  name: string;
  tagline: string;
  background: string;
  surface: string;
  surfaceRaised: string;
  surfaceContainer: string;
  text: string;
  textMuted: string;
  textSoft: string;
  primary: string;
  onPrimary: string;
  border: string;
}

const PALETTES: DemoPalette[] = [
  {
    key: 'current',
    name: 'Actuel',
    tagline: 'Référence — surfaces blanc pur sur fond crème',
    background: '#FAF3E8',
    surface: '#FFFFFF',
    surfaceRaised: '#FBF5EC',
    surfaceContainer: '#EDE2D2',
    text: '#3A2F2C',
    textMuted: '#5A4945',
    textSoft: '#8C766F',
    primary: '#A8624D',
    onPrimary: '#FFFFFF',
    border: 'rgba(168, 98, 77, 0.22)',
  },
  {
    key: 'greige',
    name: '1 — Greige moderne',
    tagline: 'Neutre chaud sans jaune, façon Notion / Linear',
    background: '#EBE7DF',
    surface: '#F2EFE8',
    surfaceRaised: '#E3DED4',
    surfaceContainer: '#D8D2C5',
    text: '#2C2825',
    textMuted: '#534D47',
    textSoft: '#857E76',
    primary: '#A8624D',
    onPrimary: '#FFFFFF',
    border: 'rgba(80, 70, 60, 0.16)',
  },
  {
    key: 'kraft',
    name: '2 — Carnet kraft',
    tagline: 'Papier brun cosy, journal de bord vintage',
    background: '#E5D5B7',
    surface: '#EFDFC0',
    surfaceRaised: '#D9C7A4',
    surfaceContainer: '#CFBA94',
    text: '#3A2A1F',
    textMuted: '#5A4634',
    textSoft: '#8B7558',
    primary: '#A8624D',
    onPrimary: '#FBF5EC',
    border: 'rgba(120, 80, 40, 0.22)',
  },
  {
    key: 'twilight',
    name: '3 — Twilight',
    tagline: 'À 30 % vers le mode nuit, sépia sombre',
    background: '#B5A78F',
    surface: '#C5B59B',
    surfaceRaised: '#A99B82',
    surfaceContainer: '#9E9079',
    text: '#2E2520',
    textMuted: '#4F413B',
    textSoft: '#7A6760',
    primary: '#9D5743',
    onPrimary: '#FBF5EC',
    border: 'rgba(60, 45, 35, 0.24)',
  },
  {
    key: 'sunken',
    name: '4 — Sunken cards',
    tagline: 'Cartes plus foncées que le fond — effet creusé',
    background: '#FBF5EC',
    surface: '#EDE2D2',
    surfaceRaised: '#E5D7C3',
    surfaceContainer: '#DBC9B0',
    text: '#3A2F2C',
    textMuted: '#5A4945',
    textSoft: '#8C766F',
    primary: '#A8624D',
    onPrimary: '#FFFFFF',
    border: 'rgba(168, 98, 77, 0.18)',
  },
];

export default function ThemeWarmthPreview() {
  if (process.env.NODE_ENV === 'production') {
    return <Redirect href="/" />;
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Theme warmth preview' }} />
      <ScrollView style={styles.page} contentContainerStyle={styles.pageContent}>
        <Text style={styles.heading}>Mode jour — chaleur des surfaces</Text>
        <Text style={styles.intro}>
          Quatre directions plus marquées que les premières propositions. Chaque colonne
          rend un aperçu d'écran « Aujourd'hui » avec sa propre palette ; le reste de
          l'app n'est pas affecté.
        </Text>
        <View style={styles.row}>
          {PALETTES.map((palette) => (
            <PaletteColumn key={palette.key} palette={palette} />
          ))}
        </View>
      </ScrollView>
    </>
  );
}

function PaletteColumn({ palette }: { palette: DemoPalette }) {
  return (
    <View style={styles.column}>
      <Text style={styles.columnName}>{palette.name}</Text>
      <Text style={styles.columnTagline}>{palette.tagline}</Text>
      <View style={[styles.preview, { backgroundColor: palette.background }]}>
        <View
          style={[
            styles.card,
            { backgroundColor: palette.surface, borderColor: palette.border },
          ]}
        >
          <Text style={[styles.cardTitle, { color: palette.text }]}>
            Charlie · 4 mois
          </Text>
          <Text style={[styles.cardSubtitle, { color: palette.textMuted }]}>
            Dernière tétée il y a 1 h 12
          </Text>

          <View style={styles.statRow}>
            {['8 tétées', '6 couches', '4 h sieste'].map((label) => (
              <View
                key={label}
                style={[
                  styles.statTile,
                  { backgroundColor: palette.surfaceRaised, borderColor: palette.border },
                ]}
              >
                <Text style={[styles.statText, { color: palette.text }]}>{label}</Text>
              </View>
            ))}
          </View>

          <View
            style={[
              styles.notice,
              { backgroundColor: palette.surfaceContainer, borderColor: palette.border },
            ]}
          >
            <Text style={[styles.noticeText, { color: palette.textMuted }]}>
              Pic de croissance probable cette semaine
            </Text>
          </View>

          <View style={[styles.button, { backgroundColor: palette.primary }]}>
            <Text style={[styles.buttonText, { color: palette.onPrimary }]}>
              Enregistrer une tétée
            </Text>
          </View>

          <Text style={[styles.footer, { color: palette.textSoft }]}>
            Synchronisé il y a quelques secondes
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#1F1814' },
  pageContent: { padding: 24, gap: 16 },
  heading: { color: '#F0E6D6', fontSize: 22, fontWeight: '600' },
  intro: { color: '#C9B8A4', fontSize: 14, lineHeight: 20, maxWidth: 720 },
  row: { flexDirection: 'row', gap: 16, flexWrap: 'wrap' },
  column: { flex: 1, minWidth: 260, gap: 8 },
  columnName: { color: '#F0E6D6', fontSize: 16, fontWeight: '600' },
  columnTagline: { color: '#9C8C7E', fontSize: 12, lineHeight: 16 },
  preview: { borderRadius: 18, padding: 16 },
  card: { borderRadius: 16, padding: 16, gap: 12, borderWidth: 1 },
  cardTitle: { fontSize: 18, fontWeight: '600' },
  cardSubtitle: { fontSize: 13 },
  statRow: { flexDirection: 'row', gap: 8 },
  statTile: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  statText: { fontSize: 12, fontWeight: '500' },
  notice: { borderRadius: 12, padding: 10, borderWidth: 1 },
  noticeText: { fontSize: 12, lineHeight: 16 },
  button: {
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  buttonText: { fontSize: 14, fontWeight: '600' },
  footer: { fontSize: 11, textAlign: 'center', marginTop: 4 },
});
