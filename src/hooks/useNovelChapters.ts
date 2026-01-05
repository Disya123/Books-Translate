import { useEffect, useState } from 'react';
import DatabaseService from '@/services/database';

export interface Chapter {
  id: number;
  chapter_number: number;
  title?: string;
  content?: string;
}

export const useNovelChapters = (novelId: number) => {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadChapters = async () => {
    if (!novelId) return;

    setLoading(true);
    setError(null);

    try {
      const data = await DatabaseService.getChapters(novelId);
      setChapters(data);
    } catch (err) {
      setError('Не удалось загрузить главы');
      console.error('Error loading chapters:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadChapters();
  }, [novelId]);

  return { chapters, loading, error, reload: loadChapters };
};
