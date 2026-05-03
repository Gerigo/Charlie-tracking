interface NotificationPermissionResult {
  granted: boolean;
  canAskAgain: boolean;
  unsupportedReason?: 'web-unsupported';
}

export async function requestNotificationsPermission(): Promise<NotificationPermissionResult> {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return { granted: false, canAskAgain: false, unsupportedReason: 'web-unsupported' };
  }

  if (Notification.permission === 'granted') {
    return { granted: true, canAskAgain: false };
  }

  if (Notification.permission === 'denied') {
    return { granted: false, canAskAgain: false };
  }

  const result = await Notification.requestPermission();
  return {
    granted: result === 'granted',
    canAskAgain: result === 'default',
  };
}
