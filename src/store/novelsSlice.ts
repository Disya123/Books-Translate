import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Novel } from '@/types';

interface NovelsState {
  novels: Novel[];
  selectedNovelId: number | null;
  loading: boolean;
  error: string | null;
}

const initialState: NovelsState = {
  novels: [],
  selectedNovelId: null,
  loading: false,
  error: null,
};

const novelsSlice = createSlice({
  name: 'novels',
  initialState,
  reducers: {
    setNovels: (state, action: PayloadAction<Novel[]>) => {
      state.novels = action.payload;
    },
    addNovel: (state, action: PayloadAction<Novel>) => {
      state.novels.push(action.payload);
    },
    updateNovel: (state, action: PayloadAction<Novel>) => {
      const index = state.novels.findIndex((n) => n.id === action.payload.id);
      if (index !== -1) {
        state.novels[index] = action.payload;
      }
    },
    deleteNovel: (state, action: PayloadAction<number>) => {
      state.novels = state.novels.filter((n) => n.id !== action.payload);
    },
    selectNovel: (state, action: PayloadAction<number | null>) => {
      state.selectedNovelId = action.payload;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
  },
});

export const {
  setNovels,
  addNovel,
  updateNovel,
  deleteNovel,
  selectNovel,
  setLoading,
  setError,
} = novelsSlice.actions;

export default novelsSlice.reducer;
