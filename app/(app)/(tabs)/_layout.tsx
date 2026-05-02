import { Tabs } from 'expo-router';
import { SanctuaryTabBar } from '@/src/components/navigation/SanctuaryTabBar';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <SanctuaryTabBar {...props} hiddenRoutes={['history', 'data']} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen name="today" />
      <Tabs.Screen name="tracker" />
      <Tabs.Screen name="evolution" />
      <Tabs.Screen
        name="data"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen name="growth" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}
