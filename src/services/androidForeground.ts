import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import NotificationsService from './notifications';

/**
 * Android Foreground Service simulation for keeping translation running in background
 * Uses persistent notification on Android to prevent system from killing app
 */

export class AndroidForegroundServiceImpl {
  private static instance: AndroidForegroundServiceImpl;
  private isNotificationRunning: boolean = false;
  private notificationId: string | null = null;

  private constructor() {}

  static getInstance(): AndroidForegroundServiceImpl {
    if (!AndroidForegroundServiceImpl.instance) {
      AndroidForegroundServiceImpl.instance =
        new AndroidForegroundServiceImpl();
    }
    return AndroidForegroundServiceImpl.instance;
  }

  /**
   * Start foreground service by showing persistent notification
   * On Android this keeps the app from being killed
   */
  public async start(title: string, description: string): Promise<void> {
    if (Platform.OS !== 'android') {
      return;
    }

    if (this.isNotificationRunning) {
      // Update existing notification
      if (this.notificationId) {
        await NotificationsService.cancelNotification(this.notificationId);
      }
    }

    this.notificationId = await NotificationsService.sendNotification(
      title,
      description,
      {
        persistent: true,
      }
    );

    this.isNotificationRunning = true;
    console.log('[AndroidForegroundService]: Started with notification');
  }

  /**
   * Update foreground notification content
   */
  public async update(title: string, description: string): Promise<void> {
    if (Platform.OS !== 'android' || !this.notificationId) {
      return;
    }

    try {
      await NotificationsService.cancelNotification(this.notificationId!);
      this.notificationId = await NotificationsService.sendNotification(
        title,
        description,
        { persistent: true }
      );
    } catch (error) {
      console.error(
        '[AndroidForegroundService]: Error updating notification:',
        error
      );
    }
  }

  /**
   * Stop foreground service by removing notification
   */
  public async stop(): Promise<void> {
    if (Platform.OS !== 'android' || !this.notificationId) {
      return;
    }

    await NotificationsService.cancelNotification(this.notificationId);
    this.isNotificationRunning = false;
    console.log('[AndroidForegroundService]: Stopped');
  }

  public isRunning(): boolean {
    return this.isNotificationRunning;
  }

  /**
   * Setup Android notification channel if needed
   */
  public static async setupChannel(): Promise<void> {
    if (Platform.OS !== 'android') {
      return;
    }

    try {
      await Notifications.setNotificationChannelAsync('translation', {
        name: 'Translation',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#BB86FC',
        sound: 'default',
      });
    } catch (error) {
      console.error(
        '[AndroidForegroundService]: Error setting up channel:',
        error
      );
    }
  }
}

export default AndroidForegroundServiceImpl.getInstance();
