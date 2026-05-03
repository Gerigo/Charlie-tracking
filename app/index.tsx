import { useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { FullScreenLoader, useAppContext } from '@/src/providers/AppProvider';
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
  } = useAppContext();

  const [activeTab, setActiveTab] = useState<SPATabName>('tracker');
  const [historyVisible, setHistoryVisible] = useState(false);

  // Loading shell — auth provider hasn't told us anything yet.
  if (!authReady || workspaceLoading) {
    return <FullScreenLoader label="Carnet du quotidien" />;
  }

  // Not authenticated — render Login as a state, never as a route.
  // Once Firebase fires auth state change, `authUser` flips and this
  // component re-renders into the onboarding gate or the SPA shell.
  if (!authUser && !isSandbox) {
    return <LoginScreen />;
  }

  // Authenticated but no family yet — render onboarding flow inline.
  if (!isSandbox && needsOnboarding) {
    return <OnboardingScreen />;
  }

  const showHistory = () => setHistoryVisible(true);
  const hideHistory = () => setHistoryVisible(false);

  // Authenticated + onboarded → the actual app. Each tab screen is
  // mounted only when active to keep memory low; switching tabs resets
  // that screen's local state, which is acceptable for this app
  // (no in-progress forms across tabs).
  return (
    <SPANavProvider value={{ goToTab: setActiveTab, showHistory }}>
      <View style={styles.shell}>
        <View style={styles.body}>
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
    </SPANavProvider>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
  },
  body: {
    flex: 1,
  },
});
