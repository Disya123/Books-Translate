import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppDispatch, useAppSelector } from '@/hooks/reduxHooks';
import { useAppTheme, useThemeStyles } from '@/hooks/useAppTheme';
import { ThemeColors } from '@/utils/theme';
import { setTheme } from '@/store/settingsSlice';

const THEMES = [
  { id: 'system', label: 'Системная' },
  { id: 'dark', label: 'Тёмная' },
  { id: 'light', label: 'Светлая' },
  { id: 'amoled', label: 'AMOLED (Чёрная)' },
];

export default function ThemeScreen() {
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const { theme: appTheme, mode } = useAppTheme();
  const styles = useThemeStyles(createStyles);
  const { theme } = useAppSelector((state) => state.settings);
  const insets = useSafeAreaInsets();
  const headerTopPadding = (Platform.OS === 'android' ? StatusBar.currentHeight || 24 : insets.top) + 10;

  const handleSave = (selectedTheme: string) => {
    dispatch(setTheme(selectedTheme as 'system' | 'dark' | 'light' | 'amoled'));
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle={mode === 'light' ? 'dark-content' : 'light-content'} backgroundColor="transparent" translucent />
      
      {/* HEADER */}
      <View style={[styles.header, { paddingTop: headerTopPadding }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={appTheme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Тема</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Выберите тему</Text>
        <View style={styles.sectionContainer}>
          {THEMES.map((themeOption, index) => (
            <React.Fragment key={themeOption.id}>
              <TouchableOpacity
                style={styles.item}
                onPress={() => handleSave(themeOption.id)}
              >
                <Text style={[
                    styles.label,
                    theme === themeOption.id && styles.labelSelected
                ]}>
                    {themeOption.label}
                </Text>
                {theme === themeOption.id && (
                  <MaterialIcons name="check" size={20} color={appTheme.primary} />
                )}
              </TouchableOpacity>
              {/* Добавляем разделитель для всех, кроме последнего */}
              {index < THEMES.length - 1 && <View style={styles.separator} />}
            </React.Fragment>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Превью</Text>
        <View style={styles.previewContainer}>
          <Text style={styles.previewText}>
            Абзац текста для демонстрации выбранной цветовой схемы. Так будет выглядеть текст в читалке.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
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
  content: {
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSecondary,
    marginBottom: 8,
    marginLeft: 12,
    textTransform: 'uppercase',
    marginTop: 24,
  },
  sectionContainer: {
    backgroundColor: theme.surfaceHighlight,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.border,
  },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  label: {
    fontSize: 16,
    color: theme.text,
  },
  labelSelected: {
    color: theme.primary,
    fontWeight: '500',
  },
  separator: {
    height: 1,
    backgroundColor: theme.border,
    marginLeft: 16,
  },
  previewContainer: {
    backgroundColor: theme.surface,
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  previewText: {
    fontSize: 16,
    color: theme.text,
    lineHeight: 24,
  },
});