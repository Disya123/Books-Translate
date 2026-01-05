# План адаптации Novel-Translator на мобильные устройства (React Native + TypeScript + Expo)

## Обзор проекта

**Цель:** Создать автономное мобильное приложение для чтения, создания и перевода визуальных новелл с использованием React Native и TypeScript.

**Платформа:** Android (основной фокус) + iOS (ограниченный функционал)

### Дополнительная функциональность: Импорт новелл

**Поддерживаемые форматы:**
- **FB2** — FictionBook 2.0 (российский формат электронных книг)
- **EPUB** — популярный формат электронных книг
- **ZIP** — архивы со структурой папок как в Novel-Translator
- **TXT** — простые текстовые файлы (по главам или полностью)

**Структура архива:**
```
novel-name/
├── 1.txt, 2.txt, 3.txt... (главы)
├── logo.png (обложка)
└── images/ (изображения для глав)
```

### Дополнительная функциональность: Пакетный перевод

**Возможности пакетного перевода:**
- **Перевод всей новеллы** — все главы одной командой
- **Перевод выбранных глав** — массовый выбор глав
- **Перевод диапазона глав** — от главы X до главы Y
- **Очередь переводов** — автоматическая обработка запросов
- **Прогресс и статистика** — отслеживание статуса каждого перевода
- **Пауза по главам** — приостановка после завершения текущей главы, продолжение по запросу
- **Уведомления** — уведомление при завершении пакетного перевода

**Платформенные особенности:**
- **Android:** Полноценный фоновый перевод (Foreground Service), Headless JS, push-уведомления
- **iOS:** Ограничения — экран должен оставаться активным (expo-keep-awake)

---

## Архитектура приложения

### Структура модулей

```
src/
├── components/          # Переиспользуемые UI компоненты
│   ├── NovelCard.tsx
│   ├── ChapterList.tsx
│   ├── SettingsModal.tsx
│   ├── BatchTranslationModal.tsx
│   └── ...
├── screens/            # Экраны приложения
│   ├── LibraryScreen.tsx
│   ├── ReaderScreen.tsx
│   ├── EditorScreen.tsx
│   ├── SettingsScreen.tsx
│   └── ImportScreen.tsx
├── navigation/         # Конфигурация навигации
│   └── AppNavigator.tsx
├── services/           # Сервисы и API
│   ├── database.ts     # SQLite операции
│   ├── translation.ts  # API перевода
│   ├── batchTranslation.ts  # Пакетный перевод
│   ├── notifications.ts  # Уведомления
│   ├── storage.ts      # Файловая система
│   ├── import/         # Модуль импорта новелл
│   │   ├── index.ts
│   │   ├── fb2Parser.ts  # Проверена совместимость с RN
│   │   ├── epubParser.ts  # Проверена совместимость с RN
│   │   ├── zipParser.ts
│   │   └── txtParser.ts
│   └── filePicker.ts   # Выбор файлов
├── store/              # State management
│   ├── index.ts
│   ├── novelsSlice.ts
│   ├── readerSlice.ts
│   ├── translationSlice.ts  # Управление переводами (только метаданные!)
│   └── settingsSlice.ts
├── types/              # TypeScript типы
│   └── index.ts
├── utils/              # Утилиты
│   ├── theme.ts
│   └── helpers.ts
├── hooks/              # Кастомные хуки
│   ├── useBackgroundTask.ts
│   ├── useKeepAwake.ts
│   └── useChapterPagination.ts
└── android/             # Android-специфичное
    └── services/       # Foreground Service для Android
        └── TranslationForegroundService.ts
```

---

## КРИТИЧЕСКИЕ ТЕХНИЧЕСКИЕ ТРЕБОВАНИЯ

### 1. Совместимость библиотек с React Native

**Проблема:**
- Библиотеки вроде `epub2` или старые парсеры FB2 часто написаны для Node.js
- Они могут использовать модули `stream`, `buffer`, `path`, `fs`, которых нет в React Native
- Требуются полифилы (rn-nodeify, stream-browserify) или настройка metro.config.js

**Решение:**
- Выбирать библиотеки, совместимые с Hermes (JS движок в RN)
- Использовать чисто JS-аналоги без зависимостей от Node.js Core Modules
- Проверять совместимость до начала разработки

**Рекомендуемые библиотеки:**
```typescript
// Проверенные варианты для React Native:
// 1. Для EPUB:
//    - react-native-epub-parser (чистый JS, без Node.js зависимостей)
//    - expo-file-system + ручной разбор EPUB (если библиотека не работает)

// 2. Для FB2:
//    - @xmldom/xmldom (чистый JS XML парсер, совместим с RN)
//    - react-native-fb2-reader (проверить совместимость)

// 3. Избегать:
//    - epub2 (Node.js зависимости)
//    - Любые библиотеки с require('fs'), require('path'), require('stream')
```


```typescript
// Конфигурация парсеров с учётом совместимости
const PARSER_CONFIG = {
  FB2: {
    library: '@xmldom/xmldom', // Чистый JS, совместим с RN
    chunkSize: 1024 * 1024, // 1MB за раз для памяти
  },
  EPUB: {
    library: 'react-native-epub-parser', // Проверить совместимость
    chunkSize: 1024 * 1024,
  },
  ZIP: {
    library: 'react-native-zip-archive', // Нативный модуль
    native: true,
  },
  TXT: {
    library: 'custom', // Собственная простая реализация
    chunkSize: 1024 * 1024,
  },
};
```

### 3. Управление памятью при импорте

**Проблема:**
- Если пользователь попытается импортировать книгу 50 МБ (с картинками)
- Чтение всего файла в строку base64 для передачи в парсер может вызвать Out Of Memory

**Решение:**
- Использовать потоковое чтение (stream reading) или чанкинг
- Не грузить весь файл в RAM сразу
- Показывать прогресс пользователю

```typescript
// Потоковое чтение больших файлов
async function* streamReadFile(fileUri: string, chunkSize: number = 1024 * 1024) {
  const fileInfo = await FileSystem.getInfoAsync(fileUri);
  const fileSize = fileInfo.size || 0;
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
      offset,
      total: fileSize,
    };
    
    offset += chunkSize;
    
    // Очистить память между чанками
    if (offset % (chunkSize * 5) === 0) {
      // Вызвать GC если возможно
      global.gc?.();
    }
  }
}

// Использование при импорте
async function importLargeFile(fileUri: string) {
  const parser = new FB2Parser();
  
  for await (const chunk of streamReadFile(fileUri)) {
    // Обработать чанк без загрузки всего файла в память
    parser.processChunk(chunk.data);
    
    // Показать прогресс
    updateProgress(chunk.progress);
  }
  
  return parser.getResult();
}
```

### 4. SQLite транзакции при импорте

**Проблема:**
- Если в книге 500 глав, 500 отдельных INSERT запросов будут очень медленными

**Решение:**
- Использовать транзакции для обёртки всего импорта в одну операцию
- Промежуточные данные сохранять во временные переменные

```typescript
// ПРАВИЛЬНО: использование транзакций
async function importNovel(novelData: NovelData, chapters: Chapter[], images: Image[]) {
  // Сначала сохранить все изображения в файловую систему
  const savedImages = [];
  for (const image of images) {
    const filePath = await saveImageToFileSystem(image.data, image.filename);
    savedImages.push({
      filename: image.filename,
      file_path: filePath,
      is_cover: image.isCover,
    });
  }
  
  await db.transactionAsync(async tx => {
    // Создать новеллу
    const novelId = await insertNovel(tx, novelData);
    
    // Все главы в одной транзакции
    for (const chapter of chapters) {
      await insertChapter(tx, novelId, chapter);
    }
    
    // Только пути к изображениям в БД
    for (const image of savedImages) {
      await insertImage(tx, novelId, image);
    }
  });
  
  // Конец транзакции — всё сохранено атомарно
}
```

### 5. Android Foreground Service (реальный фоновый перевод)

**Преимущества Android:**
- Можно использовать Foreground Service для реального фонового перевода
- Headless JS позволяет выполнять код даже с выключенным экраном
- Push-уведомления работают отлично

**Реализация:**
```typescript
// android/services/TranslationForegroundService.ts
// Нативный модуль для Android
import { HeadlessJSTask, ForegroundService } from 'expo-task-manager';

export class TranslationForegroundService {
  static async startTranslation(novelId: number) {
    // Запустить Foreground Service
    await ForegroundService.startTask('translation-task', {
      title: 'Перевод новеллы',
      description: 'Перевод в процессе...',
      icon: 'ic_notification',
    });
    
    // Выполнять перевод в Headless JS
    await HeadlessJSTask.run(() => {
      return TranslationService.processQueue();
    });
  }
}
```

### 6. iOS ограничения (экран активен)

**Проблема:**
- iOS убивает сетевые соединения и JS-потоки через 30-180 секунд после сворачивания

**Решение:**
- Использовать `expo-keep-awake` для удержания экрана активным
- Alert при попытке свернуть приложение
- Уведомление о необходимости держать приложение открытым

```typescript
// hooks/useKeepAwake.ts
import { activateKeepAwake, deactivateKeepAwake } from 'expo-keep-awake';
import { BackHandler, Alert } from 'react-native';

export const useKeepAwake = (isActive: boolean) => {
  useEffect(() => {
    if (isActive) {
      activateKeepAwake();
      
      // Предупреждение при попытке свернуть на iOS
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        Alert.alert(
          'Перевод в процессе',
          'Для продолжения перевода на iOS приложение должно оставаться открытым. Свернуть приложение?',
          [
            { text: 'Отмена', style: 'cancel' },
            { text: 'Свернуть', onPress: () => {
              // Приостановить перевод
              BatchTranslationService.pause();
              deactivateKeepAwake();
            }},
          ]
        );
        return true;
      });
      
      return () => {
        deactivateKeepAwake();
        backHandler.remove();
      };
    }
  }, [isActive]);
};
```

### 7. Производительность рендеринга (FlatList)

**Проблема:**
- ScrollView для огромной главы вызовет лаги
- Весь текст рендерится сразу, что плохо для производительности

**Решение:**
- FlatList с рендерингом абзацев вместо ScrollView
- Мемоизация компонентов

```typescript
// Компонент разбивки текста на абзацы
const ParagraphList = ({ content }: { content: string }) => {
  const paragraphs = useMemo(() => {
    return content.split('\n\n').filter(p => p.trim());
  }, [content]);
  
  const renderItem = useCallback(({ item, index }: { item: string; index: number }) => {
    return <Paragraph key={`para-${index}`} text={item} />;
  }, []);
  
  return (
    <FlatList
      data={paragraphs}
      renderItem={renderItem}
      keyExtractor={(item, index) => `para-${index}`}
      removeClippedSubviews={true}
      maxToRenderPerBatch={10}
      windowSize={5}
      initialNumToRender={5}
      ListEmptyComponent={<EmptyState />}
    />
  );
};

// Мемоизированный компонент абзаца
const Paragraph = memo(({ text }: { text: string }) => {
  return (
    <Text style={styles.paragraph}>
      {text}
    </Text>
  );
});
```

### 8. Оптимизация Redux Store

**Проблема:**
- Хранение текста глав в Redux Store потребляет сотни мегабайт оперативной памяти

**Решение:**
- В Redux только метаданные — ID, заголовки, статусы, не текст
- Текст подгружать из SQLite непосредственно перед отображением

```typescript
// ПРАВИЛЬНО: только метаданные в Redux
interface NovelsState {
  novels: Array<{
    id: number;
    title: string;
    slug: string;
    coverImage: string | null;
    chapterCount: number;
    // !НЕ хранить здесь текст глав!
  }>;
}

// Непосредственно перед отображением
const currentChapterText = await Database.getChapterContent(chapterId);
```

### 9. Хранение изображений в файловой системе

**Проблема:**
- Хранение бинарных данных (картинок) в SQLite — плохая практика
- База быстро раздуется до сотен мегабайт
- Вытаскивание base64 из БД и передача в UI потребляет много памяти

**Решение:**
- Хранить только пути к файлам в SQLite
- Изображения сохранять в файловой системе устройства

```typescript
// Структура папок для хранения
// documentDirectory/
// ├── novels/
// │   ├── novel-slug-1/
// │   │   ├── logo.png
// │   │   └── images/
// │   │       ├── 1.webp
// │   │       └── 2.webp
// │   └── novel-slug-2/
// │       └── ...

async function saveImageToFileSystem(base64Data: string, filename: string, novelSlug: string) {
  const novelDir = `${FileSystem.documentDirectory}/novels/${novelSlug}/images`;
  await FileSystem.makeDirectoryAsync(novelDir, { intermediates: true });
  
  const filePath = `${novelDir}/${filename}`;
  await FileSystem.writeAsStringAsync(filePath, base64Data, {
    encoding: FileSystem.EncodingType.Base64,
  });
  
  return filePath;
}

// В БД только путь
await db.executeSql(
  'INSERT INTO images (novel_id, filename, file_path, is_cover) VALUES (?, ?, ?, ?)',
  [novelId, filename, filePath, isCover ? 1 : 0]
);
```

---

## Модель данных

### SQLite таблицы

#### 1. novels
| Поле | Тип | Описание |
|------|-----|----------|
| id | INTEGER PRIMARY KEY | Уникальный ID |
| title | TEXT | Название новеллы |
| slug | TEXT UNIQUE | URL-безопасное название |
| cover_image_path | TEXT | Путь к обложке в ФС |
| created_at | TIMESTAMP | Дата создания |
| updated_at | TIMESTAMP | Дата обновления |

#### 2. chapters
| Поле | Тип | Описание |
|------|-----|----------|
| id | INTEGER PRIMARY KEY | Уникальный ID |
| novel_id | INTEGER (FK) | ID новеллы |
| chapter_number | INTEGER | Номер главы |
| content | TEXT | Содержание главы |
| created_at | TIMESTAMP | Дата создания |

#### 3. translation_cache
| Поле | Тип | Описание |
|------|-----|----------|
| id | INTEGER PRIMARY KEY | Уникальный ID |
| chapter_id | INTEGER (FK) | ID главы |
| source_lang | TEXT | Исходный язык |
| target_lang | TEXT | Целевой язык |
| target_code | TEXT | Код целевого языка |
| translated_content | TEXT | Переведённый текст |
| created_at | TIMESTAMP | Дата кэширования |

#### 4. translation_queue
| Поле | Тип | Описание |
|------|-----|----------|
| id | INTEGER PRIMARY KEY | Уникальный ID |
| chapter_id | INTEGER (FK) | ID главы |
| source_lang | TEXT | Исходный язык |
| target_lang | TEXT | Целевой язык |
| status | TEXT | Статус: pending/processing/completed/failed |
| error_message | TEXT | Сообщение об ошибке |
| created_at | TIMESTAMP | Дата добавления в очередь |
| completed_at | TIMESTAMP | Дата завершения |

#### 5. bookmarks
| Поле | Тип | Описание |
|------|-----|----------|
| id | INTEGER PRIMARY KEY | Уникальный ID |
| novel_id | INTEGER (FK) | ID новеллы |
| chapter_number | INTEGER | Номер главы |

#### 6. images (ПУТИ К ФАЙЛАМ, НЕ В БД!)
| Поле | Тип | Описание |
|------|-----|----------|
| id | INTEGER PRIMARY KEY | Уникальный ID |
| novel_id | INTEGER (FK) | ID новеллы |
| chapter_id | INTEGER (FK) | ID главы (nullable) |
| filename | TEXT | Название файла изображения |
| file_path | TEXT | Путь к файлу в файловой системе |
| is_cover | BOOLEAN | Является ли обложкой |
| created_at | TIMESTAMP | Дата создания |

**КРИТИЧЕСКО ВАЖНО:** Хранить только пути к файлам, не сами данные!

---

## Экраны приложения

### 1. LibraryScreen (Библиотека новелл)
**Функционал:**
- Отображение сетки новелл с обложками
- Поиск по названию
- Добавление новой новеллы
- Редактирование существующей
- Удаление новеллы
- Закладки
- Пакетный перевод (кнопка для всего списка или отдельной новеллы)

**UI элементы:**
- FlatList с двухколоночной сеткой
- Карточка новеллы с обложкой и названием
- Кнопка добавления новой новеллы
- Поле поиска
- FAB (Floating Action Button) для быстрого добавления
- Меню пакетного перевода

### 2. ReaderScreen (Чтение главы)
**Функционал:**
- Отображение текста главы с изображениями (виртуализированно!)
- Навигация между главами (предыдущая/следующая)
- Перевод главы через API с кэшированием
- Настройки отображения (шрифт, размер, выравнивание, цвета)
- Добавление в закладки
- Тёмная/светлая тема
- Автоскролл при переводе

**UI элементы:**
- **FlatList** с абзацами вместо ScrollView (виртуализация!)
- Header с названием новеллы и номером главы
- Модальное окно настроек
- Кнопки навигации в футере
- Индикатор загрузки при переводе

### 3. EditorScreen (Редактор новеллы)
**Функционал:**
- Создание новой новеллы
- Редактирование метаданных (название, обложка)
- Управление главами (создание, редактирование, удаление)
- Загрузка изображений для глав
- Автосохранение

**UI элементы:**
- Сайдбар со списком глав
- TextInput для ввода названия
- ImagePicker для обложки
- TextInput с поддержкой Markdown для текста главы
- Кнопки управления (сохранить, удалить)

### 4. ImportScreen (Импорт новелл)
**Функционал:**
- Выбор файлов из файловой системы (FB2, EPUB, ZIP, TXT)
- Парсинг выбранного файла с прогрессом
- Предпросмотр содержимого (название, количество глав, обложка)
- Настройка импорта (переименование новеллы, выбор глав)
- Прогресс импорта
- Обработка ошибок
- Предупреждение о памяти для больших файлов

**UI элементы:**
- Список поддерживаемых форматов с кнопками выбора
- DocumentPicker для выбора файлов
- Модальное окно предпросмотра
- **ProgressBar для прогресса импорта (обязательно!)**
- Сообщения об ошибках
- Предупреждение о размере файла (>50 МБ)

### 5. BatchTranslationModal (Модальное окно пакетного перевода)
**Функционал:**
- Выбор режима перевода (вся новелла / выбранные главы / диапазон)
- Список глав с чекбоксами
- Настройки перевода (языки, модель)
- Отображение прогресса
- Управление очередью (пауза после главы, остановка, очистка, продолжение)
- Статистика перевода (завершённые/в процессе/ошибки)
- Предупреждение о сворачивании (iOS)
- Настройки уведомлений (включить/выключить)

**UI элементы:**
- Radio buttons для выбора режима
- FlatList с чекбоксами для выбора глав
- Range slider для диапазона
- ProgressBar для общего прогресса
- Кнопки управления (Старт, Пауза после главы, Продолжить, Остановить)
- Переключатель уведомлений
- **Alert при попытке свернуть (только iOS)**
- Список задач в очереди с индикаторами статуса
- Статистика перевода

### 6. SettingsScreen (Настройки приложения)
**Функционал:**
- Настройки перевода (исходный язык, целевой язык)
- API конфигурация (URL, ключ модели, название модели)
- Кэш управление (очистка кэша переводов)
- Управление очередью переводов (просмотр, очистка)
- Настройки уведомлений (включить/выключить, тип)
- Тема приложения

---

## Основные зависимости

### Основные библиотеки
- `expo` - платформа разработки
- `react-native` - UI фреймворк
- `typescript` - типизация

### Навигация
- `@react-navigation/native`
- `@react-navigation/native-stack`
- `@react-navigation/bottom-tabs`

### Хранилище данных
- `expo-sqlite` - локальная база данных
- `@react-native-async-storage/async-storage` - хранилище настроек

### HTTP запросы
- `axios` - для API переводов
- `eventsource` - для SSE (потоковой передачи)

### UI компоненты
- `react-native-paper` - Material Design компоненты
- `react-native-vector-icons` - иконки
- `react-native-gesture-handler` - жесты
- `react-native-pager-view` - для пагинации в читалке

### Импорт FB2/EPUB (совместимые с RN!)
- `@xmldom/xmldom` - чистый JS XML парсер (FB2)
- `react-native-epub-parser` - проверить совместимость (EPUB)
- `react-native-zip-archive` - нативный модуль (ZIP)

### Фоновое выполнение
- `expo-keep-awake` - держать экран активным (для iOS)
- `expo-task-manager` - управление фоновыми задачами (Android)
- `expo-background-fetch` - периодические фоновые задачи
- `expo-notifications` - уведомления

### Android Foreground Service
- `expo-foreground-service` - Android-specific модуль
- `@react-native-async-storage/async-storage` - Headless JS доступ

### Утилиты
- `expo-file-system` - работа с файлами
- `expo-document-picker` - выбор документов
- `expo-image-picker` - выбор изображений
- `expo-secure-store` - безопасное хранение API ключов
- `react-native-fs` - файловая система

---

## Потоки данных

### Хранение данных

```mermaid
flowchart TD
    A[Данные новеллы] --> B[SQLite: novels]
    C[Данные глав] --> D[SQLite: chapters]
    E[Переводы] --> F[SQLite: translation_cache]
    G[Закладки] --> H[SQLite: bookmarks]
    I[Настройки] --> J[AsyncStorage]
    K[Изображения] --> L[Файловая система документа]
    M[Пути к изображениям] --> N[SQLite: images]
    O[Импортируемые файлы] --> P[Временная папка]
    P --> Q[Парсеры с чанкингом]
    Q --> B
    Q --> D
    Q --> L[сохранить файл]
    Q --> N[сохранить путь]
    R[Очередь переводов] --> S[SQLite: translation_queue]
    S --> F
    
    Note over Redux: Redux хранит только метаданные<br/>и ID, текст из SQLite
    
    Note over Images: Изображения в файловой системе,<br/>SQLite хранит только пути
    
    Note over Memory: Потоковое чтение<br/>для больших файлов
```

---

## Список задач

### Этап 1: Настройка проекта и архитектуры
- [ ] Инициализация Expo проекта с TypeScript
- [ ] Настройка ESLint и Prettier
- [ ] Настройка пути к файлам (path aliases)
- [ ] **Проверка совместимости библиотек** с React Native (Hermes, Node.js modules)
- [ ] Настройка Navigation (Native Stack + Bottom Tabs)
- [ ] Создание базовой структуры папок

### Этап 2: Модели данных и база данных
- [ ] Создание TypeScript типов данных
- [ ] Настройка expo-sqlite
- [ ] Создание схемы базы данных (таблицы: novels, chapters, translation_cache, translation_queue, bookmarks, images)
- [ ] Реализация DatabaseService с транзакциями (transactionAsync)
- [ ] Реализация хранения путей к изображениям (не самих данных)
- [ ] Миграции базы данных

### Этап 3: State Management
- [ ] Установка Redux Toolkit
- [ ] Создание store
- [ ] Реализация novelsSlice (новеллы, главы) — только метаданные!
- [ ] Реализация readerSlice (чтение, настройки)
- [ ] Реализация translationSlice (переводы, очередь) — только метаданные!
- [ ] Реализация settingsSlice (настройки приложения)
- [ ] Интеграция AsyncStorage с Redux

### Этап 4: Экран библиотеки (LibraryScreen)
- [ ] Разметка экрана библиотеки
- [ ] Компонент NovelCard
- [ ] FlatList с сеткой новелл
- [ ] Поиск по названию
- [ ] Добавление новой новеллы
- [ ] Удаление новеллы с подтверждением
- [ ] Загрузка обложек из файловой системы
- [ ] Кнопка пакетного перевода

### Этап 5: Экран чтения (ReaderScreen)
- [ ] Разметка экрана чтения
- [ ] **FlatList с абзацами вместо ScrollView** (виртуализация!)
- [ ] Компонент разбивки текста на абзацы
- [ ] Отображение текста главы с поддержкой изображений
- [ ] Навигация между главами
- [ ] Модальное окно настроек
- [ ] Реализация настроек отображения (шрифт, размер, выравнивание)
- [ ] Смена темы (light/dark/amoled)
- [ ] Закладки
- [ ] Автоскролл

### Этап 6: Экран редактора (EditorScreen)
- [ ] Разметка экрана редактора
- [ ] Компонент списка глав
- [ ] Форма редактирования метаданных новеллы
- [ ] TextInput для текста главы
- [ ] Выбор обложки (expo-image-picker)
- [ ] Загрузка изображений в главы
- [ ] Автосохранение

### Этап 7: Сервис перевода
- [ ] Создание TranslationService
- [ ] Реализация запроса к API перевода
- [ ] Потоковая передача (SSE) через eventsource
- [ ] Кэширование переводов в SQLite
- [ ] Обработка ошибок сети
- [ ] Проверка интернета перед запросом

### Этап 8: Сервис пакетного перевода (Android Foreground Service)
- [ ] Создание BatchTranslationService
- [ ] Управление очередью переводов
- [ ] Добавление задач в очередь
- [ ] **Реализация Android Foreground Service** для фонового перевода
- [ ] Реализация iOS keep-awake для удержания экрана активным
- [ ] Обработка задач в фоновом режиме
- [ ] Обновление статуса задач
- [ ] Интеграция с TranslationCache
- [ ] Реализация паузы после главы (pauseAfterChapter)
- [ ] Кнопка "Продолжить" для возобновления
- [ ] Обработка ошибок и повторные попытки
- [ ] **Alert при попытке свернуть (только iOS)**

### Этап 9: Сервис уведомлений
- [ ] Настройка expo-notifications
- [ ] Запрос прав на уведомления
- [ ] Создание NotificationsService
- [ ] Функция отправки уведомления о завершении главы
- [ ] Функция отправки уведомления о завершении перевода
- [ ] Функция отправки уведомления об ошибке
- [ ] Настройка типа уведомлений (только в приложении / всегда)
- [ ] Интеграция с BatchTranslationService
- [ ] **Android: уведомления Foreground Service**

### Этап 10: Модальное окно пакетного перевода (BatchTranslationModal)
- [ ] Разметка модального окна
- [ ] Режимы выбора (вся новелла / выбранные главы / диапазон)
- [ ] FlatList с чекбоксами
- [ ] Range slider для диапазона
- [ ] ProgressBar для прогресса
- [ ] Кнопки управления очередью (Старт, Пауза после главы, Продолжить, Остановить)
- [ ] Переключатель уведомлений
- [ ] **Alert при попытке свернуть (только iOS)**
- [ ] Список задач с индикаторами статуса
- [ ] Статистика перевода

### Этап 11: Экран импорта (ImportScreen)
- [ ] Разметка экрана импорта
- [ ] Интеграция expo-document-picker
- [ ] Компонент выбора формата файла
- [ ] Модальное окно предпросмотра
- [ ] **ProgressBar для прогресса импорта (обязательно!)**
- [ ] Проверка размера файла (предупреждение >50 МБ)
- [ ] Обработка ошибок импорта

### Этап 12: Сервис импорта с совместимостью
- [ ] **Проверка совместимости библиотек** с React Native (Hermes, Node.js modules)
- [ ] Установка совместимых библиотек:
  - [ ] `@xmldom/xmldom` для FB2 (чистый JS)
  - [ ] `react-native-epub-parser` для EPUB (проверить совместимость)
  - [ ] `react-native-zip-archive` для ZIP (нативный)
- [ ] Создание базового интерфейса парсера (Parser interface)
- [ ] Реализация потокового чтения файлов (streamReadFile)
- [ ] Реализация чанкинга для больших файлов (chunkSize: 1MB)
- [ ] Реализация FB2Parser с использованием @xmldom/xmldom
- [ ] Реализация EPUBParser с совместимой библиотекой
- [ ] Реализация ZIPParser (распаковка и парсинг структуры) — нативный модуль!
- [ ] Реализация TXTParser (простая собственная реализация)
- [ ] **Реализация транзакций SQLite для импорта**
- [ ] **Реализация хранения изображений в файловой системе (не в SQLite)**
- [ ] Обработка изображений (извлечение, сохранение)
- [ ] Обработка обложек
- [ ] Конвертация глав во внутренний формат
- [ ] Интеграция с SQLite базой данных
- [ ] Управление временными файлами

### Этап 13: Настройки приложения (SettingsScreen)
- [ ] Разметка экрана настроек
- [ ] Настройки перевода (языки)
- [ ] Конфигурация API (URL, ключ, модель)
- [ ] Безопасное хранение API ключа
- [ ] Управление кэшем (просмотр размера, очистка)
- [ ] Управление очередью переводов (просмотр, очистка)
- [ ] Настройки уведомлений (включить/выключить, тип)
- [ ] Настройки темы

### Этап 14: Оптимизация производительности
- [ ] **Проверка размера Redux Store** (удалить лишнее!)
- [ ] Мемоизация компонентов (memo, useMemo, useCallback)
- [ ] Виртуализация списков (FlatList с windowSize)
- [ ] Отложенная загрузка изображений (lazy loading)
- [ ] Профилирование производительности

### Этап 15: Платформенные оптимизации
- [ ] **Android Foreground Service** для фонового перевода
- [ ] **iOS keep-awake** для удержания экрана активным
- [ ] **Alert при сворачивании (только iOS)**
- [ ] Платформенные тесты (Android и iOS)

### Этап 16: Полировка, оптимизация и тестирование
- [ ] Анимации переходов
- [ ] Улучшение UX (индикаторы загрузки, пустые состояния)
- [ ] Обработка ошибок
- [ ] Логирование
- [ ] Тестирование на Android (основной фокус)
- [ ] Тестирование на iOS (ограниченный функционал)

### Этап 17: Сборка и публикация
- [ ] Настройка app.json (название, иконки, splash screen)
- [ ] Настройка Android Foreground Service в app.json
- [ ] Настройка Expo EAS Build
- [ ] Сборка APK для Android
- [ ] Сборка IPA для iOS (опционально)
- [ ] Подготовка к публикации в Google Play
- [ ] Подготовка к публикации в App Store (опционально)

---

## Конфигурация приложения (app.json)

```json
{
  "expo": {
    "name": "Novel Translator",
    "slug": "novel-translator",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "plugins": [
      "expo-keep-awake",
      "expo-notifications",
      "expo-task-manager",
      "expo-background-fetch",
      "expo-foreground-service"
    ],
    "android": {
      "package": "com.noveltranslator.app",
      "versionCode": 1,
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      },
      "permissions": [
        "FOREGROUND_SERVICE",
        "WAKE_LOCK"
      ]
    },
    "ios": {
      "bundleIdentifier": "com.noveltranslator.app",
      "buildNumber": "1"
    }
  }
}
```

---

## Преимущества данного подхода

1. **Автономность:** Все данные хранятся локально, приложение работает без интернета
2. **Кэширование:** Переводы сохраняются и переиспользуются
3. **Производительность:** React Native обеспечивает нативную скорость
4. **Кроссплатформенность:** Одно кодовая база для iOS и Android
5. **Масштабируемость:** Модульная архитектура позволяет легко добавлять функции
6. **Безопасность:** API ключи хранятся защищённо
7. **Универсальность импорта:** Поддержка популярных форматов (FB2, EPUB, ZIP, TXT)
8. **Простота использования:** Интуитивный интерфейс импорта с предпросмотром
9. **Массовый перевод:** Пакетный перевод позволяет перевести всю новеллу или выбранные главы
10. **Умная пауза:** Приостановка после завершения каждой главы с возможностью продолжения
11. **Уведомления:** Информирование о прогрессе перевода, даже при свернутом приложении
12. **Оптимизация Redux:** Хранение только метаданных в Redux, текст из SQLite
13. **Виртуализация рендеринга:** FlatList для текста вместо ScrollView
14. **Совместимые библиотеки:** Использование библиотек, совместимых с React Native и Hermes
15. **Потоковое чтение:** Чанкинг для предотвращения OOM при импорте больших файлов
16. **Транзакции SQLite:** Быстрый импорт с пакетными операциями
17. **Android Foreground Service:** Реальный фоновый перевод на Android
18. **Хранение изображений в ФС:** Изображения в файловой системе, SQLite хранит только пути
19. **Платформенная адаптация:** Учёт ограничений iOS и преимуществ Android

---

## Детали реализации импорта с совместимостью

### Потоковое чтение больших файлов

```typescript
import * as FileSystem from 'expo-file-system';

// Потоковое чтение для предотвращения OOM
async function* streamReadFile(fileUri: string, chunkSize: number = 1024 * 1024) {
  const fileInfo = await FileSystem.getInfoAsync(fileUri);
  const fileSize = fileInfo.size || 0;
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
      offset,
      total: fileSize,
    };
    
    offset += chunkSize;
    
    // Очистить память каждые 5 чанков
    if (offset % (chunkSize * 5) === 0) {
      global.gc?.();
    }
  }
}

// Использование при импорте
async function importLargeFB2(fileUri: string) {
  const parser = new FB2Parser();
  
  for await (const chunk of streamReadFile(fileUri)) {
    // Обработать чанк без загрузки всего файла в память
    parser.processChunk(chunk.data);
    
    // Показать прогресс
    updateProgress(chunk.progress);
  }
  
  return parser.getResult();
}
```

### SQLite транзакции для быстрого импорта

```typescript
import * as FileSystem from 'expo-file-system';

// ПАМЯТКА: только пути к файлам в БД, файлы в ФС
async function importNovel(novelData: NovelData, chapters: Chapter[], images: Image[]) {
  const db = await Database.getInstance();
  const novelDir = `${FileSystem.documentDirectory}/novels/${novelData.slug}`;
  
  // Создать папку для новеллы
  await FileSystem.makeDirectoryAsync(novelDir, { intermediates: true });
  
  // Сохранить все изображения в файловую систему
  const savedImages = [];
  for (const image of images) {
    const imagePath = `${novelDir}/${image.filename}`;
    await FileSystem.writeAsStringAsync(imagePath, image.data, {
      encoding: FileSystem.EncodingType.Base64,
    });
    
    savedImages.push({
      filename: image.filename,
      file_path: imagePath,
      is_cover: image.isCover || false,
    });
  }
  
  // Вся операция с БД в одной транзакции
  await db.transactionAsync(async tx => {
    // Создать новеллу
    const [result] = await tx.executeSql(
      'INSERT INTO novels (title, slug, cover_image_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [novelData.title, novelData.slug, savedImages.find(i => i.is_cover)?.file_path || null, Date.now(), Date.now()]
    );
    const novelId = result.insertId;
    
    // Все главы в одной транзакции
    for (const chapter of chapters) {
      await tx.executeSql(
        'INSERT INTO chapters (novel_id, chapter_number, content, created_at) VALUES (?, ?, ?, ?)',
        [novelId, chapter.number, chapter.content, Date.now()]
      );
    }
    
    // Только пути к изображениям в БД
    for (const image of savedImages) {
      await tx.executeSql(
        'INSERT INTO images (novel_id, filename, file_path, is_cover, created_at) VALUES (?, ?, ?, ?, ?)',
        [novelId, image.filename, image.file_path, image.is_cover ? 1 : 0, Date.now()]
      );
    }
  });
  
  // Конец транзакции — всё сохранено атомарно и быстро
}

// Удаление новеллы с очисткой файлов
async function deleteNovel(novelId: number) {
  const db = await Database.getInstance();
  const novel = await getNovelById(novelId);
  
  // Удалить папку с файлами
  if (novel.slug) {
    const novelDir = `${FileSystem.documentDirectory}/novels/${novel.slug}`;
    await FileSystem.deleteAsync(novelDir, { idempotent: true });
  }
  
  // Удалить записи из БД в транзакции
  await db.transactionAsync(async tx => {
    await tx.executeSql('DELETE FROM images WHERE novel_id = ?', [novelId]);
    await tx.executeSql('DELETE FROM chapters WHERE novel_id = ?', [novelId]);
    await tx.executeSql('DELETE FROM novels WHERE id = ?', [novelId]);
    await tx.executeSql('DELETE FROM translation_cache WHERE chapter_id IN (SELECT id FROM chapters WHERE novel_id = ?)', [novelId]);
  });
}
```

### Проверка совместимости библиотек

```typescript
// Проверка совместимости перед началом разработки
const LIBRARY_COMPATIBILITY = {
  '@xmldom/xmldom': {
    status: 'COMPATIBLE',
    notes: 'Чистый JS, работает с Hermes',
  },
  'react-native-epub-parser': {
    status: 'NEEDS_TESTING',
    notes: 'Проверить отсутствие Node.js зависимостей',
  },
  'react-native-zip-archive': {
    status: 'COMPATIBLE',
    notes: 'Нативный модуль, хорошо работает',
  },
  'epub2': {
    status: 'INCOMPATIBLE',
    notes: 'Node.js зависимости, использовать альтернативы',
  },
};

// Альтернативная реализация для EPUB если библиотека не работает
class SimpleEPUBParser {
  async parse(fileUri: string) {
    // Распаковать EPUB (это ZIP) через react-native-zip-archive
    // Прочитать container.xml
    // Прочитать OPF файл
    // Извлечь метаданные и главы
    // Вся операция с чанкинг для памяти
  }
}