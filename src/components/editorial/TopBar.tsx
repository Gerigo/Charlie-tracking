import { useRouter } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
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
  const resolvedImageUri = imageUri ?? currentBaby?.photoUrl ?? getBabyAvatarUri(currentBaby?.avatarKey);
  const resolvedProfileUri = profileImageUri ?? profile?.photoUrl ?? editorialAssets.familyHero;
  const headerLabel = currentFamily?.parentsCombination
    ? comboLabel(currentFamily.parentsCombination, language)
    : (currentFamily?.parentNames?.[0] ?? profile?.displayName?.split(' ')[0] ?? null);

  // Carnet d'aquarelle — translucent cream paper (matches background tokens).
  const shellBg = theme.isDark
    ? 'rgba(31, 24, 20, 0.55)'
    : 'rgba(250, 243, 232, 0.62)';
  const innerStroke = theme.isDark ? 'rgba(240, 230, 214, 0.10)' : 'rgba(168, 98, 77, 0.10)';

  return (
    <>
      <SyncErrorBanner />
      <View
        style={[
          styles.shell,
          {
            shadowColor: theme.shadow,
            borderColor: innerStroke,
          },
        ]}
      >
        <BlurView
          intensity={theme.isDark ? 32 : 40}
          tint={theme.isDark ? 'dark' : 'light'}
          style={[styles.blur, { backgroundColor: shellBg }]}
        >
          <View style={styles.left}>
            <View style={[styles.avatar, { backgroundColor: theme.secondaryContainer }]}>
              {resolvedImageUri ? <Image source={{ uri: resolvedImageUri }} style={styles.avatarImage} /> : null}
            </View>
            <Text style={[styles.title, { color: theme.primary, fontFamily: theme.fontDisplay }]}>{resolvedTitle}</Text>
            <SyncDot />
          </View>
          <Pressable
            style={({ pressed }) => [styles.profileBtn, pressed ? { opacity: 0.85, transform: [{ scale: 0.96 }] } : null]}
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
            <View style={[styles.iconButton, { backgroundColor: theme.surfaceRaised, borderColor: innerStroke }]}>
              <Image source={{ uri: resolvedProfileUri }} style={styles.profileImage} />
            </View>
          </Pressable>
        </BlurView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderRadius: 999,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: spacing.md,
    shadowOpacity: 0.12,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  blur: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  title: {
    fontSize: 22,
    letterSpacing: -0.4,
  },
  profileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 6,
  },
  profileName: {
    fontSize: 13,
    maxWidth: 120,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
});
