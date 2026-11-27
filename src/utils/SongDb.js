import * as SQLite from 'expo-sqlite';
import { dbDirectoryOption } from './dbPaths';

let zionDbPromise = null;
let thiruDbPromise = null;

export const getZionDb = () => {
  if (!zionDbPromise) zionDbPromise = SQLite.openDatabaseAsync('zion.db', undefined, dbDirectoryOption);
  return zionDbPromise;
};

export const getThiruDb = () => {
  if (!thiruDbPromise) thiruDbPromise = SQLite.openDatabaseAsync('Thirumarai.db', undefined, dbDirectoryOption);
  return thiruDbPromise;
};
