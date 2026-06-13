import { querySync, getTableNameSync } from './DatabaseManager';
import * as FileSystem from 'expo-file-system/legacy';

let currentTicket = 0;

export function requestChapter(bookId, chapter, bibleLanguage, englishVersion, onSuccess, onError) {
  const myTicket = ++currentTicket;

  setTimeout(async () => {
    if (myTicket !== currentTicket) return;

    try {
      let combined = []; let maxCh = 1; let taVerses = []; let enVerses = [];

      if (bibleLanguage === 'tamil' || bibleLanguage === 'both') {
        const taTable = getTableNameSync('TAMIL.db');
        taVerses = querySync('TAMIL.db', `SELECT verse, text FROM "${taTable}" WHERE book_id = ? AND chapter = ? ORDER BY verse ASC`, [bookId, chapter]) || [];
        const chResult = querySync('TAMIL.db', `SELECT MAX(chapter) as maxCh FROM "${taTable}" WHERE book_id = ?`, [bookId]);
        maxCh = Math.max(maxCh, chResult?.[0]?.maxCh || 1);
      }

      if (bibleLanguage === 'english' || bibleLanguage === 'both') {
        let enDbName = englishVersion ? `${englishVersion}.db` : 'KJV.db';
        try {
          const fileInfo = await FileSystem.getInfoAsync(FileSystem.documentDirectory + 'SQLite/' + enDbName);
          if (!fileInfo.exists || fileInfo.size < 5000) enDbName = 'KJV.db';
        } catch (e) { enDbName = 'KJV.db'; }

        const enTable = getTableNameSync(enDbName);
        enVerses = querySync(enDbName, `SELECT verse, text FROM "${enTable}" WHERE book_id = ? AND chapter = ? ORDER BY verse ASC`, [bookId, chapter]) || [];
      }

      const totalVerses = Math.max(taVerses[taVerses.length - 1]?.verse || 0, enVerses[enVerses.length - 1]?.verse || 0);
      for (let i = 1; i <= totalVerses; i++) {
        const ta = taVerses.find(v => v.verse === i);
        const en = enVerses.find(v => v.verse === i);
        if (ta || en) {
          combined.push({ verse: i, text_ta: ta?.text || '', text_en: en?.text || '', combinedIndex: combined.length });
        }
      }

      if (myTicket !== currentTicket) return;

      // FIX: Query the exact tables BibleScreen is expecting
      let highlights = [];
      let bookmarks = [];
      let notes = [];
      try {
        highlights = querySync('UserData.db', `SELECT verse, color FROM highlights WHERE book_id = ? AND chapter = ?`, [bookId, chapter]) || [];
        bookmarks = querySync('UserData.db', `SELECT verse FROM bookmarks WHERE book_id = ? AND chapter = ?`, [bookId, chapter]) || [];
        notes = querySync('UserData.db', `SELECT verse FROM notes WHERE book_id = ? AND chapter = ?`, [bookId, chapter]) || [];
      } catch (e) {}

      if (myTicket !== currentTicket) return;
      
      // FIX: Return all 5 arguments in the correct order
      onSuccess(combined, maxCh, highlights, bookmarks, notes);

    } catch (err) {
      if (myTicket === currentTicket) onError(err);
    }
  }, 120);
}

export function cancelAllRequests() {
  currentTicket++;
}
