import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Linking,
  StatusBar,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme, useThemeStyles } from '@/hooks/useAppTheme';
import { ThemeColors, ThemeMode } from '@/utils/theme';

export default function AboutScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { theme, mode } = useAppTheme();
  const styles = useThemeStyles(createStyles);
  const headerTopPadding = (Platform.OS === 'android' ? StatusBar.currentHeight || 24 : insets.top) + 10;

  const handleOpenLink = (url: string) => {
    Linking.openURL(url).catch((err) => {
      console.error('Failed to open URL:', err);
    });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle={mode === 'light' ? 'dark-content' : 'light-content'} backgroundColor="transparent" translucent />
      
      {/* HEADER */}
      <View style={[styles.header, { paddingTop: headerTopPadding }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>О нас</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        
        {/* LOGO SECTION */}
        <View style={styles.centerSection}>
          <View style={styles.iconContainer}>
            <MaterialIcons name="menu-book" size={48} color="#000" />
          </View>
          <Text style={styles.appTitle}>Novel Translator</Text>
          <Text style={styles.versionText}>Версия 1.0.0 (Beta)</Text>
        </View>

        {/* LINKS SECTION */}
        <View style={styles.sectionContainer}>
          <TouchableOpacity
            style={styles.item}
            onPress={() => handleOpenLink('https://github.com')}
          >
            <View style={styles.itemLeft}>
                <MaterialIcons name="code" size={20} color={theme.text} />
                <Text style={styles.label}>GitHub</Text>
            </View>
            <MaterialIcons name="open-in-new" size={18} color="#555" />
          </TouchableOpacity>

          <View style={styles.separator} />

          <TouchableOpacity
            style={styles.item}
            onPress={() => handleOpenLink('https://t.me')}
          >
            <View style={styles.itemLeft}>
                <MaterialIcons name="telegram" size={20} color={theme.text} />
                <Text style={styles.label}>Telegram Канал</Text>
            </View>
            <MaterialIcons name="open-in-new" size={18} color="#555" />
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>© 2025 All rights reserved</Text>
          <Text style={styles.footerSubText}>Made with React Native & Expo</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: ThemeColors, mode?: ThemeMode) => StyleSheet.create({
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
    paddingBottom: 40,
  },
  centerSection: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  iconContainer: {
    width: 80,
    height: 80,
    backgroundColor: theme.primary,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: theme.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  appTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 4,
  },
  versionText: {
    color: theme.textSecondary,
    fontSize: 14,
  },
  sectionContainer: {
    backgroundColor: theme.surface,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.border,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  label: {
    fontSize: 16,
    color: theme.text,
    fontWeight: '500',
  },
  separator: {
    height: 1,
    backgroundColor: theme.border,
    marginLeft: 48,
  },
  footer: {
    marginTop: 40,
    alignItems: 'center',
    gap: 4,
  },
  footerText: {
    color: theme.textSecondary,
    fontSize: 12,
  },
  footerSubText: {
    color: theme.textSecondary,
    fontSize: 11,
  },
});