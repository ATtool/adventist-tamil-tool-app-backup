import * as SQLite from 'expo-sqlite';

// 1. Open the database synchronously just like you were already doing.
// We put it at the top so all functions below can use this same 'db' connection.
const db = SQLite.openDatabaseSync('UserData.db');

export const initUserDataDB = () => {
  try {
    db.execSync(`
      -- Your existing favorites table
      CREATE TABLE IF NOT EXISTS favorites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        book_id INTEGER,
        chapter INTEGER,
        verse INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Your existing highlights table
      CREATE TABLE IF NOT EXISTS highlights (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        book_id INTEGER,
        chapter INTEGER,
        verse INTEGER,
        color TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- NEW: Our custom songs drawer!
      CREATE TABLE IF NOT EXISTS custom_songs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title_tamil TEXT NOT NULL,
        title_thanglish TEXT,
        lyrics TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('✅ UserData DB successfully initialized with favorites, highlights, and custom_songs tables.');
  } catch (error) {
    console.error('❌ Failed to initialize UserData DB: ', error);
  }
};

// --- NEW HELPER FUNCTIONS FOR CUSTOM SONGS ---

// Fetch all songs.
export const getCustomSongs = () => {
  try {
    return db.getAllSync('SELECT * FROM custom_songs ORDER BY id ASC');
  } catch (error) {
    console.error('Error fetching custom songs:', error);
    return [];
  }
};

// Add a new song.
export const addCustomSong = (titleTamil, titleThanglish, lyrics) => {
  try {
    const result = db.runSync(
      'INSERT INTO custom_songs (title_tamil, title_thanglish, lyrics) VALUES (?, ?, ?)',
      [titleTamil, titleThanglish, lyrics]
    );
    return result.lastInsertRowId;
  } catch (error) {
    console.error('Error adding custom song:', error);
    return null;
  }
};

// Update an existing song if the user clicks "Edit"
export const updateCustomSong = (id, titleTamil, titleThanglish, lyrics) => {
  try {
    db.runSync(
      'UPDATE custom_songs SET title_tamil = ?, title_thanglish = ?, lyrics = ? WHERE id = ?',
      [titleTamil, titleThanglish, lyrics, id]
    );
    return true;
  } catch (error) {
    console.error('Error updating custom song:', error);
    return false;
  }
};

// Delete a song permanently.
export const deleteCustomSong = (id) => {
  try {
    db.runSync('DELETE FROM custom_songs WHERE id = ?', [id]);
    return true;
  } catch (error) {
    console.error('Error deleting custom song:', error);
    return false;
  }
};
