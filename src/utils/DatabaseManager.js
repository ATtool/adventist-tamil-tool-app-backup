import * as SQLite from 'expo-sqlite';
import { dbDirectoryOption } from './dbPaths';

const dbCache = {};
const tableNameCache = {};

// Always open databases from the writable app directory (see dbPaths.js).
const openDatabase = (dbName) => SQLite.openDatabaseSync(dbName, undefined, dbDirectoryOption);

export const getSafeDb = (dbName) => {
  if (!dbCache[dbName]) {
    dbCache[dbName] = openDatabase(dbName);
  }
  return dbCache[dbName];
};

export const querySync = (dbName, sql, params = []) => {
  if (!dbCache[dbName]) dbCache[dbName] = openDatabase(dbName);
  try {
    return dbCache[dbName].getAllSync(sql, params);
  } catch (error) {
    const errStr = String(error);
    if (errStr.includes('no such table')) {
      // The cached table name was probably read before the database file was
      // installed/replaced. Forget it so the next lookup re-detects it.
      delete tableNameCache[dbName];
    }
    if (errStr.includes('NullPointer') || errStr.includes('rejected') || errStr.includes('closed')) {
      console.warn(`🚨 Auto-healing DB connection for ${dbName}...`);
      delete dbCache[dbName];
      dbCache[dbName] = openDatabase(dbName);
      return dbCache[dbName].getAllSync(sql, params); 
    }
    throw error;
  }
};

export const executeRunSync = (dbName, sql, params = []) => {
  if (!dbCache[dbName]) dbCache[dbName] = openDatabase(dbName);
  try {
    return dbCache[dbName].runSync(sql, params);
  } catch (error) {
    const errStr = String(error);
    if (errStr.includes('NullPointer') || errStr.includes('rejected') || errStr.includes('closed')) {
      console.warn(`🚨 Auto-healing DB connection for ${dbName}...`);
      delete dbCache[dbName];
      dbCache[dbName] = openDatabase(dbName);
      return dbCache[dbName].runSync(sql, params); 
    }
    throw error;
  }
};

export const getTableNameSync = (dbName) => {
  if (tableNameCache[dbName]) return tableNameCache[dbName];
  try {
    const result = querySync(dbName, `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'android_%'`);
    tableNameCache[dbName] = result && result.length > 0 ? result[0].name : 'verses';
    return tableNameCache[dbName];
  } catch (error) {
    return 'verses';
  }
};

// Called after database files are (re)installed so cached handles/names that
// point at the old, empty files are not reused.
export const clearTableNameCache = (dbName) => {
  if (dbName) {
    delete tableNameCache[dbName];
  } else {
    Object.keys(tableNameCache).forEach((key) => delete tableNameCache[key]);
  }
};

export const resetDatabaseConnections = () => {
  Object.keys(dbCache).forEach((key) => {
    try {
      dbCache[key].closeSync();
    } catch (e) {}
    delete dbCache[key];
  });
  clearTableNameCache();
};
