import React from 'react';
import { View, Text, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme, useThemeStyles } from '@/hooks/useAppTheme';
import { ThemeColors } from '@/utils/theme';

export default function EditorScreen() {
  const { theme, mode } = useAppTheme();
  const styles = useThemeStyles(createStyles);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle={mode === 'light' ? 'dark-content' : 'light-content'}
        translucent
        backgroundColor="transparent"
      />
      <Text style={styles.text}>Экран редактора будет здесь...</Text>
    </SafeAreaView>
  );
}

const createStyles = (theme: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 16,
    color: theme.textSecondary,
  },
});
