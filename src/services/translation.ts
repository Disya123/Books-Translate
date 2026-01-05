import DatabaseService from './database';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface TranslationConfig {
  text: string;
  source_lang: string;
  target_lang: string;
  target_code: string;
  instruction?: string;
  system_prompt?: string;
  options?: {
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
  };
}

interface TranslationResponse {
  translated_text: string;
  meta?: {
    model: string;
    tokens_used?: number;
  };
}

// Открытая спецификация OpenAI для chat completions
// Поддерживает и streaming (delta) и non-streaming (message) ответы
interface OpenAIDataChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta?: {
      content?: string;
    };
    message?: {
      content?: string;
      role: string;
    };
    finish_reason: string | null;
  }>;
}

export interface TranslationConfigState {
  apiKey: string;
  apiUrl: string;
  modelName: string;
  sourceLanguage: string;
  targetLanguage: string;
  targetCode: string;
  systemPrompt: string;
}

export class TranslationService {
  private static instance: TranslationService;
  private config: TranslationConfigState;

  private constructor() {
    this.config = {
      apiKey: '',
      apiUrl: 'https://api.openai.com/v1',
      modelName: 'gpt-4o-mini',
      sourceLanguage: 'en',
      targetLanguage: 'ru',
      targetCode: 'ru',
      systemPrompt:
        'You are a professional novel translator. Translate text preserving literary style and tone.',
    };
  }

  static getInstance(): TranslationService {
    if (!TranslationService.instance) {
      TranslationService.instance = new TranslationService();
    }
    return TranslationService.instance;
  }

  public setConfig(config: Partial<TranslationConfigState>) {
    this.config = { ...this.config, ...config };
  }

  public getConfig(): TranslationConfigState {
    return { ...this.config };
  }

  public updateFromReduxConfig(reduxConfig: {
    apiKey: string;
    apiUrl: string;
    modelName: string;
    sourceLanguage: string;
    targetLanguage: string;
    targetCode: string;
    systemPrompt: string;
  }) {
    this.config = {
      apiKey: reduxConfig.apiKey,
      apiUrl: reduxConfig.apiUrl,
      modelName: reduxConfig.modelName,
      sourceLanguage: reduxConfig.sourceLanguage,
      targetLanguage: reduxConfig.targetLanguage,
      targetCode: reduxConfig.targetCode,
      systemPrompt: reduxConfig.systemPrompt,
    };
  }

  private async checkInternetConnection(): Promise<boolean> {
    const state = await NetInfo.fetch();
    return state.isConnected ?? false;
  }

  public async translate(
    chapterId: number,
    sourceLang: string,
    targetLang: string,
    targetCode: string,
    content: string,
    onSuccess?: (translated: string) => void,
    onError?: (error: Error) => void,
    onProgress?: (text: string) => void
  ): Promise<string> {
    // Загружаем последние настройки перед переводом
    await this.loadSettingsFromStorage();

    const isConnected = await this.checkInternetConnection();
    if (!isConnected) {
      const error = new Error('Нет подключения к интернету');
      onError?.(error);
      throw error;
    }

    // Проверить кэш
    const cached = await DatabaseService.getCachedTranslation(
      chapterId,
      targetCode
    );
    if (cached) {
      onSuccess?.(cached.translated_content);
      return cached.translated_content;
    }

    try {
      // Стриминговый перевод через fetch
      const translatedText = await this.translateWithStream(
        content,
        onProgress
      );

      // Сохранить в кэш
      await DatabaseService.saveCachedTranslation(
        chapterId,
        sourceLang,
        targetLang,
        targetCode,
        translatedText
      );

      onSuccess?.(translatedText);
      return translatedText;
    } catch (error) {
      const err = this.handleError(error);
      onError?.(err);
      throw err;
    }
  }

  // Проверка и очистка URL (убираем слеш в конце если есть)
  private cleanBaseUrl(url: string): string {
    const trimmed = url.trim();
    return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
  }

  // Формирование prompt для перевода
  private buildPrompt(text: string): string {
    const instruction =
      'Переведи текст художественной прозы: визуальной новеллы или веб-новеллы с английского на русский язык.';
    return `${instruction}\n\nТекст для перевода:\n${text}`;
  }

  // Построение сообщений для API
  private buildMessages(
    text: string
  ): Array<{ role: string; content: string }> {
    return [
      {
        role: 'system',
        content: this.config.systemPrompt,
      },
      {
        role: 'user',
        content: this.buildPrompt(text),
      },
    ];
  }

  // Стриминг через XMLHttpRequest (работает в React Native!)
  private async translateWithStream(
    content: string,
    onProgress?: (text: string) => void
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        // Сигнализируем о старте перевода
        onProgress?.('');

        const cleanBaseUrl = this.cleanBaseUrl(this.config.apiUrl);
        const url = `${cleanBaseUrl}/chat/completions`;

        if (!this.config.apiKey) {
          const error = new Error('API ключ не настроен. Проверьте настройки.');
          reject(error);
          return;
        }

        console.log('[TranslationService] Запрос стриминга к:', {
          url,
          model: this.config.modelName,
        });

        const xhr = new XMLHttpRequest();
        xhr.open('POST', url, true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.setRequestHeader('Authorization', `Bearer ${this.config.apiKey}`);

        let buffer = '';
        let translatedText = '';
        let processedLength = 0; // Отслеживаем сколько уже обработано

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            console.log('[TranslationService] Стриминг завершен:', {
              length: translatedText.length,
              status: xhr.status,
            });
            resolve(translatedText);
          } else {
            const errorText = xhr.responseText || 'Неизвестная ошибка';
            console.error('[TranslationService] Ошибка API:', {
              status: xhr.status,
              errorText,
            });
            reject(
              new Error(
                `Ошибка перевода (код ${xhr.status}): ${this.parseErrorMessage(
                  errorText
                )}`
              )
            );
          }
        };

        xhr.onerror = () => {
          console.error('[TranslationService] Ошибка сети');
          reject(new Error('Ошибка сети. Проверьте подключение к интернету.'));
        };

        // Обработка SSE потока в реальном времени
        xhr.onprogress = () => {
          const responseText = xhr.responseText;

          // Обрабатываем только НОВЫЕ данные после последнего вызова
          const newChunk = responseText.slice(processedLength);
          if (!newChunk) {
            return; // Нет новых данных
          }

          processedLength = responseText.length;
          buffer += newChunk;

          // Обрабатываем SSE формат (data: {...})
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Сохраняем неполную строку

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) {
              continue;
            }

            const dataStr = trimmed.replace('data: ', '').trim();

            if (dataStr === '[DONE]') {
              continue;
            }

            try {
              const json = JSON.parse(dataStr) as OpenAIDataChunk;
              const content = json.choices?.[0]?.delta?.content;
              if (content) {
                translatedText += content;
                onProgress?.(translatedText);
              }
            } catch (e) {
              // Игнорируем парсинг неполных JSON
            }
          }
        };

        const body = {
          model: this.config.modelName,
          messages: this.buildMessages(content),
          stream: true, // ВАЖНО: включаем стриминг!
          temperature: 0.3,
          max_tokens: 4000,
          top_p: 0.9,
        };

        xhr.send(JSON.stringify(body));
      } catch (error) {
        console.error('[TranslationService] Ошибка стриминга:', error);
        reject(error);
      }
    });
  }

  // Парсинг сообщения об ошибке
  private parseErrorMessage(errorText: string): string {
    try {
      // Попытка распарсить JSON ошибку OpenAI
      if (errorText.startsWith('{')) {
        const json = JSON.parse(errorText);
        return json.error?.message || json.message || errorText;
      }
    } catch {
      // Ошибка не JSON, возвращаем как есть
    }

    // Обрезаем длинный HTML ответ от неверных URL
    if (errorText.length > 500) {
      return 'Неверный URL сервера или API ключ. Проверьте настройки.';
    }

    return errorText;
  }

  private handleError(error: unknown): Error {
    console.error('[TranslationService] Translation error:', error);

    if (error instanceof Error) {
      return error;
    }

    if (typeof error === 'string') {
      return new Error(error);
    }

    if (error && typeof error === 'object') {
      const err = error as { message?: string; status?: number };
      if (err.message) {
        return new Error(err.message);
      }
      if (err.status) {
        return new Error(`Ошибка связи (код ${err.status})`);
      }
    }

    return new Error('Неизвестная ошибка перевода');
  }

  // Пакетный перевод
  public async translateBatch(
    translations: Array<{
      chapterId: number;
      sourceLang: string;
      targetLang: string;
      targetCode: string;
      content: string;
    }>,
    onProgress?: (completed: number, total: number, chapterId: number) => void,
    onError?: (chapterId: number, error: Error) => void
  ): Promise<Array<{ chapterId: number; success: boolean; text?: string }>> {
    const results: Array<{
      chapterId: number;
      success: boolean;
      text?: string;
    }> = [];

    for (let index = 0; index < translations.length; index++) {
      const { chapterId, sourceLang, targetLang, targetCode, content } =
        translations[index];

      try {
        const translatedText = await this.translate(
          chapterId,
          sourceLang,
          targetLang,
          targetCode,
          content,
          undefined,
          undefined,
          undefined
        );

        results.push({ chapterId, success: true, text: translatedText });
        onProgress?.(index + 1, translations.length, chapterId);

        // Небольшая пауза между переводами для избежания rate limiting
        if (index < translations.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Ошибка');
        results.push({ chapterId, success: false });
        onError?.(chapterId, err);
      }
    }

    return results;
  }

  // Очистить весь кэш
  public async clearCache(): Promise<void> {
    await DatabaseService.clearTranslationsCache();
  }

  // Получить размер кэша
  public async getCacheSize(): Promise<number> {
    const cache = await DatabaseService.getAllNovels();
    return cache.reduce((acc, novel) => acc + novel.chapter_count, 0);
  }

  // Загрузить настройки напрямую из AsyncStorage
  private async loadSettingsFromStorage(): Promise<void> {
    try {
      const apiUrl = await AsyncStorage.getItem('translation_apiUrl');
      const apiKey = await AsyncStorage.getItem('translation_apiKey');
      const modelName = await AsyncStorage.getItem('translation_modelName');
      const sourceLang = await AsyncStorage.getItem(
        'translation_sourceLanguage'
      );
      const targetLang = await AsyncStorage.getItem(
        'translation_targetLanguage'
      );
      const targetCode = await AsyncStorage.getItem('translation_targetCode');
      const systemPrompt = await AsyncStorage.getItem(
        'translation_systemPrompt'
      );

      if (apiUrl) this.config.apiUrl = apiUrl;
      if (apiKey) this.config.apiKey = apiKey;
      if (modelName) this.config.modelName = modelName;
      if (sourceLang) this.config.sourceLanguage = sourceLang;
      if (targetLang) this.config.targetLanguage = targetLang;
      if (targetCode) this.config.targetCode = targetCode;
      if (systemPrompt) this.config.systemPrompt = systemPrompt;

      console.log('[TranslationService] Настройки загружены:', {
        apiUrl: this.config.apiUrl,
        hasApiKey: !!this.config.apiKey,
        modelName: this.config.modelName,
      });
    } catch (error) {
      console.error('[TranslationService] Ошибка загрузки настроек:', error);
    }
  }
}

export default TranslationService.getInstance();
