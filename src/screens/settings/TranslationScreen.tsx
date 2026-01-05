import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppDispatch, useAppSelector } from '@/hooks/reduxHooks';
import { useAppTheme, useThemeStyles } from '@/hooks/useAppTheme';
import { ThemeColors } from '@/utils/theme';
import {
  setSourceLang,
  setTargetLang,
  setSystemPrompt,
} from '@/store/settingsSlice';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function TranslationScreen() {
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const { theme: appTheme, mode } = useAppTheme();
  const styles = useThemeStyles(createStyles);
  const insets = useSafeAreaInsets();
  const headerTopPadding = (Platform.OS === 'android' ? StatusBar.currentHeight || 24 : insets.top) + 10;

  const { sourceLang, targetLang, systemPrompt } = useAppSelector(
    (state) => state.settings
  );

  const [localSourceLang] = useState(sourceLang);
  const [localTargetLang] = useState(targetLang);
  const [localSystemPrompt, setLocalSystemPrompt] = useState(systemPrompt);

  const handleSave = async () => {
    dispatch(setSourceLang(localSourceLang));
    dispatch(setTargetLang(localTargetLang));
    dispatch(setSystemPrompt(localSystemPrompt));

    await AsyncStorage.setItem('translation_sourceLanguage', localSourceLang);
    await AsyncStorage.setItem('translation_targetLanguage', localTargetLang);
    await AsyncStorage.setItem('translation_targetCode', localTargetLang);
    await AsyncStorage.setItem('translation_systemPrompt', localSystemPrompt);

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
        <Text style={styles.headerTitle}>Перевод</Text>
        <TouchableOpacity onPress={handleSave} style={styles.saveBtnContainer}>
          <Text style={styles.saveBtn}>Сохранить</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        
        {/* LANGUAGES */}
        <Text style={styles.sectionTitle}>Языки</Text>
        <View style={styles.sectionContainer}>
          <TouchableOpacity style={styles.item}>
            <Text style={styles.label}>Исходный язык</Text>
            <View style={styles.valueRow}>
                <Text style={styles.value}>{localSourceLang}</Text>
                <MaterialIcons name="chevron-right" size={20} color={appTheme.textSecondary} />
            </View>
          </TouchableOpacity>

          <View style={styles.separator} />

          <TouchableOpacity style={styles.item}>
            <Text style={styles.label}>Целевой язык</Text>
            <View style={styles.valueRow}>
                <Text style={styles.value}>{localTargetLang}</Text>
                <MaterialIcons name="chevron-right" size={20} color={appTheme.textSecondary} />
            </View>
          </TouchableOpacity>
        </View>

        {/* PROMPT */}
        <Text style={styles.sectionTitle}>Системный промпт</Text>
        <View style={styles.sectionContainer}>
            <TextInput
              style={styles.textArea}
              value={localSystemPrompt}
              onChangeText={setLocalSystemPrompt}
              placeholder="You are a professional novel translator..."
              placeholderTextColor={appTheme.textSecondary}
              multiline
              textAlignVertical="top"
            />
        </View>
        <Text style={styles.hintText}>
            Инструкция для нейросети о том, как переводить текст (стиль, тон, термины).
        </Text>

        {/* RESET */}
        <TouchableOpacity style={styles.resetButton}>
            <Text style={styles.resetText}>Сбросить настройки</Text>
        </TouchableOpacity>

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
  saveBtnContainer: {
    padding: 8,
  },
  saveBtn: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.primary,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 40,
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
    backgroundColor: theme.surface,
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
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  value: {
    color: theme.textSecondary,
    fontSize: 15,
  },
  separator: {
    height: 1,
    backgroundColor: theme.border,
    marginLeft: 16,
  },
  textArea: {
    backgroundColor: theme.surface,
    padding: 16,
    color: theme.text,
    fontSize: 15,
    minHeight: 150,
    lineHeight: 22,
  },
  hintText: {
    color: theme.textSecondary,
    fontSize: 12,
    marginTop: 8,
    marginLeft: 12,
  },
  resetButton: {
    marginTop: 40,
    alignSelf: 'center',
    padding: 10,
  },
  resetText: {
    color: theme.error,
    fontSize: 15,
  },
});