import { Redirect, Stack } from 'expo-router';
import { FullScreenLoader, useAppContext } from '@/src/providers/AppProvider';

export default function AppLayout() {
  const { authReady, authUser, workspaceLoading, needsOnboarding, isSandbox } = useAppContext();

  if (!authReady || workspaceLoading) {
    return <FullScreenLoader label="Chargement de la famille..." />;
  }

  if (!authUser && !isSandbox) {
    return <Redirect href="/login" />;
  }

  if (!isSandbox && needsOnboarding) {
    return <Redirect href="/onboarding" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
