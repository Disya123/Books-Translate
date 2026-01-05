import { useTheme } from '@/contexts/ThemeContext';
import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { ThemeColors, ThemeMode } from '@/utils/theme';

// Хук для получения цветов
export const useAppTheme = () => {
  const { theme, mode } = useTheme();
  return { theme, mode };
};

// Хелпер для создания стилей, зависящих от темы
export const useThemeStyles = <T extends StyleSheet.NamedStyles<T>>(
  styleFactory: (theme: ThemeColors, mode?: ThemeMode) => T
): T => {
  const { theme, mode } = useTheme();
  
  // Пересчитываем стили только когда меняется объект темы или режим
  return useMemo(() => styleFactory(theme, mode), [theme, mode]);
};