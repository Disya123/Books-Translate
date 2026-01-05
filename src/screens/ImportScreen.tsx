import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import DatabaseService from '@/services/database';
import * as ImportService from '@/services/import/index';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppTheme, useThemeStyles } from '@/hooks/useAppTheme';
import { ThemeColors, ThemeMode } from '@/utils/theme';

const SUPPORTED_FORMATS = [
  { format: 'FB2', icon: '📖', description: 'FictionBook 2.0' },
  { format: 'EPUB', icon: '📚', description: 'Популярный формат e-book' },
  { format: 'ZIP', icon: '📦', description: 'Архив со структурой' },
  { format: 'TXT', icon: '📝', description: 'Простой текст' },
];

const MAX_FILE_SIZE = 150 * 1024 * 1024; // Увеличил лимит до 150 MB

// Исправленная функция сохранения
async function saveImageToFileSystem(
  base64Data: string,
  filename: string,
  novelSlug: string
): Promise<string> {
  // 1. Очистка имени файла
  const cleanFileName = filename.split('/').pop()?.replace(/[^a-zA-Z0-9._-]/g, '_') || `img_${Date.now()}.png`;
  
  // 2. Получение директории (с защитой от null)
  let rootDir = FileSystem.documentDirectory;
  
  // Фоллбэк для странных случаев (обычно не нужен, если дебаггер выключен)
  if (!rootDir) {
    console.warn('FileSystem.documentDirectory is null, using cacheDirectory');
    rootDir = FileSystem.cacheDirectory;
  }

  if (!rootDir) {
    throw new Error('Критическая ошибка: файловая система недоступна');
  }

  // 3. Формируем пути. Важно убедиться, что слэши правильные.
  // rootDir обычно уже заканчивается на '/', поэтому убираем дублирование
  const baseDir = rootDir.endsWith('/') ? rootDir : `${rootDir}/`;
  const novelDir = `${baseDir}novels/${novelSlug}/images`;

  console.log(`[SaveImage] Создание папки: ${novelDir}`);

  // 4. Создаем папку
  try {
    await FileSystem.makeDirectoryAsync(novelDir, { intermediates: true });
  } catch (e) {
    // Игнорируем ошибку, если папка уже существует
    console.log('[SaveImage] Папка, возможно, уже существует');
  }

  // 5. Полный путь к файлу
  const filePath = `${novelDir}/${cleanFileName}`;

  console.log(`[SaveImage] Запись файла: ${filePath}`);

  // 6. Запись
// 6. Запись
  await FileSystem.writeAsStringAsync(filePath, base64Data, {
    encoding: 'base64', // Используем просто строку, это работает всегда
  });

  return filePath;
}

export default function ImportScreen() {
  const navigation = useNavigation();
  const { theme, mode } = useAppTheme();
  const styles = useThemeStyles(createStyles);

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState('');

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/zip',
          'application/epub+zip',
          'application/x-fictionbook+xml',
          'text/plain',
          '*/*', // Fallback для некоторых Android устройств
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const file = result.assets[0];
      const fileSize = file.size || 0;

      if (fileSize > MAX_FILE_SIZE) {
        Alert.alert(
          'Файл слишком большой',
          `Размер: ${(fileSize / 1024 / 1024).toFixed(2)} МБ`,
          [{ text: 'OK', style: 'cancel' }]
        );
        return;
      }
      
      importFile(file);
    } catch (error) {
      console.error('Error picking file:', error);
      Alert.alert('Ошибка', 'Не удалось выбрать файл');
    }
  };

  const importFile = async (file: DocumentPicker.DocumentPickerAsset) => {
    setLoading(true);
    setProgress(0);
    setStep('Чтение файла...');

    try {
      const fileUri = file.uri;
      const fileName = file.name.toLowerCase();
      
      let parser: ImportService.Parser;
      let parserName = '';

      if (fileName.endsWith('.fb2')) {
        parser = new ImportService.FB2Parser();
        parserName = 'FB2';
      } else if (fileName.endsWith('.epub')) {
        parser = new ImportService.EPUBParser();
        parserName = 'EPUB';
      } else if (fileName.endsWith('.zip')) {
        parser = new ImportService.ZIPParser();
        parserName = 'ZIP';
      } else if (fileName.endsWith('.txt')) {
        parser = new ImportService.TXTParser();
        parserName = 'TXT';
      } else {
        throw new Error(`Неизвестный формат файла: ${file.name}`);
      }

      setProgress(10);
      setStep(`Парсинг ${parserName}...`);

      const novel = await parser.parse(
        fileUri,
        (progressData: ImportService.ImportProgress) => {
          setProgress(10 + Math.round(progressData.percentage * 0.6));
        }
      );

      setProgress(70);
      setStep('Подготовка данных...');

      // Генерация slug
      const novelSlug = novel.metadata.title
        .toLowerCase()
        .replace(/[^a-z0-9а-яё]/gi, '-') // Заменяем спецсимволы
        .replace(/-+/g, '-') // Убираем дубли тире
        .replace(/^-|-$/g, '') // Убираем тире по краям
        || `novel_${Date.now()}`;

      // --- ИСПРАВЛЕНИЕ: Поиск и сохранение обложки ---
      
      let coverImagePath: string | null = null;
      
      // 1. Ищем обложку в массиве images (куда её кладет ZIPParser)
      const coverImageObj = novel.images.find(img => img.isCover);
      
      // 2. Или пробуем metadata.cover (для других парсеров)
      const metaCover = novel.metadata.cover;

      try {
        if (coverImageObj) {
          // Приоритет 1: Обложка из массива картинок
          console.log('Найдена обложка в images:', coverImageObj.filename);
          coverImagePath = await saveImageToFileSystem(
            coverImageObj.data,
            coverImageObj.filename,
            novelSlug
          );
        } else if (metaCover) {
          // Приоритет 2: Обложка из метаданных
          console.log('Найдена обложка в metadata:', metaCover.filename);
          coverImagePath = await saveImageToFileSystem(
            metaCover.data,
            metaCover.filename,
            novelSlug
          );
        }
      } catch (error) {
        console.error('Не удалось сохранить обложку:', error);
      }

      setProgress(80);
      setStep('Создание записи в БД...');

      // Создание новеллы
      const novelResult = await DatabaseService.createNovel(
        novel.metadata.title,
        novelSlug,
        coverImagePath // Передаем путь к файлу (например file:///.../logo.png)
      );
      
      // @ts-ignore - Expo SQLite type fix
      const novelId = novelResult.lastInsertRowId || novelResult.insertId;

      setProgress(85);
      setStep(`Сохранение глав (${novel.chapters.length})...`);

      // Сохранение глав (транзакция внутри сервиса была бы быстрее, но так тоже ок)
      for (const chapter of novel.chapters) {
        await DatabaseService.createChapter(
          novelId,
          chapter.number,
          chapter.content
        );
      }

      await DatabaseService.updateChapterCount(novelId);

      setProgress(95);
      setStep('Сохранение иллюстраций...');

      // Сохранение остальных изображений
      for (const image of novel.images) {
        // Пропускаем обложку, если мы её уже сохранили
        if (image === coverImageObj) continue;

        try {
          const imagePath = await saveImageToFileSystem(
            image.data,
            image.filename,
            novelSlug
          );
          
          await DatabaseService.addImage(
            novelId,
            null, // Пока не привязываем к конкретной главе
            image.filename,
            imagePath,
            false // isCover
          );
        } catch (error) {
          console.warn(`Ошибка сохранения картинки ${image.filename}:`, error);
        }
      }

      setProgress(100);
      setStep('Готово!');

      setTimeout(() => {
        Alert.alert(
          'Импорт завершен',
          `Новелла "${novel.metadata.title}" добавлена.\nГлав: ${novel.chapters.length}`,
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      }, 500);

    } catch (error) {
      console.error('Import error:', error);
      Alert.alert(
        'Ошибка',
        error instanceof Error ? error.message : 'Произошла ошибка при импорте',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle={mode === 'light' ? 'dark-content' : 'light-content'}
        translucent
        backgroundColor="transparent"
      />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <MaterialIcons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Импорт новеллы</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Intro */}
        <View style={styles.introSection}>
          <Text style={styles.introText}>
            Выберите файл с вашего устройства. Приложение автоматически распознает формат и структуру.
          </Text>
        </View>

        {/* Formats List */}
        <Text style={styles.sectionTitle}>Поддерживаемые форматы</Text>
        
        {SUPPORTED_FORMATS.map((format) => (
          <View key={format.format} style={styles.formatCard}>
            <Text style={styles.formatIcon}>{format.icon}</Text>
            <View style={styles.formatInfo}>
              <Text style={styles.formatName}>{format.format}</Text>
              <Text style={styles.formatDescription}>{format.description}</Text>
            </View>
          </View>
        ))}

        {/* Import Button */}
        <TouchableOpacity
          style={[styles.importButton, loading && styles.disabledButton]}
          onPress={handlePickFile}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <>
              <MaterialIcons name="file-upload" size={24} color="#000" style={{ marginRight: 8 }} />
              <Text style={styles.importButtonText}>Выбрать файл</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Progress Bar */}
        {loading && (
          <View style={styles.progressContainer}>
            <View style={styles.progressHeader}>
              <Text style={styles.stepText}>{step}</Text>
              <Text style={styles.progressText}>{progress}%</Text>
            </View>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
            </View>
          </View>
        )}

        {/* Warning Info */}
        <View style={styles.infoSection}>
          <MaterialIcons name="info-outline" size={20} color={theme.textSecondary} style={{ marginRight: 8 }} />
          <Text style={styles.infoText}>
            Картинки сохраняются локально. Большие архивы могут обрабатываться до 1-2 минут.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: ThemeColors, mode?: ThemeMode) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  backBtn: {
    padding: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.text,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  introSection: {
    marginBottom: 24,
  },
  introText: {
    color: theme.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 12,
    marginTop: 10,
  },
  formatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  formatIcon: {
    fontSize: 28,
    marginRight: 16,
  },
  formatInfo: {
    flex: 1,
  },
  formatName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 2,
  },
  formatDescription: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  importButton: {
    backgroundColor: theme.primary,
    flexDirection: 'row',
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 20,
    shadowColor: theme.primary + '4D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  disabledButton: {
    opacity: 0.7,
  },
  importButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: mode === 'light' ? '#FFF' : theme.text,
  },
  progressContainer: {
    backgroundColor: theme.surface,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  stepText: {
    color: theme.text,
    fontSize: 14,
  },
  progressText: {
    color: theme.primary,
    fontSize: 14,
    fontWeight: 'bold',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: theme.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: theme.primary,
  },
  infoSection: {
    flexDirection: 'row',
    marginTop: 20,
    padding: 12,
    backgroundColor: theme.primary + '19',
    borderRadius: 8,
    alignItems: 'flex-start',
  },
  infoText: {
    color: theme.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
  },
});