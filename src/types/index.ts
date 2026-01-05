// Типы данных для приложения

export interface Novel {
  id: number;
  title: string;
  slug: string;
  cover_image_path: string | null;
  chapter_count: number;
  created_at: number;
  updated_at: number;
}

export interface Chapter {
  id: number;
  novel_id: number;
  chapter_number: number;
  content: string;
  created_at: number;
}

export interface TranslationCache {
  id: number;
  chapter_id: number;
  source_lang: string;
  target_lang: string;
  target_code: string;
  translated_content: string;
  created_at: number;
}

export interface TranslationQueueItem {
  id: number;
  chapter_id: number;
  source_lang: string;
  target_lang: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error_message: string | null;
  created_at: number;
  completed_at: number | null;
}

export interface Bookmark {
  id: number;
  novel_id: number;
  chapter_number: number;
}

export interface Image {
  id: number;
  novel_id: number;
  chapter_id: number | null;
  filename: string;
  file_path: string;
  is_cover: boolean;
  created_at: number;
}

export type ThemeMode = 'system' | 'light' | 'dark' | 'amoled';

export type NotificationType = 'in_app' | 'always';

export interface ReaderSettings {
  fontFamily: string;
  fontSize: number;
  textAlignment: 'left' | 'center' | 'justify';
  theme: ThemeMode;
}

export interface TranslationSettings {
  sourceLanguage: string;
  targetLanguage: string;
  targetCode: string;
  apiUrl: string;
  apiKey: string;
  modelName: string;
}

export interface AppSettings {
  reader: ReaderSettings;
  translation: TranslationSettings;
  notifications: NotificationType;
}
