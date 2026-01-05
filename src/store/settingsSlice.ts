import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { AppSettings, TranslationSettings } from '@/types';

interface SettingsState {
  reader: AppSettings['reader'];
  translation: TranslationSettings;
  notifications: 'in_app' | 'always';
  // Flatten properties for simplification
  apiUrl: string;
  apiKey: string;
  modelName: string;
  sourceLang: string;
  targetLang: string;
  systemPrompt: string;
  theme: 'system' | 'dark' | 'light' | 'amoled';
}

const defaultTranslationSettings: TranslationSettings = {
  sourceLanguage: 'en',
  targetLanguage: 'ru',
  targetCode: 'ru',
  apiUrl: 'https://nano-gpt.com/api/v1',
  apiKey: '',
  modelName: 'Qwen/Qwen3-Next-80B-A3B-Instruct',
};

const initialState: SettingsState = {
  reader: {
    fontFamily: 'System',
    fontSize: 18,
    textAlignment: 'left',
    theme: 'dark',
  },
  translation: defaultTranslationSettings,
  notifications: 'in_app',
  // Additional properties for convenience
  apiUrl: defaultTranslationSettings.apiUrl,
  apiKey: defaultTranslationSettings.apiKey,
  modelName: defaultTranslationSettings.modelName,
  sourceLang: defaultTranslationSettings.sourceLanguage,
  targetLang: defaultTranslationSettings.targetLanguage,
  systemPrompt:
    'You are a professional novel translator. Translate the text preserving the literary style and tone.',
  theme: 'dark',
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setSettings: (_state, _action: PayloadAction<AppSettings>) => {
      // Not used currently, but keeping for compatibility
    },
    updateReaderSettings: (
      state,
      action: PayloadAction<Partial<AppSettings['reader']>>
    ) => {
      state.reader = { ...state.reader, ...action.payload };
    },
    updateTranslationSettings: (
      state,
      action: PayloadAction<Partial<TranslationSettings>>
    ) => {
      state.translation = {
        ...state.translation,
        ...action.payload,
      };
    },
    setNotificationType: (
      state,
      action: PayloadAction<'in_app' | 'always'>
    ) => {
      state.notifications = action.payload;
    },
    // New simplified actions
    setApiUrl: (state, action: PayloadAction<string>) => {
      state.apiUrl = action.payload;
      state.translation.apiUrl = action.payload;
    },
    setApiKey: (state, action: PayloadAction<string>) => {
      state.apiKey = action.payload;
      state.translation.apiKey = action.payload;
    },
    setModelName: (state, action: PayloadAction<string>) => {
      state.modelName = action.payload;
      state.translation.modelName = action.payload;
    },
    setSourceLang: (state, action: PayloadAction<string>) => {
      state.sourceLang = action.payload;
      state.translation.sourceLanguage = action.payload;
    },
    setTargetLang: (state, action: PayloadAction<string>) => {
      state.targetLang = action.payload;
      state.translation.targetLanguage = action.payload;
    },
    setSystemPrompt: (state, action: PayloadAction<string>) => {
      state.systemPrompt = action.payload;
    },
    setTheme: (
      state,
      action: PayloadAction<'system' | 'dark' | 'light' | 'amoled'>
    ) => {
      state.theme = action.payload;
      state.reader.theme = action.payload;
    },
  },
});

export const {
  setSettings,
  updateReaderSettings,
  updateTranslationSettings,
  setNotificationType,
  setApiUrl,
  setApiKey,
  setModelName,
  setSourceLang,
  setTargetLang,
  setSystemPrompt,
  setTheme,
} = settingsSlice.actions;

export default settingsSlice.reducer;
