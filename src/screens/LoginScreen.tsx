import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppButton, AppInput, Screen } from '@/src/components/ui';
import { canUseDevTools } from '@/src/lib/env';
import { useI18n } from '@/src/hooks/useI18n';
import { radii, spacing } from '@/src/constants/theme';
import { useAppContext } from '@/src/providers/AppProvider';
import { useAppTheme } from '@/src/providers/ThemeProvider';

export function LoginScreen() {
  const { theme } = useAppTheme();
  const { signInWithPassword, registerWithPassword, saving, enterSandbox } = useAppContext();
  const { t } = useI18n();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const isSignup = mode === 'signup';

  const submit = async () => {
    if (isSignup) {
      await registerWithPassword(email, password, displayName);
      return;
    }

    await signInWithPassword(email, password);
  };

  return (
    <Screen contentContainerStyle={styles.screenContent}>
      <View style={styles.header}>
        <LinearGradient
          colors={[theme.gradientStart, theme.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.brandMark}
        >
          <Ionicons name="leaf-outline" size={28} color={theme.onPrimary} />
        </LinearGradient>
        <Text style={[styles.brand, { color: theme.primary, fontFamily: theme.fontSemiBold }]}>Luna</Text>
        <Text style={[styles.subtitle, { color: theme.textMuted, fontFamily: theme.fontRegular }]}>
          {t('login.subtitle')}
        </Text>
      </View>

      {canUseDevTools && __DEV__ ? (
        <View style={[styles.quickAccessCard, { backgroundColor: theme.surfaceLowest }]}>
          <Text style={[styles.quickAccessTitle, { color: theme.text, fontFamily: theme.fontSemiBold }]}>
            {t('login.quick_access')}
          </Text>
          <Text style={[styles.quickAccessBody, { color: theme.textMuted, fontFamily: theme.fontRegular }]}>
            {t('login.quick_access_body')}
          </Text>
          <View style={styles.quickAccessActions}>
            <AppButton onPress={enterSandbox}>
              {t('login.local_test')}
            </AppButton>
          </View>
        </View>
      ) : null}

      <View style={styles.form}>
        {isSignup ? (
          <AppInput
            label={t('login.first_name')}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Sarah"
            autoCapitalize="words"
          />
        ) : null}

        <AppInput
          label={t('login.email')}
          value={email}
          onChangeText={setEmail}
          placeholder="nom@exemple.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <AppInput
          label={t('login.password')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="••••••••"
        />

        <Pressable
          disabled={saving || !email || !password || (isSignup && !displayName)}
          onPress={submit}
          style={({ pressed }) => [
            styles.submitShell,
            pressed ? styles.submitPressed : null,
            saving || !email || !password || (isSignup && !displayName) ? styles.submitDisabled : null,
          ]}
        >
          <LinearGradient
            colors={[theme.gradientStart, theme.gradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.submitGradient}
          >
            <Text style={[styles.submitLabel, { color: theme.onPrimary, fontFamily: theme.fontBold }]}>
              {saving ? t('common.loading') : isSignup ? t('login.create_account') : t('login.sign_in')}
            </Text>
          </LinearGradient>
        </Pressable>

      </View>

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: theme.textMuted, fontFamily: theme.fontRegular }]}>
          {isSignup ? t('login.already_have_account') : t('login.new_here')}
        </Text>
        <Pressable onPress={() => setMode((current) => current === 'signin' ? 'signup' : 'signin')}>
          <Text style={[styles.footerLink, { color: theme.primary, fontFamily: theme.fontBold }]}>
            {isSignup ? t('login.sign_in') : t('login.create_account')}
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: spacing.xxl,
  },
  header: {
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xxl,
  },
  brandMark: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  brand: {
    fontSize: 28,
    lineHeight: 32,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  quickAccessCard: {
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  quickAccessTitle: {
    fontSize: 18,
  },
  quickAccessBody: {
    fontSize: 14,
    lineHeight: 21,
  },
  quickAccessActions: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  form: {
    gap: spacing.lg,
  },
  submitShell: {
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  submitGradient: {
    minHeight: 58,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  submitPressed: {
    transform: [{ scale: 0.985 }],
  },
  submitDisabled: {
    opacity: 0.5,
  },
  submitLabel: {
    fontSize: 18,
  },
  footer: {
    marginTop: spacing.xxl,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
  },
  footerText: {
    fontSize: 14,
  },
  footerLink: {
    fontSize: 14,
  },
});
