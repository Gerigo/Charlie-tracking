import { Icon } from '@/src/components/ui/Icon';
import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/src/components/ui';
import { radii, spacing } from '@/src/constants/theme';
import { useAppContext } from '@/src/providers/AppProvider';
import { useAppTheme } from '@/src/providers/ThemeProvider';

export function SocialScreen() {
  const { theme } = useAppTheme();
  const { language } = useAppContext();
  const fr = language === 'fr';

  return (
    <Screen contentContainerStyle={styles.content}>
      <View
        style={[
          styles.card,
          { backgroundColor: theme.surfaceLowest, shadowColor: theme.shadow, borderColor: theme.hairline },
        ]}
      >
        <View style={[styles.iconWrap, { backgroundColor: `${theme.evolution}22` }]}>
          <Icon name="heart-outline" size={40} color={theme.evolution} />
        </View>
        <Text style={[styles.title, { color: theme.text, fontFamily: theme.fontSemiBold }]}>
          {fr ? 'Bientôt disponible' : 'Coming soon'}
        </Text>
        <Text style={[styles.body, { color: theme.textMuted, fontFamily: theme.fontRegular }]}>
          {fr
            ? 'Un espace pour partager les moments forts de la famille : photos, jalons, anecdotes. Restez à l\'affût.'
            : 'A space to share family highlights: photos, milestones, anecdotes. Stay tuned.'}
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    gap: spacing.lg,
  },
  card: {
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    letterSpacing: -0.3,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
