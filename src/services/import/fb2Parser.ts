import * as FileSystem from 'expo-file-system/legacy';
import { DOMParser } from '@xmldom/xmldom';
import type { ParsedNovel, OnProgress } from './utils';
import { htmlToText } from './utils';
import { decodeBase64 } from '@/utils/polyfills';

export class FB2Parser {
  private buffer: string[] = [];

  public async parse(
    fileUri: string,
    onProgress?: OnProgress
  ): Promise<ParsedNovel> {
    // Читаем весь файл для FB2 (обычно небольшие)
    const content = await FileSystem.readAsStringAsync(fileUri, {
      encoding: 'base64',
    });

    onProgress?.({
      processedBytes: content.length,
      totalBytes: content.length,
      percentage: 100,
      currentFile: 'FB2 парсинг',
    });

    // Парсим XML
    const parser = new DOMParser({
      errorHandler: (level, message) => {
        console.warn(`FB2 Parse Warning (${level}):`, message);
      },
    });

    const doc = parser.parseFromString(
      this.base64ToUtf8(content),
      'application/xml'
    );

    // Извлекаем метаданные
    const metadata = this.extractMetadata(doc);

    // Извлекаем главы
    const chapters = this.extractChapters(doc);

    // Извлекаем бинарные данные (обложка и изображения)
    const images = this.extractImages(doc);

    return {
      metadata,
      chapters,
      images,
    };
  }

  private extractMetadata(doc: Document): ParsedNovel['metadata'] {
    const description = doc.getElementsByTagName('description')[0];
    if (!description) {
      return { title: 'Без названия' };
    }

    const titleInfo = this.getFirstElementByTagName(description, 'title-info');
    if (!titleInfo) {
      return { title: 'Без названия' };
    }

    const bookTitle = this.getElementText(titleInfo, 'book-title');
    const author = this.getElementText(
      this.getFirstElementByTagName(titleInfo, 'author'),
      'first-name'
    );
    const lastName = this.getElementText(
      this.getFirstElementByTagName(titleInfo, 'author'),
      'last-name'
    );

    const annotation = this.getElementText(titleInfo, 'annotation');
    const cleanAnnotation = annotation ? htmlToText(annotation) : undefined;

    return {
      title: bookTitle || 'Без названия',
      author:
        author || lastName ? `${author || ''} ${lastName || ''}` : undefined,
      description: cleanAnnotation,
    };
  }

  private extractChapters(doc: Document) {
    const chapters: Array<{ number: number; title: string; content: string }> =
      [];
    const body = doc.getElementsByTagName('body')[0];

    if (!body) {
      return chapters;
    }

    const sections = body.getElementsByTagName('section');
    let chapterNumber = 1;

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const title = this.extractSectionTitle(section);
      const content = this.extractSectionContent(section);

      if (content.trim()) {
        chapters.push({
          number: chapterNumber++,
          title,
          content: htmlToText(content),
        });
      }
    }

    return chapters;
  }

  private extractSectionTitle(section: Element): string {
    const titleElements = section.getElementsByTagName('title');
    if (titleElements.length === 0) {
      return `Глава`;
    }

    const titleElement = titleElements[0];
    const paragraphs = titleElement.getElementsByTagName('p');

    const titles: string[] = [];
    for (let i = 0; i < paragraphs.length; i++) {
      const text = paragraphs[i].textContent?.trim();
      if (text) {
        titles.push(text);
      }
    }

    return titles.length > 0 ? titles.join(' ') : 'Глава';
  }

  private extractSectionContent(section: Element): string {
    const paragraphs = section.getElementsByTagName('p');
    const content: string[] = [];

    for (let i = 0; i < paragraphs.length; i++) {
      const p = paragraphs[i];

      // Пропускаем если это заголовок
      if (p.parentNode?.nodeName === 'title') {
        continue;
      }

      const text = p.textContent?.trim();
      if (text) {
        content.push(text);
      }
    }

    return content.join('\n\n');
  }

  private extractImages(doc: Document) {
    const images: Array<{ filename: string; data: string; isCover: boolean }> =
      [];
    const binaries = doc.getElementsByTagName('binary');

    for (let i = 0; i < binaries.length; i++) {
      const binary = binaries[i];
      const id = binary.getAttribute('id');
      const contentType = binary.getAttribute('content-type');

      if (!id || !contentType) {
        continue;
      }

      const isCover = id.includes('cover');

      // Извлекаем имя файла из ID (удаляем префикс #)
      const filename = id.replace(/^[#_]/, '') + this.getExtension(contentType);
      const data = binary.textContent?.trim();

      if (!data) {
        continue;
      }

      images.push({
        filename,
        data,
        isCover,
      });
    }

    return images;
  }

  private getExtension(contentType: string): string {
    const mimeToExt: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
    };

    return mimeToExt[contentType] || '.bin';
  }

  private getFirstElementByTagName(parent: Element, tagName: string): Element {
    return Array.from(parent.getElementsByTagName(tagName))[0];
  }

  private getElementText(parent: Element | undefined, tagName: string): string {
    if (!parent) return '';

    const element = this.getFirstElementByTagName(parent, tagName);
    return element?.textContent?.trim() || '';
  }

  private base64ToUtf8(base64: string): string {
    try {
      // Декодируем base64 в строку UTF-8
      return decodeBase64(base64);
    } catch (error) {
      console.error('Ошибка декодирования base64:', error);
      return '';
    }
  }
}

export default FB2Parser;
