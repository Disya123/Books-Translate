import * as FileSystem from 'expo-file-system/legacy'; // Используйте актуальный импорт (без /legacy если версия Expo 50+)
import JSZip from 'jszip';
import { ParsedNovel, OnProgress } from './index';
import { decodeBase64 } from '@/utils/polyfills';

interface ZIPFileEntry {
  filename: string; // Полный путь внутри ZIP
  cleanName: string; // Имя файла без пути
  data: string;
  zipEntry?: JSZip.JSZipObject;
}

export class ZIPParser {
  private baseDir: string = '';

  public async parse(
    fileUri: string,
    onProgress?: OnProgress
  ): Promise<ParsedNovel> {
    onProgress?.({
      processedBytes: 0,
      totalBytes: 100,
      percentage: 0,
      currentFile: 'Чтение ZIP файла...',
    });

    const zipFiles: ZIPFileEntry[] = [];
    this.baseDir = '';

    try {
      const fileData = await FileSystem.readAsStringAsync(fileUri, {
        encoding: 'base64',
      });

      onProgress?.({
        processedBytes: 20,
        totalBytes: 100,
        percentage: 20,
        currentFile: 'Распаковка архива...',
      });

      const zip = await JSZip.loadAsync(fileData, { base64: true });
      const fileEntries = Object.entries(zip.files);
      const totalFiles = fileEntries.length;
      
      // 1. Предварительный проход: нормализация путей и поиск BaseDir
      const paths: string[] = [];

      for (const [relativePath, zipEntry] of fileEntries) {
        // Нормализуем слэши (Windows fix)
        const normalizedPath = relativePath.replace(/\\/g, '/');
        
        // Игнорируем мусорные файлы macOS и скрытые файлы
        if (normalizedPath.includes('__MACOSX') || normalizedPath.startsWith('.')) {
          continue;
        }

        if (!zipEntry.dir && normalizedPath) {
          paths.push(normalizedPath);
          
          // Получаем чистое имя файла (последняя часть пути)
          const parts = normalizedPath.split('/');
          const cleanName = parts[parts.length - 1];

          zipFiles.push({
            filename: normalizedPath,
            cleanName: cleanName,
            data: '',
            zipEntry,
          });
        }
      }

      // Определение базовой папки (если все файлы лежат внутри одной папки)
      if (paths.length > 0) {
        const firstParts = paths[0].split('/');
        if (firstParts.length > 1) {
          const potentialRoot = firstParts[0];
          // Проверяем, начинается ли каждый файл с этой папки
          const allStartWithRoot = paths.every(p => p.startsWith(potentialRoot + '/'));
          if (allStartWithRoot) {
            this.baseDir = potentialRoot;
          }
        }
      }

      console.log('ZIP: BaseDir detected:', this.baseDir || '(root)');

      // 2. Извлечение данных (Base64)
      let processedCount = 0;
      for (let i = 0; i < zipFiles.length; i++) {
        const file = zipFiles[i];
        if (file.zipEntry) {
          file.data = await file.zipEntry.async('base64');
        }
        
        processedCount++;
        if (onProgress && processedCount % 5 === 0) {
          onProgress({
            processedBytes: 20 + (processedCount / zipFiles.length) * 70,
            totalBytes: 100,
            percentage: 20 + (processedCount / zipFiles.length) * 70,
            currentFile: file.cleanName,
          });
        }
      }

      // 3. Фильтрация и подготовка файлов (убираем префикс папки)
      const workingFiles = zipFiles.map(file => {
        let relativeName = file.filename;
        if (this.baseDir && file.filename.startsWith(this.baseDir + '/')) {
          relativeName = file.filename.slice(this.baseDir.length + 1);
        }
        return {
          ...file,
          relativeName // Путь относительно корня новеллы
        };
      });

      // 4. Поиск обложки (LOGO.PNG или COVER.*)
      // Сначала ищем строго в корне
      let coverFile = workingFiles.find(f => 
        !f.relativeName.includes('/') && // Только файлы в корне
        /^(logo|cover)\.(png|jpg|jpeg|webp)$/i.test(f.cleanName)
      );

      // Если не нашли в корне, ищем в папке images/
      if (!coverFile) {
        coverFile = workingFiles.find(f => 
          /^images\/(logo|cover)\.(png|jpg|jpeg|webp)$/i.test(f.relativeName)
        );
      }

      // Если всё еще нет, ищем любой файл с именем logo.png или cover.jpg где угодно
      if (!coverFile) {
        coverFile = workingFiles.find(f => 
          /^(logo|cover)\.(png|jpg|jpeg|webp)$/i.test(f.cleanName)
        );
      }

      console.log('ZIP: Cover found:', coverFile ? coverFile.relativeName : 'NO');

      // 5. Обработка изображений
      const images: ParsedNovel['images'] = [];

      if (coverFile && coverFile.data) {
        images.push({
          filename: coverFile.cleanName, // Сохраняем просто имя, путь решит импортер
          data: coverFile.data,
          isCover: true,
        });
      }

      // Собираем остальные картинки из папки images/
      const contentImages = workingFiles.filter(f => 
        f.relativeName.toLowerCase().startsWith('images/') &&
        f !== coverFile && // Не дублируем обложку
        /\.(png|jpg|jpeg|webp|gif)$/i.test(f.cleanName)
      );

      for (const img of contentImages) {
        if (img.data) {
          images.push({
            filename: img.cleanName, // Важно: сохраняем имя файла, а не путь images/file.png
            data: img.data,
            isCover: false,
          });
        }
      }

      // 6. Парсинг глав
      const chapterFiles = workingFiles.filter(f => 
        !f.relativeName.includes('/') && // Главы только в корне
        /^\d+\.txt$|^chapter\d+\.txt$/i.test(f.cleanName)
      );

      // Сортировка (1.txt, 2.txt, 10.txt)
      chapterFiles.sort((a, b) => {
        const numA = parseInt(a.cleanName.match(/^\d+/)?.[0] || '0');
        const numB = parseInt(b.cleanName.match(/^\d+/)?.[0] || '0');
        return numA - numB;
      });

      const chapters: ParsedNovel['chapters'] = [];

      for (let i = 0; i < chapterFiles.length; i++) {
        const file = chapterFiles[i];
        if (!file.data) continue;

        try {
          const content = decodeBase64(file.data);
          const lines = content.split('\n');
          // Если первая строка короткая (<100 символов), считаем её заголовком
          const titleLine = lines[0]?.trim();
          const hasExplicitTitle = titleLine && titleLine.length < 100;
          
          const title = hasExplicitTitle ? titleLine : `Глава ${i + 1}`;
          const text = hasExplicitTitle ? lines.slice(1).join('\n').trim() : content;

          chapters.push({
            number: i + 1,
            title,
            content: text || 'Пустая глава',
          });
        } catch (e) {
          console.error(`Error parsing chapter ${file.cleanName}`, e);
        }
      }

      // 7. Метаданные
      const metadata = await this.readMetadata(workingFiles);

      onProgress?.({ processedBytes: 100, totalBytes: 100, percentage: 100, currentFile: 'Готово' });

      return { metadata, chapters, images };

    } catch (error) {
      console.error('ZIP Parse Error:', error);
      throw error;
    }
  }

  private async readMetadata(files: any[]): Promise<ParsedNovel['metadata']> {
    const metaFile = files.find(f => f.cleanName === 'meta.json');
    let meta = {};
    
    if (metaFile && metaFile.data) {
      try {
        const json = decodeBase64(metaFile.data);
        meta = JSON.parse(json);
      } catch (e) {
        console.warn('Failed to parse meta.json');
      }
    }

    // @ts-ignore
    return {
      // @ts-ignore
      title: meta.title || this.baseDir || 'Новая новелла',
      // @ts-ignore
      author: meta.author,
      // @ts-ignore
      description: meta.description,
    };
  }
}

export default ZIPParser;