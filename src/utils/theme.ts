import { ColorSchemeName } from 'react-native';

export type ThemeMode = 'system' | 'light' | 'dark' | 'amoled';

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceHighlight: string;
  text: string;
  textSecondary: string;
  primary: string;
  border: string;
  error: string;
  success: string;
}

export const themes: Record<string, ThemeColors> = {
  light: {
    background: '#FFFFFF',
    surface: '#F5F5F5',
    surfaceHighlight: '#E0E0E0',
    text: '#000000',
    textSecondary: '#666666',
    primary: '#6200EE',
    border: '#E0E0E0',
    error: '#B00020',
    success: '#4CAF50',
  },
  dark: {
    background: '#121212',
    surface: '#1E1E1E',
    surfaceHighlight: '#2C2C2C',
    text: '#E0E0E0',
    textSecondary: '#A0A0A0',
    primary: '#BB86FC',
    border: '#333333',
    error: '#CF6679',
    success: '#4CAF50',
  },
  amoled: {
    background: '#000000',
    surface: '#121212',
    surfaceHighlight: '#222222',
    text: '#FFFFFF',
    textSecondary: '#999999',
    primary: '#BB86FC',
    border: '#222222',
    error: '#CF6679',
    success: '#4CAF50',
  },
};

// ВОТ ЭТА ФУНКЦИЯ, КОТОРОЙ НЕ ХВАТАЛО
export const getActualTheme = (
  userPreference: ThemeMode,
  systemScheme: ColorSchemeName
): ThemeColors => {
  if (userPreference === 'system') {
    return systemScheme === 'dark' ? themes.dark : themes.light;
  }
  return themes[userPreference] || themes.dark;
};