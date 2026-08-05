import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing, Dimensions, TextInput, KeyboardAvoidingView, Platform, FlatList, Modal, Image, ScrollView, Linking } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSettings } from '../context/SettingsContext';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import * as Notifications from 'expo-notifications';
import InAppBrowser from '../components/InAppBrowser';

// Import app.json to get current app version safely
import appConfig from '../../app.json'; 

const { width, height } = Dimensions.get('window');

const FAB_SIZE = Math.round(Math.min(74, Math.max(52, width * 0.145)));
const FAB_ICON_SIZE = Math.round(FAB_SIZE * 0.46);

const COUNTRIES = [
  { name: 'India', flag: '🇮🇳' }, { name: 'Australia', flag: '🇦🇺' }, { name: 'Canada', flag: '🇨🇦' }, 
  { name: 'France', flag: '🇫🇷' }, { name: 'Germany', flag: '🇩🇪' }, { name: 'Malaysia', flag: '🇲🇾' },
  { name: 'Singapore', flag: '🇸🇬' }, { name: 'Sri Lanka', flag: '🇱🇰' }, { name: 'United Arab Emirates', flag: '🇦🇪' },
  { name: 'United Kingdom', flag: '🇬🇧' }, { name: 'United States', flag: '🇺🇸' }
];

// --- CRITICAL: Tell Android/iOS how to handle notifications when app is open ---
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

export default function HomeScreen() {
  const navigation = useNavigation();
  const { isDark, colors, appFontSize, hapticsEnabled } = useSettings();
  
  const [isChecking, setIsChecking] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  
  const [isMenuOpen, setIsMenuOpen] = useState(false); 
  const [showMeetingMenu, setShowMeetingMenu] = useState(false);
  const [showSabbathOptions, setShowSabbathOptions] = useState(false);
  const [sabbathSheetRendered, setSabbathSheetRendered] = useState(false);
  const [browserVisible, setBrowserVisible] = useState(false);
  const [browserUrl, setBrowserUrl] = useState('');
  const [browserTitle, setBrowserTitle] = useState('');
  
  const [greeting, setGreeting] = useState('');
  const [userName, setUserName] = useState('');
  const [currentDateStr, setCurrentDateStr] = useState('');
  
  const [tempName, setTempName] = useState('');
  const [tempCountry, setTempCountry] = useState({ name: 'India', flag: '🇮🇳' });
  const [todayVerse, setTodayVerse] = useState('');

  // NEW: Read status state
  const [hasReadToday, setHasReadToday] = useState(false);

  const [updates, setUpdates] = useState([]);
  const [isUpdatesTamil, setIsUpdatesTamil] = useState(false);
  const [showAllUpdates, setShowAllUpdates] = useState(false);
  const [showStorePopup, setShowStorePopup] = useState(false);
  const [selectedUpdate, setSelectedUpdate] = useState(null);
  
  const [lastSeenUpdateId, setLastSeenUpdateId] = useState(null);
  const [dismissedForcedVersion, setDismissedForcedVersion] = useState(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const menuSlideAnim = useRef(new Animated.Value(width)).current; 
  const menuFadeAnim = useRef(new Animated.Value(0)).current;
  const sabbathSlideAnim = useRef(new Animated.Value(height)).current;
  const sabbathBackdropAnim = useRef(new Animated.Value(0)).current;
  
  const cardScales = useRef([...Array(3)].map(() => new Animated.Value(0.8))).current; 
  const cardOpacities = useRef([...Array(3)].map(() => new Animated.Value(0))).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // NEW: Listen for when a user taps a notification
  const lastNotificationResponse = Notifications.useLastNotificationResponse();

  useEffect(() => {
    if (lastNotificationResponse) {
      const screen = lastNotificationResponse.notification.request.content.data?.screen;
      if (screen === 'TodaysManna') {
        navigation.navigate('TodaysManna');
      } else if (screen === 'Updates') {
        setShowAllUpdates(true);
      }
    }
  }, [lastNotificationResponse, navigation]);

  useEffect(() => {
    checkUserData();
    setGreetingTime();
    fetchUpdates(); 
    checkReadStatus();
    setupDailyNotification();
    
    const date = new Date();
    setCurrentDateStr(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));

    const fetchTodayVerse = async () => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateString = `${year}-${month}-${day}`;

      try {
        let foundVerse = null;
        const savedData = await AsyncStorage.getItem('@manna_data');
        
        if (savedData) {
          try {
            const parsedData = JSON.parse(savedData);
            if (parsedData.devotions && parsedData.devotions[dateString]) {
              foundVerse = parsedData.devotions[dateString].verse;
            }
          } catch (parseError) {
            console.warn("Corrupt local manna data found and cleared.");
            await AsyncStorage.removeItem('@manna_data');
          }
        }
        
        if (!foundVerse) {
          const response = await fetch('https://gist.githubusercontent.com/ATtool/e3a8241e07503969cb06448a32eb4382/raw/manna.json', { headers: { 'Cache-Control': 'no-cache' } });
          if (response.ok) {
            try {
              const rawText = await response.text();
              const json = JSON.parse(rawText.replace(/^\uFEFF/, '').trim());
              await AsyncStorage.setItem('@manna_data', JSON.stringify(json));
              if (json.devotions && json.devotions[dateString]) {
                foundVerse = json.devotions[dateString].verse;
              }
            } catch (fetchError) {
              console.warn("Gist JSON has a typo right now. The app will safely wait until you fix it.");
            }
          }
        }
        
        if (foundVerse) {
          let formattedVerse = foundVerse;
          const parts = foundVerse.split(/\n/);
          
          if (parts.length > 1) {
            const reference = parts.pop().replace('-', '').trim();
            const verseText = parts.join(' ').trim();
            formattedVerse = `${reference} - ${verseText}`;
          }
          setTodayVerse(formattedVerse);
        }
      } catch (error) { console.warn("Home Manna Fetch Error:", error); }
    };
    
    fetchTodayVerse();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
      ])
    ).start();
  }, []);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(menuSlideAnim, { toValue: isMenuOpen ? 0 : width, duration: 300, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
      Animated.timing(menuFadeAnim, { toValue: isMenuOpen ? 1 : 0, duration: 300, useNativeDriver: true })
    ]).start();
  }, [isMenuOpen]);

  // --- Smooth open/close animation for the Sabbath School options sheet ---
  useEffect(() => {
    if (showSabbathOptions) {
      setSabbathSheetRendered(true);
      Animated.parallel([
        Animated.timing(sabbathSlideAnim, {
          toValue: 0,
          duration: 380,
          easing: Easing.bezier(0.16, 1, 0.3, 1), // eases out gently, like a native bottom sheet settling
          useNativeDriver: true,
        }),
        Animated.timing(sabbathBackdropAnim, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    } else if (sabbathSheetRendered) {
      Animated.parallel([
        Animated.timing(sabbathSlideAnim, {
          toValue: height,
          duration: 300,
          easing: Easing.bezier(0.4, 0, 1, 1), // eases in, accelerating downward on close
          useNativeDriver: true,
        }),
        Animated.timing(sabbathBackdropAnim, {
          toValue: 0,
          duration: 250,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start(() => {
        setSabbathSheetRendered(false);
      });
    }
  }, [showSabbathOptions]);

  // --- NEW: Check if user read today's manna ---
  const checkReadStatus = async () => {
    const today = new Date().toLocaleDateString('en-US');
    const lastRead = await AsyncStorage.getItem('@last_read_manna_date');
    setHasReadToday(lastRead === today);
  };

  // --- CRITICAL FIX: Setup 5:00 AM Daily Notification with Android VIP Channel ---
  const setupDailyNotification = async () => {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') return;

    // This creates the VIP Channel for Android devices so it never blocks the alarm
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('daily-manna', {
        name: 'Daily Devotion',
        importance: Notifications.AndroidImportance.HIGH,
        sound: true,
      });
    }

    // Check if we already scheduled it so we don't create duplicates
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const hasDaily = scheduled.some(n => n.content.data?.type === 'daily_manna');

    if (!hasDaily) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "இன்றைய மன்னா",
          body: "இன்றைய தேவ செய்தியை வாசிக்க நேரம் ஒதுக்குங்கள்.",
          data: { screen: 'TodaysManna', type: 'daily_manna' },
          sound: true,
        },
        trigger: {
          hour: 5,
          minute: 0,
          repeats: true,
        },
      });
    }
  };

  const isUpdateRequired = (requiredVersion) => {
    if (!requiredVersion) return false;
    const currentVersion = appConfig.expo.version; 
    const currParts = currentVersion.split('.').map(Number);
    const reqParts = requiredVersion.split('.').map(Number);
    for (let i = 0; i < Math.max(currParts.length, reqParts.length); i++) {
      const curr = currParts[i] || 0;
      const req = reqParts[i] || 0;
      if (curr < req) return true; 
      if (curr > req) return false; 
    }
    return false; 
  };

  useFocusEffect(
    useCallback(() => {
      // Re-check read status every time they return to the home screen
      checkReadStatus();
      
      if (!isChecking && !showOnboarding && userName) {
        cardScales.forEach(anim => anim.setValue(0.8));
        cardOpacities.forEach(anim => anim.setValue(0));

        const animations = cardScales.map((anim, index) => {
          return Animated.parallel([
            Animated.spring(anim, { toValue: 1, friction: 6, tension: 50, useNativeDriver: true }),
            Animated.timing(cardOpacities[index], { toValue: 1, duration: 300, useNativeDriver: true })
          ]);
        });

        Animated.stagger(120, animations).start();
      }
    }, [isChecking, showOnboarding, userName])
  );

  const fetchUpdates = async () => {
    try {
      const GIST_URL = 'https://gist.githubusercontent.com/ATtool/d2282fc4e40cab92304a6a3615561a34/raw/updates.json'; 
      const response = await fetch(GIST_URL);
      const data = await response.json();
      setUpdates(data); 

      const storedLastSeenId = await AsyncStorage.getItem('@last_seen_update_id');
      const storedNotifiedId = await AsyncStorage.getItem('@last_notified_update_id');
      const storedDismissedVersion = await AsyncStorage.getItem('@dismissed_forced_version');
      
      setLastSeenUpdateId(storedLastSeenId);
      setDismissedForcedVersion(storedDismissedVersion);

      if (data.length > 0) {
        const latestId = String(data[0].id);
        
        // NEW: Trigger a push notification if there is a new update we haven't notified them about yet
        if (latestId !== storedNotifiedId) {
          const updateTitle = isUpdatesTamil ? data[0].titleTa : data[0].titleEn;
          
          if (Platform.OS === 'android') {
             await Notifications.setNotificationChannelAsync('updates', {
               name: 'App Updates',
               importance: Notifications.AndroidImportance.DEFAULT,
               sound: true,
             });
          }

          await Notifications.scheduleNotificationAsync({
            content: {
              title: "New Update / புதிய அறிவிப்பு",
              body: updateTitle,
              data: { screen: 'Updates' },
              sound: true,
            },
            trigger: null, // trigger immediately
          });
          await AsyncStorage.setItem('@last_notified_update_id', latestId);
        }

        const forcedUpdate = data.find(item => 
          item.actionType === 'store_update' && 
          item.isForced === true && 
          isUpdateRequired(item.versionRequired)
        );

        if (forcedUpdate && storedDismissedVersion !== forcedUpdate.versionRequired) {
          setSelectedUpdate(forcedUpdate);
          setShowStorePopup(true);
        }
      }

    } catch (error) {
      console.warn("Failed to fetch updates:", error);
    }
  };

  const handleUpdateAction = (update) => {
    if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (update.actionType === 'navigate' && update.targetScreen) {
      setShowAllUpdates(false);
      navigation.navigate(update.targetScreen);
    } else if (update.actionType === 'store_update') {
      if (isUpdateRequired(update.versionRequired)) {
        setSelectedUpdate(update);
        setShowStorePopup(true);
      }
    }
  };

  const openAppStore = () => {
    if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    if (Platform.OS === 'android') {
      Linking.openURL(`https://play.google.com/store/apps/details?id=${appConfig.expo.android.package}`);
    } else {
      Linking.openURL('itms-apps://itunes.apple.com/app/idYOUR_APPLE_APP_ID'); 
    }
    setShowStorePopup(false);
  };

  const latestUpdateId = updates.length > 0 ? String(updates[0].id) : null;
  const safeLastSeenId = lastSeenUpdateId ? String(lastSeenUpdateId) : null;
  const hasNewUpdates = latestUpdateId && latestUpdateId !== safeLastSeenId;

  const setGreetingTime = () => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good Morning');
    else if (hour < 18) setGreeting('Good Afternoon');
    else setGreeting('Good Evening');
  };

  const startHomeAnimations = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 800, easing: Easing.out(Easing.exp), useNativeDriver: true })
    ]).start();
  };

  const checkUserData = async () => {
    try {
      const savedName = await AsyncStorage.getItem('@user_name');
      if (savedName) {
        setUserName(savedName);
        setShowOnboarding(false);
        startHomeAnimations();
      } else setShowOnboarding(true);
    } catch (error) { console.warn(error); } finally { setIsChecking(false); }
  };

  const saveUserData = async () => {
    if (!tempName.trim()) return;
    try {
      if (hapticsEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await AsyncStorage.setItem('@user_name', tempName.trim());
      await AsyncStorage.setItem('@user_country_name', tempCountry.name);
      await AsyncStorage.setItem('@user_country_flag', tempCountry.flag);
      setUserName(tempName.trim());
      setShowOnboarding(false);
      
      // Request notifications immediately after they finish setting up
      setupDailyNotification();
      
      startHomeAnimations();
    } catch (error) { console.warn(error); }
  };

  const isTamilText = (text) => /[\u0B80-\u0BFF]/.test(text);

  const navigateFromMenu = (screenName) => {
    if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsMenuOpen(false);
    setTimeout(() => { navigation.navigate(screenName); }, 200);
  };

  const openSabbathSchoolLink = () => {
    if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowSabbathOptions(true);
  };

  const openSabbathOption = (url, title) => {
    if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowSabbathOptions(false);
    setBrowserTitle(title);
    setBrowserUrl(url);
    setTimeout(() => setBrowserVisible(true), 320);
  };

  const renderUpdateItem = (item, index) => {
    const isStoreUpdate = item.actionType === 'store_update';
    const needsUpdate = isStoreUpdate ? isUpdateRequired(item.versionRequired) : false;
    const buttonLabelEn = (isStoreUpdate && !needsUpdate) ? "Up to Date" : item.buttonTextEn;
    const buttonLabelTa = (isStoreUpdate && !needsUpdate) ? "புதுப்பிக்கப்பட்டது" : item.buttonTextTa;

    return (
      <View key={item.id || index} style={[styles.updateItem, { borderBottomColor: index === updates.length - 1 ? 'transparent' : colors.border }]}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={{ color: colors.text, fontSize: appFontSize, fontWeight: isUpdatesTamil ? 'normal' : 'bold', fontFamily: isUpdatesTamil ? 'Tamil003' : undefined }}>
            {isUpdatesTamil ? item.titleTa : item.titleEn}
          </Text>
          <Text style={{ color: colors.subtext, fontSize: appFontSize - 2, marginTop: 4, fontFamily: isUpdatesTamil ? 'Tamil003' : undefined }}>
            {isUpdatesTamil ? item.descTa : item.descEn}
          </Text>
        </View>
        <TouchableOpacity 
          style={[styles.updateBtn, { backgroundColor: (isStoreUpdate && !needsUpdate) ? 'transparent' : colors.primary + '20' }]} 
          onPress={() => handleUpdateAction(item)}
          disabled={isStoreUpdate && !needsUpdate} 
        >
          <Text style={{ color: (isStoreUpdate && !needsUpdate) ? colors.subtext : colors.primary, fontSize: appFontSize - 3, fontWeight: isUpdatesTamil ? 'normal' : 'bold', fontFamily: isUpdatesTamil ? 'Tamil003' : undefined }}>
            {isUpdatesTamil ? buttonLabelTa : buttonLabelEn}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        
        <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text style={[styles.greeting, { color: colors.subtext, fontSize: 14 }]} allowFontScaling={false}>
                {greeting}{userName ? ', ' : ''}
                {userName && (
                  <Text style={{ color: colors.primary, fontFamily: isTamilText(userName) ? 'Tamil003' : undefined, fontSize: isTamilText(userName) ? 18 : 14 }} allowFontScaling={false}>
                    {userName}
                  </Text>
                )}
              </Text>
              <Text style={[styles.title, { color: colors.text, fontSize: 13 }]} allowFontScaling={false}>
                Welcome to Adventist Tamil Tool
              </Text>
            </View>
            
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity 
                onPress={async () => { 
                  if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); 
                  setShowAllUpdates(true); 
                  if (latestUpdateId) {
                    await AsyncStorage.setItem('@last_seen_update_id', latestUpdateId);
                    setLastSeenUpdateId(latestUpdateId);
                  }
                }}
                style={{ marginRight: 20, position: 'relative' }}
              >
                <Ionicons name="notifications-outline" size={28} color="#FFD700" />
                {hasNewUpdates && <View style={styles.redDot} />}
              </TouchableOpacity>

              <TouchableOpacity onPress={() => { if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setIsMenuOpen(true); }}>
                <Ionicons name="menu" size={32} color="#FFD700" />
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>

        <Animated.ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

          <AnimatedTouchableOpacity 
            style={[styles.mannaCard, { backgroundColor: colors.card, borderColor: colors.border, marginBottom: 15, opacity: cardOpacities[0], transform: [{ scale: cardScales[0] }] }]} 
            onPress={async () => {
              // Mark as read immediately when they click!
              const today = new Date().toLocaleDateString('en-US');
              await AsyncStorage.setItem('@last_read_manna_date', today);
              setHasReadToday(true);
              navigation.navigate('TodaysManna');
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: todayVerse ? 12 : 0 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={[styles.iconContainerSmall, { backgroundColor: hasReadToday ? 'rgba(48, 209, 88, 0.1)' : 'rgba(255, 159, 10, 0.1)' }]}>
                  {/* The magic Read / Unread icon changes here! */}
                  <Ionicons name={hasReadToday ? "checkmark-circle" : "sunny"} size={24} color={hasReadToday ? "#30D158" : "#FF9F0A"} />
                </View>
                <View style={{ marginLeft: 15 }}>
                  <Text style={{ color: colors.text, fontSize: 16, fontWeight: 'bold', includeFontPadding: false }} allowFontScaling={false}>Today's Manna</Text>
                  <Text style={{ color: colors.subtext, fontSize: appFontSize - 2, marginTop: 2, includeFontPadding: false }} allowFontScaling={false}>
                    <Text style={{ fontFamily: 'Tamil003', fontSize: 16 }}>இன்றைய மன்னா</Text> • {currentDateStr}
                  </Text>
                </View>
              </View>
              {/* Optional: Add a small pulsing dot if unread */}
              {!hasReadToday && (
                 <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF9F0A', marginRight: 10 }} />
              )}
              <Ionicons name="chevron-forward" size={20} color={colors.subtext} />
            </View>

            {!!todayVerse && (
              <View style={{ marginTop: 2, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
                <Text 
                  style={{ color: '#00F0FF', fontSize: appFontSize, fontFamily: 'Tamil003', lineHeight: 22, textAlign: 'center' }} 
                  numberOfLines={3}
                  allowFontScaling={false}
                >
                  {todayVerse}
                </Text>
              </View>
            )}
          </AnimatedTouchableOpacity>

          <View style={styles.grid}>
            <AnimatedTouchableOpacity style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, opacity: cardOpacities[1], transform: [{ scale: cardScales[1] }] }]} onPress={openSabbathSchoolLink}>
              <View style={[styles.iconContainer, { backgroundColor: 'rgba(48, 209, 88, 0.1)' }]}><Ionicons name="library" size={32} color="#30D158" /></View>
              <Text style={[styles.cardTitle, { color: colors.text, fontSize: 16 }]} allowFontScaling={false}>Sabbath School</Text>
              <Text style={[styles.cardSub, { color: colors.subtext, fontSize: appFontSize, fontFamily: 'Tamil003', fontWeight: 'normal' }]} allowFontScaling={false}>ஓய்வுநாள் பள்ளி</Text>
            </AnimatedTouchableOpacity>

            <AnimatedTouchableOpacity style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, opacity: cardOpacities[2], transform: [{ scale: cardScales[2] }] }]} onPress={() => navigation.navigate('Magazine')}>
              <View style={[styles.iconContainer, { backgroundColor: 'rgba(191, 90, 242, 0.1)' }]}><Ionicons name="newspaper" size={32} color="#BF5AF2" /></View>
              <Text style={[styles.cardTitle, { color: colors.text, fontSize: 16 }]} allowFontScaling={false}>Monthly Magazine</Text>
              <Text style={[styles.cardSub, { color: colors.subtext, fontSize: appFontSize, fontFamily: 'Tamil003' }]} allowFontScaling={false}>மாதாந்திர இதழ்</Text>
            </AnimatedTouchableOpacity>
          </View>
        </Animated.ScrollView>
      </SafeAreaView>

      <Animated.View style={[styles.fabWrapper, { transform: [{ scale: pulseAnim }], shadowColor: colors.primary }]}>
        {Platform.OS === 'android' && (
          <Svg width={FAB_SIZE * 2.4} height={FAB_SIZE * 2.4} style={styles.fabGlowSvg}>
            <Defs>
              <RadialGradient id="fabGlow" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor={colors.primary} stopOpacity="0.28" />
                <Stop offset="55%" stopColor={colors.primary} stopOpacity="0.10" />
                <Stop offset="100%" stopColor={colors.primary} stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Circle cx="50%" cy="50%" r="50%" fill="url(#fabGlow)" />
          </Svg>
        )}
        <TouchableOpacity style={[styles.fab, { backgroundColor: colors.primary, width: FAB_SIZE, height: FAB_SIZE, borderRadius: FAB_SIZE / 2 }]} activeOpacity={0.8} onPress={() => { if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowMeetingMenu(true); }}>
          <Ionicons name="people" size={FAB_ICON_SIZE} color={isDark ? "#000" : "#FFF"} />
        </TouchableOpacity>
      </Animated.View>

      <Modal visible={showAllUpdates} transparent animationType="slide" onRequestClose={() => setShowAllUpdates(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.meetingSheet, { backgroundColor: colors.background, borderColor: colors.border, height: '75%' }]}>
            <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
              <View>
                <Text style={{ color: colors.text, fontSize: 20, fontWeight: 'bold' }}>All Updates</Text>
                <Text style={{ color: colors.subtext, fontSize: 14, fontFamily: 'Tamil003', marginTop: 2 }}>அனைத்து அறிவிப்புகள்</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TouchableOpacity style={[styles.langToggleBtn, { borderColor: colors.primary, marginRight: 15 }]} onPress={() => setIsUpdatesTamil(!isUpdatesTamil)}>
                  <Text style={{ color: colors.primary, fontSize: 14, fontWeight: 'bold' }}>{isUpdatesTamil ? 'A' : 'த'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowAllUpdates(false)}>
                  <Ionicons name="close-circle" size={32} color={colors.subtext} />
                </TouchableOpacity>
              </View>
            </View>
            
            {updates.length === 0 ? (
              <View style={{ padding: 30, alignItems: 'center' }}>
                <Ionicons name="checkmark-done-circle" size={50} color={colors.subtext} />
                <Text style={{ color: colors.subtext, marginTop: 15, fontSize: 16 }}>You are all caught up!</Text>
              </View>
            ) : (
              <ScrollView contentContainerStyle={{ padding: 15, paddingBottom: 40 }}>
                {updates.map((item, index) => renderUpdateItem(item, index))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={showStorePopup} transparent animationType="fade" onRequestClose={() => setShowStorePopup(false)}>
        <View style={[styles.modalOverlay, { justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.95)' }]}>
          <View style={[styles.updateAlertBox, { backgroundColor: isDark ? '#121212' : '#FFFFFF', borderColor: colors.border }]}>
            <View style={[styles.iconContainer, { backgroundColor: 'rgba(0, 240, 255, 0.1)', alignSelf: 'center', marginBottom: 20 }]}>
              <Ionicons name="cloud-download" size={32} color={colors.primary} />
            </View>
            <Text style={{ color: colors.text, fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 10 }}>Update Required</Text>
            <Text style={{ color: colors.subtext, fontSize: 16, textAlign: 'center', marginBottom: 5 }}>
              Please go to the Store and update the app for more new features.
            </Text>
            <Text style={{ color: colors.subtext, fontSize: 14, textAlign: 'center', fontFamily: 'Tamil003', marginBottom: 25 }}>
              புதிய அம்சங்களைப் பெற செயலியைப் புதுப்பிக்கவும்.
            </Text>
            
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <TouchableOpacity 
                style={[styles.modalBtn, { backgroundColor: 'transparent', borderColor: colors.border, borderWidth: 1 }]} 
                onPress={async () => {
                  if (selectedUpdate?.versionRequired) {
                    await AsyncStorage.setItem('@dismissed_forced_version', selectedUpdate.versionRequired);
                    setDismissedForcedVersion(selectedUpdate.versionRequired);
                  }
                  setShowStorePopup(false);
                }}
              >
                <Text style={{ color: colors.text, fontWeight: 'bold' }}>Later / பிறகு</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.primary }]} onPress={openAppStore}>
                <Text style={{ color: isDark ? '#000' : '#FFF', fontWeight: 'bold' }}>Update Now</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showMeetingMenu} transparent animationType="slide" onRequestClose={() => setShowMeetingMenu(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.meetingSheet, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
              <View>
                <Text style={{ color: colors.text, fontSize: 20, fontWeight: 'bold' }}>Fellowship Services</Text>
                <Text style={{ color: colors.subtext, fontSize: 14, fontFamily: 'Tamil003', marginTop: 2 }}>ஐக்கிய ஆராதனைகள்</Text>
              </View>
              <TouchableOpacity onPress={() => setShowMeetingMenu(false)}><Ionicons name="close-circle" size={32} color={colors.subtext} /></TouchableOpacity>
            </View>
            <TouchableOpacity style={[styles.meetingOption, { borderBottomColor: colors.border }]} onPress={() => { setShowMeetingMenu(false); navigation.navigate('CreateService'); }}>
              <View style={[styles.iconContainerSmall, { backgroundColor: 'rgba(0, 240, 255, 0.1)', marginRight: 15 }]}><Ionicons name="add" size={24} color={colors.primary} /></View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: 18, fontWeight: 'bold' }}>Create Service</Text>
                <Text style={{ color: colors.subtext, fontSize: 14, fontFamily: 'Tamil003' }}>புதிய ஆராதனை</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.border} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.meetingOption, { borderBottomColor: colors.border }]} onPress={() => { setShowMeetingMenu(false); navigation.navigate('JoinService'); }}>
              <View style={[styles.iconContainerSmall, { backgroundColor: 'rgba(48, 209, 88, 0.1)', marginRight: 15 }]}><Ionicons name="qr-code" size={24} color="#30D158" /></View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: 18, fontWeight: 'bold' }}>Join Service</Text>
                <Text style={{ color: colors.subtext, fontSize: 14, fontFamily: 'Tamil003' }}>ஆராதனையில் இணைய</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.border} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.meetingOption} onPress={() => { setShowMeetingMenu(false); navigation.navigate('SavedServices'); }}>
              <View style={[styles.iconContainerSmall, { backgroundColor: 'rgba(255, 159, 10, 0.1)', marginRight: 15 }]}><Ionicons name="bookmark" size={24} color="#FF9F0A" /></View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: 18, fontWeight: 'bold' }}>Saved Services</Text>
                <Text style={{ color: colors.subtext, fontSize: 14, fontFamily: 'Tamil003' }}>சேமிக்கப்பட்டவை</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.border} />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={sabbathSheetRendered} transparent animationType="none" onRequestClose={() => setShowSabbathOptions(false)}>
        <Animated.View style={[styles.modalOverlay, { opacity: sabbathBackdropAnim }]}>
          <Animated.View style={[styles.meetingSheet, { backgroundColor: colors.background, borderColor: colors.border, transform: [{ translateY: sabbathSlideAnim }], maxHeight: '85%' }]}>
            
            <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
              <View>
                <Text style={{ color: colors.text, fontSize: 20, fontWeight: 'bold' }}>Sabbath School</Text>
                <Text style={{ color: colors.subtext, fontSize: 14, fontFamily: 'Tamil003', fontWeight: 'normal', marginTop: 2 }}>ஓய்வுநாள் பள்ளி</Text>
              </View>
              <TouchableOpacity onPress={() => setShowSabbathOptions(false)}>
                <Ionicons name="close-circle" size={32} color={colors.subtext} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 30 : 20 }} showsVerticalScrollIndicator={false}>
              
              <Text style={[styles.sectionTitle, { color: colors.primary, marginTop: 15, marginBottom: 10, fontSize: appFontSize - 2 }]}>IN-APP READER (OFFLINE)</Text>

              {/* SINGLE OFFLINE OPTION: Read Today */}
              <TouchableOpacity
                style={[styles.sabbathPrimaryCard, { borderColor: '#00F0FF' }]}
                activeOpacity={0.85}
                onPress={() => {
                  if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowSabbathOptions(false);
                  // Navigate to the new unified screen
                  setTimeout(() => navigation.navigate('SabbathSchool'), 200);
                }}
              >
                <LinearGradient colors={['#004d66', '#0099cc']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.sabbathPrimaryGradient}>
                  <View style={styles.sabbathPrimaryTopRow}>
                    <View style={[styles.iconContainerSmall, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                      <Ionicons name="today" size={22} color="#FFFFFF" />
                    </View>
                  </View>
                  <Text style={styles.sabbathPrimaryTitle} allowFontScaling={false}>Today's Sabbath School Lesson</Text>
                  <Text style={styles.sabbathPrimaryTamil} allowFontScaling={false}>இன்றைய ஒய்வுநாள் பள்ளி பாடம் #Adventech</Text>
                </LinearGradient>
              </TouchableOpacity>

              <Text style={[styles.sectionTitle, { color: colors.subtext, marginTop: 15, marginBottom: 10, fontSize: appFontSize - 2 }]}>OTHER WEB SOURCES</Text>

              {/* EXTERNAL OPTION 1: Fustero */}
              <TouchableOpacity
                style={[styles.sabbathSmallCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                activeOpacity={0.8}
                onPress={() => openSabbathOption('https://www.fustero.es/index_tm.php', 'Tamil Sabbath School')}
              >
                <View style={[styles.iconContainerSmall, { backgroundColor: 'rgba(48, 209, 88, 0.1)', marginRight: 12 }]}>
                  <Ionicons name="globe-outline" size={20} color="#30D158" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontSize: 15, fontWeight: 'bold' }} allowFontScaling={false}>Tamil Sabbath School</Text>
                  <Text style={{ color: colors.subtext, fontSize: 12, marginTop: 3, lineHeight: 16 }} allowFontScaling={false}>
                    Includes Mission Report & Children's lessons. (மிஷன் ரிப்போர்ட்)
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.subtext} />
              </TouchableOpacity>

              {/* EXTERNAL OPTION 2: Official GC */}
              <TouchableOpacity
                style={[styles.sabbathSmallCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                activeOpacity={0.8}
                onPress={() => openSabbathOption('https://sabbath-school.adventech.io/ta?group=%E0%AE%AA%E0%AF%86%E0%AE%B0%E0%AE%BF%E0%AE%AF%E0%AF%8B%E0%AE%B0%E0%AF%8D-%E0%AE%AA%E0%AE%BE%E0%AE%9F%E0%AE%99%E0%AF%8D%E0%AE%95%E0%AE%B3%E0%AF%8D', 'Official GC Sabbath School')}
              >
                <View style={[styles.iconContainerSmall, { backgroundColor: 'rgba(0, 122, 255, 0.1)', marginRight: 12 }]}>
                  <Ionicons name="globe-outline" size={20} color="#0A84FF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontSize: 15, fontWeight: 'bold' }} allowFontScaling={false}>Official GC Website</Text>
                  <Text style={{ color: colors.subtext, fontSize: 12, marginTop: 3, lineHeight: 16 }} allowFontScaling={false}>
                    No mission report available here.
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.subtext} />
              </TouchableOpacity>

              {/* EXTERNAL OPTION 3: Backup */}
              <TouchableOpacity
                style={[styles.sabbathSmallCard, { backgroundColor: colors.card, borderColor: colors.border, marginBottom: 0 }]}
                activeOpacity={0.8}
                onPress={() => openSabbathOption('https://onedrive.live.com/?id=964A92A9B81F49C6%21517682&cid=964A92A9B81F49C6&redeem=aHR0cHM6Ly8xZHJ2Lm1zL3UvcyFBc1pKSDdpcGtrcVduOHd5V29YUDNLUjgwSFF2bUE%5FZT1ZM0xsTUY', 'Backup Lessons')}
              >
                <View style={[styles.iconContainerSmall, { backgroundColor: 'rgba(255, 159, 10, 0.1)', marginRight: 12 }]}>
                  <Ionicons name="archive-outline" size={20} color="#FF9F0A" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontSize: 15, fontWeight: 'bold' }} allowFontScaling={false}>Backup</Text>
                  <Text style={{ color: colors.subtext, fontSize: 12, marginTop: 3, fontFamily: 'Tamil003', fontWeight: 'normal' }} allowFontScaling={false}>
                    பழைய பாட தொகுப்புகள்
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.subtext} />
              </TouchableOpacity>

            </ScrollView>
          </Animated.View>
        </Animated.View>
      </Modal>

      <InAppBrowser
        visible={browserVisible}
        url={browserUrl}
        title={browserTitle}
        onClose={() => setBrowserVisible(false)}
      />

      <Modal visible={isMenuOpen} transparent animationType="none" onRequestClose={() => setIsMenuOpen(false)}>
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <Animated.View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', opacity: menuFadeAnim }}>
            <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setIsMenuOpen(false)} />
          </Animated.View>
          <Animated.View style={[styles.drawerMenu, { backgroundColor: isDark ? '#0A1929' : '#FFFFFF', transform: [{ translateX: menuSlideAnim }] }]}>
            <SafeAreaView edges={['top']} style={{ flex: 1 }}>
              <View style={styles.drawerHeader}>
                <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.primary }}>Menu</Text>
                <TouchableOpacity onPress={() => setIsMenuOpen(false)}><Ionicons name="close" size={28} color={colors.text} /></TouchableOpacity>
              </View>
              <ScrollView style={{ padding: 20 }}>
                <TouchableOpacity style={styles.drawerItem} onPress={() => navigateFromMenu('TodaysManna')}>
                  <Ionicons name="sunny" size={24} color={colors.text} style={{ marginRight: 15 }} />
                  <Text style={{ color: colors.text, fontSize: 18 }}>Daily Devotion</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.drawerItem} onPress={() => { setIsMenuOpen(false); openSabbathSchoolLink(); }}>
                  <Ionicons name="library" size={24} color={colors.text} style={{ marginRight: 15 }} />
                  <Text style={{ color: colors.text, fontSize: 18 }}>Sabbath School Lesson</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.drawerItem} onPress={() => navigateFromMenu('Study')}>
                  <Ionicons name="library" size={24} color={colors.text} style={{ marginRight: 15 }} />
                  <Text style={{ color: colors.text, fontSize: 18 }}>Bible Tools & Study</Text>
                </TouchableOpacity>
                <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 15 }} />
                <TouchableOpacity style={styles.drawerItem} onPress={() => navigateFromMenu('Settings')}>
                  <Ionicons name="settings" size={24} color={colors.text} style={{ marginRight: 15 }} />
                  <Text style={{ color: colors.text, fontSize: 18 }}>Settings</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.drawerItem} onPress={() => navigateFromMenu('About')}>
                  <Ionicons name="information-circle" size={24} color={colors.text} style={{ marginRight: 15 }} />
                  <Text style={{ color: colors.text, fontSize: 18 }}>About the App</Text>
                </TouchableOpacity>
                <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 15 }} />
                <TouchableOpacity style={styles.drawerItem} onPress={() => Linking.openURL('mailto:adventisttamiltool@gmail.com')}>
                  <Image source={require('../../assets/Gmail.png')} style={{ width: 24, height: 24, marginRight: 15 }} resizeMode="contain" />
                  <Text style={{ color: colors.text, fontSize: 16 }}>adventisttamiltool@gmail.com</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.drawerItem} onPress={() => Linking.openURL('https://whatsapp.com/channel/0029Vb6Pu8FLI8YfM5H49e0p')}>
                  <Image source={require('../../assets/whatsapp.png')} style={{ width: 48, height: 48, marginRight: 15 }} resizeMode="contain" />
                  <Text style={{ color: colors.text, fontSize: 18 }}>Join our WhatsApp Channel</Text>
                </TouchableOpacity>
              </ScrollView>
            </SafeAreaView>
          </Animated.View>
        </View>
      </Modal>

      <Modal visible={isChecking || showOnboarding} animationType="none" statusBarTranslucent={true} onRequestClose={() => {}}>
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
          {showOnboarding && (
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.onboardingContainer}>
              <View style={styles.onboardingHeader}>
                <View style={[styles.iconContainerBig, { backgroundColor: 'transparent' }]}><Image source={require('../../assets/icon.png')} style={{ width: 100, height: 100, borderRadius: 25 }} resizeMode="cover" /></View>
                <Text style={[styles.welcomeText, { color: colors.text }]}>Welcome to</Text>
                <Text style={[styles.appNameText, { color: colors.primary }]}>Adventist Tamil Tool</Text>
                <Text style={[styles.onboardingSub, { color: colors.subtext }]}>Please personalize your experience</Text>
              </View>
              <View style={styles.onboardingForm}>
                <Text style={[styles.inputLabel, { color: colors.subtext }]}>Your Name (English or Tamil)</Text>
                <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]} placeholder="e.g. David / தாவீது" placeholderTextColor={colors.subtext} value={tempName} onChangeText={setTempName} autoCorrect={false} />
                <Text style={[styles.inputLabel, { color: colors.subtext, marginTop: 15 }]}>Your Country</Text>
                <TouchableOpacity style={[styles.input, styles.countrySelector, { borderColor: colors.border, backgroundColor: colors.card }]} onPress={() => setShowCountryPicker(true)}>
                  <Text style={{ fontSize: 18, color: colors.text }}>{tempCountry.flag}  {tempCountry.name}</Text>
                  <Ionicons name="chevron-down" size={20} color={colors.subtext} />
                </TouchableOpacity>
              </View>
              <View style={{ flex: 1 }} />
              <TouchableOpacity style={[styles.saveBtn, { opacity: tempName.trim() ? 1 : 0.5 }]} onPress={saveUserData} disabled={!tempName.trim()}>
                <LinearGradient colors={['#00F0FF', '#0080FF']} style={styles.gradientBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                  <Text style={styles.saveBtnText}>Let's Begin</Text>
                  <Ionicons name="arrow-forward" size={20} color="#000" style={{ marginLeft: 10 }} />
                </LinearGradient>
              </TouchableOpacity>
            </KeyboardAvoidingView>
          )}

          <Modal visible={showCountryPicker} animationType="slide" transparent={true}>
            <View style={styles.modalOverlay}>
              <View style={[styles.countrySheet, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}><Text style={{ color: colors.text, fontSize: 18, fontWeight: 'bold' }}>Select Country</Text><TouchableOpacity onPress={() => setShowCountryPicker(false)}><Ionicons name="close-circle" size={28} color={colors.subtext} /></TouchableOpacity></View>
                <FlatList data={COUNTRIES} keyExtractor={(item) => item.name} renderItem={({ item }) => (
                  <TouchableOpacity style={[styles.countryItem, { borderBottomColor: colors.border }]} onPress={() => { setTempCountry(item); setShowCountryPicker(false); if (hapticsEnabled) Haptics.selectionAsync(); }}>
                    <Text style={{ fontSize: 24, marginRight: 15 }}>{item.flag}</Text>
                    <Text style={{ fontSize: 16, color: colors.text, fontWeight: item.name === tempCountry.name ? 'bold' : 'normal' }}>{item.name}</Text>
                    {item.name === tempCountry.name && <Ionicons name="checkmark" size={20} color={colors.primary} style={{ marginLeft: 'auto' }} />}
                  </TouchableOpacity>
                )} />
              </View>
            </View>
          </Modal>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 15 },
  greeting: { fontWeight: '600', marginBottom: 4 },
  title: { fontWeight: '900', letterSpacing: 0.5 },
  redDot: { position: 'absolute', top: 0, right: -2, width: 12, height: 12, borderRadius: 6, backgroundColor: '#FF3B30', borderWidth: 2, borderColor: '#05070A' },
  scrollContent: { padding: 15, paddingBottom: 120 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  card: { width: (width - 45) / 2, paddingVertical: 18, paddingHorizontal: 6, borderRadius: 24, borderWidth: 1, marginBottom: 15, alignItems: 'center' },
  iconContainer: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  iconContainerSmall: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  cardTitle: { fontWeight: 'bold', marginBottom: 3, textAlign: 'center', includeFontPadding: false },
  cardSub: { fontWeight: 'normal', textAlign: 'center', marginTop: 0, includeFontPadding: false },
  langToggleBtn: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
  updateItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
  updateBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  updateAlertBox: { width: '85%', padding: 25, borderRadius: 24, borderWidth: 1 },
  modalBtn: { width: '47%', paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  mannaCard: { paddingVertical: 18, paddingHorizontal: 20, borderRadius: 20, borderWidth: 1, flexDirection: 'column', justifyContent: 'center' },
  drawerMenu: { width: width * 0.75, height: '100%', shadowColor: '#000', shadowOffset: { width: -5, height: 0 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 10 },
  drawerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#333' },
  drawerItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15 },
  onboardingContainer: { flex: 1, padding: 30, justifyContent: 'space-between' },
  onboardingHeader: { alignItems: 'center', marginTop: 40 },
  iconContainerBig: { width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center', marginBottom: 30 },
  welcomeText: { fontSize: 24, fontWeight: '600', marginBottom: 5 },
  appNameText: { fontSize: 32, fontWeight: '900', textAlign: 'center', marginBottom: 15 },
  onboardingSub: { fontSize: 16, textAlign: 'center' },
  onboardingForm: { marginTop: 40 },
  inputLabel: { fontSize: 14, fontWeight: 'bold', marginBottom: 8, marginLeft: 5 },
  input: { borderWidth: 1, borderRadius: 15, padding: 18, fontSize: 16 },
  countrySelector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  saveBtn: { borderRadius: 15, overflow: 'hidden', marginBottom: 20 },
  gradientBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18 },
  saveBtnText: { color: '#000', fontSize: 18, fontWeight: 'bold' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.7)' },
  countrySheet: { width: '100%', height: '70%', borderTopLeftRadius: 30, borderTopRightRadius: 30, borderWidth: 1, paddingBottom: 30 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1 },
  countryItem: { flexDirection: 'row', alignItems: 'center', padding: 18, borderBottomWidth: 1, paddingHorizontal: 20 },
  fabWrapper: { position: 'absolute', bottom: 30, right: 25, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.7, shadowRadius: 15, elevation: 10, zIndex: 50, alignItems: 'center', justifyContent: 'center' },
  fab: { justifyContent: 'center', alignItems: 'center' },
  fabGlowSvg: { position: 'absolute' },
  meetingSheet: { width: '100%', borderTopLeftRadius: 30, borderTopRightRadius: 30, borderWidth: 1, paddingBottom: 30 },
  meetingOption: { flexDirection: 'row', alignItems: 'center', padding: 20, borderBottomWidth: 1 },

  disclaimerBox: { flexDirection: 'row', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 16, alignItems: 'flex-start' },

  sabbathPrimaryCard: { borderRadius: 20, borderWidth: 1.5, marginBottom: 14, overflow: 'hidden', elevation: 6, shadowColor: '#30D158', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
  sabbathPrimaryGradient: { padding: 18 },
  sabbathPrimaryTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  recommendedPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFD700', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  recommendedPillText: { color: '#0F3D24', fontSize: 10, fontWeight: 'bold', marginLeft: 4 },
  sabbathPrimaryTitle: { color: '#FFFFFF', fontSize: 19, fontWeight: 'bold', includeFontPadding: false },
  sabbathPrimaryTamil: { color: 'rgba(255,255,255,0.85)', fontSize: 15, fontFamily: 'Tamil003', fontWeight: 'normal', marginTop: 2, includeFontPadding: false },
  sabbathPrimaryDesc: { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontFamily: 'Tamil003', fontWeight: 'normal', lineHeight: 20, marginTop: 10 },
  sabbathPrimaryFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)' },
  sabbathPrimaryFooterText: { color: '#FFFFFF', fontSize: 14, fontWeight: 'bold', marginRight: 8 },

  sabbathSmallCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 12 }
});
