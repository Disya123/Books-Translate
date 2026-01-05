import * as FileSystem from 'expo-file-system/legacy';

export interface Chapter {
  number: number;
  title: string;
  content: string;
}

export interface NovelMetadata {
  title: string;
  author?: string;
  description?: string;
  cover?: {
    filename: string;
    data: string; // base64
    isCover: boolean;
  };
}

export interface FileInfo {
  exists: boolean;
  isDirectory: boolean;
  size?: number;
  uri: string;
  modificationTime?: number;
}

export interface Image {
  filename: string;
  data: string; // base64
  isCover: boolean;
}

export interface ParsedNovel {
  metadata: NovelMetadata;
  chapters: Chapter[];
  images: Image[];
}

export interface ImportProgress {
  processedBytes: number;
  totalBytes: number;
  percentage: number;
  currentFile?: string;
}

export type OnProgress = (progress: ImportProgress) => void;

export interface Parser {
  parse(fileUri: string, onProgress?: OnProgress): Promise<ParsedNovel>;
}

// Потоковое чтение для больших файлов
export async function* streamReadFile(
  fileUri: string,
  chunkSize: number = 1024 * 1024
): AsyncGenerator<{ data: string; progress: number }, void, unknown> {
  const fileInfo = await FileSystem.getInfoAsync(fileUri);
  const fileSize = (fileInfo as FileInfo)?.size ?? 0;

  if (fileSize === 0) {
    throw new Error('Файл пуст');
  }

  let offset = 0;

  while (offset < fileSize) {
    const chunk = await FileSystem.readAsStringAsync(fileUri, {
      encoding: 'base64',
      position: offset,
      length: Math.min(chunkSize, fileSize - offset),
    });

    yield {
      data: chunk,
      progress: (offset / fileSize) * 100,
    };

    offset += Math.min(chunkSize, fileSize - offset);
  }
}

// Создание слага из названия
export function createSlug(title: string): string {
  const transliterated = title
    .toLowerCase()
    .trim()
    .replace(
      /[а-я]/g,
      (c) => cyrillicToLatin[c as keyof typeof cyrillicToLatin] || c
    )
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  return transliterated || `novel-${Date.now()}`;
}

const cyrillicToLatin: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'yo',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'shch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
};

// Очистка HTML тегов
export function stripHtmlTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Конвертация HTML в простой текст
export function htmlToText(html: string): string {
  // Удалить теги скриптов и стилей
  html = html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '');

  // Заменить <p> на новые строки
  html = html.replace(/<\/p>/gi, '\n\n');
  html = html.replace(/<br[^>]*>/gi, '\n');

  // Удалить все остальные теги
  const text = stripHtmlTags(html);

  return text;
}

// Экранирование для XML
export function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
