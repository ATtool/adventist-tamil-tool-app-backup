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

SplashScreen.preventAutoHideAsync();

const DB_VERSION = "3.0.0";

async function copyDatabase(dbName, assetName) {
  const sqliteDirectory = FileSystem.documentDirectory + 'SQLite';
  if (!(await FileSystem.getInfoAsync(sqliteDirectory)).exists) {
    await FileSystem.makeDirectoryAsync(sqliteDirectory, { intermediates: true });
  }
  const dbUri = sqliteDirectory + '/' + dbName;
  const dbFileInfo = await FileSystem.getInfoAsync(dbUri);

  const currentDbVersion = await AsyncStorage.getItem(`@db_version_${dbName}`);

  if (!dbFileInfo.exists || dbFileInfo.size < 10000 || currentDbVersion !== DB_VERSION) {
    let asset;

    if (assetName === 'KJV.db') asset = require('./assets/data/KJV.db');
    else if (assetName === 'TAMIL.db') asset = require('./assets/data/TAMIL.db');
    else if (assetName === 'cross_references.db') asset = require('./assets/data/cross_references.db');
    else if (assetName === 'zion.db') asset = require('./assets/data/zion.db');
    else if (assetName === 'Thirumarai.db') asset = require('./assets/data/Thirumarai.db');

    if (asset) {
      if (dbFileInfo.exists) {
        await FileSystem.deleteAsync(dbUri, { idempotent: true });
      }

      const assetObj = (await Asset.loadAsync(asset))[0];
      await FileSystem.downloadAsync(assetObj.uri, dbUri);
      await AsyncStorage.setItem(`@db_version_${dbName}`, DB_VERSION);
      console.log(`✅ Successfully installed bulletproof version of ${dbName}`);
    } else {
      console.warn(`⚠️ Warning: Asset ${assetName} not found in require list.`);
    }
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

        await copyDatabase('KJV.db', 'KJV.db');
        await copyDatabase('TAMIL.db', 'TAMIL.db');
        await copyDatabase('cross_references.db', 'cross_references.db');
        await copyDatabase('zion.db', 'zion.db');
        await copyDatabase('Thirumarai.db', 'Thirumarai.db');

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
        scheduleMannaNotifications(devotions);

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
