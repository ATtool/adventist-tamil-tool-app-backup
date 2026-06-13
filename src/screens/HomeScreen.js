import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing, Dimensions, TextInput, KeyboardAvoidingView, Platform, FlatList, Modal, Image, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSettings } from '../context/SettingsContext';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';

const { width, height } = Dimensions.get('window');

const COUNTRIES = [
  { name: 'India', flag: '🇮🇳' }, { name: 'Australia', flag: '🇦🇺' }, { name: 'Canada', flag: '🇨🇦' }, 
  { name: 'France', flag: '🇫🇷' }, { name: 'Germany', flag: '🇩🇪' }, { name: 'Malaysia', flag: '🇲🇾' },
  { name: 'Singapore', flag: '🇸🇬' }, { name: 'Sri Lanka', flag: '🇱🇰' }, { name: 'United Arab Emirates', flag: '🇦🇪' },
  { name: 'United Kingdom', flag: '🇬🇧' }, { name: 'United States', flag: '🇺🇸' }
];

export default function HomeScreen() {
  const navigation = useNavigation();
  const { isDark, colors, appFontSize, hapticsEnabled } = useSettings();
  
  const [isChecking, setIsChecking] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false); 
  
  const [greeting, setGreeting] = useState('');
  const [userName, setUserName] = useState('');
  const [currentDateStr, setCurrentDateStr] = useState('');
  
  const [tempName, setTempName] = useState('');
  const [tempCountry, setTempCountry] = useState({ name: 'India', flag: '🇮🇳' });

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const menuSlideAnim = useRef(new Animated.Value(width)).current; 

  useEffect(() => {
    checkUserData();
    setGreetingTime();
    
    const date = new Date();
    setCurrentDateStr(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
  }, []);

  useEffect(() => {
    Animated.timing(menuSlideAnim, {
      toValue: isMenuOpen ? 0 : width, 
      duration: 300,
      useNativeDriver: true,
      easing: Easing.out(Easing.ease)
    }).start();
  }, [isMenuOpen]);

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
      startHomeAnimations();
    } catch (error) { console.warn(error); }
  };

  const isTamilText = (text) => /[\u0B80-\u0BFF]/.test(text);

  const navigateFromMenu = (screenName) => {
    if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsMenuOpen(false);
    setTimeout(() => { navigation.navigate(screenName); }, 200);
  };

  const openSabbathSchoolLink = async () => {
    if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await WebBrowser.openBrowserAsync('https://share.google/eCOZ36uegDz6DFCBq');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        
        <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text style={[styles.greeting, { color: colors.subtext, fontSize: appFontSize }]}>
                {greeting}{userName ? ', ' : ''}
                {userName && (
                  <Text style={{ color: colors.primary, fontFamily: isTamilText(userName) ? 'Tamil003' : undefined, fontSize: isTamilText(userName) ? appFontSize + 4 : appFontSize }}>
                    {userName}
                  </Text>
                )}
              </Text>
              <Text style={[styles.title, { color: colors.text, fontSize: appFontSize }]}>
                Welcome to Adventist Tamil Tool
              </Text>
            </View>
            <TouchableOpacity onPress={() => { if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setIsMenuOpen(true); }}>
              <Ionicons name="menu" size={32} color={colors.text} />
            </TouchableOpacity>
          </View>
        </Animated.View>

        <Animated.ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

          <TouchableOpacity 
            style={[styles.mannaCard, { backgroundColor: colors.card, borderColor: colors.border, marginBottom: 20 }]} 
            onPress={() => navigation.navigate('TodaysManna')}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={[styles.iconContainerSmall, { backgroundColor: 'rgba(255, 159, 10, 0.1)' }]}>
                <Ionicons name="sunny" size={24} color="#FF9F0A" />
              </View>
              <View style={{ marginLeft: 15 }}>
                <Text style={{ color: colors.text, fontSize: appFontSize + 2, fontWeight: 'bold' }}>Today's Manna</Text>
                <Text style={{ color: colors.subtext, fontSize: appFontSize - 2, marginTop: 2 }}>
                  {/* SIZE BOOST HERE */}
                  <Text style={{ fontFamily: 'Tamil003', fontSize: appFontSize + 1 }}>இன்றைய மன்னா</Text> • {currentDateStr}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.subtext} />
          </TouchableOpacity>

          <View style={styles.grid}>
            {/* SIZE BOOST ON ALL FOUR CARDS */}
            <TouchableOpacity style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={openSabbathSchoolLink}>
              <View style={[styles.iconContainer, { backgroundColor: 'rgba(48, 209, 88, 0.1)' }]}><Ionicons name="library" size={32} color="#30D158" /></View>
              <Text style={[styles.cardTitle, { color: colors.text, fontSize: appFontSize + 2 }]}>Sabbath School</Text>
              <Text style={[styles.cardSub, { color: colors.subtext, fontSize: appFontSize, fontFamily: 'Tamil003' }]}>ஓய்வுநாள் பள்ளி பாடம்</Text>
            </TouchableOpacity>

            

            <TouchableOpacity style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => navigation.navigate('Magazine')}>
              <View style={[styles.iconContainer, { backgroundColor: 'rgba(191, 90, 242, 0.1)' }]}><Ionicons name="newspaper" size={32} color="#BF5AF2" /></View>
              <Text style={[styles.cardTitle, { color: colors.text, fontSize: appFontSize + 2 }]}>Monthly Magazine</Text>
              <Text style={[styles.cardSub, { color: colors.subtext, fontSize: appFontSize, fontFamily: 'Tamil003' }]}>மாதாந்திர இதழ்</Text>
            </TouchableOpacity>
          </View>
        </Animated.ScrollView>
      </SafeAreaView>

      <Modal visible={isMenuOpen} transparent animationType="none" onRequestClose={() => setIsMenuOpen(false)}>
        <View style={{ flex: 1, flexDirection: 'row' }}>
          
          <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={() => setIsMenuOpen(false)} />
          
          <Animated.View style={[styles.drawerMenu, { backgroundColor: isDark ? '#0A1929' : '#FFFFFF', transform: [{ translateX: menuSlideAnim }] }]}>
            <SafeAreaView edges={['top']} style={{ flex: 1 }}>
              <View style={styles.drawerHeader}>
                <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.primary }}>Menu</Text>
                <TouchableOpacity onPress={() => setIsMenuOpen(false)}>
                  <Ionicons name="close" size={28} color={colors.text} />
                </TouchableOpacity>
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
              </ScrollView>
            </SafeAreaView>
          </Animated.View>
        </View>
      </Modal>

      {/* ✅ ONBOARDING MODAL — renders above the entire nav stack (including tab bar).
          visible during first-launch check AND during the name/country setup form.
          onRequestClose is a no-op so the Android back button cannot dismiss it. */}
      <Modal
        visible={isChecking || showOnboarding}
        animationType="none"
        statusBarTranslucent={true}
        onRequestClose={() => {}}
      >
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
          {/* Show nothing while checking (brief blank) — form appears once we know onboarding is needed */}
          {showOnboarding && (
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.onboardingContainer}>
              <View style={styles.onboardingHeader}>
                <View style={[styles.iconContainerBig, { backgroundColor: 'transparent' }]}>
                  <Image source={require('../../assets/icon.png')} style={{ width: 100, height: 100, borderRadius: 25 }} resizeMode="cover" />
                </View>
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

          {/* Country Picker — nested inside the onboarding Modal (works fine on both platforms) */}
          <Modal visible={showCountryPicker} animationType="slide" transparent={true}>
            <View style={styles.modalOverlay}>
              <View style={[styles.countrySheet, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
                  <Text style={{ color: colors.text, fontSize: 18, fontWeight: 'bold' }}>Select Country</Text>
                  <TouchableOpacity onPress={() => setShowCountryPicker(false)}><Ionicons name="close-circle" size={28} color={colors.subtext} /></TouchableOpacity>
                </View>
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
  scrollContent: { padding: 15, paddingBottom: 100 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  card: { width: (width - 45) / 2, padding: 20, borderRadius: 24, borderWidth: 1, marginBottom: 15, alignItems: 'center' },
  iconContainer: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  iconContainerSmall: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  cardTitle: { fontWeight: 'bold', marginBottom: 5, textAlign: 'center' },
  cardSub: { fontWeight: '500', textAlign: 'center' },
  verseCard: { padding: 25, borderRadius: 24, borderWidth: 1 },
  verseHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  verseTitle: { fontWeight: 'bold', letterSpacing: 1 },
  verseText: { fontStyle: 'italic', marginBottom: 15 },
  verseRef: { fontWeight: 'bold', textAlign: 'right' },
  mannaCard: { padding: 20, borderRadius: 20, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
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
  countryItem: { flexDirection: 'row', alignItems: 'center', padding: 18, borderBottomWidth: 1, paddingHorizontal: 20 }
});
