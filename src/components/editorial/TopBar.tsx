import { useRouter } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { editorialAssets, getBabyAvatarUri } from '@/src/constants/editorialAssets';
import { triggerSelectionFeedback } from '@/src/lib/feedback';
import { spacing } from '@/src/constants/theme';
import { useAppContext } from '@/src/providers/AppProvider';
import { useAppTheme } from '@/src/providers/ThemeProvider';
import { SyncDot } from '@/src/components/sync/SyncDot';
import { SyncErrorBanner } from '@/src/components/sync/SyncErrorBanner';
import { comboLabel } from '@/src/utils/parentsCombinationMap';

export function EditorialTopBar({
  title,
  imageUri,
  profileImageUri,
}: {
  title?: string;
  imageUri?: string;
  profileImageUri?: string;
}) {
  const { theme } = useAppTheme();
  const { currentBaby, profile, currentFamily, language } = useAppContext();
  const router = useRouter();
  const resolvedTitle = title ?? currentBaby?.firstName ?? 'Luna';
  // Baby photo takes priority over avatar illustration
  const resolvedImageUri = imageUri ?? currentBaby?.photoUrl ?? getBabyAvatarUri(currentBaby?.avatarKey);
  // User photo for the profile button, fallback to editorial asset
  const resolvedProfileUri = profileImageUri ?? profile?.photoUrl ?? editorialAssets.familyHero;
  // Label du compte famille : combinaison de parents (Papa & Maman / Papa / etc.) si définie,
  // sinon fallback sur le premier parentName connu ou le prénom de l'utilisateur.
  const headerLabel = currentFamily?.parentsCombination
    ? comboLabel(currentFamily.parentsCombination, language)
    : (currentFamily?.parentNames?.[0] ?? profile?.displayName?.split(' ')[0] ?? null);

  return (
    <>
      <SyncErrorBanner />
      <View style={[styles.wrap, { backgroundColor: theme.background }]}>
        <View style={styles.left}>
          <View style={[styles.avatar, { backgroundColor: theme.secondaryContainer }]}>
            {resolvedImageUri ? <Image source={{ uri: resolvedImageUri }} style={styles.avatarImage} /> : null}
          </View>
          <Text style={[styles.title, { color: theme.primary, fontFamily: theme.fontSemiBold }]}>{resolvedTitle}</Text>
          <SyncDot />
        </View>
        <Pressable
          style={styles.profileBtn}
          onPress={() => {
            triggerSelectionFeedback();
            router.push('/(app)/(tabs)/settings');
          }}
        >
          {headerLabel ? (
            <Text
              style={[styles.profileName, { color: theme.textSoft, fontFamily: theme.fontMedium }]}
              numberOfLines={1}
            >
              {headerLabel}
            </Text>
          ) : null}
          <View style={[styles.iconButton, { backgroundColor: theme.surfaceRaised }]}>
            <Image source={{ uri: resolvedProfileUri }} style={styles.profileImage} />
          </View>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  title: {
    fontSize: 18,
    letterSpacing: -0.3,
  },
  profileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  profileName: {
    fontSize: 13,
    maxWidth: 120,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
});
