import { EditorialTopBar } from "@/src/components/editorial/TopBar";
import { AppBadge, AppButton, AppInput, AppModal, FullScreenPortal, Screen } from "@/src/components/ui";
import {
  babyAvatarOptions,
  getBabyAvatarUri,
} from "@/src/constants/editorialAssets";
import { feedingModeLabelKey } from "@/src/constants/i18n";
import { radii, spacing } from "@/src/constants/theme";
import { useI18n } from "@/src/hooks/useI18n";
import { confirmAction } from "@/src/lib/dialog";
import { canUseDevTools } from "@/src/lib/env";
import { GROWTH_SPURT_MOCK_OPTIONS } from "@/src/lib/devMocks";
import { triggerSelectionFeedback } from "@/src/lib/feedback";
import { useAppContext } from "@/src/providers/AppProvider";
import { useAppTheme } from "@/src/providers/ThemeProvider";
import { DataScreen } from "@/src/screens/DataScreen";
import { LogsScreen } from "@/src/screens/LogsScreen";
import type {
  AppLanguage,
  BabyAvatarKey,
  BabyProfile,
  BabySex,
  FeedingMode,
  MembershipRole,
  ParentsCombination,
} from "@/src/types/domain";
import { getDefaultCareTypes, normalizeCareTypes, normalizeVisitTypes } from "@/src/utils/careEvents";
import { formatDateTime } from "@/src/utils/date";
import { PARENTS_COMBINATION_OPTIONS, comboLabel } from "@/src/utils/parentsCombinationMap";
import { Icon } from "@/src/components/ui/Icon";
import DateTimePicker from "@/src/components/ui/PlatformDateTimePicker";
import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import { useMemo, useState, type ReactNode } from "react";
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

function formatBabyAge(birthDate: string, language: AppLanguage) {
  const birth = new Date(birthDate);
  const now = new Date();
  let months =
    (now.getFullYear() - birth.getFullYear()) * 12 +
    (now.getMonth() - birth.getMonth());
  if (now.getDate() < birth.getDate()) months -= 1;

  if (months <= 0) {
    return language === "fr" ? "Nouveau-né" : "Newborn";
  }

  if (months < 24) {
    return language === "fr"
      ? `${months} mois`
      : `${months} month${months > 1 ? "s" : ""}`;
  }

  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  if (language === "fr") {
    return remainingMonths > 0
      ? `${years} an${years > 1 ? "s" : ""}, ${remainingMonths} mois`
      : `${years} an${years > 1 ? "s" : ""}`;
  }

  return remainingMonths > 0
    ? `${years} year${years > 1 ? "s" : ""}, ${remainingMonths} month${remainingMonths > 1 ? "s" : ""}`
    : `${years} year${years > 1 ? "s" : ""}`;
}

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");
}

/** "2026-03-03" → "03/03/2026" */
function isoToDisplay(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

/** "03/03/2026" → "2026-03-03" */
function displayToIso(display: string): string {
  const [d, m, y] = display.split("/");
  if (!d || !m || !y) return display;
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

/** Inline date picker: value/onChange are ISO strings "YYYY-MM-DD" */
function BirthDatePicker({
  label,
  value,
  onChange,
  locale,
}: {
  label: string;
  value: string;
  onChange: (iso: string) => void;
  locale?: string;
}) {
  const { theme } = useAppTheme();

  const dateObj = useMemo(() => {
    const d = new Date(`${value}T12:00:00`);
    return isNaN(d.getTime()) ? new Date() : d;
  }, [value]);

  return (
    <View style={birthPickerStyles.wrap}>
      <Text style={[birthPickerStyles.label, { color: theme.text, fontFamily: "Manrope_500Medium" }]}>
        {label}
      </Text>
      <DateTimePicker
        value={dateObj}
        mode="date"
        display="compact"
        maximumDate={new Date()}
        locale={locale}
        themeVariant={theme.isDark ? "dark" : "light"}
        textColor={theme.text}
        accentColor={theme.primary}
        style={birthPickerStyles.picker}
        onChange={(_event, date) => {
          if (date) {
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, "0");
            const d = String(date.getDate()).padStart(2, "0");
            onChange(`${y}-${m}-${d}`);
          }
        }}
      />
    </View>
  );
}

const birthPickerStyles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontSize: 13 },
  picker: { alignSelf: "flex-start" },
});

async function pickPhoto(): Promise<string | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== "granted") return null;
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"] as ImagePicker.MediaType[],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
  });
  if (result.canceled) return null;
  return result.assets[0]?.uri ?? null;
}

function ToggleRow({
  icon,
  label,
  enabled,
  onPress,
}: {
  icon: string;
  label: string;
  enabled: boolean;
  onPress: () => void;
}) {
  const { theme } = useAppTheme();

  return (
    <Pressable
      onPress={() => {
        triggerSelectionFeedback();
        onPress();
      }}
      style={styles.settingRow}
    >
      <View style={styles.settingLeft}>
        <Icon name={icon} size={18} color={theme.primaryContainer} />
        <Text
          style={[
            styles.settingLabel,
            { color: theme.text, fontFamily: theme.fontMedium },
          ]}
        >
          {label}
        </Text>
      </View>
      <View
        style={[
          styles.toggleTrack,
          {
            backgroundColor: enabled
              ? theme.primaryContainer
              : theme.surfaceContainerHigh,
          },
        ]}
      >
        <View
          style={[
            styles.toggleThumb,
            enabled ? styles.toggleThumbOn : styles.toggleThumbOff,
          ]}
        />
      </View>
    </Pressable>
  );
}

function LinkRow({
  icon,
  label,
  onPress,
}: {
  icon: string;
  label: string;
  onPress?: () => void;
}) {
  const { theme } = useAppTheme();

  return (
    <Pressable
      onPress={() => {
        triggerSelectionFeedback();
        onPress?.();
      }}
      style={styles.settingRow}
    >
      <View style={styles.settingLeft}>
        <Icon name={icon} size={18} color={theme.primaryContainer} />
        <Text
          style={[
            styles.settingLabel,
            { color: theme.text, fontFamily: theme.fontMedium },
          ]}
        >
          {label}
        </Text>
      </View>
      <Icon name="chevron-forward" size={18} color={theme.textSoft} />
    </Pressable>
  );
}

function SegmentRow<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (nextValue: T) => void;
}) {
  const { theme } = useAppTheme();

  return (
    <View style={styles.segmentRowWrap}>
      <Text
        style={[
          styles.settingLabel,
          { color: theme.text, fontFamily: theme.fontMedium },
        ]}
      >
        {label}
      </Text>
      <View style={styles.segmentRow}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              onPress={() => {
                triggerSelectionFeedback();
                onChange(option.value);
              }}
              style={[
                styles.segmentButton,
                {
                  backgroundColor: selected
                    ? theme.secondaryContainer
                    : theme.surfaceRaised,
                },
              ]}
            >
              <Text
                style={[
                  styles.segmentLabel,
                  {
                    color: theme.text,
                    fontFamily: selected ? theme.fontBold : theme.fontMedium,
                  },
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function ModalSheet({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const { theme } = useAppTheme();

  return (
    <AppModal visible={visible} onClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalKeyboardWrap}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.modalScrollContent}
        >
          <Pressable
            style={[
              styles.modalCard,
              { backgroundColor: theme.surfaceLowest, shadowColor: theme.shadow },
            ]}
            onPress={(event) => event.stopPropagation()}
          >
            <Text
              style={[
                styles.modalTitle,
                { color: theme.text, fontFamily: theme.fontSemiBold },
              ]}
            >
              {title}
            </Text>
            {children}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </AppModal>
  );
}

export function SettingsScreen() {
  const { theme, themeMode, setThemeMode } = useAppTheme();
  const { t, language } = useI18n();
  const {
    authUser,
    currentFamily,
    currentBaby,
    currentMembership,
    babies,
    familyMembers,
    notificationsGranted,
    requestNotificationAccess,
    logout,
    deleteAccount,
    isSandbox,
    exitSandbox,
    language: appLanguage,
    feedingMode,
    setLanguagePreference,
    setFeedingModePreference,
    selectBaby,
    addBaby,
    updateBabyAvatar,
    updateBabyInfo,
    updateUserInfo,
    joinFamily,
    updateFamilyDetails,
    removeFamilyMember,
    updateMemberRole,
    setParentsCombination,
    syncStatus,
    lastSyncedAt,
    saving,
    viewerRole,
    profile,
    debugSetSyncStatus,
    growthSpurtMock,
    setGrowthSpurtMock,
  } = useAppContext();

  const shareLink = "https://sleeptracker-71e30.web.app";
  const isNightMode = themeMode === "dark";
  const canManageFamily = viewerRole === "manager";

  // --- Modal visibility state ---
  const [logsVisible, setLogsVisible] = useState(false);
  const [addChildVisible, setAddChildVisible] = useState(false);
  const [editFamilyVisible, setEditFamilyVisible] = useState(false);
  const [familySharingVisible, setFamilySharingVisible] = useState(false);
  const [securityVisible, setSecurityVisible] = useState(false);
  const [tutorialVisible, setTutorialVisible] = useState(false);
  const [visitTypesVisible, setVisitTypesVisible] = useState(false);
  const [careTypesVisible, setCareTypesVisible] = useState(false);
  const [deleteAccountVisible, setDeleteAccountVisible] = useState(false);
  const [deleteAccountPassword, setDeleteAccountPassword] = useState("");
  const [deleteAccountConfirmText, setDeleteAccountConfirmText] = useState("");
  const [deleteAccountSaving, setDeleteAccountSaving] = useState(false);
  const [avatarPickerVisible, setAvatarPickerVisible] = useState(false);
  const [avatarTargetBaby, setAvatarTargetBaby] = useState<BabyProfile | null>(
    null,
  );
  const [editParentVisible, setEditParentVisible] = useState(false);
  const [editBabyVisible, setEditBabyVisible] = useState(false);
  const [editBabyTarget, setEditBabyTarget] = useState<BabyProfile | null>(
    null,
  );

  // --- Add child form state ---
  const [familyName, setFamilyName] = useState(currentFamily?.name ?? "");
  const [visitDraft, setVisitDraft] = useState("");
  const [visitTypesDraft, setVisitTypesDraft] = useState<string[]>(
    currentFamily?.visitTypes ?? [],
  );
  const [careDraft, setCareDraft] = useState("");
  const [careTypesDraft, setCareTypesDraft] = useState<string[]>(
    currentFamily?.careTypes ?? [],
  );
  const [childName, setChildName] = useState("");
  const [childBirthDate, setChildBirthDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [childSex, setChildSex] = useState<BabySex>("boy");
  const [childFeedingMode, setChildFeedingMode] =
    useState<FeedingMode>(feedingMode);
  const [childAvatarKey, setChildAvatarKey] =
    useState<BabyAvatarKey>("babyAvatar");

  // --- Edit user form state ---
  const [editDisplayName, setEditDisplayName] = useState(
    profile?.displayName ?? "",
  );

  // --- Edit baby form state ---
  const [editBabyName, setEditBabyName] = useState("");
  const [editBabyBirthDate, setEditBabyBirthDate] = useState("");
  const [editBabySex, setEditBabySex] = useState<BabySex>("boy");
  const [editBabyFeedingMode, setEditBabyFeedingMode] =
    useState<FeedingMode>(feedingMode);

  // --- Add child extra state ---
  const [childSetAsActive, setChildSetAsActive] = useState(false);

  // --- Join family by code state ---
  const [joinCodeDraft, setJoinCodeDraft] = useState("");

  // --- Per-child share modal ---
  const [childShareVisible, setChildShareVisible] = useState(false);

  const [parentsComboVisible, setParentsComboVisible] = useState(false);

  // --- Add child modal mode: 'create' a new child, or 'join' an existing family ---
  const [addChildMode, setAddChildMode] = useState<'create' | 'join'>('create');

  // --- Sync info modal ---
  const [syncInfoVisible, setSyncInfoVisible] = useState(false);

  // --- Data page sheet ---
  const [dataVisible, setDataVisible] = useState(false);

  // --- Optimistic local photo URIs (affichage immédiat avant fin d'upload) ---
  const [localUserPhotoUri, setLocalUserPhotoUri] = useState<string | null>(null);
  const [localBabyPhotoUris, setLocalBabyPhotoUris] = useState<Record<string, string>>({});

  // --- Family member split: me vs. co-parents ---
  const myMember = useMemo(
    () => familyMembers.find((m) => m.uid === currentMembership?.userId) ?? null,
    [familyMembers, currentMembership],
  );
  const otherMembers = useMemo(
    () => familyMembers.filter((m) => m.uid !== currentMembership?.userId),
    [familyMembers, currentMembership],
  );

  // --- Sync meta ---
  const syncMeta = useMemo(() => {
    if (syncStatus === "error") {
      return {
        label: t("settings.sync_error"),
        tone: "warning" as const,
        icon: "alert-circle-outline" as const,
      };
    }
    if (syncStatus === "syncing" || saving) {
      return {
        label: t("settings.sync_syncing"),
        tone: "primary" as const,
        icon: "sync-outline" as const,
      };
    }
    return {
      label: language === "fr" ? "Comptes synchronisés" : "Accounts synced",
      tone: "success" as const,
      icon: "shield-checkmark-outline" as const,
    };
  }, [saving, syncStatus, t]);

  // --- Role label helper ---
  function getRoleLabel(role: "manager" | "viewer"): string {
    if (language === "fr") {
      if (role === "manager") return "Parent";
      return "Lecture seule";
    }
    if (role === "manager") return "Parent";
    return "Read-only";
  }

  // --- Photo pickers ---
  async function pickUserPhoto() {
    const uri = await pickPhoto();
    if (uri) {
      setLocalUserPhotoUri(uri); // affichage instantané
      await updateUserInfo({ photoUri: uri });
    }
  }

  async function pickBabyPhoto(babyId: string) {
    const uri = await pickPhoto();
    if (uri) {
      setLocalBabyPhotoUris((prev) => ({ ...prev, [babyId]: uri })); // affichage instantané
      await updateBabyInfo(babyId, { photoUri: uri });
    }
  }


  const handleJoinFamily = async () => {
    const trimmed = joinCodeDraft.trim();
    if (!trimmed) return;
    await joinFamily(trimmed);
    setJoinCodeDraft("");
    setFamilySharingVisible(false);
  };

  const handleJoinChild = async () => {
    const trimmed = joinCodeDraft.trim();
    if (!trimmed) return;
    await joinFamily(trimmed);
    setJoinCodeDraft("");
    setAddChildVisible(false);
  };

  // --- Family profile handlers ---
  const openEditProfile = () => {
    if (!canManageFamily) return;
    triggerSelectionFeedback();
    setFamilyName(currentFamily?.name ?? "");
    setEditFamilyVisible(true);
  };

  const openVisitTypes = () => {
    if (!canManageFamily) return;
    triggerSelectionFeedback();
    setVisitDraft("");
    setVisitTypesDraft(currentFamily?.visitTypes ?? []);
    setVisitTypesVisible(true);
  };

  const openCareTypes = () => {
    if (!canManageFamily) return;
    triggerSelectionFeedback();
    setCareDraft("");
    const existing = currentFamily?.careTypes ?? [];
    // Seed with language-aware defaults if the family hasn't customised yet
    setCareTypesDraft(existing.length > 0 ? existing : getDefaultCareTypes(language));
    setCareTypesVisible(true);
  };

  const openAddChild = (mode: 'create' | 'join' = 'create') => {
    if (mode === 'create' && !canManageFamily) return;
    triggerSelectionFeedback();
    setChildName("");
    setChildBirthDate(new Date().toISOString().slice(0, 10));
    setChildSex("boy");
    setChildFeedingMode(feedingMode);
    setChildAvatarKey("babyAvatar");
    setJoinCodeDraft("");
    setAddChildMode(mode);
    setAddChildVisible(true);
  };

  const openAvatarPicker = (baby: BabyProfile) => {
    if (!canManageFamily) return;
    triggerSelectionFeedback();
    setAvatarTargetBaby(baby);
    setAvatarPickerVisible(true);
  };

  const openEditBaby = (baby: BabyProfile) => {
    if (!canManageFamily) return;
    triggerSelectionFeedback();
    setEditBabyTarget(baby);
    setEditBabyName(baby.firstName);
    setEditBabyBirthDate(baby.birthDate.slice(0, 10));
    setEditBabySex(baby.sex);
    setEditBabyFeedingMode(baby.feedingMode);
    setEditBabyVisible(true);
  };


  // --- Save handlers ---
  const saveFamilyProfile = async () => {
    await updateFamilyDetails({ name: familyName });
    setEditFamilyVisible(false);
  };

  const addVisitDraft = () => {
    const nextValue = visitDraft.trim();
    if (!nextValue) return;
    setVisitTypesDraft((current) =>
      normalizeVisitTypes([...current, nextValue]),
    );
    setVisitDraft("");
  };

  const removeVisitDraft = (value: string) => {
    setVisitTypesDraft((current) => current.filter((item) => item !== value));
  };

  const saveVisitTypes = async () => {
    const merged = visitDraft.trim()
      ? normalizeVisitTypes([...visitTypesDraft, visitDraft.trim()])
      : normalizeVisitTypes(visitTypesDraft);
    setVisitTypesDraft(merged);
    setVisitDraft('');
    await updateFamilyDetails({ visitTypes: merged });
    setVisitTypesVisible(false);
  };

  const addCareDraft = () => {
    const nextValue = careDraft.trim();
    if (!nextValue) return;
    setCareTypesDraft((current) =>
      normalizeCareTypes([...current, nextValue]),
    );
    setCareDraft("");
  };

  const removeCareDraft = (value: string) => {
    setCareTypesDraft((current) => current.filter((item) => item !== value));
  };

  const saveCareTypes = async () => {
    const merged = careDraft.trim()
      ? normalizeCareTypes([...careTypesDraft, careDraft.trim()])
      : normalizeCareTypes(careTypesDraft);
    setCareTypesDraft(merged);
    setCareDraft('');
    await updateFamilyDetails({ careTypes: merged });
    setCareTypesVisible(false);
  };

  const saveNewChild = async () => {
    await addBaby({
      firstName: childName,
      birthDate: childBirthDate,
      sex: childSex,
      feedingMode: childFeedingMode,
      avatarKey: childAvatarKey,
      setAsActive: false,
    });
    setAddChildVisible(false);
  };

  const openEditParent = () => {
    triggerSelectionFeedback();
    setEditDisplayName(profile?.displayName ?? "");
    setEditParentVisible(true);
  };

  const saveEditParent = async () => {
    try {
      await updateUserInfo({ displayName: editDisplayName });
      setEditParentVisible(false);
    } catch {
      setEditParentVisible(false);
    }
  };

  const saveEditBaby = async () => {
    if (!editBabyTarget) return;
    await updateBabyInfo(editBabyTarget.id, {
      firstName: editBabyName,
      birthDate: editBabyBirthDate,
      sex: editBabySex,
      feedingMode: editBabyFeedingMode,
    });
    setEditBabyVisible(false);
    setEditBabyTarget(null);
  };

  return (
    <Screen topBar={<EditorialTopBar />}>
      {/* ── FAMILLE (unified adults + babies) ── */}
      <View
        style={[
          styles.sectionCard,
          { backgroundColor: theme.surfaceLowest, shadowColor: theme.shadow },
        ]}
      >
        <View style={styles.sectionHeader}>
          <Text
            style={[
              styles.sectionTitle,
              { color: theme.text, fontFamily: theme.fontSemiBold },
            ]}
          >
            {currentFamily?.name ?? (language === "fr" ? "Ma famille" : "My family")}
          </Text>
          {canManageFamily ? (
            <Pressable onPress={openEditProfile}>
              <Text
                style={[
                  styles.sectionAction,
                  { color: theme.primary, fontFamily: theme.fontBold },
                ]}
              >
                {language === "fr" ? "Modifier" : "Edit"}
              </Text>
            </Pressable>
          ) : null}
        </View>

        {/* ── Card : Combinaison de parents (nudge non-bloquant si non-set) ── */}
        {canManageFamily && currentFamily && !currentFamily.parentsCombination ? (
          <Pressable
            onPress={() => setParentsComboVisible(true)}
            style={[
              styles.parentsComboCard,
              { backgroundColor: `${theme.primary}0F`, borderColor: `${theme.primary}30` },
            ]}
          >
            <View style={[styles.parentsComboIcon, { backgroundColor: `${theme.primary}22` }]}>
              <Icon name="people" size={20} color={theme.primary} />
            </View>
            <View style={styles.parentsComboBody}>
              <Text style={[styles.parentsComboTitle, { color: theme.text, fontFamily: theme.fontSemiBold }]}>
                {language === "fr" ? "Qui êtes-vous ?" : "Who are you?"}
              </Text>
              <Text style={[styles.parentsComboText, { color: theme.textMuted, fontFamily: theme.fontRegular }]}>
                {language === "fr"
                  ? "Indiquez si ce compte est géré par Papa, Maman, ou les deux."
                  : "Tell us if this account is managed by Dad, Mom, or both."}
              </Text>
            </View>
            <Icon name="chevron-forward" size={20} color={theme.primary} />
          </Pressable>
        ) : null}

        {/* ── Card : Combinaison de parents (affichage si déjà set) ── */}
        {canManageFamily && currentFamily?.parentsCombination ? (
          <Pressable
            onPress={() => setParentsComboVisible(true)}
            style={[
              styles.parentsComboCardSet,
              { backgroundColor: theme.surfaceRaised, borderColor: theme.hairline },
            ]}
          >
            <Icon name="people-outline" size={18} color={theme.primary} />
            <Text style={[styles.parentsComboTextSet, { color: theme.text, fontFamily: theme.fontMedium }]}>
              {comboLabel(currentFamily.parentsCombination, language)}
            </Text>
            <Icon name="create-outline" size={16} color={theme.textMuted} />
          </Pressable>
        ) : null}

        {/* ── Moi ── */}
        {myMember ? (
          <View
            style={[
              styles.memberRow,
              {
                backgroundColor: `${theme.primary}08`,
                borderRadius: radii.lg,
                paddingHorizontal: spacing.sm,
              },
            ]}
          >
            <Pressable
              onPress={() => void pickUserPhoto()}
              style={styles.memberPhotoWrap}
            >
              {(localUserPhotoUri ?? profile?.photoUrl) ? (
                <Image
                  source={{ uri: localUserPhotoUri ?? profile!.photoUrl! }}
                  style={styles.memberPhoto}
                />
              ) : (
                <View
                  style={[
                    styles.memberPhoto,
                    styles.memberInitialsCircle,
                    { backgroundColor: `${theme.primary}20` },
                  ]}
                >
                  <Text
                    style={[
                      styles.memberInitialsText,
                      { color: theme.primary, fontFamily: theme.fontBold },
                    ]}
                  >
                    {getInitials(profile?.displayName ?? authUser?.email ?? "?")}
                  </Text>
                </View>
              )}
              <View
                style={[
                  styles.memberCameraBtn,
                  { backgroundColor: theme.primaryContainer },
                ]}
              >
                <Icon name="camera" size={10} color={theme.primary} />
              </View>
            </Pressable>
            <View style={styles.memberCopy}>
              <View style={styles.memberNameRow}>
                <Text
                  style={[
                    styles.childName,
                    { color: theme.text, fontFamily: theme.fontMedium },
                  ]}
                >
                  {profile?.displayName ?? authUser?.email ?? "—"}
                </Text>
                <View
                  style={[styles.youBadge, { backgroundColor: `${theme.primary}18` }]}
                >
                  <Text
                    style={[
                      styles.youBadgeText,
                      { color: theme.primary, fontFamily: theme.fontBold },
                    ]}
                  >
                    {language === "fr" ? "Vous" : "You"}
                  </Text>
                </View>
              </View>
              <Text
                style={[
                  styles.childMeta,
                  { color: theme.textMuted, fontFamily: theme.fontRegular },
                ]}
              >
                {authUser?.email ?? (myMember.parentLabel ?? getRoleLabel(myMember.role))}
              </Text>
            </View>
            <Pressable onPress={openEditParent} style={styles.editLabelBtn}>
              <Icon name="create-outline" size={16} color={theme.primary} />
            </Pressable>
          </View>
        ) : null}

        {/* ── Enfants ── */}
        {babies.length > 0 ? (
          <Text
            style={[
              styles.subSectionLabel,
              { color: theme.textSoft, fontFamily: theme.fontBold },
            ]}
          >
            {language === "fr" ? "Enfants" : "Children"}
          </Text>
        ) : null}

        {babies.map((baby) => {
          const isSelected = currentBaby?.id === baby.id;
          return (
            <View key={baby.id}>
              <View
                style={[
                  styles.childRow,
                  {
                    backgroundColor: isSelected
                      ? `${theme.secondaryContainer}AA`
                      : theme.surfaceRaised,
                    borderColor: isSelected ? `${theme.primary}30` : "transparent",
                  },
                ]}
              >
                <Pressable
                  style={styles.childLeft}
                  onPress={() => openEditBaby(baby)}
                >
                  <Image
                    source={{
                      uri: localBabyPhotoUris[baby.id] ?? baby.photoUrl ?? getBabyAvatarUri(baby.avatarKey),
                    }}
                    style={styles.babyRowPhoto}
                  />
                  <View style={styles.childCopy}>
                    <Text
                      style={[
                        styles.childName,
                        { color: theme.text, fontFamily: theme.fontSemiBold },
                      ]}
                    >
                      {baby.firstName}
                    </Text>
                    <Text
                      style={[
                        styles.childMeta,
                        { color: theme.textMuted, fontFamily: theme.fontRegular },
                      ]}
                    >
                      {formatBabyAge(baby.birthDate, language)}
                    </Text>
                  </View>
                </Pressable>
                <View style={styles.childRight}>
                  <Pressable
                    onPress={() => {
                      triggerSelectionFeedback();
                      void selectBaby(baby.id);
                    }}
                    style={[
                      styles.activeToggle,
                      {
                        backgroundColor: isSelected
                          ? theme.primaryContainer
                          : theme.surfaceContainerHigh,
                      },
                    ]}
                  >
                    <Icon
                      name={isSelected ? "checkmark" : "ellipse-outline"}
                      size={14}
                      color={isSelected ? theme.primary : theme.textSoft}
                    />
                  </Pressable>
                  <Pressable onPress={() => openEditBaby(baby)}>
                    <Icon name="chevron-forward" size={18} color={theme.textSoft} />
                  </Pressable>
                </View>
              </View>

              {/* Co-parents + share link */}
              <View style={styles.childFooterRow}>
                {otherMembers.length > 0 ? (
                  <View style={styles.coParentsList}>
                    {otherMembers.map((m) => {
                      const isViewer = m.role === 'viewer';

                      const roleLabel = isViewer
                        ? (language === 'fr' ? 'Lecture seule' : 'Read-only')
                        : (language === 'fr' ? 'Parent' : 'Parent');

                      const badgeBg = isViewer ? `${theme.warning}18` : `${theme.primary}10`;
                      const badgeColor = isViewer ? theme.warning : theme.primary;

                      return (
                        <View key={m.uid} style={styles.coParentRow}>
                          <Icon name="person-outline" size={12} color={theme.textSoft} />
                          <Text
                            style={[styles.childMeta, { color: theme.textSoft, fontFamily: theme.fontMedium, flex: 1 }]}
                            numberOfLines={1}
                          >
                            {m.parentLabel ?? m.displayName}
                          </Text>
                          <View style={[styles.roleBadge, { backgroundColor: badgeBg }]}>
                            <Text style={[styles.roleBadgeText, { color: badgeColor, fontFamily: theme.fontMedium }]}>
                              {roleLabel}
                            </Text>
                          </View>

                          {/* Promouvoir en parent — tout manager, pour un viewer */}
                          {canManageFamily && isViewer ? (
                            <Pressable
                              hitSlop={8}
                              onPress={() => {
                                triggerSelectionFeedback();
                                confirmAction(
                                  language === 'fr' ? 'Donner accès complet' : 'Grant full access',
                                  language === 'fr'
                                    ? `Donner à ${m.parentLabel ?? m.displayName} le plein accès (enregistrement, modification) ?`
                                    : `Give ${m.parentLabel ?? m.displayName} full access (record, edit)?`,
                                  () => { void updateMemberRole(m.uid, 'manager'); },
                                  { confirmLabel: language === 'fr' ? 'Confirmer' : 'Confirm' },
                                );
                              }}
                            >
                              <Icon name="checkmark-circle-outline" size={16} color={theme.primary} />
                            </Pressable>
                          ) : null}

                          {/* Retirer de la famille — tout manager */}
                          {canManageFamily ? (
                            <Pressable
                              hitSlop={8}
                              onPress={() => {
                                triggerSelectionFeedback();
                                confirmAction(
                                  language === 'fr' ? "Retirer l'accès" : 'Remove access',
                                  language === 'fr'
                                    ? `Retirer ${m.parentLabel ?? m.displayName} de la famille ?`
                                    : `Remove ${m.parentLabel ?? m.displayName} from the family?`,
                                  () => { void removeFamilyMember(m.uid); },
                                  {
                                    confirmLabel: language === 'fr' ? 'Retirer' : 'Remove',
                                    danger: true,
                                  },
                                );
                              }}
                            >
                              <Icon name="remove-circle-outline" size={15} color={theme.warning} />
                            </Pressable>
                          ) : null}
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  <View />
                )}
              </View>
            </View>
          );
        })}

        {/* Add child / Rejoindre */}
        {canManageFamily ? (
          <Pressable
            onPress={() => openAddChild('create')}
            style={[styles.addChildRow, { borderColor: `${theme.primary}30` }]}
          >
            <Icon name="add-circle-outline" size={18} color={theme.primary} />
            <Text
              style={[
                styles.sectionAction,
                { color: theme.primary, fontFamily: theme.fontBold },
              ]}
            >
              {t("settings.add_child")}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => openAddChild('join')}
            style={styles.joinChildRow}
          >
            <Icon name="person-add-outline" size={15} color={theme.textSoft} />
            <Text
              style={[
                styles.sectionAction,
                { color: theme.textSoft, fontFamily: theme.fontMedium },
              ]}
            >
              {language === "fr" ? "Ajouter un enfant par code" : "Add a child by code"}
            </Text>
            <Icon name="chevron-forward" size={14} color={theme.textSoft} />
          </Pressable>
        )}
      </View>

      {/* ── PERSONNALISATION ── */}
      <View
        style={[
          styles.sectionCard,
          { backgroundColor: theme.surfaceLowest, shadowColor: theme.shadow },
        ]}
      >
        <Text
          style={[
            styles.sectionEyebrow,
            { color: theme.primary, fontFamily: theme.fontBold },
          ]}
        >
          {language === "fr" ? "Personnalisation" : "Customization"}
        </Text>
        <SegmentRow<AppLanguage>
          label={t("settings.language")}
          value={appLanguage}
          options={[
            { value: "fr", label: t("language.french") },
            { value: "en", label: t("language.english") },
          ]}
          onChange={(nextValue) => void setLanguagePreference(nextValue)}
        />
        <ToggleRow
          icon="moon-outline"
          label={t("settings.night_mode")}
          enabled={isNightMode}
          onPress={() => setThemeMode(isNightMode ? "light" : "dark")}
        />
        <ToggleRow
          icon="notifications-outline"
          label={t("settings.notifications")}
          enabled={notificationsGranted}
          onPress={requestNotificationAccess}
        />
      </View>

      {/* ── OPTIONS ── */}
      {canManageFamily ? (
        <View
          style={[
            styles.sectionCard,
            { backgroundColor: theme.surfaceLowest, shadowColor: theme.shadow },
          ]}
        >
          <Text
            style={[
              styles.sectionEyebrow,
              { color: theme.primary, fontFamily: theme.fontBold },
            ]}
          >
            {language === "fr" ? "Options" : "Options"}
          </Text>
          <LinkRow
            icon="calendar-outline"
            label={t("settings.visit_types")}
            onPress={openVisitTypes}
          />
          <LinkRow
            icon="heart-outline"
            label={language === "fr" ? "Soins personnalisés" : "Custom care"}
            onPress={openCareTypes}
          />
          <LinkRow
            icon="folder-open-outline"
            label={language === "fr" ? "Données" : "Data"}
            onPress={() => { triggerSelectionFeedback(); setDataVisible(true); }}
          />
        </View>
      ) : null}

      {/* ── COMPTE ── */}
      <View
        style={[
          styles.sectionCard,
          { backgroundColor: theme.surfaceLowest, shadowColor: theme.shadow },
        ]}
      >
        <Text
          style={[
            styles.sectionEyebrow,
            { color: theme.primary, fontFamily: theme.fontBold },
          ]}
        >
          {t("settings.account")}
        </Text>
        {/* Sécurité & Sync — une seule entrée fusionnée */}
        <Pressable
          style={styles.settingRow}
          onPress={() => { triggerSelectionFeedback(); setSyncInfoVisible(true); }}
        >
          <View style={styles.settingLeft}>
            <Icon
              name="shield-checkmark-outline"
              size={18}
              color={
                syncMeta.tone === "success"
                  ? theme.primary
                  : syncMeta.tone === "warning"
                    ? theme.warning
                    : theme.textSoft
              }
            />
            <Text style={[styles.settingLabel, { color: theme.text, fontFamily: theme.fontMedium }]}>
              {language === "fr" ? "Sécurité & Synchronisation" : "Security & Sync"}
            </Text>
          </View>
          {syncMeta.tone === "success" ? (
            <Icon name="checkmark-circle" size={18} color={theme.primary} />
          ) : syncMeta.tone === "warning" ? (
            <AppBadge label={language === "fr" ? "À vérifier" : "Check"} tone="warning" />
          ) : (
            <Icon name="ellipsis-horizontal" size={16} color={theme.textSoft} />
          )}
        </Pressable>
        <LinkRow
          icon="sparkles-outline"
          label={t("settings.tutorial")}
          onPress={() => setTutorialVisible(true)}
        />
        {authUser?.email === "admin@charlie.com" ? (
          <LinkRow
            icon="terminal-outline"
            label="Journaux"
            onPress={() => setLogsVisible(true)}
          />
        ) : null}
      </View>

      {/* ── FOOTER ── */}
      <AppButton onPress={isSandbox ? exitSandbox : logout}>
        {isSandbox ? t("settings.quit_sandbox") : t("settings.logout")}
      </AppButton>

      {/* ── DANGER ZONE — RGPD account deletion ── */}
      {!isSandbox && authUser ? (
        <View style={styles.dangerZone}>
          <Text
            style={[
              styles.dangerZoneTitle,
              { color: theme.danger, fontFamily: theme.fontBold },
            ]}
          >
            {language === 'fr' ? 'Zone dangereuse' : 'Danger zone'}
          </Text>
          <Text
            style={[
              styles.dangerZoneBody,
              { color: theme.textMuted, fontFamily: theme.fontRegular },
            ]}
          >
            {language === 'fr'
              ? "La suppression de votre compte efface définitivement vos données : famille, bébés, événements, photos, soins. Cette action est irréversible."
              : 'Deleting your account permanently erases all your data: family, babies, events, photos, care. This action cannot be undone.'}
          </Text>
          <Pressable
            onPress={() => {
              triggerSelectionFeedback();
              setDeleteAccountPassword("");
              setDeleteAccountConfirmText("");
              setDeleteAccountVisible(true);
            }}
            style={({ pressed }) => [
              styles.dangerBtn,
              { borderColor: theme.danger, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text style={[styles.dangerBtnLabel, { color: theme.danger, fontFamily: theme.fontSemiBold }]}>
              {language === 'fr' ? 'Supprimer mon compte' : 'Delete my account'}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {isSandbox ? (
        <Text
          style={[
            styles.sandboxNote,
            { color: theme.textSoft, fontFamily: theme.fontMedium },
          ]}
        >
          {t("settings.test_mode", { email: authUser?.email ?? "—" })}
        </Text>
      ) : null}

      {/* ── DEV : Sync state simulator — sandbox only ── */}
      {canUseDevTools && isSandbox && debugSetSyncStatus ? (
        <View style={[styles.devPanel, { backgroundColor: `${theme.warning}12`, borderColor: `${theme.warning}30` }]}>
          <Text style={[styles.devPanelTitle, { color: theme.warning, fontFamily: theme.fontBold }]}>
            {language === 'fr' ? '🛠 Test sync' : '🛠 Sync tester'}
          </Text>
          <View style={styles.devPanelRow}>
            {(['syncing', 'live', 'error', 'offline'] as const).map((s) => (
              <Pressable
                key={s}
                style={[
                  styles.devPanelBtn,
                  {
                    backgroundColor: syncStatus === s ? theme.warning : `${theme.warning}20`,
                    borderColor: `${theme.warning}50`,
                  },
                ]}
                onPress={() => { triggerSelectionFeedback(); debugSetSyncStatus(s); }}
              >
                <Text style={[styles.devPanelBtnText, { color: syncStatus === s ? theme.background : theme.warning, fontFamily: theme.fontSemiBold }]}>
                  {s}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {/* ── DEV : Growth-spurt mock selector — dev tools / sandbox ── */}
      {canUseDevTools ? (
        <View style={[styles.devPanel, { backgroundColor: `${theme.warning}12`, borderColor: `${theme.warning}30` }]}>
          <Text style={[styles.devPanelTitle, { color: theme.warning, fontFamily: theme.fontBold }]}>
            {language === 'fr' ? '🛠 Mock — pic de croissance' : '🛠 Growth-spurt mock'}
          </Text>
          <Text style={[styles.devPanelHint, { color: theme.textMuted, fontFamily: theme.fontRegular }]}>
            {language === 'fr'
              ? "Force l'affichage de la bannière dans Today avec un scénario simulé."
              : "Force the Today banner to render a simulated scenario."}
          </Text>
          <View style={styles.devPanelStack}>
            {GROWTH_SPURT_MOCK_OPTIONS.map((opt) => {
              const active = growthSpurtMock === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => { triggerSelectionFeedback(); setGrowthSpurtMock(opt.key); }}
                  style={[
                    styles.mockOption,
                    {
                      backgroundColor: active ? theme.warning : `${theme.warning}10`,
                      borderColor: active ? theme.warning : `${theme.warning}40`,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.mockOptionLabel,
                      { color: active ? theme.background : theme.warning, fontFamily: theme.fontSemiBold },
                    ]}
                  >
                    {opt.label}
                  </Text>
                  <Text
                    style={[
                      styles.mockOptionDescription,
                      { color: active ? theme.background : theme.textMuted, fontFamily: theme.fontRegular },
                    ]}
                  >
                    {opt.description}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {/* ════════════════ MODALS ════════════════ */}

      {/* Edit parent profile (nom + rôle/alias fusionnés) */}
      <ModalSheet
        visible={editParentVisible}
        title={language === "fr" ? "Mon profil" : "My profile"}
        onClose={() => setEditParentVisible(false)}
      >
        {/* Photo */}
        <Pressable onPress={() => void pickUserPhoto()} style={styles.editBabyPhotoBtn}>
          {(localUserPhotoUri ?? profile?.photoUrl) ? (
            <Image
              source={{ uri: localUserPhotoUri ?? profile!.photoUrl! }}
              style={styles.editBabyPhoto}
            />
          ) : (
            <View style={[styles.editBabyPhoto, { backgroundColor: `${theme.primary}20`, alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={[styles.memberInitialsText, { color: theme.primary, fontFamily: theme.fontBold, fontSize: 24 }]}>
                {getInitials(profile?.displayName ?? authUser?.email ?? '?')}
              </Text>
            </View>
          )}
          <View style={[styles.memberCameraBtn, { backgroundColor: theme.primaryContainer }]}>
            <Icon name="camera" size={10} color={theme.primary} />
          </View>
        </Pressable>

        {/* Nom affiché */}
        <AppInput
          label={language === "fr" ? "Prénom / Nom affiché" : "Display name"}
          value={editDisplayName}
          onChangeText={setEditDisplayName}
          placeholder={language === "fr" ? "Votre nom" : "Your name"}
        />

        <View style={styles.modalActions}>
          <AppButton style={styles.modalButton} variant="secondary" onPress={() => setEditParentVisible(false)}>
            {t("common.cancel")}
          </AppButton>
          <AppButton
            style={styles.modalButton}
            disabled={saving || !editDisplayName.trim()}
            onPress={() => void saveEditParent()}
          >
            {t("common.save")}
          </AppButton>
        </View>
      </ModalSheet>

      {/* Edit baby */}
      <ModalSheet
        visible={editBabyVisible}
        title={
          editBabyTarget
            ? editBabyTarget.firstName
            : language === "fr"
              ? "Modifier le bébé"
              : "Edit baby"
        }
        onClose={() => {
          setEditBabyVisible(false);
          setEditBabyTarget(null);
        }}
      >
        {editBabyTarget ? (
          <Pressable
            onPress={() => void pickBabyPhoto(editBabyTarget.id)}
            style={styles.editBabyPhotoBtn}
          >
            {(localBabyPhotoUris[editBabyTarget.id] ?? editBabyTarget.photoUrl) ? (
              <Image
                source={{ uri: localBabyPhotoUris[editBabyTarget.id] ?? editBabyTarget.photoUrl! }}
                style={styles.editBabyPhoto}
              />
            ) : (
              <Image
                source={{ uri: getBabyAvatarUri(editBabyTarget.avatarKey) }}
                style={styles.editBabyPhoto}
              />
            )}
            <View
              style={[
                styles.heroCameraBtn,
                { backgroundColor: theme.primaryContainer },
              ]}
            >
              <Icon name="camera" size={14} color={theme.primary} />
            </View>
          </Pressable>
        ) : null}
        <AppInput
          label={t("settings.child_name")}
          value={editBabyName}
          onChangeText={setEditBabyName}
          placeholder={language === "fr" ? "Charlie" : "Charlie"}
        />
        <BirthDatePicker
          label={t("settings.child_birth_date")}
          value={editBabyBirthDate}
          onChange={setEditBabyBirthDate}
          locale={language}
        />
        <SegmentRow<BabySex>
          label={t("settings.child_sex")}
          value={editBabySex}
          options={[
            { value: "boy", label: t("onboarding.sex.boy") },
            { value: "girl", label: t("onboarding.sex.girl") },
          ]}
          onChange={setEditBabySex}
        />
        <SegmentRow<FeedingMode>
          label={t("settings.feeding_mode")}
          value={editBabyFeedingMode}
          options={[
            {
              value: "breastfeeding",
              label: t(feedingModeLabelKey("breastfeeding")),
            },
            { value: "bottle", label: t(feedingModeLabelKey("bottle")) },
            { value: "mixed", label: t(feedingModeLabelKey("mixed")) },
          ]}
          onChange={setEditBabyFeedingMode}
        />
        <View style={styles.modalActions}>
          <AppButton
            style={styles.modalButton}
            variant="secondary"
            onPress={() => {
              setEditBabyVisible(false);
              setEditBabyTarget(null);
            }}
          >
            {t("common.cancel")}
          </AppButton>
          <AppButton
            style={styles.modalButton}
            disabled={
              saving || !editBabyName.trim() || !editBabyBirthDate.trim()
            }
            onPress={() => void saveEditBaby()}
          >
            {t("common.save")}
          </AppButton>
        </View>
      </ModalSheet>

      {/* Add child */}
      <ModalSheet
        visible={addChildVisible}
        title={addChildMode === 'join'
          ? (language === "fr" ? "Ajouter un enfant" : "Add a child")
          : t("settings.add_child")}
        onClose={() => setAddChildVisible(false)}
      >
        {/* Tab switcher — only shown for owners/parents who can do both */}
        {canManageFamily ? (
          <View style={styles.addChildTabs}>
            <Pressable
              style={[
                styles.addChildTab,
                addChildMode === 'create'
                  ? { backgroundColor: theme.primaryContainer, borderColor: theme.primary }
                  : { backgroundColor: theme.surfaceRaised, borderColor: theme.hairline },
              ]}
              onPress={() => { triggerSelectionFeedback(); setAddChildMode('create'); }}
            >
              <Text style={[styles.addChildTabLabel, {
                color: addChildMode === 'create' ? theme.primary : theme.textSoft,
                fontFamily: addChildMode === 'create' ? theme.fontBold : theme.fontMedium,
              }]}>
                {language === "fr" ? "Créer" : "Create"}
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.addChildTab,
                addChildMode === 'join'
                  ? { backgroundColor: theme.primaryContainer, borderColor: theme.primary }
                  : { backgroundColor: theme.surfaceRaised, borderColor: theme.hairline },
              ]}
              onPress={() => { triggerSelectionFeedback(); setAddChildMode('join'); }}
            >
              <Text style={[styles.addChildTabLabel, {
                color: addChildMode === 'join' ? theme.primary : theme.textSoft,
                fontFamily: addChildMode === 'join' ? theme.fontBold : theme.fontMedium,
              }]}>
                {language === "fr" ? "Rejoindre" : "Join"}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {addChildMode === 'create' ? (
          <>
            <AppInput
              label={t("settings.child_name")}
              value={childName}
              onChangeText={setChildName}
              placeholder={language === "fr" ? "Charlie" : "Charlie"}
            />
            <BirthDatePicker
              label={t("settings.child_birth_date")}
              value={childBirthDate}
              onChange={setChildBirthDate}
              locale={language}
            />
            <SegmentRow<BabySex>
              label={t("settings.child_sex")}
              value={childSex}
              options={[
                { value: "boy", label: t("onboarding.sex.boy") },
                { value: "girl", label: t("onboarding.sex.girl") },
              ]}
              onChange={setChildSex}
            />
            <SegmentRow<FeedingMode>
              label={t("settings.feeding_mode")}
              value={childFeedingMode}
              options={[
                { value: "breastfeeding", label: t(feedingModeLabelKey("breastfeeding")) },
                { value: "bottle", label: t(feedingModeLabelKey("bottle")) },
                { value: "mixed", label: t(feedingModeLabelKey("mixed")) },
              ]}
              onChange={setChildFeedingMode}
            />
            <View style={styles.avatarPickerBlock}>
              <Text style={[styles.settingLabel, { color: theme.text, fontFamily: theme.fontMedium }]}>
                {t("settings.child_avatar")}
              </Text>
              <View style={styles.avatarGrid}>
                {babyAvatarOptions.map((avatarKey) => {
                  const selected = avatarKey === childAvatarKey;
                  return (
                    <Pressable
                      key={avatarKey}
                      onPress={() => { triggerSelectionFeedback(); setChildAvatarKey(avatarKey); }}
                      style={[
                        styles.avatarOption,
                        {
                          borderColor: selected ? theme.primary : "transparent",
                          backgroundColor: selected ? `${theme.secondaryContainer}AA` : theme.surfaceRaised,
                        },
                      ]}
                    >
                      <Image source={{ uri: getBabyAvatarUri(avatarKey) }} style={styles.avatarOptionImage} />
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <View style={styles.modalActions}>
              <AppButton style={styles.modalButton} variant="secondary" onPress={() => setAddChildVisible(false)}>
                {t("common.cancel")}
              </AppButton>
              <AppButton
                style={styles.modalButton}
                disabled={saving || !childName.trim() || !childBirthDate.trim()}
                onPress={() => void saveNewChild()}
              >
                {t("settings.save_child")}
              </AppButton>
            </View>
          </>
        ) : (
          <>
            <Text style={[styles.syncBody, { color: theme.textMuted, fontFamily: theme.fontRegular }]}>
              {language === "fr"
                ? "Entrez le code partagé par un proche pour rejoindre sa famille et accéder aux données de son enfant."
                : "Enter the code shared by a family member to join their family and access their child's data."}
            </Text>
            <AppInput
              label={language === "fr" ? "Code enfant" : "Child code"}
              value={joinCodeDraft}
              onChangeText={(v) => setJoinCodeDraft(v.toUpperCase())}
              placeholder="TESTFAM1"
            />
            <View style={styles.modalActions}>
              <AppButton style={styles.modalButton} variant="secondary" onPress={() => setAddChildVisible(false)}>
                {t("common.cancel")}
              </AppButton>
              <AppButton
                style={styles.modalButton}
                disabled={saving || joinCodeDraft.trim().length < 4}
                onPress={() => void handleJoinChild()}
              >
                {language === "fr" ? "Rejoindre" : "Join"}
              </AppButton>
            </View>
          </>
        )}
      </ModalSheet>

      {/* Edit family */}
      <ModalSheet
        visible={editFamilyVisible}
        title={t("settings.edit_family")}
        onClose={() => setEditFamilyVisible(false)}
      >
        <AppInput
          label={t("settings.family_name")}
          value={familyName}
          onChangeText={setFamilyName}
          placeholder={language === "fr" ? "Famille Morel" : "Morel family"}
        />
        <View style={styles.modalActions}>
          <AppButton
            style={styles.modalButton}
            variant="secondary"
            onPress={() => setEditFamilyVisible(false)}
          >
            {t("common.cancel")}
          </AppButton>
          <AppButton
            style={styles.modalButton}
            disabled={saving || !familyName.trim()}
            onPress={() => void saveFamilyProfile()}
          >
            {t("settings.save_profile")}
          </AppButton>
        </View>
      </ModalSheet>

      {/* Visit types */}
      <ModalSheet
        visible={visitTypesVisible}
        title={t("settings.visit_types")}
        onClose={() => setVisitTypesVisible(false)}
      >
        <Text
          style={[
            styles.syncBody,
            { color: theme.textMuted, fontFamily: theme.fontRegular },
          ]}
        >
          {t("settings.visit_types_body")}
        </Text>
        <AppInput
          label={t("settings.visit_name")}
          value={visitDraft}
          onChangeText={setVisitDraft}
          placeholder={language === "fr" ? "Ostéopathe" : "Osteopath"}
        />
        <View style={styles.chipsWrap}>
          {visitTypesDraft.map((visitName) => (
            <Pressable
              key={visitName}
              onPress={() => removeVisitDraft(visitName)}
              style={[
                styles.visitChip,
                {
                  backgroundColor: theme.surfaceRaised,
                  borderColor: theme.cardBorderStrong,
                },
              ]}
            >
              <Text
                style={[
                  styles.visitChipLabel,
                  { color: theme.text, fontFamily: theme.fontMedium },
                ]}
              >
                {visitName}
              </Text>
              <Icon name="close" size={14} color={theme.textSoft} />
            </Pressable>
          ))}
        </View>
        <View style={styles.modalActions}>
          <AppButton
            style={styles.modalButton}
            variant="secondary"
            onPress={() => setVisitTypesVisible(false)}
          >
            {t("common.cancel")}
          </AppButton>
          <AppButton
            style={styles.modalButton}
            disabled={saving}
            onPress={() => void saveVisitTypes()}
          >
            {language === 'fr' ? 'Sauver' : 'Save'}
          </AppButton>
        </View>
      </ModalSheet>

      {/* Care types */}
      <ModalSheet
        visible={careTypesVisible}
        title={language === "fr" ? "Soins personnalisés" : "Custom care"}
        onClose={() => setCareTypesVisible(false)}
      >
        <Text
          style={[
            styles.syncBody,
            { color: theme.textMuted, fontFamily: theme.fontRegular },
          ]}
        >
          {language === "fr"
            ? "Ajoutez les soins récurrents (crème, ostéopathie, kiné…) pour les retrouver en un clic dans le tracker."
            : "Add recurring care actions (cream, osteopathy, physio…) to access them in one tap from the tracker."}
        </Text>
        <AppInput
          label={language === "fr" ? "Nom du soin" : "Care name"}
          value={careDraft}
          onChangeText={setCareDraft}
          placeholder={language === "fr" ? "Ostéopathie, Crème…" : "Osteopathy, Cream…"}
          onSubmitEditing={addCareDraft}
        />
        {careDraft.trim() ? (
          <Pressable
            onPress={addCareDraft}
            style={({ pressed }) => [
              styles.addCareDraftBtn,
              { backgroundColor: theme.primary, opacity: pressed ? 0.9 : 1 },
            ]}
          >
            <Icon name="add" size={16} color={theme.onPrimary} />
            <Text style={[styles.addCareDraftLabel, { color: theme.onPrimary, fontFamily: theme.fontSemiBold }]}>
              {language === "fr" ? "Ajouter à ma liste" : "Add to my list"}
            </Text>
          </Pressable>
        ) : null}
        <View style={styles.chipsWrap}>
          {careTypesDraft.map((careName) => (
            <Pressable
              key={careName}
              onPress={() => removeCareDraft(careName)}
              style={[
                styles.visitChip,
                {
                  backgroundColor: theme.surfaceRaised,
                  borderColor: theme.cardBorderStrong,
                },
              ]}
            >
              <Text
                style={[
                  styles.visitChipLabel,
                  { color: theme.text, fontFamily: theme.fontMedium },
                ]}
              >
                {careName}
              </Text>
              <Icon name="close" size={14} color={theme.textSoft} />
            </Pressable>
          ))}
        </View>
        <View style={styles.modalActions}>
          <AppButton
            style={styles.modalButton}
            variant="secondary"
            onPress={() => setCareTypesVisible(false)}
          >
            {t("common.cancel")}
          </AppButton>
          <AppButton
            style={styles.modalButton}
            disabled={saving}
            onPress={() => void saveCareTypes()}
          >
            {language === 'fr' ? 'Sauver' : 'Save'}
          </AppButton>
        </View>
      </ModalSheet>

      {/* Delete account — RGPD */}
      <ModalSheet
        visible={deleteAccountVisible}
        title={language === 'fr' ? 'Supprimer mon compte' : 'Delete account'}
        onClose={() => setDeleteAccountVisible(false)}
      >
        <Text
          style={[
            styles.syncBody,
            { color: theme.danger, fontFamily: theme.fontMedium },
          ]}
        >
          {language === 'fr'
            ? '⚠️ Cette action est définitive et irréversible.'
            : '⚠️ This action is final and cannot be undone.'}
        </Text>
        <Text
          style={[
            styles.syncBody,
            { color: theme.textMuted, fontFamily: theme.fontRegular },
          ]}
        >
          {language === 'fr'
            ? "Vous allez supprimer : votre profil, votre famille, tous les bébés associés, l'historique complet des événements, les soins, photos et codes d'invitation. Une fois supprimé, rien n'est récupérable."
            : 'You will delete: your profile, family, all associated babies, the complete event history, care, photos, and invite codes. Nothing can be recovered.'}
        </Text>
        <AppInput
          label={language === 'fr' ? 'Mot de passe (vérification)' : 'Password (verification)'}
          value={deleteAccountPassword}
          onChangeText={setDeleteAccountPassword}
          placeholder="••••••••"
          secureTextEntry
        />
        <AppInput
          label={language === 'fr' ? 'Tapez SUPPRIMER pour confirmer' : 'Type DELETE to confirm'}
          value={deleteAccountConfirmText}
          onChangeText={setDeleteAccountConfirmText}
          placeholder={language === 'fr' ? 'SUPPRIMER' : 'DELETE'}
          autoCapitalize="characters"
        />
        <View style={styles.modalActions}>
          <AppButton
            style={styles.modalButton}
            variant="secondary"
            onPress={() => setDeleteAccountVisible(false)}
          >
            {t('common.cancel')}
          </AppButton>
          <Pressable
            disabled={
              deleteAccountSaving ||
              !deleteAccountPassword.trim() ||
              deleteAccountConfirmText.trim().toUpperCase() !== (language === 'fr' ? 'SUPPRIMER' : 'DELETE')
            }
            onPress={async () => {
              setDeleteAccountSaving(true);
              try {
                await deleteAccount(deleteAccountPassword);
                setDeleteAccountVisible(false);
              } catch {
                // toast already shown by provider
              } finally {
                setDeleteAccountSaving(false);
              }
            }}
            style={({ pressed }) => [
              styles.modalButton,
              styles.dangerCommitBtn,
              {
                backgroundColor: theme.danger,
                opacity:
                  deleteAccountSaving ||
                  !deleteAccountPassword.trim() ||
                  deleteAccountConfirmText.trim().toUpperCase() !== (language === 'fr' ? 'SUPPRIMER' : 'DELETE')
                    ? 0.4
                    : pressed ? 0.85 : 1,
              },
            ]}
          >
            <Text style={[styles.dangerCommitLabel, { color: theme.onPrimary, fontFamily: theme.fontBold }]}>
              {deleteAccountSaving
                ? language === 'fr' ? 'Suppression…' : 'Deleting…'
                : language === 'fr' ? 'Supprimer définitivement' : 'Delete forever'}
            </Text>
          </Pressable>
        </View>
      </ModalSheet>

      {/* Avatar picker */}
      <ModalSheet
        visible={avatarPickerVisible}
        title={t("settings.child_avatar")}
        onClose={() => {
          setAvatarPickerVisible(false);
          setAvatarTargetBaby(null);
        }}
      >
        <View style={styles.avatarGrid}>
          {babyAvatarOptions.map((avatarKey) => {
            const selected = avatarTargetBaby?.avatarKey === avatarKey;
            return (
              <Pressable
                key={avatarKey}
                onPress={() => {
                  if (!avatarTargetBaby) return;
                  void updateBabyAvatar(avatarTargetBaby.id, avatarKey);
                  setAvatarPickerVisible(false);
                  setAvatarTargetBaby(null);
                }}
                style={[
                  styles.avatarOption,
                  {
                    borderColor: selected ? theme.primary : "transparent",
                    backgroundColor: selected
                      ? `${theme.secondaryContainer}AA`
                      : theme.surfaceRaised,
                  },
                ]}
              >
                <Image
                  source={{ uri: getBabyAvatarUri(avatarKey) }}
                  style={styles.avatarOptionImage}
                />
              </Pressable>
            );
          })}
        </View>
      </ModalSheet>

      {/* Parents combination modal — 5 choix */}
      <AppModal visible={parentsComboVisible} onClose={() => setParentsComboVisible(false)}>
        <Pressable
          style={[
            styles.centeredModalCard,
            { backgroundColor: theme.surfaceLowest, shadowColor: theme.shadow },
          ]}
          onPress={(event) => event.stopPropagation()}
        >
          <Text style={[{ fontSize: 18, color: theme.text, fontFamily: theme.fontSemiBold, textAlign: "center" }]}>
            {language === "fr" ? "Qui êtes-vous ?" : "Who are you?"}
          </Text>
          <Text style={[{ fontSize: 13, color: theme.textMuted, fontFamily: theme.fontRegular, textAlign: "center" }]}>
            {language === "fr"
              ? "Cette information sert à personnaliser les libellés dans l'app."
              : "This helps personalize labels throughout the app."}
          </Text>
          {PARENTS_COMBINATION_OPTIONS.map((combo) => {
            const isSelected = currentFamily?.parentsCombination === combo;
            return (
              <Pressable
                key={combo}
                onPress={async () => {
                  await setParentsCombination(combo);
                  setParentsComboVisible(false);
                }}
                style={[
                  styles.parentsComboOption,
                  {
                    borderColor: isSelected ? theme.primary : theme.hairline,
                    backgroundColor: isSelected ? `${theme.primary}14` : "transparent",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.parentsComboOptionText,
                    {
                      color: isSelected ? theme.primary : theme.text,
                      fontFamily: isSelected ? theme.fontSemiBold : theme.fontMedium,
                    },
                  ]}
                >
                  {comboLabel(combo, language)}
                </Text>
              </Pressable>
            );
          })}
          <Pressable onPress={() => setParentsComboVisible(false)} style={{ alignItems: "center", paddingVertical: spacing.xs }}>
            <Text style={[{ color: theme.textMuted, fontFamily: theme.fontRegular, fontSize: 14 }]}>
              {t("common.cancel")}
            </Text>
          </Pressable>
        </Pressable>
      </AppModal>

      {/* Per-child share modal */}
      <ModalSheet
        visible={childShareVisible}
        title={language === "fr" ? "Partager cet enfant" : "Share this child"}
        onClose={() => setChildShareVisible(false)}
      >
        <Text
          style={[styles.syncBody, { color: theme.textMuted, fontFamily: theme.fontRegular }]}
        >
          {language === "fr"
            ? "Partagez ce code avec un proche pour qu'il rejoigne votre famille et accède aux données de cet enfant."
            : "Share this code with someone to let them join your family and access this child's data."}
        </Text>
        {/* Code manager (co-parent) */}
        <View style={[styles.shareCard, { backgroundColor: theme.surfaceRaised }]}>
          <Text
            style={[styles.sectionEyebrow, { color: theme.primary, fontFamily: theme.fontBold }]}
          >
            {language === "fr" ? "Code co-parent (accès complet)" : "Co-parent code (full access)"}
          </Text>
          <Text
            style={[styles.shareCode, { color: theme.text, fontFamily: theme.fontBold }]}
          >
            {currentFamily?.managerCode ?? "—"}
          </Text>
        </View>
        <AppButton
          variant="secondary"
          onPress={() => {
            void Clipboard.setStringAsync(currentFamily?.managerCode ?? "—");
          }}
        >
          {language === "fr" ? "Copier code co-parent" : "Copy co-parent code"}
        </AppButton>

        {/* Code viewer (famille élargie) */}
        <View style={[styles.shareCard, { backgroundColor: theme.surfaceRaised }]}>
          <Text
            style={[styles.sectionEyebrow, { color: theme.primary, fontFamily: theme.fontBold }]}
          >
            {language === "fr" ? "Code famille (lecture seule)" : "Family code (read-only)"}
          </Text>
          <Text
            style={[styles.shareCode, { color: theme.text, fontFamily: theme.fontBold }]}
          >
            {currentFamily?.viewerCode ?? "—"}
          </Text>
        </View>
        <AppButton
          variant="secondary"
          onPress={() => {
            void Clipboard.setStringAsync(currentFamily?.viewerCode ?? "—");
          }}
        >
          {language === "fr" ? "Copier code famille" : "Copy family code"}
        </AppButton>
        <AppButton onPress={() => setChildShareVisible(false)}>
          {t("common.continue")}
        </AppButton>
      </ModalSheet>

      {/* Join by code */}
      <ModalSheet
        visible={familySharingVisible}
        title={language === "fr" ? "Ajouter un enfant" : "Add a child"}
        onClose={() => setFamilySharingVisible(false)}
      >
        <Text
          style={[styles.syncBody, { color: theme.textMuted, fontFamily: theme.fontRegular }]}
        >
          {language === "fr"
            ? "Entrez le code partagé par un proche pour rejoindre sa famille et accéder aux données de son enfant."
            : "Enter the code shared by a family member to join their family and access their child's data."}
        </Text>
        <AppInput
          label={language === "fr" ? "Code enfant" : "Child code"}
          value={joinCodeDraft}
          onChangeText={(v) => setJoinCodeDraft(v.toUpperCase())}
          placeholder="ABC12345"
        />
        <View style={styles.modalActions}>
          <AppButton
            style={styles.modalButton}
            variant="secondary"
            onPress={() => setFamilySharingVisible(false)}
          >
            {t("common.cancel")}
          </AppButton>
          <AppButton
            style={styles.modalButton}
            disabled={saving || joinCodeDraft.trim().length < 4}
            onPress={() => void handleJoinFamily()}
          >
            {language === "fr" ? "Rejoindre" : "Join"}
          </AppButton>
        </View>
      </ModalSheet>


      {/* Tutorial */}
      <ModalSheet
        visible={tutorialVisible}
        title={t("settings.tutorial")}
        onClose={() => setTutorialVisible(false)}
      >
        <Text
          style={[
            styles.syncBody,
            { color: theme.textMuted, fontFamily: theme.fontRegular },
          ]}
        >
          {t("settings.tutorial_body")}
        </Text>
        <AppButton onPress={() => setTutorialVisible(false)}>
          {t("common.continue")}
        </AppButton>
      </ModalSheet>


      {/* Sync & Security */}
      <ModalSheet
        visible={syncInfoVisible}
        title={language === 'fr' ? 'Sécurité & Synchronisation' : 'Security & Sync'}
        onClose={() => setSyncInfoVisible(false)}
      >
        {/* Statut de connexion */}
        <View style={[
          styles.shareCard,
          syncStatus === 'error'
            ? { backgroundColor: `${theme.warning}15`, borderWidth: 1, borderColor: `${theme.warning}35` }
            : { backgroundColor: `${theme.primary}0D` },
        ]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Icon
              name={syncStatus === 'error' ? 'alert-circle' : syncStatus === 'syncing' ? 'sync' : 'checkmark-circle'}
              size={16}
              color={syncStatus === 'error' ? theme.warning : syncStatus === 'syncing' ? theme.textSoft : theme.primary}
            />
            <Text style={[styles.sectionEyebrow, {
              color: syncStatus === 'error' ? theme.warning : syncStatus === 'syncing' ? theme.textSoft : theme.primary,
              fontFamily: theme.fontBold,
            }]}>
              {syncStatus === 'error'
                ? (language === 'fr' ? 'Données historiques inaccessibles' : 'Historical data unavailable')
                : syncStatus === 'syncing'
                  ? (language === 'fr' ? 'Synchronisation en cours…' : 'Syncing…')
                  : (language === 'fr' ? 'Données synchronisées' : 'Data synced')}
            </Text>
          </View>
          <Text style={[styles.childMeta, { color: theme.textMuted, fontFamily: theme.fontRegular }]}>
            {syncStatus === 'error'
              ? (language === 'fr'
                ? 'L\'application ne peut pas lire les données issues de l\'ancienne version web. Cela n\'affecte pas les nouvelles données. Redémarrez l\'app si le problème persiste.'
                : 'The app cannot read data from the old web version. This does not affect new data. Restart the app if the issue persists.')
              : (language === 'fr'
                ? 'Toutes les données sont à jour. Les modifications s\'appliquent en temps réel sur tous vos appareils.'
                : 'All data is up to date. Changes apply in real time across all your devices.')}
          </Text>
          {lastSyncedAt && syncStatus !== 'error' ? (
            <Text style={[styles.childMeta, { color: theme.textSoft, fontFamily: theme.fontRegular, marginTop: 4 }]}>
              {t('settings.sync_last', { value: formatDateTime(lastSyncedAt) })}
            </Text>
          ) : null}
        </View>

        {/* Rôles */}
        <Text style={[styles.syncBody, { color: theme.textMuted, fontFamily: theme.fontRegular }]}>
          {t('settings.security_body')}
        </Text>
        <AppButton onPress={() => setSyncInfoVisible(false)}>{t('common.continue')}</AppButton>
      </ModalSheet>

      {/* Données — page sheet depuis Paramètres */}
      <FullScreenPortal visible={dataVisible} onClose={() => setDataVisible(false)}>
        <DataScreen onClose={() => setDataVisible(false)} />
      </FullScreenPortal>

      {/* Logs viewer — owner only, full-screen page sheet */}
      <FullScreenPortal visible={logsVisible} onClose={() => setLogsVisible(false)}>
        <View
          style={[
            styles.logsModalContainer,
            { backgroundColor: theme.surfaceLowest },
          ]}
        >
          <View
            style={[
              styles.logsModalHeader,
              { borderBottomColor: theme.hairline },
            ]}
          >
            <Text
              style={[
                styles.logsModalTitle,
                { color: theme.text, fontFamily: theme.fontSemiBold },
              ]}
            >
              Journaux
            </Text>
            <Pressable
              onPress={() => setLogsVisible(false)}
              style={styles.logsModalClose}
            >
              <Icon name="close" size={22} color={theme.textSoft} />
            </Pressable>
          </View>
          <LogsScreen />
        </View>
      </FullScreenPortal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // ── Parents combination card ──
  parentsComboCard: {
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginTop: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  parentsComboIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  parentsComboBody: { flex: 1, gap: 2 },
  parentsComboTitle: { fontSize: 15, letterSpacing: -0.2 },
  parentsComboText: { fontSize: 13, lineHeight: 18 },
  parentsComboCardSet: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  parentsComboTextSet: { flex: 1, fontSize: 14 },
  centeredModalCard: {
    borderRadius: radii.xl,
    padding: spacing.xl,
    gap: spacing.md,
    shadowOpacity: 0.12,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 16 },
  },
  parentsComboOption: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: spacing.xs,
  },
  parentsComboOptionText: { fontSize: 15 },
  // ── HERO ──
  hero: {
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.sm,
    position: "relative",
  },
  heroOrb: {
    position: "absolute",
    top: -40,
    width: 240,
    height: 240,
    borderRadius: 120,
    opacity: 0.18,
  },
  heroAvatarWrap: {
    position: "relative",
    marginBottom: spacing.xs,
  },
  heroAvatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  heroInitialsWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  heroInitials: {
    fontSize: 28,
  },
  heroCameraBtn: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  heroName: {
    fontSize: 22,
    lineHeight: 28,
  },
  heroEmail: {
    fontSize: 14,
  },

  // ── BABY PHOTO ──
  babyPhotoWrap: {
    position: "relative",
  },
  babyRowPhoto: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },

  // ── MEMBER ROW ──
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  memberInitials: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  memberInitialsText: {
    fontSize: 14,
  },
  memberCopy: {
    flex: 1,
    gap: 2,
  },

  // ── INVITE ROW ──
  inviteRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  inviteCode: {
    fontSize: 18,
    letterSpacing: 0.6,
  },
  copyBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  // ── EDIT BABY PHOTO ──
  editBabyPhotoBtn: {
    alignSelf: "center",
    position: "relative",
    marginBottom: spacing.xs,
  },
  editBabyPhoto: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },

  // ── EXISTING STYLES (preserved) ──
  sectionCard: {
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.md,
    shadowOpacity: 0.05,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionHeaderActions: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "center",
  },
  editLabelBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  labelPresetsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  labelPresetChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 1.5,
  },

  // ── CONNECTED USER ROW ──
  memberPhotoWrap: {
    position: "relative",
  },
  memberPhoto: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  memberInitialsCircle: {
    alignItems: "center",
    justifyContent: "center",
  },
  memberCameraBtn: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  memberNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    flexWrap: "wrap",
  },
  memberActions: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  youBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  youBadgeText: {
    fontSize: 11,
  },

  // ── ACTIVE TOGGLE ──
  activeToggle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  // ── CHILD FOOTER (co-parents + share) ──
  childFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.xs,
    marginTop: 2,
  },
  coParentsInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flex: 1,
    marginRight: spacing.sm,
  },
  coParentsList: {
    flex: 1,
    gap: 4,
    marginRight: spacing.sm,
  },
  coParentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.xs,
  },
  roleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  roleBadgeText: {
    fontSize: 10,
  },
  shareInlineBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },

  // ── JOIN CHILD ROW ──
  joinChildRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },

  // ── ADD CHILD MODAL TABS ──
  addChildTabs: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  addChildTab: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  addChildTabLabel: {
    fontSize: 14,
  },

  // ── ADD CHILD ROW ──
  addChildRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderStyle: "dashed",
    justifyContent: "center",
    marginTop: spacing.xs,
  },

  // ── DIVIDER ──
  divider: {
    height: 1,
    marginVertical: spacing.md,
  },

  // ── SUB-SECTION LABEL ──
  subSectionLabel: {
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: spacing.xs,
    marginBottom: 2,
  },
  sectionTitle: {
    fontSize: 18,
  },
  sectionAction: {
    fontSize: 14,
  },
  childRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1.5,
  },
  childLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    flex: 1,
  },
  childRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  childCopy: {
    gap: 2,
  },
  avatarPickerBlock: {
    gap: spacing.sm,
  },
  avatarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  avatarOption: {
    width: 58,
    height: 58,
    borderRadius: 29,
    padding: 3,
    borderWidth: 1.5,
  },
  avatarOptionImage: {
    width: "100%",
    height: "100%",
    borderRadius: 26,
  },
  childName: {
    fontSize: 16,
  },
  childMeta: {
    fontSize: 12,
  },
  syncHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
  },
  syncBody: {
    fontSize: 14,
    lineHeight: 21,
  },
  syncMeta: {
    fontSize: 12,
  },
  sectionEyebrow: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  segmentRowWrap: {
    gap: spacing.sm,
  },
  segmentRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  segmentButton: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  segmentLabel: {
    fontSize: 13,
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 32,
  },
  settingLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  settingLabel: {
    fontSize: 16,
  },
  toggleTrack: {
    width: 40,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  toggleThumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#FFFFFF",
  },
  toggleThumbOn: {
    alignSelf: "flex-end",
  },
  toggleThumbOff: {
    alignSelf: "flex-start",
  },
  footerQuote: {
    textAlign: "center",
    fontSize: 12,
    fontStyle: "italic",
    marginTop: spacing.sm,
  },
  sandboxNote: {
    textAlign: "center",
    fontSize: 12,
  },
  devPanel: {
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  devPanelTitle: {
    fontSize: 12,
    textAlign: 'center',
  },
  devPanelRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  devPanelBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingVertical: spacing.xs,
    alignItems: 'center',
  },
  devPanelBtnText: {
    fontSize: 12,
  },
  devPanelHint: {
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'center',
  },
  devPanelStack: {
    gap: 6,
  },
  mockOption: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 2,
  },
  mockOptionLabel: {
    fontSize: 12.5,
    letterSpacing: 0.1,
  },
  mockOptionDescription: {
    fontSize: 11,
    lineHeight: 14,
    opacity: 0.85,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(27, 28, 25, 0.22)",
    justifyContent: "center",
    padding: spacing.lg,
  },
  modalKeyboardWrap: {
    width: '100%',
    maxHeight: '90%',
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  modalCard: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  modalTitle: {
    fontSize: 26,
    lineHeight: 32,
  },
  inlineActionRow: {
    flexDirection: "row",
  },
  inlineActionButton: {
    flex: 0,
  },
  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  addCareDraftBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    marginTop: -spacing.xs,
  },
  addCareDraftLabel: {
    fontSize: 13,
    letterSpacing: 0.1,
  },
  dangerZone: {
    marginTop: spacing.xxl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(186, 26, 26, 0.25)',
    backgroundColor: 'rgba(186, 26, 26, 0.04)',
    gap: spacing.sm,
  },
  dangerZoneTitle: {
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  dangerZoneBody: {
    fontSize: 13,
    lineHeight: 18,
  },
  dangerBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radii.pill,
    borderWidth: 1,
    marginTop: spacing.xs,
  },
  dangerBtnLabel: {
    fontSize: 13,
    letterSpacing: 0.1,
  },
  dangerCommitBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: radii.pill,
  },
  dangerCommitLabel: {
    fontSize: 14,
    letterSpacing: 0.1,
  },
  visitChip: {
    minHeight: 34,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  visitChipLabel: {
    fontSize: 13,
  },
  modalActions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  modalButton: {
    flex: 1,
  },
  chipsRowWrap: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  roleChip: {
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  roleChipLabel: {
    fontSize: 13,
  },
  shareCard: {
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.xs,
  },
  shareCode: {
    fontSize: 22,
    letterSpacing: 0.6,
  },
  logsModalContainer: {
    flex: 1,
  },
  logsModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  logsModalTitle: {
    fontSize: 17,
  },
  logsModalClose: {
    padding: spacing.sm,
  },
});
