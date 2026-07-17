import * as SQLite from 'expo-sqlite';

let zionDbPromise = null;
let thiruDbPromise = null;

export const getZionDb = () => {
  if (!zionDbPromise) zionDbPromise = SQLite.openDatabaseAsync('zion.db');
  return zionDbPromise;
};

export const getThiruDb = () => {
  if (!thiruDbPromise) thiruDbPromise = SQLite.openDatabaseAsync('Thirumarai.db');
  return thiruDbPromise;
};
