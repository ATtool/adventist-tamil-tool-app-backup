import { Buffer } from 'buffer';
global.Buffer = Buffer;

import React, { useState, useEffect } from 'react';
import * as Font from 'expo-font';
import * as FileSystem from 'expo-file-system/legacy';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { Asset } from 'expo-asset';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SettingsProvider } from './src/context/SettingsContext';
import MainNavigation, { navigationRef } from './src/navigation/MainNavigation';
import { initUserDataDB } from './src/utils/UserDataDB';
import { scheduleMannaNotifications } from './src/utils/NotificationService';
import { resetDatabaseConnections } from './src/utils/DatabaseManager';
import { dbPath, ensureDbDirectory } from './src/utils/dbPaths';

SplashScreen.preventAutoHideAsync();

const DB_VERSION = "3.2.0";

const DATABASE_ASSETS = {
  'KJV.db': () => require('./assets/data/KJV.db'),
  'TAMIL.db': () => require('./assets/data/TAMIL.db'),
  'cross_references.db': () => require('./assets/data/cross_references.db'),
  'zion.db': () => require('./assets/data/zion.db'),
  'Thirumarai.db': () => require('./assets/data/Thirumarai.db'),
};

async function safeDeleteFile(uri) {
  if (!uri) return;
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    }
  } catch (error) {
    // Some Expo Go/file-system combinations throw for paths they cannot delete,
    // even with idempotent=true. Ignore and let the caller fall back.
  }
}

async function installDatabase(dbName) {
  const dbUri = dbPath(dbName);
  const dbFileInfo = await FileSystem.getInfoAsync(dbUri);
  const currentDbVersion = await AsyncStorage.getItem(`@db_version_${dbName}`);

  // Already installed and valid for this app version.
  if (dbFileInfo.exists && dbFileInfo.size > 10000 && currentDbVersion === DB_VERSION) {
    return;
  }

  const assetModule = DATABASE_ASSETS[dbName];
  if (!assetModule) {
    console.warn(`⚠️ Warning: Asset ${dbName} not found in require list.`);
    return;
  }

  // Always resolve a real local file first. downloadAsync() cannot read file://
  // sources on Android, so use copyAsync for bundled assets.
  const asset = Asset.fromModule(assetModule());
  await asset.downloadAsync();
  const sourceUri = asset.localUri || asset.uri;
  if (!sourceUri) throw new Error(`No local source found for ${dbName}`);

  // Use a unique temp file and defensive deletes. Expo Go has been observed to
  // throw "isn't deletable" for deleteAsync in SQLite directories.
  const tempUri = `${dbUri}.tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await safeDeleteFile(tempUri);

  try {
    if (sourceUri.startsWith('file://')) {
      await FileSystem.copyAsync({ from: sourceUri, to: tempUri });
    } else {
      await FileSystem.downloadAsync(sourceUri, tempUri);
    }

    const copied = await FileSystem.getInfoAsync(tempUri);
    if (!copied.exists || !copied.size || copied.size < 10000) {
      throw new Error(`Install produced an invalid database (${copied.size || 0} bytes)`);
    }

    // Replace the target. If delete/move fails in Expo Go, fall back to copying
    // over the destination and cleaning up the temp file.
    await safeDeleteFile(dbUri);
    try {
      await FileSystem.moveAsync({ from: tempUri, to: dbUri });
    } catch (moveError) {
      await safeDeleteFile(dbUri);
      await FileSystem.copyAsync({ from: tempUri, to: dbUri });
      await safeDeleteFile(tempUri);
    }

    const finalInfo = await FileSystem.getInfoAsync(dbUri);
    if (!finalInfo.exists || !finalInfo.size || finalInfo.size < 10000) {
      throw new Error(`Database install did not produce a readable file (${finalInfo.size || 0} bytes)`);
    }

    await AsyncStorage.setItem(`@db_version_${dbName}`, DB_VERSION);
    console.log(`✅ Installed ${dbName} (${Math.round(finalInfo.size / 1024)} KB)`);
  } finally {
    await safeDeleteFile(tempUri);
  }
}

async function navigateFromNotification(response) {
  const screen = response?.notification?.request?.content?.data?.screen;
  if (!screen) return;

  let attempts = 0;
  while (!navigationRef.isReady() && attempts < 25) {
    await new Promise((r) => setTimeout(r, 200));
    attempts++;
  }

  if (navigationRef.isReady()) {
    navigationRef.navigate(screen);
  }
}

export default function App() {
  const [appIsReady, setAppIsReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        await Font.loadAsync({
          'Tamil003': require('./assets/fonts/Tamil003.ttf'),
          'Tamil008': require('./assets/fonts/Tamil008.ttf'),
          ...require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf'),
          ...require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialCommunityIcons.ttf'),
        });

        await ensureDbDirectory();
        resetDatabaseConnections();
        for (const dbName of Object.keys(DATABASE_ASSETS)) {
          try {
            await installDatabase(dbName);
          } catch (dbError) {
            console.warn(`⚠️ Could not install ${dbName}:`, dbError);
          }
        }

        initUserDataDB();

        let devotions = null;
        const savedManna = await AsyncStorage.getItem('@manna_data');
        if (savedManna) {
          try {
            const parsedManna = JSON.parse(savedManna);
            devotions = parsedManna.devotions || null;
          } catch (e) {
            devotions = null;
          }
        }
        try {
          await scheduleMannaNotifications(devotions);
        } catch (notifyError) {
          console.warn("Could not schedule devotion notifications:", notifyError);
        }

      } catch (e) {
        console.warn("Error during app preparation: ", e);
      } finally {
        setAppIsReady(true);
        await SplashScreen.hideAsync();
      }
    }
    prepare();
  }, []);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(navigateFromNotification);

    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) navigateFromNotification(response);
    });

    return () => subscription.remove();
  }, []);

  if (!appIsReady) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <MainNavigation />
      </SettingsProvider>
    </SafeAreaProvider>
  );
}
