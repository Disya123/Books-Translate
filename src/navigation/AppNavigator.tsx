import React from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar'; // Рекомендуется для динамической смены стиля
import { useAppTheme } from '@/hooks/useAppTheme';

// Экранные импорты
import LibraryScreen from '@/screens/LibraryScreen';
import NovelDetailScreen from '@/screens/NovelDetailScreen';
import ReaderScreen from '@/screens/ReaderScreen';
import EditorScreen from '@/screens/EditorScreen';
import ImportScreen from '@/screens/ImportScreen';
import SettingsScreen from '@/screens/settings/SettingsScreen';
import ProviderScreen from '@/screens/settings/ProviderScreen';
import TranslationScreen from '@/screens/settings/TranslationScreen';
import ThemeScreen from '@/screens/settings/ThemeScreen';
import AboutScreen from '@/screens/settings/AboutScreen';

export type RootStackParamList = {
  MainTabs: undefined;
  'settings-root': undefined;
  settings: undefined;
  provider: undefined;
  translation: undefined;
  theme: undefined;
  about: undefined;
  'novel-detail': { novelId: number };
  reader: { novelId: number; chapterNumber: number };
  editor: { novelId?: number };
  import: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  const { theme, mode } = useAppTheme();

  // Проверяем, является ли тема темной (dark или amoled)
  const isDark = mode === 'dark' || mode === 'amoled';

  // Выбираем базовую тему React Navigation
  const baseTheme = isDark ? DarkTheme : DefaultTheme;

  const navigationTheme = {
    ...baseTheme, // Это добавит 'fonts' и другие системные свойства
    dark: isDark,
    colors: {
      ...baseTheme.colors, // Копируем стандартные цвета
      primary: theme.primary,
      background: theme.background, // Здесь будет #000000 для AMOLED
      card: theme.background,       // Фон хедера
      text: theme.text,
      border: theme.border,
      notification: theme.error,
    },
  };

  return (
    <NavigationContainer theme={navigationTheme}>
      {/* Для темных тем используем светлые иконки статус-бара и наоборот */}
      <StatusBar style={isDark ? 'light' : 'dark'} />
      
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="MainTabs" component={LibraryScreen} />
        
        <Stack.Screen
          name="novel-detail"
          component={NovelDetailScreen}
          options={{ presentation: 'card' }}
        />
        
        <Stack.Screen
          name="reader"
          component={ReaderScreen}
          options={{ presentation: 'fullScreenModal' }}
        />
        
        <Stack.Screen
          name="settings-root"
          component={SettingsScreen}
          options={{ presentation: 'card' }}
        />

        <Stack.Screen name="provider" component={ProviderScreen} />
        <Stack.Screen name="translation" component={TranslationScreen} />
        <Stack.Screen name="theme" component={ThemeScreen} />
        <Stack.Screen name="about" component={AboutScreen} />
        <Stack.Screen name="editor" component={EditorScreen} />
        <Stack.Screen name="import" component={ImportScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}