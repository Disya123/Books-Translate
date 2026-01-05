import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
  ActivityIndicator,
  Alert,
  StatusBar,
  Platform,
  Modal,
  FlatList,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { Chapter } from '@/types';
import DatabaseService from '@/services/database';
import TranslationService from '@/services/translation';
import ToastService from '@/services/toast';
import { useSelector } from 'react-redux';
import { RootState } from '@/store';
import { useAppTheme, useThemeStyles } from '@/hooks/useAppTheme';
import { ThemeColors, ThemeMode } from '@/utils/theme';

type ReaderScreenProps = {
  route: {
    params: {
      novelId: number;
      chapterNumber: number;
    };
  };
};

export default function ReaderScreen({ route }: ReaderScreenProps) {
  const navigation = useNavigation();
  const { novelId, chapterNumber: initialChapterNumber } = route.params;

  // Тема
  const { theme, mode } = useAppTheme();
  const styles = useThemeStyles(createStyles);

  // Основные данные
  const [allChapters, setAllChapters] = useState<Chapter[]>([]);
  const [currentChapterNum, setCurrentChapterNum] = useState(initialChapterNumber);
  const [chapter, setChapter] = useState<Chapter | null>(null);
  
  // Состояния UI и процесса
  const [loading, setLoading] = useState(true);
  const [uiVisible, setUiVisible] = useState(true);
  const [progress, setProgress] = useState(0);

  // Модальное окно глав
  const [isChaptersModalVisible, setIsChaptersModalVisible] = useState(false);
  const [chaptersSearchQuery, setChaptersSearchQuery] = useState('');

  // Модальное окно настроек читалки
  const [isSettingsModalVisible, setIsSettingsModalVisible] = useState(false);

  // Настройки читалки
  const [readerSettings, setReaderSettings] = useState({
    fontSize: 18,
    lineHeight: 28,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    textAlign: 'left' as 'left' | 'center' | 'right' | 'justify',
    fontWeight: 'normal' as 'light' | 'normal' | 'bold',
    paragraphSpacing: 20,
    textIndent: 0,
  });

  // Фильтрованный список глав
  const filteredChapters = allChapters.filter(
    chapter =>
      chapter.chapter_number.toString().includes(chaptersSearchQuery) ||
      `Глава ${chapter.chapter_number}`.toLowerCase().includes(chaptersSearchQuery.toLowerCase())
  );
  
  // Перевод
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationProgress, setTranslationProgress] = useState('');
  const [showTranslated, setShowTranslated] = useState(false);
  const [originalContent, setOriginalContent] = useState('');

  const scrollRef = useRef<ScrollView>(null);

  // Redux настройки
  const translationSettings = useSelector(
    (state: RootState) => state.settings.translation
  );

  // 1. При старте загружаем список всех глав, чтобы знать порядок
  useEffect(() => {
    const initReader = async () => {
      try {
        const chapters = await DatabaseService.getChapters(novelId);
        setAllChapters(chapters);
        // Загружаем контент начальной главы
        await loadChapterContent(initialChapterNumber);
      } catch (error) {
        console.error('Failed to init reader:', error);
        Alert.alert('Ошибка', 'Не удалось загрузить список глав');
      }
    };
    initReader();
  }, [novelId]);

  // 2. Функция загрузки контента конкретной главы
  const loadChapterContent = async (chNum: number) => {
    setLoading(true);
    try {
      const loadedChapter = await DatabaseService.getChapterByNumber(novelId, chNum);

      if (loadedChapter) {
        setChapter(loadedChapter);
        setOriginalContent(loadedChapter.content);
        setShowTranslated(false); // Сбрасываем перевод при смене главы
        
        // Сброс скролла
        if (scrollRef.current) {
          scrollRef.current.scrollTo({ y: 0, animated: false });
        }
      } else {
        Alert.alert('Ошибка', 'Глава не найдена в базе данных');
      }
    } catch (error) {
      console.error('Failed to load chapter content:', error);
    } finally {
      setLoading(false);
    }
  };

  // Вычисляем индексы для навигации
  const currentIndex = allChapters.findIndex(c => c.chapter_number === currentChapterNum);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex !== -1 && currentIndex < allChapters.length - 1;
  const totalChapters = allChapters.length;

  // --- Навигация ---

  const goToPreviousChapter = () => {
    if (hasPrev) {
      const prevChapter = allChapters[currentIndex - 1];
      setCurrentChapterNum(prevChapter.chapter_number);
      loadChapterContent(prevChapter.chapter_number);
      
      // Обновляем прогресс бар (грубо)
      setProgress(((currentIndex - 1) / totalChapters) * 100);
    }
  };

  const goToNextChapter = () => {
    if (hasNext) {
      const nextChapter = allChapters[currentIndex + 1];
      setCurrentChapterNum(nextChapter.chapter_number);
      loadChapterContent(nextChapter.chapter_number);
      
      // Обновляем прогресс бар
      setProgress(((currentIndex + 1) / totalChapters) * 100);
    }
  };

  // --- UI Handlers ---

  const handleScroll = (event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const scrollPercentage =
      (contentOffset.y / (contentSize.height - layoutMeasurement.height)) * 100;
    setProgress(Math.min(100, Math.max(0, scrollPercentage)));
  };

  const handleTap = () => {
    setUiVisible((prev) => !prev);
  };

  const handleOpenChaptersModal = () => {
    setIsChaptersModalVisible(true);
    setChaptersSearchQuery('');
  };

  const handleSelectChapter = (chapterNumber: number) => {
    setCurrentChapterNum(chapterNumber);
    loadChapterContent(chapterNumber);
    setIsChaptersModalVisible(false);
  };

  const handleOpenSettingsModal = () => {
    setIsSettingsModalVisible(true);
  };

  const handleChangeFontSize = (delta: number) => {
    setReaderSettings(prev => ({
      ...prev,
      fontSize: Math.max(12, Math.min(32, prev.fontSize + delta)),
      lineHeight: Math.max(20, Math.min(44, prev.lineHeight + delta * 0.8)),
    }));
  };

  const handleChangeParagraphSpacing = (delta: number) => {
    setReaderSettings(prev => ({
      ...prev,
      paragraphSpacing: Math.max(8, Math.min(40, prev.paragraphSpacing + delta)),
    }));
  };

  const handleToggleTextAlign = () => {
    const alignments: ('left' | 'center' | 'right' | 'justify')[] = ['left', 'center', 'right', 'justify'];
    const currentIndex = alignments.indexOf(readerSettings.textAlign);
    setReaderSettings(prev => ({
      ...prev,
      textAlign: alignments[(currentIndex + 1) % alignments.length],
    }));
  };

  const handleToggleFontWeight = () => {
    const weights: ('light' | 'normal' | 'bold')[] = ['light', 'normal', 'bold'];
    const currentIndex = weights.indexOf(readerSettings.fontWeight);
    setReaderSettings(prev => ({
      ...prev,
      fontWeight: weights[(currentIndex + 1) % weights.length],
    }));
  };

  const handleToggleFontFamily = () => {
    const fonts = [
      { name: 'Georgia', label: 'Georgia' },
      { name: Platform.OS === 'ios' ? 'Arial' : 'Roboto', label: Platform.OS === 'ios' ? 'Arial' : 'Roboto' },
      { name: 'Times New Roman', label: 'Times New Roman' },
      { name: Platform.OS === 'ios' ? 'Courier New' : 'monospace', label: 'Courier New' },
      { name: 'Palatino', label: 'Palatino' },
      { name: 'Verdana', label: 'Verdana' },
    ];
    const currentIndex = fonts.findIndex(f => f.name === readerSettings.fontFamily);
    setReaderSettings(prev => ({
      ...prev,
      fontFamily: fonts[(currentIndex + 1) % fonts.length].name,
    }));
  };

  const handleChangeTextIndent = (delta: number) => {
    setReaderSettings(prev => ({
      ...prev,
      textIndent: Math.max(0, Math.min(60, prev.textIndent + delta)),
    }));
  };

  // --- Перевод ---

  const handleTranslate = async () => {
    if (!chapter || isTranslating) return;

    // Переключение обратно на оригинал
    if (showTranslated) {
      setChapter({ ...chapter, content: originalContent });
      setShowTranslated(false);
      return;
    }

    if (!translationSettings.apiKey) {
      Alert.alert(
        'API ключ не настроен',
        'Пожалуйста, настройте API ключ в настройках приложения.',
        [
          { text: 'Отмена', style: 'cancel' },
          {
            text: 'Настроить',
            onPress: () => navigation.navigate('settings-root' as never),
          },
        ]
      );
      return;
    }

    try {
      setIsTranslating(true);
      setTranslationProgress('Подключение к API...');

      TranslationService.updateFromReduxConfig({
        apiKey: translationSettings.apiKey,
        apiUrl: translationSettings.apiUrl,
        modelName: translationSettings.modelName,
        sourceLanguage: translationSettings.sourceLanguage,
        targetLanguage: translationSettings.targetLanguage,
        targetCode: translationSettings.targetCode,
        systemPrompt: 'You are a professional novel translator. Translate text preserving literary style and tone.',
      });

      // 1. Проверяем кэш
      const cached = await DatabaseService.getCachedTranslation(
        chapter.id,
        translationSettings.targetCode
      );

      if (cached) {
        setChapter({ ...chapter, content: cached.translated_content });
        setShowTranslated(true);
        setIsTranslating(false);
        ToastService.translationCacheUsed();
        return;
      }

      // 2. Запрос перевода
      await TranslationService.translate(
        chapter.id,
        translationSettings.sourceLanguage,
        translationSettings.targetLanguage,
        translationSettings.targetCode,
        originalContent, // Всегда переводим оригинал
        (translated) => {
          // Успех
          setChapter({ ...chapter, content: translated });
          setShowTranslated(true);
          ToastService.translationComplete(currentChapterNum);
        },
        (error) => {
          Alert.alert('Ошибка перевода', error.message);
        },
        (progressText) => {
          // Стриминг
          if (progressText.length === 0) {
            setTranslationProgress('Перевод главы...');
          } else {
            // Как только пошел текст, убираем модалку и показываем текст
            setIsTranslating(false); 
            setChapter({ ...chapter, content: progressText });
            setShowTranslated(true);
            setTranslationProgress('');
          }
        }
      );

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
      Alert.alert('Ошибка перевода', errorMessage);
    } finally {
      setIsTranslating(false);
      setTranslationProgress('');
    }
  };

  const splitIntoParagraphs = (content: string): string[] => {
    if (!content) return [];
    return content.split('\n\n').filter((p) => p.trim());
  };

  // --- Render ---

  if (loading && !chapter) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.loadingText}>Загрузка...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!chapter) return null; // Should not happen due to loading state

  const paragraphs = splitIntoParagraphs(chapter.content);

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <StatusBar
        barStyle={mode === 'light' ? 'dark-content' : 'light-content'}
        translucent
        backgroundColor="transparent"
      />
      
      {/* Модальное окно прогресса (только для начального подключения) */}
      {isTranslating && (
        <View style={styles.translationModal}>
          <View style={styles.translationModalContent}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={styles.translationModalText}>
              {translationProgress}
            </Text>
            <TouchableOpacity
              style={styles.cancelTranslationBtn}
              onPress={() => setIsTranslating(false)}
            >
              <Text style={styles.cancelTranslationText}>Отмена</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

        {/* Header */}
        <View style={[
            styles.overlayBar,
            styles.header,
            !uiVisible && styles.hiddenHeader
          ]}>
          <View style={styles.headerContent}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <MaterialIcons name="arrow-back" size={24} color={theme.text} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleOpenChaptersModal} style={styles.chapterLabelContainer}>
              <Text style={styles.chapterLabel} numberOfLines={1}>
                Глава {currentChapterNum} {showTranslated && '(RU)'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleOpenSettingsModal}>
              <MaterialIcons name="settings" size={20} color={theme.text} />
            </TouchableOpacity>
          </View>
        </View>

      {/* Content */}
      <ScrollView
        ref={scrollRef}
        style={styles.scrollContainer}
        contentContainerStyle={styles.contentPadding}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={100}
      >
        <TouchableWithoutFeedback onPress={handleTap}>
          <View>
            {paragraphs.map((paragraph, index) => (
              <View key={`para-${index}`} style={[styles.paragraph, { marginBottom: readerSettings.paragraphSpacing }]}>
                <Text style={[
                  styles.paragraphText,
                  showTranslated && styles.translatedText,
                  {
                    fontSize: readerSettings.fontSize,
                    lineHeight: readerSettings.lineHeight,
                    fontFamily: readerSettings.fontFamily,
                    textAlign: readerSettings.textAlign,
                    fontWeight: readerSettings.fontWeight === 'light' ? '300' : (readerSettings.fontWeight === 'bold' ? 'bold' : 'normal'),
                  },
                  readerSettings.textIndent > 0 && { paddingLeft: readerSettings.textIndent }
                ]}>
                  {paragraph}
                </Text>
              </View>
            ))}
          </View>
        </TouchableWithoutFeedback>
      </ScrollView>

      {/* Footer */}
      <View
        style={[
          styles.overlayBar,
          styles.footer,
          !uiVisible && styles.hiddenFooter,
        ]}
      >
        {/* Progress Bar */}
        <View style={styles.progressRow}>
          <Text style={styles.progressText}>Гл. {currentChapterNum}</Text>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${progress}%` }]} />
            <View style={[styles.thumb, { left: `${progress}%` }]} />
          </View>
          <Text style={styles.progressText}>{Math.round(progress)}%</Text>
        </View>

        {/* Controls */}
          <View style={styles.controlsRow}>
            <TouchableOpacity
              style={[styles.navBtn, { opacity: hasPrev ? 1 : 0.3 }]}
              onPress={goToPreviousChapter}
              disabled={!hasPrev}
            >
              <MaterialIcons name="arrow-back" size={24} color={theme.text} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.translateBtn}
              onPress={handleTranslate}
              disabled={isTranslating}
            >
              {isTranslating ? (
                <ActivityIndicator size="small" color={mode === 'light' ? '#FFF' : '#000'} />
              ) : (
                <MaterialIcons name="auto-awesome" size={18} color={mode === 'light' ? '#FFF' : '#000'} />
              )}
              <Text style={styles.translateBtnText}>
                {isTranslating
                  ? '...'
                  : showTranslated
                    ? 'Оригинал'
                    : 'Перевести'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.navBtn, { opacity: hasNext ? 1 : 0.3 }]}
              onPress={goToNextChapter}
              disabled={!hasNext}
            >
              <MaterialIcons name="arrow-forward" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>
      </View>

      {/* Модальное окно списка глав */}
      <Modal
        visible={isChaptersModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsChaptersModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            {/* Панель для свайпа */}
            <View style={styles.modalHandleContainer}>
              <View style={styles.modalHandle} />
            </View>

            {/* Заголовок и поиск */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Список глав</Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setIsChaptersModalVisible(false)}
              >
                <MaterialIcons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.searchInputContainer}>
              <MaterialIcons name="search" size={20} color={theme.textSecondary} />
              <TextInput
                style={[styles.searchInput, { color: theme.text }]}
                placeholder="Поиск по номеру главы..."
                placeholderTextColor={theme.textSecondary}
                value={chaptersSearchQuery}
                onChangeText={setChaptersSearchQuery}
              />
              {chaptersSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setChaptersSearchQuery('')}>
                  <MaterialIcons name="clear" size={20} color={theme.textSecondary} />
                </TouchableOpacity>
              )}
            </View>

            {/* Список глав */}
            <FlatList
              data={filteredChapters}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.chapterItem,
                    item.chapter_number === currentChapterNum && styles.chapterItemSelected,
                  ]}
                  onPress={() => handleSelectChapter(item.chapter_number)}
                >
                  <Text
                    style={[
                      styles.chapterItemText,
                      item.chapter_number === currentChapterNum && styles.chapterItemTextSelected,
                    ]}
                  >
                    Глава {item.chapter_number}
                  </Text>
                  {item.chapter_number === currentChapterNum && (
                    <MaterialIcons name="check" size={20} color={theme.primary} />
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <MaterialIcons name="search-off" size={48} color={theme.textSecondary} />
                  <Text style={styles.emptyText}>Главы не найдены</Text>
                </View>
              }
              contentContainerStyle={{ paddingBottom: 20 }}
            />

            <Text style={styles.chaptersCount}>
              Всего: {filteredChapters.length} из {allChapters.length} глав
            </Text>
          </View>
        </View>
      </Modal>

      {/* Модальное окно настроек читалки */}
      <Modal
        visible={isSettingsModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsSettingsModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            {/* Панель для свайпа */}
            <View style={styles.modalHandleContainer}>
              <View style={styles.modalHandle} />
            </View>

            {/* Заголовок */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Настройки читалки</Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setIsSettingsModalVisible(false)}
              >
                <MaterialIcons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Размер шрифта */}
              <View style={styles.settingSection}>
                <Text style={styles.settingLabel}>Размер шрифта</Text>
                <View style={styles.settingRow}>
                  <TouchableOpacity
                    style={styles.settingBtn}
                    onPress={() => handleChangeFontSize(-2)}
                  >
                    <MaterialIcons name="remove" size={20} color={theme.text} />
                  </TouchableOpacity>
                  <Text style={styles.settingValue}>{readerSettings.fontSize}</Text>
                  <TouchableOpacity
                    style={styles.settingBtn}
                    onPress={() => handleChangeFontSize(2)}
                  >
                    <MaterialIcons name="add" size={20} color={theme.text} />
                  </TouchableOpacity>
                </View>
              </View>

            {/* Межстрочный интервал */}
            <View style={styles.settingSection}>
              <Text style={styles.settingLabel}>Межстрочный интервал</Text>
              <View style={styles.settingRow}>
                <TouchableOpacity
                  style={styles.settingBtn}
                  onPress={() => handleChangeFontSize(-2)}
                >
                  <MaterialIcons name="remove" size={20} color={theme.text} />
                </TouchableOpacity>
                <Text style={styles.settingValue}>{Math.round(readerSettings.lineHeight)}</Text>
                <TouchableOpacity
                  style={styles.settingBtn}
                  onPress={() => handleChangeFontSize(2)}
                >
                  <MaterialIcons name="add" size={20} color={theme.text} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Отступы между абзацами */}
            <View style={styles.settingSection}>
              <Text style={styles.settingLabel}>Отступы между абзацами</Text>
              <View style={styles.settingRow}>
                <TouchableOpacity
                  style={styles.settingBtn}
                  onPress={() => handleChangeParagraphSpacing(-4)}
                >
                  <MaterialIcons name="remove" size={20} color={theme.text} />
                </TouchableOpacity>
                <Text style={styles.settingValue}>{readerSettings.paragraphSpacing}</Text>
                <TouchableOpacity
                  style={styles.settingBtn}
                  onPress={() => handleChangeParagraphSpacing(4)}
                >
                  <MaterialIcons name="add" size={20} color={theme.text} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Выравнивание текста */}
            <View style={styles.settingSection}>
              <Text style={styles.settingLabel}>Выравнивание</Text>
              <TouchableOpacity
                style={styles.settingRow}
                onPress={handleToggleTextAlign}
              >
                <MaterialIcons
                  name={
                    readerSettings.textAlign === 'left'
                      ? 'format-align-left'
                      : readerSettings.textAlign === 'center'
                      ? 'format-align-center'
                      : readerSettings.textAlign === 'right'
                      ? 'format-align-right'
                      : 'format-align-justify'
                  }
                  size={24}
                  color={theme.primary}
                />
                <Text style={[
                  styles.settingValue,
                  { flex: 1, textAlign: 'left' }
                ]}>
                  {readerSettings.textAlign === 'left'
                    ? 'По левому краю'
                    : readerSettings.textAlign === 'center'
                    ? 'По центру'
                    : readerSettings.textAlign === 'right'
                    ? 'По правому краю'
                    : 'По ширине'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Толщина шрифта */}
            <View style={styles.settingSection}>
              <Text style={styles.settingLabel}>Толщина шрифта</Text>
              <TouchableOpacity
                style={styles.settingRow}
                onPress={handleToggleFontWeight}
              >
                <MaterialIcons
                  name={
                    readerSettings.fontWeight === 'light'
                      ? 'format-size'
                      : readerSettings.fontWeight === 'normal'
                      ? 'format-size'
                      : 'format-bold'
                  }
                  size={24}
                  color={theme.primary}
                />
                <Text style={[
                  styles.settingValue,
                  { flex: 1, textAlign: 'left' }
                ]}>
                  {readerSettings.fontWeight === 'light'
                    ? 'Тонкий'
                    : readerSettings.fontWeight === 'normal'
                    ? 'Обычный'
                    : 'Жирный'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Шрифт */}
            <View style={styles.settingSection}>
              <Text style={styles.settingLabel}>Шрифт</Text>
              <TouchableOpacity
                style={styles.settingRow}
                onPress={handleToggleFontFamily}
              >
                <MaterialIcons name="text-fields" size={24} color={theme.primary} />
                <Text style={[
                  styles.settingValue,
                  { flex: 1 }
                ]}>
                  {readerSettings.fontFamily}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Красная строка */}
            <View style={styles.settingSection}>
              <Text style={styles.settingLabel}>Красная строка (отступ)</Text>
              <View style={styles.settingRow}>
                <TouchableOpacity
                  style={styles.settingBtn}
                  onPress={() => handleChangeTextIndent(-5)}
                >
                  <MaterialIcons name="remove" size={20} color={theme.text} />
                </TouchableOpacity>
                <Text style={styles.settingValue}>{readerSettings.textIndent}</Text>
                <TouchableOpacity
                  style={styles.settingBtn}
                  onPress={() => handleChangeTextIndent(5)}
                >
                  <MaterialIcons name="add" size={20} color={theme.text} />
                </TouchableOpacity>
              </View>
            </View>
            </ScrollView>

            {/* Кнопка сброса (внизу) */}
            <TouchableOpacity
              style={styles.resetSettingsBtn}
              onPress={() => setReaderSettings({
                fontSize: 18,
                lineHeight: 28,
                fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
                textAlign: 'left',
                fontWeight: 'normal',
                paragraphSpacing: 20,
                textIndent: 0,
              })}
            >
              <Text style={styles.resetSettingsText}>Сбросить настройки</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (theme: ThemeColors, mode?: ThemeMode) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.background,
  },
  loadingText: {
    color: theme.primary,
    fontSize: 16,
    marginTop: 10,
  },
  overlayBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: theme.surfaceHighlight + 'F2',
    zIndex: 10,
  },

  // Анимация скрытия
  hiddenHeader: {
    transform: [{ translateY: -150 }],
  },
  hiddenFooter: {
    transform: [{ translateY: 200 }],
  },

  header: {
    top: 0,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 10 : 50,
    paddingBottom: 15,
  },
  headerContent: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
  },
  chapterLabel: {
    fontWeight: '600',
    fontSize: 16,
    color: theme.text,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 10,
  },
  scrollContainer: {
    flex: 1,
  },
  contentPadding: {
    paddingHorizontal: 20,
    paddingTop: 100,
    paddingBottom: 220,
  },
  paragraph: {
    marginBottom: 20,
  },
  paragraphText: {
    fontSize: 18,
    lineHeight: 28,
    color: theme.text,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  fontWeightLight: {
    fontWeight: '300',
  },
  fontWeightBold: {
    fontWeight: 'bold',
  },
  fontWeightNormal: {
    fontWeight: 'normal',
  },
  translatedText: {
    borderLeftWidth: 0,
    paddingLeft: 0,
    color: theme.text,
  },
  footer: {
    bottom: 0,
    paddingTop: 20,
    paddingHorizontal: 15,
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  progressText: {
    color: theme.textSecondary,
    fontSize: 12,
    width: 40,
    textAlign: 'center',
  },
  track: {
    flex: 1,
    height: 4,
    backgroundColor: theme.border,
    borderRadius: 2,
    marginHorizontal: 10,
    position: 'relative',
  },
  fill: {
    height: '100%',
    backgroundColor: theme.textSecondary,
    borderRadius: 2,
  },
  thumb: {
    width: 12,
    height: 12,
    backgroundColor: theme.text,
    borderRadius: 6,
    top: -4,
    position: 'absolute',
    marginLeft: -6,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  navBtn: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  translateBtn: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    backgroundColor: theme.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: theme.primary + '4D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 8,
  },
  translateBtnText: {
    color: mode === 'light' ? '#FFF' : theme.text,
    fontSize: 16,
    fontWeight: '700',
  },
  translationModal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.background + 'CC',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  translationModalContent: {
    backgroundColor: theme.surface,
    padding: 30,
    borderRadius: 16,
    alignItems: 'center',
    width: '80%',
    elevation: 10,
  },
  translationModalText: {
    color: theme.text,
    fontSize: 16,
    marginTop: 20,
    marginBottom: 20,
    textAlign: 'center',
  },
  cancelTranslationBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: theme.surfaceHighlight,
    borderRadius: 8,
    marginTop: 10,
  },
  cancelTranslationText: {
    color: theme.text,
    fontSize: 14,
    fontWeight: '600',
  },
  // Модальное окно списка глав
  modalContainer: {
    flex: 1,
    backgroundColor: theme.background + 'CC',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 10,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    maxHeight: '85%',
  },
  modalHandleContainer: {
    alignItems: 'center',
    marginBottom: 15,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: theme.border,
    borderRadius: 2,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.text,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.surfaceHighlight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.background,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
  },
  chapterItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  chapterItemSelected: {
    backgroundColor: theme.surfaceHighlight,
  },
  chapterItemText: {
    fontSize: 16,
    color: theme.text,
  },
  chapterItemTextSelected: {
    color: theme.primary,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: theme.textSecondary,
    marginTop: 12,
  },
  chaptersCount: {
    fontSize: 13,
    color: theme.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
  // Настройки читалки
  settingSection: {
    marginBottom: 20,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textSecondary,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.background,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  settingBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: theme.surfaceHighlight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingValue: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
  },
  resetSettingsBtn: {
    marginTop: 20,
    paddingVertical: 14,
    backgroundColor: theme.surfaceHighlight,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.border,
  },
  resetSettingsText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.error,
  },
  chapterLabelContainer: {
    flex: 1,
    alignItems: 'center',
  },
});