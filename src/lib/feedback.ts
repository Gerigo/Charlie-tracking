import * as Haptics from 'expo-haptics';

function run(task: Promise<unknown>) {
  void task.catch(() => undefined);
}

export function triggerSelectionFeedback() {
  run(Haptics.selectionAsync());
}

export function triggerImpactFeedback(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) {
  run(Haptics.impactAsync(style));
}

export function triggerSuccessFeedback() {
  run(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

export function triggerErrorFeedback() {
  run(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
}
