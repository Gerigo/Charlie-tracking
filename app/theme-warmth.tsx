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
  key: 'current' | 'A' | 'B' | 'C';
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
    key: 'A',
    name: 'A — Léger',
    tagline: 'Cartes en crème (plus de blanc pur)',
    background: '#FAF3E8',
    surface: '#FBF5EC',
    surfaceRaised: '#F5EBDD',
    surfaceContainer: '#EDE2D2',
    text: '#3A2F2C',
    textMuted: '#5A4945',
    textSoft: '#8C766F',
    primary: '#A8624D',
    onPrimary: '#FFFFFF',
    border: 'rgba(168, 98, 77, 0.22)',
  },
  {
    key: 'B',
    name: 'B — Moyen',
    tagline: 'Sable clair, plus enveloppant',
    background: '#F4ECDC',
    surface: '#F8F1E1',
    surfaceRaised: '#EFE4CD',
    surfaceContainer: '#E5D7C3',
    text: '#33282A',
    textMuted: '#564541',
    textSoft: '#856E68',
    primary: '#A8624D',
    onPrimary: '#FFFFFF',
    border: 'rgba(168, 98, 77, 0.24)',
  },
  {
    key: 'C',
    name: 'C — Mid-tone',
    tagline: 'Sépia / lecture, à mi-chemin du nuit',
    background: '#ECE2CE',
    surface: '#F2E9D6',
    surfaceRaised: '#E5D9BF',
    surfaceContainer: '#D8C9AE',
    text: '#2E2520',
    textMuted: '#4F413B',
    textSoft: '#7A6760',
    primary: '#9D5743',
    onPrimary: '#FBF5EC',
    border: 'rgba(124, 70, 49, 0.28)',
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
          Comparaison des trois pistes pour adoucir le mode jour. Chaque colonne rend
          un aperçu d'écran « Aujourd'hui » avec sa propre palette ; le reste de l'app
          n'est pas affecté.
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
