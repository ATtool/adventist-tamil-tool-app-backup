import * as SQLite from 'expo-sqlite';

export const initUserDataDB = () => {
  try {
    const db = SQLite.openDatabaseSync('UserData.db');

    db.execSync(`
      CREATE TABLE IF NOT EXISTS favorites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        book_id INTEGER,
        chapter INTEGER,
        verse INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS highlights (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        book_id INTEGER,
        chapter INTEGER,
        verse INTEGER,
        color TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('✅ UserData DB successfully initialized with favorites and highlights tables.');
  } catch (error) {
    console.error('❌ Failed to initialize UserData DB: ', error);
  }
};
