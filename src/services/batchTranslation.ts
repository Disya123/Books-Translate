import { Platform, Alert, AppState, AppStateStatus } from 'react-native';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import * as KeepAwake from 'expo-keep-awake';
import * as Notifications from 'expo-notifications';
import { store } from '@/store';
import {
  addToQueue,
  updateQueueItem,
  clearQueue,
  setProcessing,
  setPauseAfterChapter,
  setActiveChapterId,
  setShowNotifications,
} from '@/store/translationSlice';
import DatabaseService from './database';
import TranslationService from './translation';
import AndroidForegroundService from './androidForeground';
import { AndroidForegroundServiceImpl } from './androidForeground';
import NotificationsService from './notifications';
import ToastService from './toast';

const BATCH_TRANSLATION_TASK = 'BATCH_TRANSLATION_TASK';

interface BatchTranslationOptions {
  novelId: number;
  chapterIds: number[];
  sourceLang: string;
  targetLang: string;
  targetCode: string;
  pauseAfterChapter?: boolean;
  showNotifications?: boolean;
}

export class BatchTranslationService {
  private static instance: BatchTranslationService;
  private isProcessing: boolean = false;
  private shouldPause: boolean = false;
  private appStateSubscription: {
    remove: () => void;
  } | null = null;

  private constructor() {
    this.setupAppStateListener();
  }

  static getInstance(): BatchTranslationService {
    if (!BatchTranslationService.instance) {
      BatchTranslationService.instance = new BatchTranslationService();
    }
    return BatchTranslationService.instance;
  }

  private setupAppStateListener() {
    this.appStateSubscription = AppState.addEventListener(
      'change',
      this.handleAppStateChange
    );
  }

  private handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (nextAppState === 'background' || nextAppState === 'inactive') {
      if (this.isProcessing && Platform.OS === 'ios') {
        // На iOS предупреждение при сворачивании
        Alert.alert(
          'Перевод в процессе',
          'Для продолжения перевода на iOS приложение должно оставаться открытым. Свернуть приложение?',
          [
            {
              text: 'Отмена',
              style: 'cancel',
            },
            {
              text: 'Свернуть',
              onPress: () => {
                this.pause();
                KeepAwake.deactivateKeepAwake();
              },
            },
          ]
        );
      }
    }
  };

  public async startBatchTranslation(
    options: BatchTranslationOptions
  ): Promise<void> {
    if (this.isProcessing) {
      throw new Error('Перевод уже выполняется');
    }

    const {
      novelId,
      chapterIds,
      sourceLang,
      targetLang,
      targetCode,
      pauseAfterChapter = false,
      showNotifications = true,
    } = options;

    // Очистить старую очередь
    await DatabaseService.clearQueue();
    store.dispatch(clearQueue());

    // Добавить главы в очередь
    for (const chapterId of chapterIds) {
      await DatabaseService.addToQueue(chapterId, sourceLang, targetLang);
      store.dispatch(
        addToQueue({
          id: Date.now() + chapterId,
          chapter_id: chapterId,
          source_lang: sourceLang,
          target_lang: targetLang,
          status: 'pending',
          error_message: null,
          created_at: Date.now(),
          completed_at: null,
        })
      );
    }

    this.shouldPause = pauseAfterChapter;
    store.dispatch(setPauseAfterChapter(pauseAfterChapter));
    store.dispatch(setShowNotifications(showNotifications));

    // На Android запустить Foreground Service через постоянное уведомление
    if (Platform.OS === 'android') {
      await AndroidForegroundServiceImpl.setupChannel();
      await AndroidForegroundService.start(
        'Перевод новеллы',
        'Перевод глав в процессе...'
      );
    }

    // На iOS активировать keep-awake
    if (Platform.OS === 'ios') {
      KeepAwake.activateKeepAwake();
    }

    // Начать обработку
    this.isProcessing = true;
    store.dispatch(setProcessing(true));

    await this.processQueue(novelId, targetCode, showNotifications);
  }

  private async processQueue(
    novelId: number,
    targetCode: string,
    showNotifications: boolean
  ): Promise<void> {
    const queue = await DatabaseService.getTranslationQueue();
    const pendingItems = queue.filter((item) => item.status === 'pending');

    for (const item of pendingItems) {
      if (!this.isProcessing) {
        break;
      }

      if (this.shouldPause) {
        this.isProcessing = false;
        store.dispatch(setProcessing(false));
        store.dispatch(setActiveChapterId(null));

        if (Platform.OS === 'ios') {
          KeepAwake.deactivateKeepAwake();
        }

        // Update Android foreground service
        if (Platform.OS === 'android') {
          await AndroidForegroundService.update(
            'Перевод приостановлен',
            'Нажмите для продолжения'
          );
        }

        if (showNotifications) {
          // Показываем toast внутри приложения
          ToastService.translationPaused();

          // Если приложение свернуто, отправляем системное уведомление
          const appState = await AppState.currentState;
          if (appState === 'background' || appState === 'inactive') {
            await NotificationsService.sendNotification(
              'Перевод приостановлен',
              'Нажмите для продолжения'
            );
          }
        }

        return;
      }

      // Обновить статус на processing
      await DatabaseService.updateQueueItem(item.id, 'processing');
      store.dispatch(
        updateQueueItem({
          ...item,
          status: 'processing',
        })
      );
      store.dispatch(setActiveChapterId(item.chapter_id));

      try {
        // Получить главу
        const chapter = await DatabaseService.getChapter(item.chapter_id);
        if (!chapter) {
          throw new Error('Глава не найдена');
        }

        // Перевести
        await TranslationService.translate(
          item.chapter_id,
          item.source_lang,
          item.target_lang,
          targetCode,
          chapter.content,
          undefined,
          undefined,
          undefined
        );

        // Обновить статус на completed
        await DatabaseService.updateQueueItem(item.id, 'completed');
        store.dispatch(
          updateQueueItem({
            ...item,
            status: 'completed',
            completed_at: Date.now(),
          })
        );

        if (showNotifications) {
          // Показываем toast внутри приложения (по умолчанию приостановка после главы выключена, показываем каждую главу)
          // ToastService.translationComplete(item.chapter_id);

          // Если включена пауза после главы или приложение свернуто, отправляем системное уведомление
          const appState = await AppState.currentState;
          if (this.shouldPause || appState === 'background' || appState === 'inactive') {
            await NotificationsService.sendNotification(
              'Глава переведена',
              `Глава ${item.chapter_id} успешно переведена`
            );
          }
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Неизвестная ошибка';

        await DatabaseService.updateQueueItem(item.id, 'failed', errorMessage);
        store.dispatch(
          updateQueueItem({
            ...item,
            status: 'failed',
            error_message: errorMessage,
          })
        );

        if (showNotifications) {
          // Показываем toast внутри приложения
          ToastService.translationError(errorMessage);

          // Если приложение свернуто, отправляем системное уведомление
          const appState = await AppState.currentState;
          if (appState === 'background' || appState === 'inactive') {
            await NotificationsService.sendNotification(
              'Ошибка перевода',
              `Глава ${item.chapter_id}: ${errorMessage}`
            );
          }
        }
      }
    }

    // Завершение обработки
    this.isProcessing = false;
    store.dispatch(setProcessing(false));
    store.dispatch(setActiveChapterId(null));

    // Подсчитать статистику
    const queueState = store.getState().translation.queue;
    const total = queueState.length;
    const completed = queueState.filter((item) => item.status === 'completed').length;
    const failed = queueState.filter((item) => item.status === 'failed').length;

    if (Platform.OS === 'ios') {
      KeepAwake.deactivateKeepAwake();
    }

    // Stop Android foreground service on completion
    if (Platform.OS === 'android') {
      await AndroidForegroundService.stop();
    }

    if (showNotifications) {
      // Показываем toast внутри приложения
      ToastService.batchTranslationCompleted(total, completed, failed);

      // Если приложение свернуто, отправляем системное уведомление
      const appState = AppState.currentState;
      if (appState === 'background' || appState === 'inactive') {
        let message = 'Все главы успешно переведены';
        if (failed > 0) {
          message = `Завершено: ${completed}/${total} глав (${failed} с ошибкой)`;
        }

        await NotificationsService.sendNotification(
          'Перевод завершён',
          message
        );
      }
    }
  }

  public async pause(): Promise<void> {
    this.shouldPause = true;
    store.dispatch(setPauseAfterChapter(true));
  }

  public async resume(): Promise<void> {
    this.shouldPause = false;
    store.dispatch(setPauseAfterChapter(false));

    if (!this.isProcessing) {
      const queue = await DatabaseService.getTranslationQueue();
      const pendingItems = queue.filter((item) => item.status === 'pending');

      if (pendingItems.length > 0) {
        this.isProcessing = true;
        store.dispatch(setProcessing(true));

        // Re-activate platform-specific features
        if (Platform.OS === 'android') {
          await AndroidForegroundService.update(
            'Перевод новеллы',
            'Перевод глав в процессе...'
          );
        }

        if (Platform.OS === 'ios') {
          KeepAwake.activateKeepAwake();
        }

        // Получить настройки из store
        const state = store.getState();
        const targetCode = state.settings.translation.targetCode;
        const showNotifications = state.translation.showNotifications;

        // Получить novelId из первой главы
        const firstChapter = await DatabaseService.getChapter(
          pendingItems[0].chapter_id
        );
        if (firstChapter) {
          await this.processQueue(
            firstChapter.novel_id,
            targetCode,
            showNotifications
          );
        }
      }
    }
  }

  public async stop(): Promise<void> {
    this.isProcessing = false;
    store.dispatch(setProcessing(false));
    store.dispatch(setActiveChapterId(null));

    if (Platform.OS === 'ios') {
      KeepAwake.deactivateKeepAwake();
    }

    // Stop Android foreground service
    if (Platform.OS === 'android') {
      await AndroidForegroundService.stop();
    }

    await DatabaseService.clearQueue();
    store.dispatch(clearQueue());
  }

  public async clearQueue(): Promise<void> {
    await DatabaseService.clearQueue();
    store.dispatch(clearQueue());
  }

  private async startForegroundService(): Promise<void> {
    // Android Foreground Service будет реализован через нативный модуль
    // Это заглушка для будущего
    console.log('Starting Android Foreground Service...');
  }

  public getQueueStatus(): {
    total: number;
    completed: number;
    processing: number;
    failed: number;
    pending: number;
  } {
    const queue = store.getState().translation.queue;

    return {
      total: queue.length,
      completed: queue.filter((item) => item.status === 'completed').length,
      processing: queue.filter((item) => item.status === 'processing').length,
      failed: queue.filter((item) => item.status === 'failed').length,
      pending: queue.filter((item) => item.status === 'pending').length,
    };
  }

  public isProcessingQueue(): boolean {
    return this.isProcessing;
  }
}

// Регистрация фоновой задачи для Android
TaskManager.defineTask(BATCH_TRANSLATION_TASK, async () => {
  try {
    const service = BatchTranslationService.getInstance();
    if (service.isProcessingQueue()) {
      return BackgroundFetch.BackgroundFetchResult.NewData;
    }
    return BackgroundFetch.BackgroundFetchResult.NoData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export default BatchTranslationService.getInstance();
