import { Redirect, Stack } from 'expo-router';
import { FullScreenLoader, useAppContext } from '@/src/providers/AppProvider';

export default function AuthLayout() {
  const { authReady, authUser, workspaceLoading, needsOnboarding, isSandbox } = useAppContext();

  if (!authReady || workspaceLoading) {
    return <FullScreenLoader label="Vérification de session..." />;
  }

  if ((authUser || isSandbox) && !isSandbox && needsOnboarding) {
    return <Redirect href="/onboarding" />;
  }

  if (isSandbox || (authUser && !needsOnboarding)) {
    return <Redirect href="/(app)/(tabs)/tracker" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
