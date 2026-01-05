import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ReaderSettings } from '@/types';

interface ReaderState {
  currentChapterId: number | null;
  currentChapterNumber: number;
  settings: ReaderSettings;
}

const initialSettings: ReaderSettings = {
  fontFamily: 'System',
  fontSize: 18,
  textAlignment: 'left',
  theme: 'dark',
};

const initialState: ReaderState = {
  currentChapterId: null,
  currentChapterNumber: 1,
  settings: initialSettings,
};

const readerSlice = createSlice({
  name: 'reader',
  initialState,
  reducers: {
    setCurrentChapter: (state, action: PayloadAction<number | null>) => {
      state.currentChapterId = action.payload;
    },
    setCurrentChapterNumber: (state, action: PayloadAction<number>) => {
      state.currentChapterNumber = action.payload;
    },
    updateSettings: (state, action: PayloadAction<Partial<ReaderSettings>>) => {
      state.settings = { ...state.settings, ...action.payload };
    },
    resetSettings: (state) => {
      state.settings = initialSettings;
    },
  },
});

export const {
  setCurrentChapter,
  setCurrentChapterNumber,
  updateSettings,
  resetSettings,
} = readerSlice.actions;

export default readerSlice.reducer;
