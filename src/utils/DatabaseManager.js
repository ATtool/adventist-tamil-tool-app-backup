import * as SQLite from 'expo-sqlite';

const dbCache = {};
const tableNameCache = {};

export const getSafeDb = (dbName) => {
  if (!dbCache[dbName]) {
    dbCache[dbName] = SQLite.openDatabaseSync(dbName);
  }
  return dbCache[dbName];
};

export const querySync = (dbName, sql, params = []) => {
  if (!dbCache[dbName]) dbCache[dbName] = SQLite.openDatabaseSync(dbName);
  try {
    return dbCache[dbName].getAllSync(sql, params);
  } catch (error) {
    const errStr = String(error);
    if (errStr.includes('NullPointer') || errStr.includes('rejected') || errStr.includes('closed')) {
      console.warn(`🚨 Auto-healing DB connection for ${dbName}...`);
      delete dbCache[dbName];
      dbCache[dbName] = SQLite.openDatabaseSync(dbName);
      return dbCache[dbName].getAllSync(sql, params); 
    }
    throw error;
  }
};

export const executeRunSync = (dbName, sql, params = []) => {
  if (!dbCache[dbName]) dbCache[dbName] = SQLite.openDatabaseSync(dbName);
  try {
    return dbCache[dbName].runSync(sql, params);
  } catch (error) {
    const errStr = String(error);
    if (errStr.includes('NullPointer') || errStr.includes('rejected') || errStr.includes('closed')) {
      console.warn(`🚨 Auto-healing DB connection for ${dbName}...`);
      delete dbCache[dbName];
      dbCache[dbName] = SQLite.openDatabaseSync(dbName);
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
