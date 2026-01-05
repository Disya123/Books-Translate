import * as SQLite from 'expo-sqlite';
import {
  Novel,
  Chapter,
  TranslationCache,
  TranslationQueueItem,
  Bookmark,
  Image,
} from '@/types';

let dbInstance: SQLite.SQLiteDatabase | null = null;

export const getDatabase = async (): Promise<SQLite.SQLiteDatabase> => {
  if (dbInstance) {
    return dbInstance;
  }

  const db = await SQLite.openDatabaseAsync('novel-translator.db');
  dbInstance = db;

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS novels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      cover_image_path TEXT,
      chapter_count INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chapters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      novel_id INTEGER NOT NULL,
      chapter_number INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS translation_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chapter_id INTEGER NOT NULL,
      source_lang TEXT NOT NULL,
      target_lang TEXT NOT NULL,
      target_code TEXT NOT NULL,
      translated_content TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      UNIQUE(chapter_id, source_lang, target_code)
    );

    CREATE TABLE IF NOT EXISTS translation_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chapter_id INTEGER NOT NULL,
      source_lang TEXT NOT NULL,
      target_lang TEXT NOT NULL,
      status TEXT NOT NULL,
      error_message TEXT,
      created_at INTEGER NOT NULL,
      completed_at INTEGER,
      FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS bookmarks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      novel_id INTEGER NOT NULL,
      chapter_number INTEGER NOT NULL,
      FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE,
      UNIQUE(novel_id)
    );

    CREATE TABLE IF NOT EXISTS images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      novel_id INTEGER NOT NULL,
      chapter_id INTEGER,
      filename TEXT NOT NULL,
      file_path TEXT NOT NULL,
      is_cover BOOLEAN DEFAULT 0,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE,
      FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_novels_slug ON novels(slug);
    CREATE INDEX IF NOT EXISTS idx_chapters_novel ON chapters(novel_id);
    CREATE INDEX IF NOT EXISTS idx_tc_chapter ON translation_cache(chapter_id);
    CREATE INDEX IF NOT EXISTS idx_tc_lang ON translation_cache(
      chapter_id, source_lang, target_code
    );
    CREATE INDEX IF NOT EXISTS idx_tq_status ON translation_queue(status);
    CREATE INDEX IF NOT EXISTS idx_bookmarks_novel ON bookmarks(novel_id);
    CREATE INDEX IF NOT EXISTS idx_images_novel ON images(novel_id);
  `);

  return db;
};

export const DatabaseService = {
  // ============ NOVELS ============
  async getAllNovels(): Promise<Novel[]> {
    const db = await getDatabase();
    const novels = await db.getAllAsync<Novel>(
      'SELECT * FROM novels ORDER BY created_at DESC'
    );

    // Подгрузить обложки для каждой новеллы
    const novelsWithCovers = await Promise.all(
      novels.map(async (novel) => {
        const cover = await this.getCoverImage(novel.id);
        return {
          ...novel,
          cover_image_path: cover?.file_path || novel.cover_image_path,
        };
      })
    );

    return novelsWithCovers;
  },

  async getNovelById(id: number): Promise<Novel | null> {
    const db = await getDatabase();
    const result = await db.getFirstAsync<Novel>(
      'SELECT * FROM novels WHERE id = ?',
      [id]
    );

    if (result) {
      const cover = await this.getCoverImage(id);
      return {
        ...result,
        cover_image_path: cover?.file_path || result.cover_image_path,
      };
    }

    return result;
  },

  async getNovelBySlug(slug: string): Promise<Novel | null> {
    const db = await getDatabase();
    const result = await db.getFirstAsync<Novel>(
      'SELECT * FROM novels WHERE slug = ?',
      [slug]
    );
    return result;
  },

  async createNovel(
    title: string,
    slug: string,
    coverImagePath: string | null = null
  ): Promise<SQLite.SQLiteRunResult> {
    const db = await getDatabase();

    // Проверяем, существует ли slug
    const existing = await this.getNovelBySlug(slug);

    // Если slug существует, добавляем суффикс
    let finalSlug = slug;
    if (existing) {
      let counter = 2;
      while (await this.getNovelBySlug(`${slug}-${counter}`)) {
        counter++;
      }
      finalSlug = `${slug}-${counter}`;
    }

    const now = Date.now();
    return await db.runAsync(
      'INSERT INTO novels (title, slug, cover_image_path, chapter_count, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)',
      [title, finalSlug, coverImagePath, now, now]
    );
  },

  async updateNovel(
    id: number,
    title?: string,
    coverImagePath?: string | null
  ): Promise<void> {
    const db = await getDatabase();
    const updates: string[] = ['updated_at = ?'];
    const params: (string | number | null)[] = [Date.now()];

    if (title) {
      updates.push('title = ?');
      params.push(title);
    }
    if (coverImagePath !== undefined) {
      updates.push('cover_image_path = ?');
      params.push(coverImagePath);
    }

    params.push(id);
    await db.runAsync(
      `UPDATE novels SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
  },

  async deleteNovel(id: number): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM novels WHERE id = ?', [id]);
  },

  async updateChapterCount(novelId: number): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      'UPDATE novels SET chapter_count = (SELECT COUNT(*) FROM chapters WHERE novel_id = ?), updated_at = ? WHERE id = ?',
      [novelId, Date.now(), novelId]
    );
  },

  // ============ CHAPTERS ============
  async getChapters(novelId: number): Promise<Chapter[]> {
    const db = await getDatabase();
    const result = await db.getAllAsync<Chapter>(
      'SELECT * FROM chapters WHERE novel_id = ? ORDER BY chapter_number ASC',
      [novelId]
    );
    return result;
  },

  async getChapter(id: number): Promise<Chapter | null> {
    const db = await getDatabase();
    const result = await db.getFirstAsync<Chapter>(
      'SELECT * FROM chapters WHERE id = ?',
      [id]
    );
    return result;
  },

  async getChapterByNumber(
    novelId: number,
    chapterNumber: number
  ): Promise<Chapter | null> {
    const db = await getDatabase();
    const result = await db.getFirstAsync<Chapter>(
      'SELECT * FROM chapters WHERE novel_id = ? AND chapter_number = ?',
      [novelId, chapterNumber]
    );
    return result;
  },

  async createChapter(
    novelId: number,
    chapterNumber: number,
    content: string
  ): Promise<SQLite.SQLiteRunResult> {
    const db = await getDatabase();
    const now = Date.now();
    return await db.runAsync(
      'INSERT INTO chapters (novel_id, chapter_number, content, created_at) VALUES (?, ?, ?, ?)',
      [novelId, chapterNumber, content, now]
    );
  },

  async updateChapter(id: number, content: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('UPDATE chapters SET content = ? WHERE id = ?', [
      content,
      id,
    ]);
  },

  async deleteChapter(id: number): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM chapters WHERE id = ?', [id]);
  },

  // ============ TRANSLATION CACHE ============
  async getCachedTranslation(
    chapterId: number,
    targetCode: string
  ): Promise<TranslationCache | null> {
    const db = await getDatabase();
    const result = await db.getFirstAsync<TranslationCache>(
      'SELECT * FROM translation_cache WHERE chapter_id = ? AND target_code = ?',
      [chapterId, targetCode]
    );
    return result;
  },

  // Получить ID всех переведенных глав для конкретной новеллы
  async getTranslatedChapterIds(novelId: number, targetCode: string = 'ru'): Promise<number[]> {
    const db = await getDatabase();
    const result = await db.getAllAsync<{ chapter_id: number }>(
      `SELECT tc.chapter_id 
       FROM translation_cache tc
       JOIN chapters c ON tc.chapter_id = c.id
       WHERE c.novel_id = ? AND tc.target_code = ?`,
      [novelId, targetCode]
    );
    return result.map(r => r.chapter_id);
  },

  async saveCachedTranslation(
    chapterId: number,
    sourceLang: string,
    targetLang: string,
    targetCode: string,
    translatedContent: string
  ): Promise<SQLite.SQLiteRunResult> {
    const db = await getDatabase();
    const now = Date.now();
    return await db.runAsync(
      'INSERT OR REPLACE INTO translation_cache (chapter_id, source_lang, target_lang, target_code, translated_content, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [chapterId, sourceLang, targetLang, targetCode, translatedContent, now]
    );
  },

  async clearTranslationsCache(): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM translation_cache');
  },

  // ============ TRANSLATION QUEUE ============
  async getTranslationQueue(): Promise<TranslationQueueItem[]> {
    const db = await getDatabase();
    const result = await db.getAllAsync<TranslationQueueItem>(
      'SELECT * FROM translation_queue ORDER BY created_at ASC'
    );
    return result;
  },

  async addToQueue(
    chapterId: number,
    sourceLang: string,
    targetLang: string
  ): Promise<SQLite.SQLiteRunResult> {
    const db = await getDatabase();
    const now = Date.now();
    return await db.runAsync(
      'INSERT INTO translation_queue (chapter_id, source_lang, target_lang, status, created_at) VALUES (?, ?, ?, ?, ?)',
      [chapterId, sourceLang, targetLang, 'pending', now]
    );
  },

  async updateQueueItem(
    id: number,
    status: string,
    errorMessage: string | null = null
  ): Promise<void> {
    const db = await getDatabase();
    const updates: string[] = [];
    const params: (string | number | null)[] = [];

    updates.push('status = ?');
    params.push(status);

    if (status === 'completed') {
      updates.push('completed_at = ?');
      params.push(Date.now());
    }

    if (errorMessage !== null) {
      updates.push('error_message = ?');
      params.push(errorMessage);
    } else if (status !== 'failed') {
      updates.push('error_message = NULL');
    }

    params.push(id);
    await db.runAsync(
      `UPDATE translation_queue SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
  },

  async clearQueue(): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM translation_queue');
  },

  // ============ BOOKMARKS ============
  async getAllBookmarks(): Promise<Bookmark[]> {
    const db = await getDatabase();
    const result = await db.getAllAsync<Bookmark>(
      'SELECT * FROM bookmarks ORDER BY novel_id'
    );
    return result;
  },

  async getBookmark(novelId: number): Promise<Bookmark | null> {
    const db = await getDatabase();
    const result = await db.getFirstAsync<Bookmark>(
      'SELECT * FROM bookmarks WHERE novel_id = ?',
      [novelId]
    );
    return result;
  },

  async setBookmark(novelId: number, chapterNumber: number): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      'INSERT OR REPLACE INTO bookmarks (novel_id, chapter_number) VALUES (?, ?)',
      [novelId, chapterNumber]
    );
  },

  async removeBookmark(novelId: number): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM bookmarks WHERE novel_id = ?', [novelId]);
  },

  // ============ IMAGES ============
  async getNovelImages(novelId: number): Promise<Image[]> {
    const db = await getDatabase();
    const result = await db.getAllAsync<Image>(
      'SELECT * FROM images WHERE novel_id = ? AND is_cover = 0 ORDER BY created_at ASC',
      [novelId]
    );
    return result;
  },

  async getCoverImage(novelId: number): Promise<Image | null> {
    const db = await getDatabase();
    const result = await db.getFirstAsync<Image>(
      'SELECT * FROM images WHERE novel_id = ? AND is_cover = 1',
      [novelId]
    );
    return result;
  },

  async addImage(
    novelId: number,
    chapterId: number | null,
    filename: string,
    filePath: string,
    isCover: boolean = false
  ): Promise<SQLite.SQLiteRunResult> {
    const db = await getDatabase();
    const now = Date.now();
    return await db.runAsync(
      'INSERT INTO images (novel_id, chapter_id, filename, file_path, is_cover, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [novelId, chapterId, filename, filePath, isCover ? 1 : 0, now]
    );
  },

  async deleteNovelImages(novelId: number): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM images WHERE novel_id = ?', [novelId]);
  },
};

export default DatabaseService;
