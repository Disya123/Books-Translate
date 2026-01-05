import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Novel } from '@/types';
import { useAppTheme } from '@/hooks/useAppTheme';
import { ThemeColors, ThemeMode } from '@/utils/theme';

const COVER_COLORS = ['#4a4a4a', '#2c3e50', '#000000'];
const EMOJIS = ['⚔️', '🗡️', '🏰', '⚗️', '🧙', '🏕'];

// Вычисляем ширину карточки: (Ширина экрана - отступы) / 2
const SCREEN_WIDTH = Dimensions.get('window').width;
const COLUMN_count = 2;
const GAP = 12; // Отступ между карточками
const PADDING = 24; // Общий боковой отступ экрана (12 слева + 12 справа)
// Формула: (Экран - Паддинги - (Промежутки * (Кол-во колонок - 1))) / Кол-во колонок
const CARD_WIDTH = (SCREEN_WIDTH - PADDING - (GAP * (COLUMN_count - 1))) / COLUMN_count;

interface NovelCardProps {
  novel: Novel;
  onPress: () => void;
}

export default function NovelCard({ novel, onPress }: NovelCardProps) {
  const { theme, mode } = useAppTheme();

  const styles = useMemo(() => createStyles(theme, mode), [theme, mode]);

  const coverColor = COVER_COLORS[novel.id % COVER_COLORS.length];
  const coverEmoji = EMOJIS[novel.id % EMOJIS.length];
  const chapterCount = novel.chapter_count || 0;

  const getImageSource = (path: string) => {
    if (path.startsWith('http')) return { uri: path };
    if (path.startsWith('file://')) return { uri: path };
    return { uri: `file://${path}` };
  };

  return (
    <TouchableOpacity
      style={[styles.cardContainer, { width: CARD_WIDTH }]} // Фиксированная ширина!
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.cardContent}>
        {novel.cover_image_path ? (
          <Image
            source={getImageSource(novel.cover_image_path)}
            style={StyleSheet.absoluteFillObject}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.placeholder, { backgroundColor: coverColor }]}>
            <Text style={styles.emoji}>{coverEmoji}</Text>
          </View>
        )}

        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.9)']}
          locations={[0.5, 0.7, 1]}
          style={styles.gradient}
        >
          <Text style={styles.title} numberOfLines={2}>
            {novel.title || 'Без названия'}
          </Text>
          
          <View style={styles.metaBadge}>
            <Text style={styles.chapterText}>
              {chapterCount} {pluralizeChapter(chapterCount)}
            </Text>
          </View>
        </LinearGradient>
      </View>
    </TouchableOpacity>
  );
}

function pluralizeChapter(count: number): string {
  const lastTwo = count % 100;
  const lastOne = count % 10;
  if (lastTwo >= 11 && lastTwo <= 19) return 'глав';
  if (lastOne === 1) return 'глава';
  if (lastOne >= 2 && lastOne <= 4) return 'главы';
  return 'глав';
}

const createStyles = (theme: ThemeColors, mode: ThemeMode) => StyleSheet.create({
  cardContainer: {
    marginBottom: 12,
    borderRadius: 12,
    // Тень
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  cardContent: {
    width: '100%',
    aspectRatio: 0.7, // Стандартная книжная пропорция
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: theme.surface,
    position: 'relative',
  },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 40,
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '100%',
    justifyContent: 'flex-end',
    padding: 10,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  metaBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  chapterText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 10,
    fontWeight: '600',
  },
});