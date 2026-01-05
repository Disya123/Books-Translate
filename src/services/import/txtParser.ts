import * as FileSystem from 'expo-file-system/legacy';
import type { ParsedNovel, OnProgress } from './utils';
import { htmlToText } from './utils';

export class TXTParser {
  public async parse(
    fileUri: string,
    onProgress?: OnProgress
  ): Promise<ParsedNovel> {
    // Читаем файл для получения размера
    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    const fileSize = (fileInfo as { size?: number })?.size ?? 0;

    onProgress?.({
      processedBytes: 0,
      totalBytes: fileSize,
      percentage: 0,
      currentFile: 'Чтение TXT файла',
    });

    // Читаем весь файл
    const content = await FileSystem.readAsStringAsync(fileUri, {
      encoding: 'utf8',
    });

    onProgress?.({
      processedBytes: fileSize,
      totalBytes: fileSize,
      percentage: 100,
      currentFile: 'TXT загружен',
    });

    // Детект формата: одна глава или много глав
    const chapters = this.extractChapters(content);

    // Метаданные - используем первую строку или заголовок
    const metadata = this.extractMetadata(content, chapters);

    return {
      metadata,
      chapters,
      images: [],
    };
  }

  private extractChapters(content: string): ParsedNovel['chapters'] {
    // Разделяем по маркерам глав
    // Возможные маркеры:
    // - Глава X
    // - Chapter X
    // - # Глава X
    // - ===
    // - ***
    const chapterMarkers = [
      /^===+$/gm,
      /^\*\*\*+$/gm,
      /^(Глава|Chapter)\s+\d+$/gim,
      /^\d+\.$/gm,
    ];

    // Попробуем найти маркеры
    for (const marker of chapterMarkers) {
      const matches = Array.from(content.matchAll(marker));

      if (matches.length >= 1) {
        // Разделяем по маркерам
        const chapters: Array<{
          number: number;
          title: string;
          content: string;
        }> = [];
        let chapterNumber = 1;

        for (const match of matches) {
          const title = match[0].trim();
          const startIndex = match.index ?? 0;

          if (chapterNumber === 1 && startIndex > 0) {
            // Первая часть (пролог или введение)
            const prologueContent = content.substring(0, startIndex).trim();
            if (prologueContent) {
              chapters.push({
                number: chapterNumber++,
                title: 'Пролог',
                content: htmlToText(prologueContent),
              });
            }
          }

          // Следующий маркер
          const nextMatch = matches[matches.indexOf(match) + 1];
          const endIndex = nextMatch
            ? (nextMatch.index ?? content.length)
            : content.length;

          const chapterContent = content
            .substring(startIndex + title.length, endIndex)
            .trim();

          if (chapterContent) {
            chapters.push({
              number: chapterNumber++,
              title: title,
              content: htmlToText(chapterContent),
            });
          }
        }

        return chapters;
      }
    }

    // Если маркеры не найдены, пытаемся разделить по пустым строкам
    // на блоки текста (абзацы)
    const paragraphs = content
      .split(/\n{3,}/) // 3 или более переводов строк
      .map((p) => p.trim())
      .filter((p) => p.length > 100); // Игнорируем слишком короткие

    if (paragraphs.length > 5) {
      // Много параграфов - это целый текст
      return [
        {
          number: 1,
          title: 'Текст',
          content: htmlToText(content),
        },
      ];
    }

    // Мало параграфов - разделить на 3 главы
    const totalLength = content.length;
    const chunkSize = Math.ceil(totalLength / 3);

    const chapters: Array<{ number: number; title: string; content: string }> =
      [];

    for (let i = 0; i < 3; i++) {
      const start = i * chunkSize;
      const end = Math.min((i + 1) * chunkSize, totalLength);
      const chunk = content.substring(start, end);

      chapters.push({
        number: i + 1,
        title: `Часть ${i + 1}`,
        content: htmlToText(chunk),
      });
    }

    return chapters;
  }

  private extractMetadata(
    content: string,
    _chapters: Array<{ number: number; title: string; content: string }>
  ) {
    const lines = content.split('\n').map((l) => l.trim());

    // Попробуем найти название (первая не пустая строка)
    for (const line of lines) {
      if (line.length > 3 && line.length < 200) {
        // Проверим что это не маркер главы
        if (
          !/^===+$/.test(line) &&
          !/^\*\*\*+$/.test(line) &&
          !/^Глава|^Chapter/i.test(line)
        ) {
          return {
            title: line,
          };
        }
      }
    }

    return { title: 'Без названия' };
  }
}

export default TXTParser;
