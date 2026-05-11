import { useState, type ReactNode } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { FullScreenLoader, useAppContext } from '@/src/providers/AppProvider';
import { useAppTheme } from '@/src/providers/ThemeProvider';
import { SPATabBar, type SPATabName } from '@/src/components/navigation/SPATabBar';
import { SPANavProvider } from '@/src/lib/spaNav';
import { LoginScreen } from '@/src/screens/LoginScreen';
import { OnboardingScreen } from '@/src/screens/OnboardingScreen';
import { TodayScreen } from '@/src/screens/TodayScreen';
import { TrackerScreen } from '@/src/screens/TrackerScreen';
import { EvolutionScreen } from '@/src/screens/EvolutionScreen';
import { GrowthScreen } from '@/src/screens/GrowthScreen';
import { SettingsScreen } from '@/src/screens/SettingsScreen';
import { HistoryScreen } from '@/src/screens/HistoryScreen';

/**
 * Phone-width frame for desktop browsers. The app was designed
 * portrait-first and stretching it edge-to-edge on a wide window looks
 * awkward (huge whitespace, tab bar dragging across the screen). This
 * wrapper caps the visible frame at a phone-ish width and centres it,
 * filling the surrounding gutter with the theme's cream background so
 * it reads as intentional.
 *
 * On iPhone (PWA standalone or Safari), the viewport is already
 * narrower than the cap → the wrapper is a no-op. No regression.
 */
function PhoneFrame({ children }: { children: ReactNode }) {
  const { theme } = useAppTheme();
  return (
    <View style={[styles.frameOuter, { backgroundColor: theme.background }]}>
      <View style={styles.frameInner}>{children}</View>
    </View>
  );
}

/**
 * Single-page application shell.
 *
 * Routing-wise, this is the ONE route the Expo Router app exposes — `/`.
 * Inside, everything (auth gate, onboarding, the 5 tabs, the History
 * modal) is driven by React state. Tab changes never touch `window.history`.
 *
 * Why this matters: iOS Safari treats only the manifest's `start_url` as
 * "in-app standalone". Every other URL exits the PWA into Safari chrome
 * (top URL bar + bottom toolbar). The previous URL-based navigation
 * triggered that exit on every tab switch — unfixable through the
 * manifest, the SW, or `pushState` monkey-patches in any reliable way.
 *
 * By keeping the URL frozen at `/`, iOS sees no navigation, the PWA
 * stays standalone forever. Trade-offs we accept:
 *   - No deep-linkable URLs for tabs (this is a 2-user private app).
 *   - Refresh inside the PWA returns to the active tab's reset state
 *     (Tracker, the default). Good enough.
 *   - The browser back button has no app-level meaning. iOS standalone
 *     hides it anyway.
 */
export default function IndexRoute() {
  const {
    authReady,
    authUser,
    workspaceLoading,
    needsOnboarding,
    isSandbox,
    initialSyncDone,
  } = useAppContext();

  const { theme } = useAppTheme();
  const [activeTab, setActiveTab] = useState<SPATabName>('tracker');
  const [historyVisible, setHistoryVisible] = useState(false);

  // Loading shell — auth provider hasn't told us anything yet.
  // FullScreenLoader now renders as a full-viewport overlay (no PhoneFrame
  // wrapper) so the cream background runs edge-to-edge into the safe
  // areas and nothing from a previous paint can bleed through.
  if (!authReady || workspaceLoading) {
    return <FullScreenLoader label="Carnet du quotidien" />;
  }

  // Not authenticated — render Login as a state, never as a route.
  // Once Firebase fires auth state change, `authUser` flips and this
  // component re-renders into the onboarding gate or the SPA shell.
  if (!authUser && !isSandbox) {
    return (
      <PhoneFrame>
        <LoginScreen />
      </PhoneFrame>
    );
  }

  // Authenticated but no family yet — render onboarding flow inline.
  if (!isSandbox && needsOnboarding) {
    return (
      <PhoneFrame>
        <OnboardingScreen />
      </PhoneFrame>
    );
  }

  // Family attached but Firestore hasn't pushed the first events
  // snapshot yet. Keep the FullScreenLoader up rather than letting the
  // user tap an empty timeline — the previous behaviour was confusing
  // because the SPA shell looked ready while it was still syncing.
  if (!isSandbox && !initialSyncDone) {
    return <FullScreenLoader label="Synchronisation…" />;
  }

  const showHistory = () => setHistoryVisible(true);
  const hideHistory = () => setHistoryVisible(false);

  // Authenticated + onboarded → the actual app. Each tab screen is
  // mounted only when active to keep memory low; switching tabs resets
  // that screen's local state, which is acceptable for this app
  // (no in-progress forms across tabs).
  return (
    <SPANavProvider value={{ goToTab: setActiveTab, showHistory }}>
      <PhoneFrame>
        <View style={[styles.shell, { backgroundColor: theme.background }]}>
          <View style={[styles.body, { backgroundColor: theme.background }]}>
            {activeTab === 'tracker' ? <TrackerScreen /> : null}
            {activeTab === 'today' ? <TodayScreen onShowHistory={showHistory} /> : null}
            {activeTab === 'evolution' ? <EvolutionScreen /> : null}
            {activeTab === 'growth' ? <GrowthScreen onShowHistory={showHistory} /> : null}
            {activeTab === 'settings' ? <SettingsScreen /> : null}
          </View>

          <SPATabBar activeTab={activeTab} onTabChange={setActiveTab} />

          <Modal
            transparent={false}
            animationType="slide"
            visible={historyVisible}
            onRequestClose={hideHistory}
          >
            <HistoryScreen onClose={hideHistory} />
          </Modal>
        </View>
      </PhoneFrame>
    </SPANavProvider>
  );
}

const styles = StyleSheet.create({
  // Outer wrapper that fills the viewport. Cream backdrop comes from
  // theme.background, so any gutter on a wide desktop screen looks
  // intentional rather than a white void.
  frameOuter: {
    flex: 1,
    alignItems: 'center',
  },
  // The actual phone-shaped frame.
  //   maxWidth 480  → above iPhone 16 Pro Max (~440pt) so no crop on
  //                   real devices, snug on desktop browsers.
  //   minWidth 320  → smallest Apple width still supported (iPhone SE
  //                   1st gen). Below that, the user is shrinking their
  //                   window past phone reality — we let the page
  //                   horizontal-scroll instead of letting the layout
  //                   pancake into illegibility.
  frameInner: {
    flex: 1,
    width: '100%',
    maxWidth: 480,
    minWidth: 320,
  },
  shell: {
    flex: 1,
  },
  body: {
    flex: 1,
  },
});
