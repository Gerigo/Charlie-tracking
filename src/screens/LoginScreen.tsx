import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { AppButton, AppInput, Screen } from '@/src/components/ui';
import { canUseDevTools } from '@/src/lib/env';
import { useI18n } from '@/src/hooks/useI18n';
import { radii, spacing } from '@/src/constants/theme';
import { useAppContext } from '@/src/providers/AppProvider';
import { useAppTheme } from '@/src/providers/ThemeProvider';

export function LoginScreen() {
  const { theme } = useAppTheme();
  const { signInWithPassword, registerWithPassword, saving, enterSandbox } = useAppContext();
  const { t, language } = useI18n();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const isSignup = mode === 'signup';
  const canSubmit = !saving && Boolean(email.trim() && password && (!isSignup || displayName.trim()));

  const submit = async () => {
    if (!canSubmit) return;
    if (isSignup) {
      await registerWithPassword(email.trim(), password, displayName.trim());
      return;
    }
    await signInWithPassword(email.trim(), password);
  };

  // Carnet d'aquarelle — translucent cream paper (matches background tokens).
  const shellBg = theme.isDark ? 'rgba(31, 24, 20, 0.55)' : 'rgba(250, 243, 232, 0.62)';
  const shellStroke = theme.isDark ? 'rgba(240, 230, 214, 0.10)' : 'rgba(168, 98, 77, 0.10)';

  return (
    <Screen contentContainerStyle={styles.screenContent}>
      {/* ── Backdrop wash — soft gradient that anchors the brand ── */}
      <LinearGradient
        pointerEvents="none"
        colors={[`${theme.gradientStart}1F`, 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.backdrop}
      />

      {/* ── Brand ── */}
      <View style={styles.brandWrap}>
        <Text
          style={[styles.brandWordmark, { color: theme.primary, fontFamily: theme.fontDisplayItalic }]}
        >
          Charlie.
        </Text>
        <Text style={[styles.eyebrow, { color: theme.textSoft, fontFamily: theme.fontMedium }]}>
          {language === 'fr' ? 'Carnet du quotidien' : 'A daily companion'}
        </Text>
      </View>

      {/* ── Glass form ── */}
      <View
        style={[
          styles.shell,
          { borderColor: shellStroke, shadowColor: theme.shadow },
        ]}
      >
        <BlurView
          intensity={theme.isDark ? 30 : 40}
          tint={theme.isDark ? 'dark' : 'light'}
          style={[styles.formInner, { backgroundColor: shellBg }]}
        >
          <Text
            style={[styles.formTitle, { color: theme.text, fontFamily: theme.fontDisplayItalic }]}
          >
            {isSignup
              ? language === 'fr' ? 'Bienvenue.' : 'Welcome.'
              : language === 'fr' ? 'Re-bonjour.' : 'Welcome back.'}
          </Text>
          <Text
            style={[styles.formSubtitle, { color: theme.textMuted, fontFamily: theme.fontRegular }]}
          >
            {isSignup
              ? language === 'fr'
                ? 'Créez votre compte en quelques secondes.'
                : 'Create your account in seconds.'
              : t('login.subtitle')}
          </Text>

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
            autoComplete="email"
          />

          <AppInput
            label={t('login.password')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••••"
            autoComplete={isSignup ? 'new-password' : 'current-password'}
          />

          <Pressable
            disabled={!canSubmit}
            onPress={submit}
            style={({ pressed }) => [
              styles.submitShell,
              !canSubmit ? styles.submitDisabled : null,
              pressed && canSubmit ? styles.submitPressed : null,
            ]}
          >
            <LinearGradient
              colors={[theme.gradientStart, theme.gradientEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.submitGradient}
            >
              <Text
                style={[styles.submitLabel, { color: theme.onPrimary, fontFamily: theme.fontBold }]}
              >
                {saving ? t('common.loading') : isSignup ? t('login.create_account') : t('login.sign_in')}
              </Text>
            </LinearGradient>
          </Pressable>

          <Pressable
            onPress={() => setMode((current) => (current === 'signin' ? 'signup' : 'signin'))}
            style={styles.modeSwitch}
          >
            <Text style={[styles.modeSwitchText, { color: theme.textMuted, fontFamily: theme.fontRegular }]}>
              {isSignup ? t('login.already_have_account') : t('login.new_here')}{'  '}
              <Text style={[styles.modeSwitchLink, { color: theme.primary, fontFamily: theme.fontBold }]}>
                {isSignup ? t('login.sign_in') : t('login.create_account')}
              </Text>
            </Text>
          </Pressable>
        </BlurView>
      </View>

      {/* ── Dev sandbox ── */}
      {canUseDevTools && __DEV__ ? (
        <View style={styles.sandboxWrap}>
          <Text style={[styles.sandboxLabel, { color: theme.textSoft, fontFamily: theme.fontMedium }]}>
            {t('login.quick_access')}
          </Text>
          <AppButton variant="secondary" onPress={enterSandbox}>
            {t('login.local_test')}
          </AppButton>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.md,
    position: 'relative',
  },
  backdrop: {
    position: 'absolute',
    top: -120,
    left: -80,
    right: -80,
    height: 380,
    borderBottomLeftRadius: 220,
    borderBottomRightRadius: 220,
    opacity: 0.9,
  },
  brandWrap: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    gap: 4,
  },
  brandWordmark: {
    fontSize: 56,
    lineHeight: 60,
    letterSpacing: -1.4,
  },
  eyebrow: {
    fontSize: 12,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    opacity: 0.85,
  },
  shell: {
    borderRadius: 28,
    borderWidth: 1,
    overflow: 'hidden',
    shadowOpacity: 0.1,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  formInner: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  formTitle: {
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: -0.4,
  },
  formSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: -spacing.xs,
    marginBottom: spacing.xs,
  },
  submitShell: {
    borderRadius: radii.pill,
    overflow: 'hidden',
    marginTop: spacing.sm,
  },
  submitGradient: {
    minHeight: 54,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  submitPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.92,
  },
  submitDisabled: {
    opacity: 0.45,
  },
  submitLabel: {
    fontSize: 16,
    letterSpacing: 0.1,
  },
  modeSwitch: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  modeSwitchText: {
    fontSize: 13,
  },
  modeSwitchLink: {
    fontSize: 13,
  },
  sandboxWrap: {
    marginTop: spacing.xl,
    alignItems: 'center',
    gap: spacing.xs,
  },
  sandboxLabel: {
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
});
