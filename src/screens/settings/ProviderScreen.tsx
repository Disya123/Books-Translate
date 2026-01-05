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
import { ThemeColors, ThemeMode } from '@/utils/theme';
import { setApiUrl, setApiKey, setModelName } from '@/store/settingsSlice';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ProviderScreen() {
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const { theme, mode } = useAppTheme();
  const styles = useThemeStyles(createStyles);
  const headerTopPadding = (Platform.OS === 'android' ? StatusBar.currentHeight || 24 : insets.top) + 10;

  const { apiUrl, apiKey, modelName } = useAppSelector(
    (state) => state.settings
  );

  const [localApiUrl, setLocalApiUrl] = useState(apiUrl);
  const [localApiKey, setLocalApiKey] = useState(apiKey);
  const [localModelName, setLocalModelName] = useState(modelName);

  const handleSave = async () => {
    dispatch(setApiUrl(localApiUrl));
    dispatch(setApiKey(localApiKey));
    dispatch(setModelName(localModelName));

    await AsyncStorage.setItem('translation_apiUrl', localApiUrl);
    await AsyncStorage.setItem('translation_apiKey', localApiKey);
    await AsyncStorage.setItem('translation_modelName', localModelName);

    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle={mode === 'light' ? 'dark-content' : 'light-content'} backgroundColor="transparent" translucent />
      
      {/* HEADER */}
      <View style={[styles.header, { paddingTop: headerTopPadding }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Провайдер</Text>
        <TouchableOpacity onPress={handleSave} style={styles.saveBtnContainer}>
          <Text style={styles.saveBtn}>Сохранить</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        
        {/* SECTION 1 */}
        <Text style={styles.sectionTitle}>Сервис</Text>
        <View style={styles.sectionContainer}>
          <View style={styles.item}>
            <Text style={styles.label}>Тип API</Text>
            <View style={styles.valueRow}>
                <Text style={styles.valueHighlight}>OpenAI Compatible</Text>
                <MaterialIcons name="check" size={16} color={theme.primary} />
            </View>
          </View>
        </View>

        {/* SECTION 2 */}
        <Text style={styles.sectionTitle}>Настройки подключения</Text>
        <View style={styles.sectionContainer}>
          
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>BASE URL</Text>
            <TextInput
              style={styles.textInput}
              value={localApiUrl}
              onChangeText={setLocalApiUrl}
              placeholder="https://api.openai.com/v1"
              placeholderTextColor="#555"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.separator} />

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>API KEY</Text>
            <TextInput
              style={styles.textInput}
              value={localApiKey}
              onChangeText={setLocalApiKey}
              placeholder="sk-..."
              placeholderTextColor="#555"
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          <View style={styles.separator} />

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>MODEL NAME</Text>
            <TextInput
              style={styles.textInput}
              value={localModelName}
              onChangeText={setLocalModelName}
              placeholder="gpt-3.5-turbo"
              placeholderTextColor="#555"
              autoCapitalize="none"
            />
          </View>
        </View>

        {/* SECTION 3 */}
        <TouchableOpacity style={styles.testButton}>
            <Text style={styles.testButtonText}>Проверить соединение</Text>
        </TouchableOpacity>

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
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  label: {
    fontSize: 16,
    color: theme.text,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  valueHighlight: {
    color: theme.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  inputContainer: {
    padding: 16,
  },
  inputLabel: {
    color: theme.textSecondary,
    fontSize: 11,
    marginBottom: 4,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  textInput: {
    fontSize: 16,
    color: theme.text,
    padding: 0,
    height: 24,
  },
  separator: {
    height: 1,
    backgroundColor: theme.border,
    marginLeft: 16,
  },
  testButton: {
    marginTop: 24,
    backgroundColor: `${theme.primary}1A`,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: `${theme.primary}4D`,
  },
  testButtonText: {
    color: theme.primary,
    fontWeight: '600',
    fontSize: 16,
  },
});