import React, { useRef, useEffect } from 'react';
import { View, Text, Platform, TouchableOpacity, Animated, useWindowDimensions } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack'; // <-- Native-optimized stack
import { NavigationContainer } from '@react-navigation/native';
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

// --- STACK SCREENS (Cleanly unmounted when not in use) ---
import EGWBooksListScreen from '../screens/EGWBooksListScreen';
import SettingsScreen from '../screens/SettingsScreen';
import TodaysMannaScreen from '../screens/TodaysMannaScreen';
import AboutScreen from '../screens/AboutScreen';
import MagazineScreen from '../screens/MagazineScreen';
import DictionaryScreen from '../screens/DictionaryScreen';
import ConcordanceScreen from '../screens/ConcordanceScreen';
import StudyExplanationsScreen from '../screens/StudyExplanationsScreen'; 

import ZionScreen from '../screens/ZionScreen';
import ThirumaraiOldScreen from '../screens/ThirumaraiOldScreen';
import ThirumaraiHopeScreen from '../screens/ThirumaraiHopeScreen';
import OtherSongsScreen from '../screens/OtherSongsScreen';
import CustomSongsScreen from '../screens/CustomSongsScreen';

import CreateService from '../screens/CreateService';
import JoinService from '../screens/JoinService';
import SavedServices from '../screens/SavedServices';
import ViewService from '../screens/ViewService'; 

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator(); // The high-performance bookshelf coordinator

// Deep linking remains fully active and maps directly to the Stack layout
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
  const { colors, hapticsEnabled } = useSettings();
  const { width } = useWindowDimensions();
  
  const PRIME_YELLOW = '#FFD700';
  const TAB_BG = '#0A1929'; 
  const NEON_BLUE = colors.primary; 

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
      backgroundColor: TAB_BG,
      height: Platform.OS === 'ios' ? 85 : 65 + insets.bottom,
      paddingBottom: Platform.OS === 'ios' ? 20 : (insets.bottom > 0 ? insets.bottom : 8),
      borderTopWidth: 1,
      borderTopColor: colors.border,
      elevation: 15,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -5 },
      shadowOpacity: 0.3,
      shadowRadius: 5,
    }}>
      
      <Animated.View style={{
        position: 'absolute',
        top: -1, 
        left: (TAB_WIDTH / 2) - 25, 
        width: 50,
        height: 4,
        backgroundColor: PRIME_YELLOW,
        borderBottomLeftRadius: 5,
        borderBottomRightRadius: 5,
        shadowColor: PRIME_YELLOW,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 1,
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
            <Ionicons name={iconName} size={isFocused ? 26 : 24} color={isFocused ? PRIME_YELLOW : NEON_BLUE} />
            <Text style={{ color: isFocused ? PRIME_YELLOW : NEON_BLUE, fontSize: 10, fontWeight: isFocused ? 'bold' : '600', marginTop: 5 }}>
              {route.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// Sub-Navigator containing only your 5 core bottom tabs
function TabNavigator() {
  return (
    <Tab.Navigator
      initialRouteName="Home"
      backBehavior="history" 
      safeAreaInsets={{ left: 0, right: 0 }}
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

// Master Navigation Component
export default function MainNavigation() {
  return (
    <NavigationContainer linking={linking}>
       <Stack.Navigator screenOptions={{ headerShown: false }}>
        
        {/* The persistent bottom tabs are the root layer */}
        <Stack.Screen name="MainTabs" component={TabNavigator} />

        {/* Detailed screens are layered on top sequentially and automatically unmounted */}
        <Stack.Screen name="EGWBooksList" component={EGWBooksListScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="TodaysManna" component={TodaysMannaScreen} />
        <Stack.Screen name="About" component={AboutScreen} />
        <Stack.Screen name="Magazine" component={MagazineScreen} />
        <Stack.Screen name="Dictionary" component={DictionaryScreen} />
        <Stack.Screen name="Concordance" component={ConcordanceScreen} />
        <Stack.Screen name="StudyExplanations" component={StudyExplanationsScreen} />
        
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
  );
}
