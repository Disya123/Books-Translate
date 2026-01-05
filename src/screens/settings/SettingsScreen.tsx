import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  StatusBar,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/AppNavigator';
import { useAppDispatch } from '@/hooks/reduxHooks';
import { useAppTheme, useThemeStyles } from '@/hooks/useAppTheme';
import { ThemeColors, ThemeMode } from '@/utils/theme';
import TranslationService from '@/services/translation';
import DatabaseService from '@/services/database';

type SettingsScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'settings'
>;

export default function SettingsScreen() {
  const navigation = useNavigation<SettingsScreenNavigationProp>();
  const insets = useSafeAreaInsets();
  const { theme, mode } = useAppTheme();
  const styles = useThemeStyles(createStyles);
  const [isClearingCache, setIsClearingCache] = useState(false);

  // Отступ для хедера
  const headerTopPadding = (Platform.OS === 'android' ? StatusBar.currentHeight || 24 : insets.top) + 10;

  const handleProviderSettings = () => navigation.navigate('provider');
  const handleTranslationSettings = () => navigation.navigate('translation');
  const handleThemeSettings = () => navigation.navigate('theme');
  const handleAboutSettings = () => navigation.navigate('about');

  const handleClearCache = async () => {
    Alert.alert(
      'Очистить кэш переводов',
      'Это удалит все кэшированные переводы. Продолжить?',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Очистить',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsClearingCache(true);
              await TranslationService.clearCache();
              await DatabaseService.clearTranslationsCache();
              Alert.alert('Успешно', 'Кэш переводов очищен');
            } catch (error) {
              const errorMessage =
                error instanceof Error ? error.message : 'Неизвестная ошибка';
              Alert.alert('Ошибка', errorMessage);
            } finally {
              setIsClearingCache(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle={mode === 'light' ? 'dark-content' : 'light-content'} backgroundColor="transparent" translucent />
      
      {/* HEADER */}
      <View style={[styles.header, { paddingTop: headerTopPadding }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Настройки</Text>
        <View style={styles.backBtn} /> 
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* ГРУППА 1: AI и Перевод */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>AI и Перевод</Text>
          <View style={styles.sectionContainer}>
            
            <TouchableOpacity style={styles.item} onPress={handleProviderSettings}>
              <View style={styles.itemLeft}>
                <View style={[styles.iconContainer, { backgroundColor: theme.primary + '26' }]}>
                  <MaterialIcons name="dns" size={20} color={theme.primary} />
                </View>
                <Text style={styles.itemLabel}>Провайдер API</Text>
              </View>
              <MaterialIcons name="chevron-right" size={22} color={theme.textSecondary} />
            </TouchableOpacity>

            <View style={styles.separator} />

            <TouchableOpacity style={styles.item} onPress={handleTranslationSettings}>
              <View style={styles.itemLeft}>
                <View style={[styles.iconContainer, { backgroundColor: 'rgba(3, 218, 198, 0.15)' }]}>
                  <MaterialIcons name="translate" size={20} color={theme.primary} />
                </View>
                <Text style={styles.itemLabel}>Параметры перевода</Text>
              </View>
              <MaterialIcons name="chevron-right" size={22} color={theme.textSecondary} />
            </TouchableOpacity>

          </View>
        </View>

        {/* ГРУППА 2: Внешний вид */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Интерфейс</Text>
          <View style={styles.sectionContainer}>
            
            <TouchableOpacity style={styles.item} onPress={handleThemeSettings}>
              <View style={styles.itemLeft}>
                <View style={[styles.iconContainer, { backgroundColor: 'rgba(255, 152, 0, 0.15)' }]}>
                  <MaterialIcons name="palette" size={20} color={theme.primary} />
                </View>
                <Text style={styles.itemLabel}>Тема</Text>
              </View>
              <View style={styles.itemRight}>
                <Text style={styles.itemValue}>Тёмная</Text>
                <MaterialIcons name="chevron-right" size={22} color={theme.textSecondary} />
              </View>
            </TouchableOpacity>

          </View>
        </View>

        {/* ГРУППА 3: Данные */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Данные</Text>
          <View style={styles.sectionContainer}>
            
            <TouchableOpacity 
              style={[styles.item, isClearingCache && { opacity: 0.5 }]} 
              onPress={handleClearCache}
              disabled={isClearingCache}
            >
              <View style={styles.itemLeft}>
                <View style={[styles.iconContainer, { backgroundColor: theme.error + '26' }]}>
                  {isClearingCache ? (
                    <MaterialIcons name="hourglass-empty" size={20} color={theme.error} />
                  ) : (
                    <MaterialIcons name="delete-outline" size={20} color={theme.error} />
                  )}
                </View>
                <Text style={[styles.itemLabel, { color: theme.error }]}>
                  {isClearingCache ? 'Очистка...' : 'Очистить кэш'}
                </Text>
              </View>
            </TouchableOpacity>

          </View>
        </View>

        {/* ГРУППА 4: Инфо */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Приложение</Text>
          <View style={styles.sectionContainer}>
            
            <TouchableOpacity style={styles.item} onPress={handleAboutSettings}>
              <View style={styles.itemLeft}>
                <View style={[styles.iconContainer, { backgroundColor: 'rgba(255, 255, 255, 0.1)' }]}>
                  <MaterialIcons name="info-outline" size={20} color={theme.text} />
                </View>
                <Text style={styles.itemLabel}>О приложении</Text>
              </View>
              <MaterialIcons name="chevron-right" size={22} color={theme.textSecondary} />
            </TouchableOpacity>

          </View>
        </View>

        <Text style={styles.versionText}>Версия 1.0.0 (Beta)</Text>

      </ScrollView>
    </View>
  );
}

const createStyles = (theme: ThemeColors, mode?: ThemeMode) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background, // Глубокий черный фон
  },
  // --- HEADER ---
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: theme.background,
    zIndex: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.text,
  },
  
  // --- CONTENT ---
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 40,
  },
  
  // --- SECTIONS ---
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSecondary,
    marginBottom: 8,
    marginLeft: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionContainer: {
    backgroundColor: theme.surface, // Цвет карточки
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)', // Тонкая обводка
  },
  
  // --- ITEMS ---
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemLabel: {
    fontSize: 16,
    color: theme.text,
    fontWeight: '500',
  },
  itemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  itemValue: {
    fontSize: 15,
    color: theme.textSecondary,
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginLeft: 66, // Отступ, чтобы линия начиналась после иконки
  },
  
  versionText: {
    textAlign: 'center',
    color: '#444',
    fontSize: 12,
    marginTop: 10,
  },
});