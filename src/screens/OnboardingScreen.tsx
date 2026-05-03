import { Icon } from '@/src/components/ui/Icon';
import DateTimePicker from '@/src/components/ui/PlatformDateTimePicker';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppButton, AppInput, Chip, Screen } from '@/src/components/ui';
import { feedingModeLabelKey } from '@/src/constants/i18n';
import { useI18n } from '@/src/hooks/useI18n';
import { radii, spacing } from '@/src/constants/theme';
import { useAppContext } from '@/src/providers/AppProvider';
import { useAppTheme } from '@/src/providers/ThemeProvider';
import { validateInviteCode } from '@/src/services/productRepository';

type OnboardingPath = 'choice' | 'create' | 'invite-code' | 'invite-role';

const ROLE_OPTIONS = [
  { labelKey: 'role.papa' as const, value: 'Papa' },
  { labelKey: 'role.maman' as const, value: 'Maman' },
  { labelKey: 'role.parrain' as const, value: 'Parrain' },
  { labelKey: 'role.marraine' as const, value: 'Marraine' },
  { labelKey: 'role.grandpere' as const, value: 'Grand-père' },
  { labelKey: 'role.grandmere' as const, value: 'Grand-mère' },
  { labelKey: 'role.tante' as const, value: 'Tante' },
  { labelKey: 'role.oncle' as const, value: 'Oncle' },
  { labelKey: 'role.other' as const, value: '__other__' },
];

export function OnboardingScreen() {
  const { theme } = useAppTheme();
  const router = useRouter();
  const { authUser, completeInitialSetup, joinFamily, saving, profile, logout, language } = useAppContext();
  const { t } = useI18n();

  // Stable refs for DateTimePicker to avoid re-renders
  const [today] = useState(() => new Date());

  // Path state
  const [path, setPath] = useState<OnboardingPath>('choice');

  // Create family state
  const [familyName, setFamilyName] = useState('');
  const [babyName, setBabyName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [sex, setSex] = useState<'boy' | 'girl'>('boy');
  const [partnerDisplayName, setPartnerDisplayName] = useState('');
  const [feedingMode, setFeedingMode] = useState<'breastfeeding' | 'bottle' | 'mixed'>('breastfeeding');

  // Invite code state
  const [inviteCode, setInviteCode] = useState('');
  const [familyInfo, setFamilyInfo] = useState<{ familyId: string; familyName: string; type: 'manager' | 'viewer' } | null>(null);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [customRole, setCustomRole] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);

  const resolvedBirthDate = useMemo(() => {
    if (!birthDate) return '';
    const parsed = new Date(`${birthDate}T12:00:00`);
    return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
  }, [birthDate]);

  const datePickerValue = useMemo(() => {
    if (!birthDate) return today;
    const d = new Date(`${birthDate}T12:00:00`);
    return Number.isNaN(d.getTime()) ? today : d;
  }, [birthDate, today]);

  const ownerDisplayName = useMemo(() => {
    return profile?.displayName?.trim() || authUser?.displayName?.trim() || authUser?.email?.split('@')[0] || 'Parent';
  }, [authUser?.displayName, authUser?.email, profile?.displayName]);

  const resolvedFamilyName = useMemo(() => {
    const trimmed = familyName.trim();
    if (trimmed) return trimmed;
    const firstName = ownerDisplayName.split(' ')[0]?.trim();
    return firstName ? `${t('onboarding.default_family_name')} ${firstName}` : t('onboarding.default_family_name');
  }, [familyName, ownerDisplayName, t]);

  const resolvedBabyName = useMemo(() => {
    return babyName.trim() || t('onboarding.default_baby_name');
  }, [babyName, t]);

  const resolvedBirthDateForSkip = useMemo(() => {
    return resolvedBirthDate || new Date().toISOString();
  }, [resolvedBirthDate]);

  const handleBack = async () => {
    if (path === 'create' || path === 'invite-code') {
      setPath('choice');
      return;
    }
    if (path === 'invite-role') {
      setPath('invite-code');
      setSelectedRole(null);
      setCustomRole('');
      return;
    }

    // From choice screen — go back to login
    if (authUser) {
      await logout();
      router.replace('/(auth)/login');
      return;
    }

    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/(auth)/login');
  };

  const submitSetup = async (options?: { skip?: boolean }) => {
    const success = await completeInitialSetup({
      familyName: resolvedFamilyName,
      babyName: resolvedBabyName,
      birthDate: options?.skip ? resolvedBirthDateForSkip : resolvedBirthDate,
      sex,
      feedingMode,
      ownerDisplayName,
      partnerDisplayName,
    });

    if (success) {
      router.replace('/(app)/(tabs)/tracker');
    }
  };

  const handleVerifyCode = async () => {
    setInviteError('');
    setInviteLoading(true);
    try {
      const result = await validateInviteCode(inviteCode);
      if (result) {
        setFamilyInfo(result);
        setPath('invite-role');
      } else {
        setInviteError(t('join.invalid_code'));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[JoinFamily] validateInviteCode error:', msg);
      setInviteError(`${t('join.invalid_code')} (${msg})`);
    } finally {
      setInviteLoading(false);
    }
  };

  const handleJoinFamily = async () => {
    if (!familyInfo) return;

    // Viewers don't need to pick a role label — skip if code is viewer type
    const isViewerCode = familyInfo.type === 'viewer';
    const parentLabel = isViewerCode
      ? undefined
      : (selectedRole === '__other__' ? customRole.trim() : selectedRole ?? undefined);

    if (!isViewerCode && !parentLabel) return;

    setInviteLoading(true);
    setInviteError('');
    try {
      await joinFamily(inviteCode, parentLabel);
      // Listeners Firestore mettent à jour needsOnboarding → la navigation
      // se fait automatiquement via l'index quand memberships.length > 0.
      // On navigue aussi explicitement pour les cas où l'index ne redirige pas.
      router.replace('/(app)/(tabs)/tracker');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[JoinFamily] error:', msg);
      setInviteError(`${t('join.invalid_code')} (${msg})`);
    } finally {
      setInviteLoading(false);
    }
  };

  const progressWidth = path === 'choice' ? '15%' : path === 'invite-role' ? '66%' : '32%';
  const isViewerCode = familyInfo?.type === 'viewer';
  const isJoinDisabled = inviteLoading || (!isViewerCode && (!selectedRole || (selectedRole === '__other__' && !customRole.trim())));

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable onPress={() => void handleBack()} style={[styles.backButton, { backgroundColor: theme.surfaceRaised }]}>
          <Icon name="arrow-back" size={20} color={theme.primary} />
        </Pressable>
        <Text style={[styles.step, { color: theme.textMuted, fontFamily: theme.fontMedium }]}>{t('onboarding.step')}</Text>
      </View>

      <View style={[styles.progressTrack, { backgroundColor: theme.surfaceContainerHigh }]}>
        <View style={[styles.progressFill, { width: progressWidth, backgroundColor: theme.primaryContainer }]} />
      </View>

      {/* ─── CHOICE SCREEN ─── */}
      {path === 'choice' ? (
        <>
          <View style={styles.hero}>
            <Text style={[styles.title, { color: theme.text, fontFamily: theme.fontDisplayItalic }]}>
              {t('onboarding.title')}
            </Text>
            <Text style={[styles.subtitle, { color: theme.textMuted, fontFamily: theme.fontRegular }]}>
              {t('onboarding.subtitle')}
            </Text>
          </View>

          <AppButton onPress={() => setPath('create')}>
            {t('onboarding.create_family')}
          </AppButton>

          <AppButton variant="secondary" onPress={() => setPath('invite-code')}>
            {t('login.have_invite_code')}
          </AppButton>
        </>
      ) : null}

      {/* ─── CREATE FAMILY ─── */}
      {path === 'create' ? (
        <>
          <View style={styles.hero}>
            <Text style={[styles.title, { color: theme.text, fontFamily: theme.fontDisplayItalic }]}>
              {t('onboarding.title')}
            </Text>
            <Text style={[styles.subtitle, { color: theme.textMuted, fontFamily: theme.fontRegular }]}>
              {t('onboarding.subtitle')}
            </Text>
          </View>

          <View style={[styles.formCard, { backgroundColor: theme.surfaceLowest }]}>
            <AppInput
              label={t('onboarding.family_name')}
              value={familyName}
              onChangeText={setFamilyName}
              placeholder={resolvedFamilyName}
            />
            <AppInput
              label={t('onboarding.baby_name')}
              value={babyName}
              onChangeText={setBabyName}
              placeholder={t('onboarding.default_baby_name')}
            />
            <View style={styles.datePickerWrap}>
              <Text style={[styles.questionLabel, { color: theme.textSoft, fontFamily: theme.fontBold }]}>
                {t('onboarding.birth_date')}
              </Text>
              <DateTimePicker
                value={datePickerValue}
                mode="date"
                display="compact"
                maximumDate={today}
                locale={language}
                themeVariant={theme.isDark ? 'dark' : 'light'}
                textColor={theme.text}
                accentColor={theme.primary}
                style={styles.datePickerCompact}
                onChange={(_event, date) => {
                  if (date) {
                    const y = date.getFullYear();
                    const m = String(date.getMonth() + 1).padStart(2, '0');
                    const d = String(date.getDate()).padStart(2, '0');
                    setBirthDate(`${y}-${m}-${d}`);
                  }
                }}
              />
            </View>
            <View style={styles.goalRow}>
              <Chip label={t('onboarding.sex.boy')} selected={sex === 'boy'} onPress={() => setSex('boy')} />
              <Chip label={t('onboarding.sex.girl')} selected={sex === 'girl'} onPress={() => setSex('girl')} />
            </View>
            <View style={styles.questionBlock}>
              <Text style={[styles.questionLabel, { color: theme.textSoft, fontFamily: theme.fontBold }]}>{t('onboarding.feeding_mode')}</Text>
              <View style={styles.goalRow}>
                {(['breastfeeding', 'bottle', 'mixed'] as const).map((value) => (
                  <Chip
                    key={value}
                    label={t(feedingModeLabelKey(value))}
                    selected={feedingMode === value}
                    onPress={() => setFeedingMode(value)}
                  />
                ))}
              </View>
            </View>
            <AppInput label={t('onboarding.second_parent')} value={partnerDisplayName} onChangeText={setPartnerDisplayName} placeholder="Sarah" />
          </View>

          <AppButton
            disabled={saving || !resolvedBirthDate}
            onPress={() => void submitSetup()}
          >
            {saving ? t('common.loading') : t('common.continue')}
          </AppButton>

          <AppButton variant="ghost" disabled={saving} onPress={() => void submitSetup({ skip: true })}>
            {t('onboarding.skip')}
          </AppButton>

          <Text style={[styles.footer, { color: theme.textSoft, fontFamily: theme.fontRegular }]}>
            {t('onboarding.skip_body')}
          </Text>

          <Text style={[styles.footer, { color: theme.textSoft, fontFamily: theme.fontRegular }]}>
            {t('onboarding.edit_later')}
          </Text>
        </>
      ) : null}

      {/* ─── INVITE CODE ─── */}
      {path === 'invite-code' ? (
        <>
          <View style={styles.hero}>
            <Text style={[styles.title, { color: theme.text, fontFamily: theme.fontDisplayItalic }]}>
              {t('join.title')}
            </Text>
            <Text style={[styles.subtitle, { color: theme.textMuted, fontFamily: theme.fontRegular }]}>
              {t('join.subtitle')}
            </Text>
          </View>

          <View style={[styles.formCard, { backgroundColor: theme.surfaceLowest }]}>
            <AppInput
              label={t('join.enter_code')}
              value={inviteCode}
              onChangeText={(v) => {
                setInviteCode(v.toUpperCase());
                setInviteError('');
              }}
              placeholder="ABC123"
              autoCapitalize="characters"
            />
            {inviteError ? (
              <Text style={[styles.errorText, { color: theme.danger, fontFamily: theme.fontMedium }]}>
                {inviteError}
              </Text>
            ) : null}
          </View>

          {inviteLoading ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : (
            <AppButton
              disabled={inviteCode.trim().length < 4}
              onPress={() => void handleVerifyCode()}
            >
              {t('join.verify')}
            </AppButton>
          )}
        </>
      ) : null}

      {/* ─── INVITE ROLE SELECTION ─── */}
      {path === 'invite-role' ? (
        <>
          <View style={styles.hero}>
            <Text style={[styles.title, { color: theme.text, fontFamily: theme.fontDisplayItalic }]}>
              {t('join.family_found')}
            </Text>
            <Text style={[styles.familyNameHighlight, { color: theme.primary, fontFamily: theme.fontDisplayItalic }]}>
              {familyInfo?.familyName}
            </Text>
          </View>

          {isViewerCode ? (
            /* Viewer : confirmation simple, pas de choix de label */
            <View style={[styles.formCard, { backgroundColor: theme.surfaceLowest }]}>
              <Text style={[styles.subtitle, { color: theme.textSoft, fontFamily: theme.fontRegular }]}>
                {language === 'fr'
                  ? 'Vous rejoindrez la famille en mode lecture seule. Vous pourrez consulter les données mais pas en enregistrer.'
                  : 'You will join the family in read-only mode. You can view data but not record events.'}
              </Text>
              {inviteError ? (
                <Text style={[styles.errorText, { color: theme.danger, fontFamily: theme.fontMedium }]}>
                  {inviteError}
                </Text>
              ) : null}
            </View>
          ) : (
            /* Manager : choix du label (Papa, Maman, etc.) */
            <View style={[styles.formCard, { backgroundColor: theme.surfaceLowest }]}>
              <Text style={[styles.questionLabel, { color: theme.textSoft, fontFamily: theme.fontBold }]}>
                {t('join.select_role')}
              </Text>
              <View style={styles.roleGrid}>
                {ROLE_OPTIONS.map((option) => (
                  <Chip
                    key={option.value}
                    label={t(option.labelKey)}
                    selected={selectedRole === option.value}
                    onPress={() => {
                      setSelectedRole(option.value);
                      if (option.value !== '__other__') setCustomRole('');
                    }}
                  />
                ))}
              </View>
              {selectedRole === '__other__' ? (
                <AppInput
                  label={t('role.other')}
                  value={customRole}
                  onChangeText={setCustomRole}
                  placeholder={t('role.other_placeholder')}
                />
              ) : null}
              {inviteError ? (
                <Text style={[styles.errorText, { color: theme.danger, fontFamily: theme.fontMedium }]}>
                  {inviteError}
                </Text>
              ) : null}
            </View>
          )}

          {inviteLoading ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : (
            <AppButton
              disabled={isJoinDisabled}
              onPress={() => void handleJoinFamily()}
            >
              {t('join.join_button')}
            </AppButton>
          )}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  step: {
    fontSize: 12,
    letterSpacing: 1,
  },
  progressTrack: {
    height: 3,
    borderRadius: radii.pill,
    overflow: 'hidden',
    marginTop: spacing.md,
    opacity: 0.7,
  },
  progressFill: {
    height: '100%',
    borderRadius: radii.pill,
  },
  hero: {
    gap: spacing.sm,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 38,
    lineHeight: 42,
    letterSpacing: -0.6,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  familyNameHighlight: {
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: -0.4,
  },
  questionBlock: {
    gap: spacing.md,
  },
  questionLabel: {
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  goalRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  roleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  formCard: {
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.md,
  },
  errorText: {
    fontSize: 13,
    marginLeft: spacing.sm,
  },
  footer: {
    textAlign: 'center',
    fontSize: 13,
  },
  datePickerWrap: {
    gap: spacing.xs,
  },
  datePickerCompact: {
    alignSelf: 'flex-start',
  },
});
