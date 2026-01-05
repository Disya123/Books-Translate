import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { TranslationQueueItem } from '@/types';

interface TranslationState {
  queue: TranslationQueueItem[];
  isProcessing: boolean;
  pauseAfterChapter: boolean;
  activeChapterId: number | null;
  batchMode: 'all' | 'selected' | 'range' | null;
  selectedChapters: number[];
  rangeStart: number | null;
  rangeEnd: number | null;
  showNotifications: boolean;
}

const initialState: TranslationState = {
  queue: [],
  isProcessing: false,
  pauseAfterChapter: false,
  activeChapterId: null,
  batchMode: null,
  selectedChapters: [],
  rangeStart: null,
  rangeEnd: null,
  showNotifications: true,
};

const translationSlice = createSlice({
  name: 'translation',
  initialState,
  reducers: {
    setQueue: (state, action: PayloadAction<TranslationQueueItem[]>) => {
      state.queue = action.payload;
    },
    addToQueue: (state, action: PayloadAction<TranslationQueueItem>) => {
      state.queue.push(action.payload);
    },
    removeFromQueue: (state, action: PayloadAction<number>) => {
      state.queue = state.queue.filter((item) => item.id !== action.payload);
    },
    updateQueueItem: (state, action: PayloadAction<TranslationQueueItem>) => {
      const index = state.queue.findIndex(
        (item) => item.id === action.payload.id
      );
      if (index !== -1) {
        state.queue[index] = action.payload;
      }
    },
    clearQueue: (state) => {
      state.queue = [];
    },
    setProcessing: (state, action: PayloadAction<boolean>) => {
      state.isProcessing = action.payload;
    },
    setPauseAfterChapter: (state, action: PayloadAction<boolean>) => {
      state.pauseAfterChapter = action.payload;
    },
    setActiveChapterId: (state, action: PayloadAction<number | null>) => {
      state.activeChapterId = action.payload;
    },
    setBatchMode: (
      state,
      action: PayloadAction<'all' | 'selected' | 'range' | null>
    ) => {
      state.batchMode = action.payload;
    },
    setSelectedChapters: (state, action: PayloadAction<number[]>) => {
      state.selectedChapters = action.payload;
    },
    setRange: (
      state,
      action: PayloadAction<{ start: number | null; end: number | null }>
    ) => {
      state.rangeStart = action.payload.start;
      state.rangeEnd = action.payload.end;
    },
    setShowNotifications: (state, action: PayloadAction<boolean>) => {
      state.showNotifications = action.payload;
    },
  },
});

export const {
  setQueue,
  addToQueue,
  removeFromQueue,
  updateQueueItem,
  clearQueue,
  setProcessing,
  setPauseAfterChapter,
  setActiveChapterId,
  setBatchMode,
  setSelectedChapters,
  setRange,
  setShowNotifications,
} = translationSlice.actions;

export default translationSlice.reducer;
