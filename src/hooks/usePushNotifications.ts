import { useEffect, useRef, useState } from 'react';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '../supabase/client';
import { useAuthStore } from '../store/auth.store';
import { createNotification } from '../db/repositories/notifications';
import type { NotificationType } from '../types';

// Handler requis pour afficher les notifications quand l'app est au premier plan
// (s'applique aux notifications locales ET push)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function usePushNotifications() {
  const { profile, isAuthenticated, activeResidence } = useAuthStore();
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const activeResidenceRef = useRef(activeResidence);

  useEffect(() => {
    activeResidenceRef.current = activeResidence;
  }, [activeResidence]);

  useEffect(() => {
    if (!isAuthenticated || !profile) return;

    registerForPushNotificationsAsync().then((token) => {
      if (token && token !== profile.push_token) {
        setExpoPushToken(token);
        supabase
          .from('profiles')
          .update({ push_token: token })
          .eq('id', profile.id)
          .then(({ error }) => {
            if (error) console.error('Error saving push token to Supabase', error);
          });
      } else if (token) {
        setExpoPushToken(token);
      }
    });
  }, [isAuthenticated, profile?.id, profile?.push_token]);

  // Persist every received notification to the DB inbox
  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      const residenceId = activeResidenceRef.current?.id;
      if (!residenceId) return;

      const { title, body, data } = notification.request.content;
      createNotification({
        residence_id: residenceId,
        title: title ?? '',
        body: body ?? '',
        type: (data?.type as NotificationType) ?? 'system',
      }).catch((e) => console.error('Error persisting notification:', e));
    });

    return () => subscription.remove();
  }, []);

  return { expoPushToken };
}

async function registerForPushNotificationsAsync() {
  let token;

  // Expo Go (SDK 53+) ne supporte plus les notifications push natives.
  if (Constants.appOwnership === 'expo') {
    console.log('Les notifications Push ne sont pas supportées dans Expo Go.');
    return null;
  }

  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
      sound: 'notify_1.wav',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('Permission refusée pour les notifications push');
      return null;
    }
    
    try {
      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
      
      if (!projectId) {
        throw new Error('EAS Project ID manquant dans app.json');
      }

      token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    } catch (e) {
      console.error('Erreur lors de la récupération du token:', e);
    }
  } else {
    console.log('Les notifications push nécessitent un appareil physique.');
  }

  return token;
}
