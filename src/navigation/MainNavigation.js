import React, { useRef, useEffect } from 'react';
import { View, Text, Platform, TouchableOpacity, Animated, useWindowDimensions } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSettings } from '../context/SettingsContext';
import * as Linking from 'expo-linking'; // <--- NEW IMPORT FOR DEEP LINKING

// --- MAIN TABS ---
import HomeScreen from '../screens/HomeScreen';
import BibleScreen from '../screens/BibleScreen';
import SongsScreen from '../screens/SongsScreen';
import BooksScreen from '../screens/BooksScreen';
import StudyScreen from '../screens/StudyScreen'; 

// --- HIDDEN SCREENS ---
import EGWBooksListScreen from '../screens/EGWBooksListScreen';
import SettingsScreen from '../screens/SettingsScreen';
import TodaysMannaScreen from '../screens/TodaysMannaScreen';
import AboutScreen from '../screens/AboutScreen';
import MagazineScreen from '../screens/MagazineScreen';
import DictionaryScreen from '../screens/DictionaryScreen';
import ConcordanceScreen from '../screens/ConcordanceScreen';
import StudyExplanationsScreen from '../screens/StudyExplanationsScreen'; 

// --- NEW SONG SCREENS ---
import ZionScreen from '../screens/ZionScreen';
import ThirumaraiOldScreen from '../screens/ThirumaraiOldScreen';
import ThirumaraiHopeScreen from '../screens/ThirumaraiHopeScreen';
import OtherSongsScreen from '../screens/OtherSongsScreen';

// --- FELLOWSHIP / MEETING SCREENS ---
import CreateService from '../screens/CreateService';
import JoinService from '../screens/JoinService';
import SavedServices from '../screens/SavedServices';
import ViewService from '../screens/ViewService'; 

const Tab = createBottomTabNavigator();

// ==============================================================
// 🌟 DEEP LINKING CONFIGURATION
// ==============================================================
const linking = {
  prefixes: ['adventisttamil://', 'https://adventisttamil.app'],
  config: {
    screens: {
      // Maps adventisttamil://join?data=... to the JoinService screen
      JoinService: 'join', 
    },
  },
};

// ==============================================================
// 🌟 CUSTOM PREMIUM TAB BAR WITH MOVING GLOW
// ==============================================================
function CustomTabBar({ state, descriptors, navigation, insets }) {
  const { colors, hapticsEnabled } = useSettings();
  const { width } = useWindowDimensions();
  
  const PRIME_YELLOW = '#FFD700';
  const TAB_BG = '#0A1929'; 
  const NEON_BLUE = colors.primary; 

  const getActiveMainTab = (routeName) => {
    const parentMap = {
      ZionSongs: 'Songs',
      ThirumaraiOld: 'Songs',
      ThirumaraiHope: 'Songs',
      OtherSongs: 'Songs',
      Dictionary: 'Study',
      Concordance: 'Study',
      StudyExplanations: 'Study',
      EGWBooksList: 'Books',
      Settings: 'Home',
      TodaysManna: 'Home',
      About: 'Home',
      Magazine: 'Home',
      CreateService: 'Home',
      JoinService: 'Home',
      SavedServices: 'Home',
      ViewService: 'Home',
    };
    return parentMap[routeName] || routeName;
  };

  const visibleRoutes = state.routes.filter(r => {
    const { options } = descriptors[r.key];
    return options.tabBarItemStyle?.display !== 'none';
  });

  const TAB_WIDTH = width / visibleRoutes.length;
  const currentRouteName = state.routes[state.index].name;
  const activeMainTabName = getActiveMainTab(currentRouteName);
  const activeVisibleIndex = visibleRoutes.findIndex(r => r.name === activeMainTabName);
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (activeVisibleIndex >= 0) {
      Animated.spring(slideAnim, {
        toValue: activeVisibleIndex * TAB_WIDTH,
        useNativeDriver: true,
        friction: 7,    
        tension: 50     
      }).start();
    }
  }, [activeVisibleIndex, TAB_WIDTH]);

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
        opacity: activeVisibleIndex >= 0 ? 1 : 0, 
      }} />

      {visibleRoutes.map((route, index) => {
        const isFocused = activeVisibleIndex === index;
        
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
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
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

// ==============================================================
// MAIN NAVIGATION WRAPPER
// ==============================================================
export default function MainNavigation() {
  return (
    // We add the linking configuration here!
    <NavigationContainer linking={linking}>
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

        {/* --- HIDDEN SCREENS --- */}
        <Tab.Screen name="EGWBooksList" component={EGWBooksListScreen} options={{ tabBarItemStyle: { display: 'none' } }} />
        <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarItemStyle: { display: 'none' } }} />
        <Tab.Screen name="TodaysManna" component={TodaysMannaScreen} options={{ tabBarItemStyle: { display: 'none' } }} />
        <Tab.Screen name="About" component={AboutScreen} options={{ tabBarItemStyle: { display: 'none' } }} />
        <Tab.Screen name="Magazine" component={MagazineScreen} options={{ tabBarItemStyle: { display: 'none' } }} />
        <Tab.Screen name="Dictionary" component={DictionaryScreen} options={{ tabBarItemStyle: { display: 'none' } }} />
        <Tab.Screen name="Concordance" component={ConcordanceScreen} options={{ tabBarItemStyle: { display: 'none' } }} />
        <Tab.Screen name="StudyExplanations" component={StudyExplanationsScreen} options={{ tabBarItemStyle: { display: 'none' } }} />
        
        {/* --- NEW SONG SCREENS --- */}
        <Tab.Screen name="ZionSongs" component={ZionScreen} options={{ tabBarItemStyle: { display: 'none' } }} />
        <Tab.Screen name="ThirumaraiOld" component={ThirumaraiOldScreen} options={{ tabBarItemStyle: { display: 'none' } }} />
        <Tab.Screen name="ThirumaraiHope" component={ThirumaraiHopeScreen} options={{ tabBarItemStyle: { display: 'none' } }} />
        <Tab.Screen name="OtherSongs" component={OtherSongsScreen} options={{ tabBarItemStyle: { display: 'none' } }} />

        {/* --- FELLOWSHIP / MEETING SCREENS --- */}
        <Tab.Screen name="CreateService" component={CreateService} options={{ tabBarItemStyle: { display: 'none' } }} />
        <Tab.Screen name="JoinService" component={JoinService} options={{ tabBarItemStyle: { display: 'none' } }} />
        <Tab.Screen name="SavedServices" component={SavedServices} options={{ tabBarItemStyle: { display: 'none' } }} />
        <Tab.Screen name="ViewService" component={ViewService} options={{ tabBarItemStyle: { display: 'none' } }} />

      </Tab.Navigator>
    </NavigationContainer>
  );
}
