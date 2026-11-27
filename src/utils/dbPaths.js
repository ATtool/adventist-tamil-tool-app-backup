import * as FileSystem from 'expo-file-system/legacy';

// Database files must live inside the folder that expo-file-system is allowed
// to write to, otherwise downloads and bundled-asset copies fail with
// "Location '...' isn't writable/deletable" (this happens in Expo Go, where
// expo-sqlite's own default directory sits outside the experience sandbox).
//
// So we keep every database in `documentDirectory + 'SQLite'` and explicitly
// pass that folder to expo-sqlite when opening a database, instead of relying
// on expo-sqlite's default directory.
function resolveDatabaseDirectory() {
  const documentDirectory = FileSystem.documentDirectory;
  if (!documentDirectory) return '';

  const directory = documentDirectory + 'SQLite';
  return directory.endsWith('/') ? directory : directory + '/';
}

export const DB_DIRECTORY = resolveDatabaseDirectory();

export const dbPath = (fileName) => DB_DIRECTORY + fileName;

export async function ensureDbDirectory() {
  if (!DB_DIRECTORY) return DB_DIRECTORY;

  const info = await FileSystem.getInfoAsync(DB_DIRECTORY);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(DB_DIRECTORY, { intermediates: true });
  }
  return DB_DIRECTORY;
}

// expo-sqlite accepts a custom directory as an optional third argument. Passing
// `undefined` when we have no directory keeps its default behaviour intact.
export const dbDirectoryOption = DB_DIRECTORY || undefined;
