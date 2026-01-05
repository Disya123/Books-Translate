import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { 
  persistStore, 
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';

import novelsReducer from './novelsSlice';
import readerReducer from './readerSlice';
import translationReducer from './translationSlice';
import settingsReducer from './settingsSlice';

// 1. Конфигурация сохранения
const persistConfig = {
  key: 'root',
  storage: AsyncStorage,
  // Укажите здесь редюсеры, которые нужно сохранять при перезапуске
  whitelist: ['settings', 'novels'], 
  // 'reader' и 'translation' можно не сохранять, если они инициализируются заново
};

// 2. Объединяем редюсеры
const rootReducer = combineReducers({
  novels: novelsReducer,
  reader: readerReducer,
  translation: translationReducer,
  settings: settingsReducer,
});

// 3. Создаем персистированный редюсер
const persistedReducer = persistReducer(persistConfig, rootReducer);

// 4. Создаем Store
export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Игнорируем экшены redux-persist, чтобы не было ошибок в консоли
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});

// 5. Создаем и ЭКСПОРТИРУЕМ persistor (этого не хватало!)
export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;