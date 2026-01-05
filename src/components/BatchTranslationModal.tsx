import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppSelector } from '@/hooks/reduxHooks';
import { useNovelChapters } from '@/hooks/useNovelChapters';
import { useAppTheme, useThemeStyles } from '@/hooks/useAppTheme';
import { ThemeColors, ThemeMode } from '@/utils/theme';
import BatchTranslationService from '@/services/batchTranslation';
import NotificationsService from '@/services/notifications';

type TranslationMode = 'all' | 'selected' | 'range';

interface TranslationTask {
  chapterId: number;
  chapterNumber: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  error?: string;
}

interface BatchTranslationModalProps {
  visible: boolean;
  novelId: number;
  novelTitle: string;
  onClose: () => void;
}

export default function BatchTranslationModal({
  visible,
  novelId,
  novelTitle,
  onClose,
}: BatchTranslationModalProps) {
  const { theme, mode } = useAppTheme();
  const styles = useThemeStyles(createStyles);

  const { chapters } = useNovelChapters(novelId);
  const { sourceLanguage, targetLanguage, targetCode } = useAppSelector(
    (state) => state.settings.translation
  );
  const translationState = useAppSelector((state) => state.translation);

  const [translationMode, setTranslationMode] = useState<TranslationMode>('all');
  const [selectedChapters, setSelectedChapters] = useState<Set<number>>(
    new Set()
  );
  const [rangeStart] = useState<number>(1);
  const [rangeEnd] = useState<number>(
    chapters.length > 0 ? chapters.length : 1
  );

  const [progress, setProgress] = useState(0);
  const [tasks, setTasks] = useState<TranslationTask[]>([]);

  const showChapterSelection = translationMode === 'selected' || translationMode === 'range';
  const showRangeSlider = translationMode === 'range';

  const isTranslating = translationState.isProcessing;
  const isPaused = translationState.pauseAfterChapter;
  const pauseAfterChapterLocal = translationState.pauseAfterChapter;
  const notificationsEnabled = translationState.showNotifications;

  // Update UI from Redux state
  useEffect(() => {
    const queueStats = BatchTranslationService.getQueueStatus();
    const queue = translationState.queue;

    // Convert Redux queue to tasks
    const newTasks = queue.map((item) => {
      // Find the corresponding chapter to get its number
      const chapter = chapters.find((ch) => ch.id === item.chapter_id);
      return {
        chapterId: item.chapter_id,
        chapterNumber: chapter ? chapter.chapter_number : item.chapter_id,
        status: item.status,
        progress:
          item.status === 'completed'
            ? 100
            : item.status === 'processing'
              ? 50
              : 0,
        error: item.error_message || undefined,
      };
    });

    setTasks(newTasks);

    // Calculate overall progress
    const overallProgress =
      queueStats.total === 0
        ? 0
        : (queueStats.completed / queueStats.total) * 100;
    setProgress(overallProgress);
  }, [translationState.queue, translationState.isProcessing, chapters]);

  // Calculate stats for display
  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === 'completed').length;
    const failed = tasks.filter((t) => t.status === 'failed').length;
    const processing = tasks.filter((t) => t.status === 'processing').length;
    return {
      total,
      completed,
      failed,
      processing,
      pending: total - completed - failed - processing,
    };
  }, [tasks]);

  // Определение глав для перевода
  const chaptersToTranslate = useMemo(() => {
    switch (translationMode) {
      case 'all':
        return chapters;
      case 'selected':
        return chapters.filter((ch) => selectedChapters.has(ch.id));
      case 'range':
        return chapters.filter(
          (ch) =>
            ch.chapter_number >= rangeStart && ch.chapter_number <= rangeEnd
        );
      default:
        return chapters;
    }
  }, [mode, chapters, selectedChapters, rangeStart, rangeEnd]);

  const handleToggleChapter = (chapterId: number) => {
    const newSet = new Set(selectedChapters);
    if (newSet.has(chapterId)) {
      newSet.delete(chapterId);
    } else {
      newSet.add(chapterId);
    }
    setSelectedChapters(newSet);
  };

  const handleSelectAll = () => {
    const allIds = new Set(chapters.map((ch) => ch.id));
    setSelectedChapters(allIds);
  };

  const handleDeselectAll = () => {
    setSelectedChapters(new Set());
  };

  const handleStart = async () => {
    const chaptersToTranslateList = chaptersToTranslate;

    if (chaptersToTranslateList.length === 0) {
      Alert.alert('Внимание', 'Выберите хотя бы одну главу для перевода');
      return;
    }

    if (notificationsEnabled && Platform.OS === 'ios') {
      Alert.alert(
        'Перевод в процессе',
        'Для продолжения перевода на iOS приложение должно оставаться открытым. Начать перевод?',
        [
          { text: 'Отмена', style: 'cancel' },
          {
            text: 'Начать',
            onPress: () => startTranslation(chaptersToTranslateList),
          },
        ]
      );
    } else {
      await startTranslation(chaptersToTranslateList);
    }
  };

  const startTranslation = async (chaptersToTranslateList: typeof chapters) => {
    try {
      await BatchTranslationService.startBatchTranslation({
        novelId,
        chapterIds: chaptersToTranslateList.map((ch) => ch.id),
        sourceLang: sourceLanguage,
        targetLang: targetLanguage,
        targetCode,
        pauseAfterChapter: pauseAfterChapterLocal,
        showNotifications: notificationsEnabled,
      });

      // The service will update Redux state, which will update UI
      // The completion notification is handled by the service
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Неизвестная ошибка';
      Alert.alert('Ошибка перевода', errorMessage);
    }
  };

  const handleTogglePauseAfterChapter = async () => {
    await BatchTranslationService.pause();
  };

  const handleResume = async () => {
    await BatchTranslationService.resume();
  };

  const handleStop = async () => {
    Alert.alert('Остановить', 'Остановить перевод прогресса?', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Остановить',
        style: 'destructive',
        onPress: async () => {
          await BatchTranslationService.stop();
        },
      },
    ]);
  };

  const handleClearQueue = async () => {
    Alert.alert('Очистить очередь', 'Очистить список задач перевода?', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Очистить',
        style: 'destructive',
        onPress: async () => {
          await BatchTranslationService.clearQueue();
        },
      },
    ]);
  };

  const renderChapterItem = ({
    item,
  }: {
    item: { id: number; chapter_number: number };
  }) => (
    <TouchableOpacity
      style={[
        styles.chapterItem,
        selectedChapters.has(item.id) && styles.chapterItemSelected,
      ]}
      onPress={() => !isTranslating && handleToggleChapter(item.id)}
      disabled={isTranslating}
    >
      <Text style={styles.chapterNumber}>Глава {item.chapter_number}</Text>
      {selectedChapters.has(item.id) && (
        <MaterialIcons name="check" size={20} color={theme.primary} />
      )}
    </TouchableOpacity>
  );

  const renderTaskItem = ({ item }: { item: TranslationTask }) => (
    <View style={styles.taskItem}>
      <View style={styles.taskInfo}>
        <Text style={styles.taskChapter}>Глава {item.chapterNumber}</Text>
        <Text
          style={[
            styles.taskStatus,
            item.status === 'completed' && styles.taskCompleted,
            item.status === 'failed' && styles.taskFailed,
            item.status === 'processing' && styles.taskProcessing,
          ]}
        >
          {getStatusText(item.status)}
        </Text>
      </View>
      {item.status === 'processing' && (
        <View style={styles.taskProgressContainer}>
          <View
            style={[styles.taskProgressBar, { width: `${item.progress}%` }]}
          />
        </View>
      )}
    </View>
  );

  const getStatusText = (status: TranslationTask['status']): string => {
    switch (status) {
      case 'pending':
        return 'Ожидает';
      case 'processing':
        return 'В процессе';
      case 'completed':
        return 'Готово';
      case 'failed':
        return 'Ошибка';
      default:
        return '';
    }
  };

  const renderModeButton = (m: TranslationMode, label: string) => (
    <TouchableOpacity
      style={[styles.modeButton, translationMode === m && styles.modeButtonActive]}
      onPress={() => !isTranslating && setTranslationMode(m)}
      disabled={isTranslating}
    >
      <Text
        style={[
          styles.modeButtonText,
          translationMode === m && styles.modeButtonTextActive,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.backBtn}>
            <Text style={styles.backBtnText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Пакетный перевод</Text>
          <View style={styles.spacer} />
        </View>

        <ScrollView style={styles.content}>
          {/* Информация о новелле */}
          <View style={styles.infoSection}>
            <Text style={styles.infoLabel}>Новелла</Text>
            <Text style={styles.infoValue} numberOfLines={1}>
              {novelTitle}
            </Text>
          </View>

          {/* Выбор режима */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Режим перевода</Text>
            <View style={styles.modesContainer}>
              {renderModeButton('all', 'Вся новелла')}
              {renderModeButton('selected', 'Выбранные')}
              {renderModeButton('range', 'Диапазон')}
            </View>
          </View>

          {/* Выбор глав */}
          {showChapterSelection && (
            <View style={styles.section}>
              <View style={styles.chapterListHeader}>
                <Text style={styles.sectionTitle}>Выбор глав</Text>
                {!isTranslating && (
                  <View style={styles.chapterListButtons}>
                    <TouchableOpacity
                      onPress={handleSelectAll}
                      style={styles.selectBtn}
                    >
                      <Text style={styles.selectBtnText}>Все</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleDeselectAll}
                      style={styles.selectBtn}
                    >
                      <Text style={styles.selectBtnText}>Сброс</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {showRangeSlider && (
                <View style={styles.rangeContainer}>
                  <View style={styles.rangeRow}>
                    <Text style={styles.rangeLabel}>С:</Text>
                    <View style={styles.rangeInput}>
                      <Text style={styles.rangeValue}>{rangeStart}</Text>
                    </View>
                    <Text style={styles.rangeLabel}>По:</Text>
                    <View style={styles.rangeInput}>
                      <Text style={styles.rangeValue}>{rangeEnd}</Text>
                    </View>
                  </View>
                </View>
              )}

              <FlatList
                data={chapters}
                renderItem={renderChapterItem}
                keyExtractor={(item) => item.id.toString()}
                style={styles.chapterList}
                scrollEnabled={false}
              />
            </View>
          )}

          {/* Настройки перевода */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Настройки</Text>

            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>Исходный язык</Text>
              <Text style={styles.settingValue}>{sourceLanguage}</Text>
            </View>

            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>Целевой язык</Text>
              <Text style={styles.settingValue}>
                {targetCode || targetLanguage}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.toggleItem}
              onPress={handleTogglePauseAfterChapter}
              disabled={isTranslating}
            >
              <Text style={styles.toggleLabel}>Пауза после главы</Text>
              <View
                style={[
                  styles.toggleContainer,
                  pauseAfterChapterLocal && styles.toggleActive,
                ]}
              >
                <View style={styles.toggleThumb} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toggleItem}
              onPress={() => {
                // Toggle notifications in Redux
                // This is handled by the service, but we can show a message
                Alert.alert(
                  'Уведомления',
                  'Настройки уведомлений управляются через BatchTranslationService'
                );
              }}
              disabled={isTranslating}
            >
              <Text style={styles.toggleLabel}>Уведомления</Text>
              <View
                style={[
                  styles.toggleContainer,
                  notificationsEnabled && styles.toggleActive,
                ]}
              >
                <View style={styles.toggleThumb} />
              </View>
            </TouchableOpacity>
          </View>

          {/* Прогресс */}
          {(isTranslating || tasks.length > 0) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Прогресс</Text>

              <View style={styles.progressContainer}>
                <View style={styles.progressBarContainer}>
                  <View
                    style={[styles.progressBar, { width: `${progress}%` }]}
                  />
                </View>
                <Text style={styles.progressText}>{Math.round(progress)}%</Text>
              </View>

              {/* Статистика */}
              <View style={styles.statsContainer}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{stats.total}</Text>
                  <Text style={styles.statLabel}>Всего</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, styles.statCompleted]}>
                    {stats.completed}
                  </Text>
                  <Text style={styles.statLabel}>Готово</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, styles.statProcessing]}>
                    {stats.processing}
                  </Text>
                  <Text style={styles.statLabel}>В работе</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, styles.statFailed]}>
                    {stats.failed}
                  </Text>
                  <Text style={styles.statLabel}>Ошибок</Text>
                </View>
              </View>

              {/* Список задач */}
              {tasks.length > 0 && (
                <FlatList
                  data={tasks}
                  renderItem={renderTaskItem}
                  keyExtractor={(item) => item.chapterId.toString()}
                  style={styles.taskList}
                  scrollEnabled={false}
                />
              )}
            </View>
          )}
        </ScrollView>

        {/* Кнопки управления */}
        {isTranslating && (
          <View style={styles.controlButtons}>
            <TouchableOpacity
              style={[styles.controlBtn, styles.controlBtnPause]}
              onPress={isPaused ? handleResume : handleTogglePauseAfterChapter}
            >
              <Text style={styles.controlBtnText}>
                {isPaused ? 'Продолжить' : 'Пауза'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.controlBtn, styles.controlBtnStop]}
              onPress={handleStop}
            >
              <Text style={styles.controlBtnText}>Остановить</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.footer}>
          {isTranslating ? (
            <View style={styles.statusContainer}>
              <ActivityIndicator size="small" color={theme.primary} />
              <Text style={styles.statusText}>
                {isPaused ? 'Пауза' : 'Перевод в процессе...'}
              </Text>
            </View>
          ) : (
            <>
              {tasks.length > 0 && (
                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={handleClearQueue}
                  disabled={isTranslating}
                >
                  <Text style={styles.secondaryBtnText}>Очистить очередь</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[
                  styles.primaryBtn,
                  isTranslating && styles.primaryBtnDisabled,
                ]}
                onPress={handleStart}
                disabled={isTranslating}
              >
                <Text style={styles.primaryBtnText}>
                  {isPaused ? 'Продолжить' : 'Начать перевод'}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </SafeAreaView>
    </Modal>
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
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  backBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: {
    fontSize: 24,
    color: theme.text,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.text,
  },
  spacer: {
    width: 32,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  // Информация о новелле
  infoSection: {
    backgroundColor: theme.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: 'bold',
    color: theme.primary,
    marginBottom: 8,
  },
  infoValue: {
    fontSize: 16,
    color: theme.text,
  },
  // Секции
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: theme.primary,
    marginBottom: 12,
  },
  // Выбор режима
  modesContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  modeButton: {
    flex: 1,
    backgroundColor: theme.surface,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.border,
  },
  modeButtonActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  modeButtonText: {
    fontSize: 14,
    color: theme.text,
    fontWeight: '500',
  },
  modeButtonTextActive: {
    color: theme.text,
  },
  // Выбор глав
  chapterListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  chapterListButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  selectBtn: {
    backgroundColor: theme.surfaceHighlight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  selectBtnText: {
    fontSize: 12,
    color: theme.primary,
  },
  chapterList: {
    maxHeight: 200,
  },
  chapterItem: {
    backgroundColor: theme.surface,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  chapterItemSelected: {
    backgroundColor: theme.surfaceHighlight,
  },
  chapterNumber: {
    fontSize: 14,
    color: theme.text,
  },
  // Диапазон
  rangeContainer: {
    backgroundColor: theme.surface,
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  rangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rangeLabel: {
    fontSize: 14,
    color: theme.text,
  },
  rangeInput: {
    flex: 1,
    backgroundColor: theme.surfaceHighlight,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 8,
    padding: 12,
  },
  rangeValue: {
    fontSize: 16,
    color: theme.text,
    textAlign: 'center',
  },
  // Настройки
  settingItem: {
    backgroundColor: theme.surface,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  settingLabel: {
    fontSize: 16,
    color: theme.text,
  },
  settingValue: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  toggleItem: {
    backgroundColor: theme.surface,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  toggleLabel: {
    fontSize: 16,
    color: theme.text,
  },
  toggleContainer: {
    width: 50,
    height: 28,
    backgroundColor: theme.surfaceHighlight,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 2,
  },
  toggleActive: {
    backgroundColor: theme.primary,
  },
  toggleThumb: {
    width: 24,
    height: 24,
    backgroundColor: theme.text,
    borderRadius: 12,
    marginLeft: 2,
  },
  // Прогресс
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  progressBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: theme.surfaceHighlight,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: theme.primary,
  },
  progressText: {
    fontSize: 14,
    color: theme.text,
    fontWeight: 'bold',
    minWidth: 50,
    textAlign: 'right',
  },
  // Статистика
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: theme.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.text,
  },
  statCompleted: {
    color: '#4CAF50',
  },
  statProcessing: {
    color: theme.primary,
  },
  statFailed: {
    color: '#F44336',
  },
  statLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 4,
  },
  // Задачи
  taskList: {
    maxHeight: 150,
  },
  taskItem: {
    backgroundColor: theme.surface,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  taskInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  taskChapter: {
    fontSize: 14,
    color: theme.text,
  },
  taskStatus: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  taskCompleted: {
    color: '#4CAF50',
  },
  taskProcessing: {
    color: theme.primary,
  },
  taskFailed: {
    color: '#F44336',
  },
  taskProgressContainer: {
    height: 4,
    backgroundColor: theme.surfaceHighlight,
    borderRadius: 2,
    overflow: 'hidden',
  },
  taskProgressBar: {
    height: '100%',
    backgroundColor: theme.primary,
  },
  // Кнопки управления
  controlButtons: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: theme.surface,
  },
  controlBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  controlBtnPause: {
    backgroundColor: theme.primary,
  },
  controlBtnStop: {
    backgroundColor: '#F44336',
  },
  controlBtnText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000000',
  },
  // Status indicator
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  statusText: {
    fontSize: 14,
    color: theme.text,
  },
  // Footer
  footer: {
    backgroundColor: theme.surface,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    gap: 12,
  },
  secondaryBtn: {
    backgroundColor: theme.surfaceHighlight,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.text,
  },
  primaryBtn: {
    backgroundColor: theme.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryBtnDisabled: {
    backgroundColor: theme.surfaceHighlight,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.text,
  },
});
