import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  ImageBackground,
  Alert,
  Modal,
  TouchableWithoutFeedback,
  StatusBar,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Novel, Chapter } from '@/types';
import DatabaseService from '@/services/database';
import { useAppTheme, useThemeStyles } from '@/hooks/useAppTheme';
import { ThemeColors, ThemeMode } from '@/utils/theme';

const { width } = Dimensions.get('window');

type NovelDetailScreenProps = {
  route: {
    params: {
      novelId: number;
    };
  };
};

export default function NovelDetailScreen({ route }: NovelDetailScreenProps) {
  const navigation = useNavigation();
  const { novelId } = route.params;

  const { theme, mode } = useAppTheme();
  const styles = useThemeStyles(createStyles);

  const [translatedChapterIds, setTranslatedChapterIds] = useState<Set<number>>(new Set());
  const [novel, setNovel] = useState<Novel | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);

  // Сортировка глав
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Переключение сортировки при клике
  const handleSortToggle = () => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  // Сортировка глав
  const sortedChapters = [...chapters].sort((a, b) => {
    if (sortOrder === 'asc') {
      return a.chapter_number - b.chapter_number;
    } else {
      return b.chapter_number - a.chapter_number;
    }
  });

  useEffect(() => {
    loadData();
  }, [novelId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const loadedNovel = await DatabaseService.getNovelById(novelId);
      if (loadedNovel) {
        setNovel(loadedNovel);
        const loadedChapters = await DatabaseService.getChapters(novelId);
        setChapters(loadedChapters);
        const trIds = await DatabaseService.getTranslatedChapterIds(novelId, 'ru');
        setTranslatedChapterIds(new Set(trIds));
      }
    } catch (error) {
      console.error('Failed to load novel details:', error);
    } finally {
      setLoading(false);
    }
  };

  const getImageSource = (path: string | null) => {
    if (!path) return require('../../assets/adaptive-icon.png');
    if (path.startsWith('http')) return { uri: path };
    if (path.startsWith('file://')) return { uri: path };
    return { uri: `file://${path}` };
  };

  const handleEdit = () => {
    setMenuVisible(false);
    (navigation as any).navigate('editor', { novelId });
  };

  const handleDelete = () => {
    setMenuVisible(false);
    Alert.alert('Удалить новеллу?', 'Все данные будут безвозвратно удалены.', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: async () => {
        await DatabaseService.deleteNovel(novelId);
        navigation.goBack();
      }},
    ]);
  };

  const renderChapter = (item: Chapter) => {
    const isTranslated = translatedChapterIds.has(item.id);
    return (
      <TouchableOpacity
        key={item.id}
        style={styles.chapterItem}
        onPress={() => (navigation as any).navigate('reader', { novelId, chapterNumber: item.chapter_number })}
      >
        <View style={styles.chapterLeft}>
          <Text style={styles.chapterTitle} numberOfLines={1}>Глава {item.chapter_number}</Text>
          <Text style={styles.chapterSub} numberOfLines={1}>
            {(item as any).title ? (item as any).title : `${item.content.length} симв.`}
          </Text>
        </View>
        <View style={isTranslated ? styles.badgeRU : styles.badgeEN}>
          {isTranslated && <MaterialIcons name="check" size={12} color="#4caf50" />}
          <Text style={[styles.badgeText, isTranslated && {color: '#4caf50'}]}>
            {isTranslated ? 'RU' : 'EN'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) return (
    <View style={[styles.container, styles.center]}>
      <ActivityIndicator size="large" color={theme.primary} />
    </View>
  );

  if (!novel) return null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
      {/* HEADER BAR */}
      <View style={styles.navBar}>
        <TouchableOpacity style={styles.navBtn} onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.navBtn} onPress={() => setMenuVisible(true)}>
          <MaterialIcons name="more-vert" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      <Modal 
        transparent 
        visible={menuVisible} 
        animationType="fade"
        statusBarTranslucent
      >
        <TouchableWithoutFeedback onPress={() => setMenuVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={[
                styles.menuBox,
                {
                  top: Platform.OS === 'android' ? 90 : 100,
                  marginBottom: Platform.OS === 'ios' ? 34 : 0,
                }
              ]}>
                <TouchableOpacity style={styles.menuLink} onPress={handleEdit}>
                  <MaterialIcons name="edit" size={20} color={theme.text} />
                  <Text style={styles.menuLinkLabel}>Редактировать</Text>
                </TouchableOpacity>
                <View style={styles.menuDiv} />
                <TouchableOpacity style={styles.menuLink} onPress={handleDelete}>
                  <MaterialIcons name="delete-outline" size={20} color={theme.error} />
                  <Text style={[styles.menuLinkLabel, { color: theme.error }]}>Удалить</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        
        {/* HERO SECTION */}
        <View style={styles.hero}>
          <ImageBackground source={getImageSource(novel.cover_image_path)} style={StyleSheet.absoluteFill} blurRadius={15}>
            <View style={styles.heroDim} />
            <LinearGradient colors={['transparent', theme.background]} style={styles.heroFade} />
          </ImageBackground>

          <View style={styles.heroBody}>
            <Image source={getImageSource(novel.cover_image_path)} style={styles.mainCover} />
            <View style={styles.mainInfo}>
              <Text style={styles.mainTitle} numberOfLines={4}>{novel.title}</Text>
              <Text style={styles.mainMeta}>{novel.chapter_count} глав • FB2</Text>
              <View style={styles.statusLabel}>
                 <View style={styles.statusDot} />
                 <Text style={styles.statusLabelText}>Читается</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ACTIONS */}
        <View style={styles.actions}>
          <TouchableOpacity 
             style={styles.readBtn} 
             onPress={() => (navigation as any).navigate('reader', { novelId, chapterNumber: 1 })}
          >
            <MaterialIcons name="play-arrow" size={26} color="#000" />
            <Text style={styles.readBtnText}>Читать</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.batchBtn}>
            <MaterialIcons name="bolt" size={24} color={theme.primary} />
          </TouchableOpacity>
        </View>

        {/* SUMMARY */}
        <View style={styles.descBox}>
          <Text style={styles.descTitle}>Описание</Text>
          <Text style={styles.descText} numberOfLines={summaryExpanded ? undefined : 3}>
             История о человеке, который внезапно оказался в теле главного злодея популярной новеллы. Теперь ему предстоит выжить в мире, где каждый герой хочет его смерти...
          </Text>
          <TouchableOpacity onPress={() => setSummaryExpanded(!summaryExpanded)}>
            <Text style={styles.descToggle}>{summaryExpanded ? 'Скрыть' : 'Показать полностью'}</Text>
          </TouchableOpacity>
        </View>

        {/* CHAPTERS */}
        <View style={styles.listSection}>
          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>Список глав</Text>
            <TouchableOpacity onPress={handleSortToggle}>
              <View style={[
                styles.sortIconContainer,
                sortOrder === 'asc' && styles.sortIconActive
              ]}>
                <Text style={[
                  styles.sortOrderLabel,
                  sortOrder === 'asc' && styles.sortOrderLabelActive
                ]}>
                  {sortOrder === 'asc' ? '1→' : '←1'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
          {sortedChapters.map(renderChapter)}
        </View>

      </ScrollView>
    </View>
  );
}

const createStyles = (theme: ThemeColors, mode?: ThemeMode) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  center: { justifyContent: 'center', alignItems: 'center' },
  
  // Header
  navBar: {
    position: 'absolute', top: Platform.OS === 'android' ? 40 : 50, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, zIndex: 100,
  },
  navBtn: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', alignItems: 'center',
  },

  // Modal Menu
  modalOverlay: { flex: 1, backgroundColor: 'transparent' },
  menuBox: {
    position: 'absolute', top: 90, right: 16, width: 220,
    backgroundColor: theme.surface, borderRadius: 16, padding: 8,
    shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 10, elevation: 12,
    borderWidth: 1, borderColor: theme.border,
  },
  menuLink: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12 },
  menuLinkLabel: { color: theme.text, fontSize: 16, fontWeight: '500' },
  menuDiv: { height: 1, backgroundColor: theme.border, marginHorizontal: 8 },

  // Sort Icon
  sortIconContainer: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: theme.surfaceHighlight,
  },
  sortIconActive: {
    backgroundColor: theme.primary + '20',
  },
  sortOrderLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.textSecondary,
  },
  sortOrderLabelActive: {
    color: theme.primary,
  },

  // Hero
  hero: { height: 380, justifyContent: 'flex-end' },
  heroDim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)' },
  heroFade: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 200 },
  heroBody: { flexDirection: 'row', paddingHorizontal: 20, paddingBottom: 20, alignItems: 'flex-end' },
  mainCover: {
    width: 130, height: 195, borderRadius: 12, backgroundColor: '#333',
    shadowColor: '#000', shadowOpacity: 0.8, shadowRadius: 15, elevation: 20,
  },
  mainInfo: { flex: 1, marginLeft: 20, height: 195, justifyContent: 'flex-end' },
  mainTitle: { fontSize: 22, fontWeight: '800', color: '#FFF', lineHeight: 28, marginBottom: 10 },
  mainMeta: { fontSize: 14, color: '#BBB', marginBottom: 10 },
  statusLabel: { 
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(187,134,252,0.15)',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, alignSelf: 'flex-start',
  },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.primary, marginRight: 6 },
  statusLabelText: { color: theme.primary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },

  // Actions
  actions: { flexDirection: 'row', paddingHorizontal: 20, gap: 12, marginTop: 10 },
  readBtn: { 
    flex: 1, height: 56, backgroundColor: theme.primary, borderRadius: 16,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
    shadowColor: theme.primary, shadowOpacity: 0.4, shadowRadius: 10, elevation: 8,
  },
  readBtnText: { color: '#000', fontSize: 18, fontWeight: '800' },
  batchBtn: { 
    width: 56, height: 56, backgroundColor: theme.surfaceHighlight, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: theme.border,
  },

  // Description
  descBox: { padding: 20 },
  descTitle: { fontSize: 18, fontWeight: '700', color: theme.text, marginBottom: 8 },
  descText: { fontSize: 15, lineHeight: 24, color: theme.textSecondary },
  descToggle: { color: theme.primary, fontWeight: '700', marginTop: 8 },

  // Chapters List
  listSection: { marginTop: 10, backgroundColor: theme.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 40 },
  listHeader: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  listTitle: { fontSize: 18, fontWeight: '700', color: theme.text },
  chapterItem: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  chapterLeft: { flex: 1, marginRight: 15 },
  chapterTitle: { fontSize: 16, color: theme.text, fontWeight: '600', marginBottom: 4 },
  chapterSub: { fontSize: 13, color: theme.textSecondary },
  
  // Badges
  badgeRU: { 
    flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(76,175,80,0.1)', 
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 
  },
  badgeEN: { backgroundColor: theme.surfaceHighlight, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '800', color: theme.textSecondary },
});