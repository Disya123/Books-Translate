import { Platform } from 'react-native';

// Типы для Toast референса
interface ToastRef {
  show: (message: string, options?: any) => string;
  hide: (id: string) => void;
  hideAll: () => void;
}

export class ToastService {
  private static instance: ToastService;
  private toastRef: ToastRef | null = null;

  private constructor() {}

  static getInstance(): ToastService {
    if (!ToastService.instance) {
      ToastService.instance = new ToastService();
    }
    return ToastService.instance;
  }

  /**
   * Установить референс на Toast компонент
   */
  setToastRef(ref: ToastRef | null) {
    this.toastRef = ref;
  }

  private show(message: string, options: any = {}): void {
    if (this.toastRef) {
      this.toastRef.show(message, options);
    } else {
      console.warn('Toast ref not set:', message);
    }
  }

  /**
   * Показать успешное уведомление
   */
  success(message: string, duration: number = 3000) {
    this.show(message, {
      type: 'success',
      placement: 'top',
      duration,
      animationType: 'slide-in',
    });
  }

  /**
   * Показать ошибку
   */
  error(message: string, duration: number = 4000) {
    this.show(message, {
      type: 'danger',
      placement: 'top',
      duration,
      animationType: 'slide-in',
    });
  }

  /**
   * Показать информационное уведомление
   */
  info(message: string, duration: number = 3000) {
    this.show(message, {
      type: 'normal',
      placement: 'top',
      duration,
      animationType: 'slide-in',
    });
  }

  /**
   * Показать предупреждение
   */
  warning(message: string, duration: number = 3500) {
    this.show(message, {
      type: 'warning',
      placement: 'top',
      duration,
      animationType: 'slide-in',
    });
  }

  /**
   * Уведомление о успешном переводе
   */
  translationComplete(chapterNumber?: number) {
    const message = chapterNumber
      ? `Глава ${chapterNumber} успешно переведена`
      : 'Перевод завершён';
    this.success(message);
  }

  /**
   * Уведомление об использовании кэша
   */
  translationCacheUsed() {
    this.info('Использован кэшированный перевод');
  }

  /**
   * Уведомление об ошибке перевода
   */
  translationError(error: string) {
    this.error(`Ошибка перевода: ${error}`);
  }

  /**
   * Уведомление о начале перевода
   */
  translationStarted() {
    this.info('Перевод начался...');
  }

  /**
   * Уведомление о паузе перевода
   */
  translationPaused() {
    this.warning('Перевод приостановлен');
  }

  /**
   * Уведомление о продолжении перевода
   */
  translationResumed() {
    this.info('Перевод продолжен');
  }

  /**
   * Уведомление о пакетном переводе
   */
  batchTranslationStarted(count: number) {
    this.info(`Начинается перевод ${count} глав...`);
  }

  /**
   * Уведомление о завершении пакетного перевода
   */
  batchTranslationCompleted(total: number, success: number, failed: number) {
    let message = `Перевод завершён: ${success}/${total} глав`;

    if (failed > 0) {
      message += ` (${failed} с ошибкой)`;
    }

    this.success(message);
  }

  /**
   * Убрать все уведомления
   */
  hideAll() {
    if (this.toastRef) {
      this.toastRef.hideAll();
    }
  }
}

export default ToastService.getInstance();
