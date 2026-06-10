import { Linking } from 'react-native';

/**
 * Opens WhatsApp with a pre-filled message.
 * Tries the native app first, falls back to web.
 */
export function openWhatsApp(phone: string, message: string): void {
  const cleanedPhone = phone.replace(/[^\d+]/g, '');
  const encodedMessage = encodeURIComponent(message);
  const appUrl = `whatsapp://send?phone=${cleanedPhone}&text=${encodedMessage}`;
  const webUrl = `https://wa.me/${cleanedPhone}?text=${encodedMessage}`;

  Linking.canOpenURL(appUrl)
    .then(supported => Linking.openURL(supported ? appUrl : webUrl))
    .catch(() => Linking.openURL(webUrl));
}
