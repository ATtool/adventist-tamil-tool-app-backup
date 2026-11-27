import MixedText from '../components/MixedText.js';
import React, { useRef, useEffect } from 'react';
import { View, Text, Platform, TouchableOpacity, Animated, useWindowDimensions, StatusBar } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack'; 
import { NavigationContainer, createNavigationContainerRef, DefaultTheme } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSettings } from '../context/SettingsContext';

// --- MAIN TABS ---
import HomeScreen from '../screens/HomeScreen';
import BibleScreen from '../screens/BibleScreen';
import SongsScreen from '../screens/SongsScreen';
import BooksScreen from '../screens/BooksScreen';
import StudyScreen from '../screens/StudyScreen'; 

// --- STACK SCREENS ---
import EGWBooksListScreen from '../screens/EGWBooksListScreen';
import SettingsScreen from '../screens/SettingsScreen';
import TodaysMannaScreen from '../screens/TodaysMannaScreen';
import AboutScreen from '../screens/AboutScreen';
import MagazineScreen from '../screens/MagazineScreen';
import DictionaryScreen from '../screens/DictionaryScreen';
import ConcordanceScreen from '../screens/ConcordanceScreen';
import StudyExplanationsScreen from '../screens/StudyExplanationsScreen'; 

// --- NEW UNIFIED SABBATH SCHOOL SCREEN ---
import SabbathSchoolScreen from '../screens/SabbathSchoolScreen';

import ZionScreen from '../screens/ZionScreen';
import ThirumaraiOldScreen from '../screens/ThirumaraiOldScreen';
import ThirumaraiHopeScreen from '../screens/ThirumaraiHopeScreen';
import OtherSongsScreen from '../screens/OtherSongsScreen';
import CustomSongsScreen from '../screens/CustomSongsScreen';

import CreateService from '../screens/CreateService';
import JoinService from '../screens/JoinService';
import SavedServices from '../screens/SavedServices';
import ViewService from '../screens/ViewService'; 

export const navigationRef = createNavigationContainerRef();

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator(); 

const linking = {
  prefixes: ['adventisttamil://', 'https://adventisttamil.app'],
  config: {
    screens: {
      JoinService: 'join', 
    },
  },
};

// --- CUSTOM TAB BAR ---
function CustomTabBar({ state, descriptors, navigation, insets }) {
  const { colors, hapticsEnabled, typography, isDark } = useSettings();
  const { width } = useWindowDimensions();
  
  const activeColor = colors.tabActive || (isDark ? '#FFD700' : colors.primary);
  const inactiveColor = colors.tabInactive || (isDark ? colors.primary : '#64748B');
  const tabBg = colors.tabBar || (isDark ? '#0A1929' : '#FFFFFF'); 

  const visibleRoutes = state.routes; 
  const TAB_WIDTH = width / visibleRoutes.length;
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: state.index * TAB_WIDTH,
      useNativeDriver: true,
      friction: 7,    
      tension: 50     
    }).start();
  }, [state.index, TAB_WIDTH]);

  return (
    <View style={{
      flexDirection: 'row',
      backgroundColor: tabBg,
      height: Platform.OS === 'ios' ? 85 : 65 + insets.bottom,
      paddingBottom: Platform.OS === 'ios' ? 20 : (insets.bottom > 0 ? insets.bottom : 8),
      borderTopWidth: 1,
      borderTopColor: colors.border,
      elevation: 15,
      shadowColor: isDark ? '#000' : '#888',
      shadowOffset: { width: 0, height: -3 },
      shadowOpacity: isDark ? 0.3 : 0.08,
      shadowRadius: 5,
    }}>
      
      <Animated.View style={{
        position: 'absolute',
        top: -1, 
        left: (TAB_WIDTH / 2) - 25, 
        width: 50,
        height: 4,
        backgroundColor: activeColor,
        borderBottomLeftRadius: 5,
        borderBottomRightRadius: 5,
        shadowColor: activeColor,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: isDark ? 1 : 0.4,
        shadowRadius: 10,
        elevation: 10,
        transform: [{ translateX: slideAnim }],
      }} />

      {visibleRoutes.map((route, index) => {
        const isFocused = state.index === index;
        
        let iconName;
        if (route.name === 'Songs') iconName = isFocused ? 'musical-notes' : 'musical-notes-outline';
        else if (route.name === 'Bible') iconName = isFocused ? 'book' : 'book-outline';
        else if (route.name === 'Home') iconName = isFocused ? 'home' : 'home-outline';
        else if (route.name === 'Study') iconName = isFocused ? 'library' : 'library-outline';
        else if (route.name === 'Books') iconName = isFocused ? 'albums' : 'albums-outline';

        return (
          <TouchableOpacity
            key={route.key}
            activeOpacity={0.8}
            onPress={() => {
              if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
            }}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 12 }}
          >
            <Ionicons name={iconName} size={isFocused ? 26 : 24} color={isFocused ? activeColor : inactiveColor} />
            <MixedText 
              numberOfLines={1} 
              adjustsFontSizeToFit 
              style={{ color: isFocused ? activeColor : inactiveColor, fontSize: typography.caption.fontSize - 1, fontWeight: isFocused ? 'bold' : '600', marginTop: 5, includeFontPadding: false }}
            >
              {route.name}
            </MixedText>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function TabNavigator() {
  const { colors } = useSettings(); // Bring in your colors here!
  return (
    <Tab.Navigator
      initialRouteName="Home"
      backBehavior="history" 
      safeAreaInsets={{ left: 0, right: 0 }}
      sceneContainerStyle={{ backgroundColor: colors.background }} // Paint the Tab floor!
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Songs" component={SongsScreen} />
      <Tab.Screen name="Bible" component={BibleScreen} />
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Study" component={StudyScreen} />
      <Tab.Screen name="Books" component={BooksScreen} />
    </Tab.Navigator>
  );
}

export default function MainNavigation() {
  const { colors, isDark } = useSettings(); 

  // Overriding the global React Navigation theme to match app theme
  const navTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: colors.background,
      card: colors.card,
      text: colors.text,
      border: colors.border,
      primary: colors.primary,
    },
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <NavigationContainer ref={navigationRef} linking={linking} theme={navTheme}>
         <Stack.Navigator screenOptions={{ 
             headerShown: false, 
             contentStyle: { backgroundColor: colors.background }, 
             animation: 'slide_from_right' 
         }}>
          
          <Stack.Screen name="MainTabs" component={TabNavigator} />

        <Stack.Screen name="EGWBooksList" component={EGWBooksListScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="TodaysManna" component={TodaysMannaScreen} />
        <Stack.Screen name="About" component={AboutScreen} />
        <Stack.Screen name="Magazine" component={MagazineScreen} />
        <Stack.Screen name="Dictionary" component={DictionaryScreen} />
        <Stack.Screen name="Concordance" component={ConcordanceScreen} />
        <Stack.Screen name="StudyExplanations" component={StudyExplanationsScreen} />
        
        {/* --- NEW UNIFIED SABBATH SCHOOL SCREEN --- */}
        <Stack.Screen name="SabbathSchool" component={SabbathSchoolScreen} />

        <Stack.Screen name="ZionSongs" component={ZionScreen} />
        <Stack.Screen name="ThirumaraiOld" component={ThirumaraiOldScreen} />
        <Stack.Screen name="ThirumaraiHope" component={ThirumaraiHopeScreen} />
        <Stack.Screen name="OtherSongs" component={OtherSongsScreen} />
        <Stack.Screen name="CustomSongs" component={CustomSongsScreen} />

        <Stack.Screen name="CreateService" component={CreateService} />
        <Stack.Screen name="JoinService" component={JoinService} />
        <Stack.Screen name="SavedServices" component={SavedServices} />
        <Stack.Screen name="ViewService" component={ViewService} />

      </Stack.Navigator>
    </NavigationContainer>
    </View>
  );
}
