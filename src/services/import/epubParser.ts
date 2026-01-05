import * as FileSystem from 'expo-file-system/legacy';
import { unzip } from 'react-native-zip-archive';
import { DOMParser } from '@xmldom/xmldom';
import type { ParsedNovel, OnProgress } from './utils';
import { htmlToText } from './utils';

export class EPUBParser {
  public async parse(
    fileUri: string,
    onProgress?: OnProgress
  ): Promise<ParsedNovel> {
    onProgress?.({
      processedBytes: 0,
      totalBytes: 100,
      percentage: 0,
      currentFile: 'Подготовка к распаковке EPUB',
    });

    // Создать временную директорию
    const cacheDir =
      (FileSystem as { documentDirectory?: string }).documentDirectory ?? '';
    const tempDir = `${cacheDir}cache/epub-${Date.now()}`;

    // Распаковать EPUB
    await unzip(fileUri, tempDir);
    onProgress?.({
      processedBytes: 50,
      totalBytes: 100,
      percentage: 50,
      currentFile: 'EPUB распакован',
    });

    // Найти и прочитать container.xml
    const containerPath = await this.findFile(tempDir, 'container.xml');
    if (!containerPath) {
      throw new Error('Не найден container.xml в EPUB');
    }

    const containerContent = await FileSystem.readAsStringAsync(containerPath, {
      encoding: 'utf8',
    });

    const parser = new DOMParser();
    const containerDoc = parser.parseFromString(
      containerContent,
      'application/xml'
    );

    // Получить путь к OPF файлу
    const rootfileNode = containerDoc.getElementsByTagName('rootfile')[0];
    const opfPath = rootfileNode?.getAttribute('full-path');

    if (!opfPath) {
      throw new Error('Не найден OPF файл в container.xml');
    }

    const fullOpfPath = `${tempDir}/${opfPath}`;
    onProgress?.({
      processedBytes: 70,
      totalBytes: 100,
      percentage: 70,
      currentFile: 'Чтение метаданных',
    });

    // Прочитать OPF файл
    const opfContent = await FileSystem.readAsStringAsync(fullOpfPath, {
      encoding: 'utf8',
    });
    const opfDoc = parser.parseFromString(opfContent, 'application/xml');

    // Извлечь метаданные
    const metadata = this.extractMetadata(opfDoc);

    onProgress?.({
      processedBytes: 85,
      totalBytes: 100,
      percentage: 85,
      currentFile: 'Извлечение глав и изображений',
    });

    // Извлечь главы
    const chapters = await this.extractChapters(
      opfDoc,
      fullOpfPath.substring(0, fullOpfPath.lastIndexOf('/'))
    );

    // Извлечь изображения
    const images = await this.extractImages(
      opfDoc,
      fullOpfPath.substring(0, fullOpfPath.lastIndexOf('/'))
    );

    // Очистить временную директорию
    await FileSystem.deleteAsync(tempDir, { idempotent: true });

    onProgress?.({
      processedBytes: 100,
      totalBytes: 100,
      percentage: 100,
      currentFile: 'EPUB загружен',
    });

    return {
      metadata,
      chapters,
      images,
    };
  }

  private async findFile(
    dir: string,
    filename: string
  ): Promise<string | null> {
    try {
      const files = await FileSystem.readDirectoryAsync(dir);

      for (const file of files) {
        const filePath = `${dir}/${file}`;
        const info = await FileSystem.getInfoAsync(filePath);

        if (info.exists && !info.isDirectory && file === filename) {
          return filePath;
        }

        if (info.isDirectory) {
          const found = await this.findFile(filePath, filename);
          if (found) return found;
        }
      }
    } catch (error) {
      console.error('Ошибка поиска файла:', error);
    }

    return null;
  }

  private extractMetadata(doc: Document): ParsedNovel['metadata'] {
    const metadataNode = doc.getElementsByTagName('metadata')[0];
    if (!metadataNode) {
      return { title: 'Без названия' };
    }

    const dc = 'http://purl.org/dc/elements/1.1/';
    const title = this.getElementTextNS(metadataNode, dc, 'title');
    const creator = this.getElementTextNS(metadataNode, dc, 'creator');
    const description = this.getElementTextNS(metadataNode, dc, 'description');
    const cleanDescription = description ? htmlToText(description) : undefined;

    return {
      title: title || 'Без названия',
      author: creator,
      description: cleanDescription,
    };
  }

  private async extractChapters(
    doc: Document,
    basePath: string
  ): Promise<Array<{ number: number; title: string; content: string }>> {
    const chapters: Array<{ number: number; title: string; content: string }> =
      [];
    const manifest = doc.getElementsByTagName('manifest')[0];
    const spine = doc.getElementsByTagName('spine')[0];

    if (!manifest || !spine) {
      return chapters;
    }

    const items = manifest.getElementsByTagName('item');
    const itemrefs = spine.getElementsByTagName('itemref');

    let chapterNumber = 1;

    // Создать карту ID -> href для быстрого поиска
    const idToHref: Record<string, string> = {};
    const idToMediaType: Record<string, string> = {};

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const id = item.getAttribute('id');
      const href = item.getAttribute('href');
      const mediaType = item.getAttribute('media-type');

      if (id && href) {
        idToHref[id] = href;
        idToMediaType[id] = mediaType || '';
      }
    }

    // Пройти по spine в порядке чтения
    for (let i = 0; i < itemrefs.length; i++) {
      const itemref = itemrefs[i];
      const idref = itemref.getAttribute('idref');

      if (!idref) continue;

      const href = idToHref[idref];
      const mediaType = idToMediaType[idref];

      // Пропустить не XHTML файлы
      if (!mediaType?.includes('application/xhtml+xml')) {
        continue;
      }

      // Полный путь к файлу главы
      const chapterPath = `${basePath}/${href}`;
      const chapterContent = await FileSystem.readAsStringAsync(chapterPath, {
        encoding: 'utf8',
      });

      const parser = new DOMParser();
      const chapterDoc = parser.parseFromString(chapterContent, 'text/html');

      // Извлечь заголовок главы
      const title = this.extractChapterTitle(chapterDoc);

      // Извлечь содержимое
      const content = this.extractChapterContent(chapterDoc);

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

  private extractChapterTitle(doc: Document): string {
    const titles = doc.getElementsByTagName('h1');
    if (titles.length > 0) {
      return titles[0].textContent?.trim() || 'Глава';
    }

    const h2s = doc.getElementsByTagName('h2');
    if (h2s.length > 0) {
      return h2s[0].textContent?.trim() || 'Глава';
    }

    return `Глава`;
  }

  private extractChapterContent(doc: Document): string {
    const body = doc.getElementsByTagName('body')[0];
    if (!body) {
      return '';
    }

    const paragraphs = body.getElementsByTagName('p');
    const content: string[] = [];

    for (let i = 0; i < paragraphs.length; i++) {
      const text = paragraphs[i].textContent?.trim();
      if (text) {
        content.push(text);
      }
    }

    return content.join('\n\n');
  }

  private async extractImages(
    doc: Document,
    basePath: string
  ): Promise<Array<{ filename: string; data: string; isCover: boolean }>> {
    const images: Array<{ filename: string; data: string; isCover: boolean }> =
      [];
    const manifest = doc.getElementsByTagName('manifest')[0];

    if (!manifest) {
      return images;
    }

    const items = manifest.getElementsByTagName('item');

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const id = item.getAttribute('id');
      const href = item.getAttribute('href');
      const mediaType = item.getAttribute('media-type');

      // Пропустить не изображения
      if (!mediaType?.startsWith('image/')) {
        continue;
      }

      if (!id || !href) continue;

      const imagePath = `${basePath}/${href}`;

      try {
        const imageData = await FileSystem.readAsStringAsync(imagePath, {
          encoding: 'base64',
        });

        // Проверить обложку
        const isCover = id.toLowerCase().includes('cover');

        images.push({
          filename: href.split('/').pop() || `image${i}.jpg`,
          data: imageData,
          isCover,
        });
      } catch (error) {
        console.error(`Ошибка чтения изображения ${href}:`, error);
      }
    }

    return images;
  }

  private getElementTextNS(
    parent: Element,
    namespaceURI: string,
    tagName: string
  ): string {
    const elements = parent.getElementsByTagNameNS(namespaceURI, tagName);

    if (elements.length === 0) {
      return '';
    }

    return elements[0].textContent?.trim() || '';
  }
}

export default EPUBParser;
