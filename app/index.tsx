import { Redirect } from 'expo-router';
import { useAppContext, FullScreenLoader } from '@/src/providers/AppProvider';

export default function IndexRoute() {
  const { authReady, authUser, workspaceLoading, needsOnboarding, isSandbox } = useAppContext();

  if (!authReady || workspaceLoading) {
    return <FullScreenLoader label="Carnet du quotidien" />;
  }

  if (!authUser && !isSandbox) {
    return <Redirect href="/login" />;
  }

  if (!isSandbox && needsOnboarding) {
    return <Redirect href="/onboarding" />;
  }

  return <Redirect href="/tracker" />;
}
