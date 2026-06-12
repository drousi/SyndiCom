import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import { useLanguageStore } from '../store/language.store';

// Initialiser le canal de rappel pour Android
// On supprime avant de recréer pour forcer l'application du son personnalisé
// (Android ignore les modifications de canal existant)
export async function setupNotificationChannels() {
  if (Platform.OS === 'android') {
    try {
      await Notifications.deleteNotificationChannelAsync('reminders');
    } catch (_) {}
    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Rappels de relance',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#0D1B2A',
      sound: 'reminder.wav',
    });
  }
}

// Demander les permissions de notification
export async function requestNotificationPermissions(): Promise<boolean> {
  if (!Device.isDevice) return false;
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  return finalStatus === 'granted';
}

// Planifier un rappel de relance configurable
export async function scheduleConfiguredReminder(settings: {
  enabled: boolean;
  dayOfWeek: number;
  hour: number;
  minute: number;
}) {
  if (!settings.enabled) {
    await cancelAllReminders();
    return;
  }

  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) return;

  await setupNotificationChannels();
  await cancelAllReminders();

  const { t } = useLanguageStore.getState();

  await Notifications.scheduleNotificationAsync({
    content: {
      title: t('notifications_push.reminder_title'),
      body: t('notifications_push.reminder_body'),
      sound: 'reminder.wav',
      channelId: 'reminders',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: settings.dayOfWeek,
      hour: settings.hour,
      minute: settings.minute,
    },
  });
}

// Méthode de test pour déclencher un rappel après 5 secondes
export async function scheduleTestReminder() {
  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) return;

  await setupNotificationChannels();

  const { t } = useLanguageStore.getState();

  await Notifications.scheduleNotificationAsync({
    content: {
      title: t('notifications_push.test_title'),
      body: t('notifications_push.test_body'),
      sound: 'reminder.wav',
      channelId: 'reminders',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 5,
      repeats: false,
    },
  });
}

// Annuler tous les rappels programmés
export async function cancelAllReminders() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
