import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('grotto', {
      name: 'Grotto',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    });
  }
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function notifyNewMessage(
  senderName: string,
  listingTitle: string,
): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `New message from ${senderName}`,
        body: listingTitle ? `About: ${listingTitle}` : undefined,
        sound: true,
      },
      trigger: null,
    });
  } catch {
    // silently fail if permission not granted
  }
}

export async function notifyNewApplication(
  listingTitle: string,
  sitterName: string,
): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'New application 🐾',
        body: `${sitterName} has applied for ${listingTitle}`,
        sound: true,
      },
      trigger: null,
    });
  } catch {
    // silently fail if permission not granted
  }
}
