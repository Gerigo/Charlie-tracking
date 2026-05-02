import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { spacing } from '@/src/constants/theme';
import { useAppTheme } from '@/src/providers/ThemeProvider';

export default function NotFoundScreen() {
  const { theme } = useAppTheme();
  return (
    <>
      <Stack.Screen options={{ title: 'Introuvable' }} />
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={[styles.title, { color: theme.text }]}>Cette route mobile n’existe pas.</Text>

        <Link href="/" style={styles.link}>
          <Text style={[styles.linkText, { color: theme.primarySoft }]}>Revenir à l’accueil</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
  linkText: {
    fontSize: 14,
  },
});
