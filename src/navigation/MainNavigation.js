import React from 'react';
import { View, Text, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
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

// --- HIDDEN SCREENS ---
import EGWBooksListScreen from '../screens/EGWBooksListScreen';
import SettingsScreen from '../screens/SettingsScreen';
import TodaysMannaScreen from '../screens/TodaysMannaScreen';
import AboutScreen from '../screens/AboutScreen';
import MagazineScreen from '../screens/MagazineScreen';
import DictionaryScreen from '../screens/DictionaryScreen';
import ConcordanceScreen from '../screens/ConcordanceScreen';
import StudyExplanationsScreen from '../screens/StudyExplanationsScreen'; // NEW!

// --- NEW SONG SCREENS ---
import ZionScreen from '../screens/ZionScreen';
import ThirumaraiOldScreen from '../screens/ThirumaraiOldScreen';
import ThirumaraiHopeScreen from '../screens/ThirumaraiHopeScreen';
import OtherSongsScreen from '../screens/OtherSongsScreen';

function DummyScreen({ route }) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#05070A' }}>
      <Text style={{ color: 'white', fontSize: 20 }}>{route.name} Coming Soon</Text>
    </View>
  );
}

const Tab = createBottomTabNavigator();

export default function MainNavigation() {
  const { colors, isDark, hapticsEnabled } = useSettings();
  const insets = useSafeAreaInsets();

  const triggerTabHaptic = () => {
    if (hapticsEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  return (
    <NavigationContainer>
       <Tab.Navigator
        initialRouteName="Home"
        backBehavior="history" 
        safeAreaInsets={{ left: 0, right: 0 }}
        screenOptions={({ route }) => ({
          tabBarIcon: ({ color }) => {
            const ICON_SIZE = 24;
            if (route.name === 'Songs') return <Ionicons name="musical-notes" size={ICON_SIZE} color={color} />;
            if (route.name === 'Bible') return <Ionicons name="book" size={ICON_SIZE} color={color} />;
            if (route.name === 'Home') return <Ionicons name="home" size={ICON_SIZE} color={color} />;
            if (route.name === 'Study') return <Ionicons name="library" size={ICON_SIZE} color={color} />;
            if (route.name === 'Books') return <Ionicons name="albums" size={ICON_SIZE} color={color} />;
            return null;
          },
          tabBarStyle: {
            backgroundColor: '#0A1929',
            borderTopWidth: 1,
            borderTopColor: colors.border,
            height: Platform.OS === 'ios' ? 85 : 65 + insets.bottom,
            paddingTop: 6,
            paddingBottom: Platform.OS === 'ios' ? 20 : (insets.bottom > 0 ? insets.bottom : 8),
            width: '100%',
            elevation: 0,
          },
          tabBarLabelPosition: 'below-icon',
          tabBarShowLabel: true,
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: '700',
            marginTop: 4,
            marginBottom: 0,
            overflow: 'visible',
            width: '100%',
            textAlign: 'center',
          },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: isDark ? '#8E94A3' : '#6B6358',
          headerShown: false,
        })}
      >
        <Tab.Screen name="Songs" component={SongsScreen} listeners={{ tabPress: triggerTabHaptic }} />
        <Tab.Screen name="Bible" component={BibleScreen} listeners={{ tabPress: triggerTabHaptic }} />
        <Tab.Screen name="Home" component={HomeScreen} listeners={{ tabPress: triggerTabHaptic }} />
        <Tab.Screen name="Study" component={StudyScreen} listeners={{ tabPress: triggerTabHaptic }} />
        <Tab.Screen name="Books" component={BooksScreen} listeners={{ tabPress: triggerTabHaptic }} />

        {/* --- HIDDEN SCREENS --- */}
        <Tab.Screen name="EGWBooksList" component={EGWBooksListScreen} options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }} />
        <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }} />
        <Tab.Screen name="TodaysManna" component={TodaysMannaScreen} options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }} />
        <Tab.Screen name="About" component={AboutScreen} options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }} />
        <Tab.Screen name="Magazine" component={MagazineScreen} options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }} />
        <Tab.Screen name="Dictionary" component={DictionaryScreen} options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }} />
        <Tab.Screen name="Concordance" component={ConcordanceScreen} options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }} />
        
        {/* NEW! The Study Explanations Screen */}
        <Tab.Screen name="StudyExplanations" component={StudyExplanationsScreen} options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }} />
        
        {/* --- NEW SONG SCREENS --- */}
        <Tab.Screen name="ZionSongs" component={ZionScreen} options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }} />
        <Tab.Screen name="ThirumaraiOld" component={ThirumaraiOldScreen} options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }} />
        <Tab.Screen name="ThirumaraiHope" component={ThirumaraiHopeScreen} options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }} />
        <Tab.Screen name="OtherSongs" component={OtherSongsScreen} options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }} />

      </Tab.Navigator>
    </NavigationContainer>
  );
}
