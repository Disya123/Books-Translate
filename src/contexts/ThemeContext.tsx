import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { useSelector } from 'react-redux';
import { RootState } from '@/store';
import { getActualTheme, ThemeColors, ThemeMode } from '@/utils/theme';

interface ThemeContextType {
  theme: ThemeColors;
  mode: ThemeMode;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Получаем настройку из Redux (system/dark/light/amoled)
  const userPreference = useSelector((state: RootState) => state.settings.theme) as ThemeMode;
  
  // Получаем системную тему телефона (dark/light)
  const systemScheme = useColorScheme();

  const [activeTheme, setActiveTheme] = useState<ThemeColors>(
    getActualTheme(userPreference, systemScheme)
  );

  useEffect(() => {
    // При изменении настроек или системной темы обновляем цвета
    setActiveTheme(getActualTheme(userPreference, systemScheme));
  }, [userPreference, systemScheme]);

  return (
    <ThemeContext.Provider value={{ theme: activeTheme, mode: userPreference }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};