import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export class NotificationsService {
  private static instance: NotificationsService;
  private isSetupComplete: boolean = false;

  private constructor() {}

  static getInstance(): NotificationsService {
    if (!NotificationsService.instance) {
      NotificationsService.instance = new NotificationsService();
    }
    return NotificationsService.instance;
  }

  public async setup(): Promise<void> {
    if (this.isSetupComplete) {
      return;
    }

    // Настройка обработчика уведомлений
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    // Запрос прав на уведомления
    const permissions = await Notifications.getPermissionsAsync();
    let finalStatus = permissions.status;

    if (finalStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('Права на уведомления не получены');
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
        sound: 'default',
      });
    }

    this.isSetupComplete = true;
  }

  public async sendNotification(
    title: string,
    body: string,
    data?: Record<string, unknown>
  ): Promise<string> {
    if (!this.isSetupComplete) {
      await this.setup();
    }

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: 'default',
        badge: 1,
        data: data || {},
      },
      trigger: null, // Показать сразу
    });

    return notificationId;
  }

  public async scheduleNotification(
    title: string,
    body: string,
    trigger: Notifications.NotificationTriggerInput,
    data?: Record<string, unknown>
  ): Promise<string> {
    if (!this.isSetupComplete) {
      await this.setup();
    }

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: 'default',
        badge: 1,
        data: data || {},
      },
      trigger,
    });

    return notificationId;
  }

  public async cancelNotification(notificationId: string): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  }

  public async cancelAllNotifications(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }

  public async clearAllNotifications(): Promise<void> {
    await Notifications.dismissAllNotificationsAsync();
  }

  public async getBadgeCount(): Promise<number> {
    return await Notifications.getBadgeCountAsync();
  }

  public async setBadgeCount(count: number): Promise<void> {
    await Notifications.setBadgeCountAsync(count);
  }

  // Подписки на события уведомлений
  public onNotificationReceived(
    listener: (notification: Notifications.Notification) => void
  ): () => void {
    const subscription =
      Notifications.addNotificationReceivedListener(listener);
    return () => {
      subscription.remove();
    };
  }

  public onNotificationResponded(
    listener: (response: Notifications.NotificationResponse) => void
  ): () => void {
    const subscription =
      Notifications.addNotificationResponseReceivedListener(listener);
    return () => {
      subscription.remove();
    };
  }
}

export default NotificationsService.getInstance();
