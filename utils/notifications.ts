import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { parseTime } from './format';

export async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  return finalStatus === 'granted';
}

export async function scheduleDailyReminder(hour: number, minute: number): Promise<void> {
  // Clear existing reminders first
  await Notifications.cancelAllScheduledNotificationsAsync();

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Erinnerungen',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#1A56DB',
    });
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Stundennachweis vergessen?',
      body: 'Nicht vergessen, deine heutigen Fahrten einzutragen!',
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
}

export async function cancelAllReminders(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function updateReminders(enabled: boolean, timeStr: string): Promise<void> {
  if (!enabled) {
    await cancelAllReminders();
    return;
  }

  const permission = await requestNotificationPermissions();
  if (permission) {
    const { hours, minutes } = parseTime(timeStr);
    await scheduleDailyReminder(hours, minutes);
  }
}
