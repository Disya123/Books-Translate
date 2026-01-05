import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppDispatch, useAppSelector } from '@/hooks/reduxHooks';
import { setNovels, setLoading, selectNovel } from '@/store/novelsSlice';
import DatabaseService from '@/services/database';
import { Novel } from '@/types';
import { useNavigation } from '@react-navigation/native';
import NovelCard from '@/components/NovelCard';
import { useAppTheme, useThemeStyles } from '@/hooks/useAppTheme'; 
import { ThemeColors } from '@/utils/theme';

const SEARCH_BAR_HEIGHT = 56;

export default function LibraryScreen() {
  const dispatch = useAppDispatch();
  const navigation = useNavigation<any>();
  
  // 1. Получаем тему и режим (dark/light/amoled)
  const { theme, mode } = useAppTheme();
  // 2. Генерируем динамические стили
  const styles = useThemeStyles(createStyles); 
  
  const { novels, loading } = useAppSelector((state) => state.novels);
  const [search, setSearch] = useState('');
  const [fabOpen, setFabOpen] = useState(false);
  
  const insets = useSafeAreaInsets();
  
  const headerHeight = (Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : insets.top) + 12;
  const listTopPadding = headerHeight + SEARCH_BAR_HEIGHT + 24;

  useEffect(() => {
    loadNovels();
  }, []);

  const loadNovels = async () => {
    dispatch(setLoading(true));
    try {
      const loadedNovels = await DatabaseService.getAllNovels();
      dispatch(setNovels(loadedNovels));
    } catch (error) {
      console.error('Failed to load novels:', error);
    } finally {
      dispatch(setLoading(false));
    }
  };

  const handleNovelPress = (novel: Novel) => {
    dispatch(selectNovel(novel.id));
    navigation.navigate('novel-detail', { novelId: novel.id });
  };

  const filteredNovels = search
    ? novels.filter((n) => n.title.toLowerCase().includes(search.toLowerCase()))
    : novels;

  return (
    <View style={styles.container}>
      {/* 3. StatusBar теперь подстраивается под тему */}
      <StatusBar 
        barStyle={mode === 'light' ? 'dark-content' : 'light-content'} 
        translucent 
        backgroundColor="transparent" 
      />

      {/* Список новелл */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredNovels}
          renderItem={({ item }) => (
            <NovelCard novel={item} onPress={() => handleNovelPress(item)} />
          )}
          keyExtractor={(item) => item.id.toString()}
          numColumns={2}
          contentContainerStyle={{
            paddingTop: listTopPadding,
            paddingBottom: 120,
            paddingHorizontal: 12,
          }}
          columnWrapperStyle={{ justifyContent: 'space-between', marginBottom: 12 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {search ? 'Ничего не найдено' : 'Библиотека пуста'}
              </Text>
            </View>
          }
        />
      )}

      {/* HEADER: Поиск */}
      <View style={[styles.headerWrapper, { paddingTop: headerHeight }]}>
        <View style={styles.glassPanel}>
          <View style={styles.searchRow}>
            <MaterialIcons name="search" size={24} color={theme.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Поиск..."
              placeholderTextColor={theme.textSecondary + '80'} // 50% прозрачности
              value={search}
              onChangeText={setSearch}
            />
            <TouchableOpacity onPress={() => navigation.navigate('settings-root')}>
              <MaterialIcons name="settings" size={24} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* FAB */}
      <View style={styles.fabContainer}>
        {fabOpen && (
          <View style={styles.fabOptions}>
            <TouchableOpacity 
              style={styles.fabOptionItem} 
              onPress={() => { setFabOpen(false); navigation.navigate('import'); }}
              activeOpacity={0.8}
            >
              <Text style={styles.fabLabel}>Импорт</Text>
              <View style={styles.fabMiniGlass}>
                <MaterialIcons name="file-upload" size={20} color={theme.text} />
              </View>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.fabOptionItem}
              onPress={() => { setFabOpen(false); navigation.navigate('editor', { novelId: undefined }); }}
              activeOpacity={0.8}
            >
              <Text style={styles.fabLabel}>Создать</Text>
              <View style={styles.fabMiniGlass}>
                <MaterialIcons name="edit" size={20} color={theme.text} />
              </View>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => setFabOpen(!fabOpen)}
          style={styles.fabMainGlass}
        >
          <MaterialIcons
            name={fabOpen ? 'close' : 'add'}
            size={32}
            color={theme.primary}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// 4. ФУНКЦИЯ СОЗДАНИЯ СТИЛЕЙ
const createStyles = (theme: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    zIndex: 100,
  },
  glassPanel: {
    height: SEARCH_BAR_HEIGHT,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: theme.surface + 'F2', // Добавляем небольшую прозрачность (F2 ≈ 95%)
    borderWidth: 1,
    borderColor: theme.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 10,
  },
  searchRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    color: theme.text,
    fontSize: 16,
    marginLeft: 12,
    height: '100%',
  },
  emptyContainer: {
    marginTop: 100,
    alignItems: 'center',
  },
  emptyText: {
    color: theme.textSecondary,
    fontSize: 16,
  },
  fabContainer: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    alignItems: 'flex-end',
    zIndex: 200,
  },
  fabOptions: {
    marginBottom: 16,
    gap: 16,
    alignItems: 'flex-end',
  },
  fabOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  fabLabel: {
    color: theme.text,
    fontSize: 14,
    fontWeight: '600',
    backgroundColor: theme.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
    elevation: 4,
    overflow: 'hidden',
  },
  fabMiniGlass: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.surfaceHighlight,
    borderWidth: 1,
    borderColor: theme.border,
    elevation: 6,
  },
  fabMainGlass: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.surfaceHighlight,
    borderWidth: 1,
    borderColor: theme.border,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
});