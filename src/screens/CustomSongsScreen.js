import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, Modal, ScrollView, Keyboard, Share, Animated, BackHandler, Dimensions, Platform, KeyboardAvoidingView, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import * as SQLite from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useSettings } from '../context/SettingsContext';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

// Database Functions
import { getCustomSongs, addCustomSong, updateCustomSong, deleteCustomSong } from '../utils/UserDataDB';

const { height } = Dimensions.get('window');
const BRIGHT_YELLOW = '#FFD700';

const ScalePressable = ({ children, onPress, style, scaleTo = 0.90 }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const handlePressIn = () => Animated.spring(scale, { toValue: scaleTo, useNativeDriver: true, friction: 5 }).start();
  const handlePressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 5 }).start();
  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <TouchableOpacity onPressIn={handlePressIn} onPressOut={handlePressOut} onPress={onPress} activeOpacity={0.8} delayPressIn={50}>
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
};

const AnimatedHeart = ({ isFavorite, onPress, inactiveColor, activeColor, size = 26 }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const handlePress = () => {
    onPress();
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.4, duration: 150, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true })
    ]).start();
  };
  return (
    <TouchableOpacity onPress={handlePress} style={{ padding: 6 }}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Ionicons name={isFavorite ? "heart" : "heart-outline"} size={size} color={isFavorite ? activeColor : inactiveColor} />
      </Animated.View>
    </TouchableOpacity>
  );
};

export default function CustomSongsScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { colors, isDark, appFontSize, hapticsEnabled, titleSize, setTitleSize, titleSpacing, setTitleSpacing, lyricsSize, setLyricsSize, lyricsSpacing, setLyricsSpacing, lyricsLineHeight, setLyricsLineHeight, restoreDefaultTextSettings } = useSettings();
  
  // State for Data
  const [songs, setSongs] = useState([]);
  const [search, setSearch] = useState('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [favorites, setFavorites] = useState(new Set());
  const [sortOrder, setSortOrder] = useState('number'); 
  const [showSortMenu, setShowSortMenu] = useState(false);

  // State for Views
  const [activeSong, setActiveSong] = useState(null);
  const [isFormVisible, setIsFormVisible] = useState(false);
  
  // State for Settings Modal
  const [showTextSettings, setShowTextSettings] = useState(false);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  
  // Form State
  const [editingId, setEditingId] = useState(null);
  const [formTamil, setFormTamil] = useState('');
  const [formThanglish, setFormThanglish] = useState('');
  const [formLyrics, setFormLyrics] = useState('');

  // Animations
  const headerSlide = useRef(new Animated.Value(-50)).current;
  const listAnim = useRef(new Animated.Value(0)).current;
  const settingsSlideAnim = useRef(new Animated.Value(height)).current;
  const settingsFadeAnim = useRef(new Animated.Value(0)).current;

  const triggerHaptic = useCallback((style = Haptics.ImpactFeedbackStyle.Medium) => { 
    if (hapticsEnabled) Haptics.impactAsync(style); 
  }, [hapticsEnabled]);

  // Load Animation
  useFocusEffect(
    useCallback(() => {
      headerSlide.setValue(-50);
      listAnim.setValue(0);
      Animated.parallel([
        Animated.timing(headerSlide, { toValue: 0, duration: 400, useNativeDriver: true }),
        Animated.timing(listAnim, { toValue: 1, duration: 500, useNativeDriver: true })
      ]).start();
      loadSongs();
      loadFavorites();
    }, [])
  );

  useEffect(() => {
    if (activeSong !== null) activateKeepAwakeAsync(); else deactivateKeepAwake();
  }, [activeSong]);

  // Handle Settings Modal Animations
  useEffect(() => {
    if (showTextSettings) {
      setSettingsModalVisible(true);
      Animated.parallel([
        Animated.spring(settingsSlideAnim, { toValue: 0, friction: 9, tension: 65, useNativeDriver: true }),
        Animated.timing(settingsFadeAnim, { toValue: 1, duration: 200, useNativeDriver: true })
      ]).start();
    } else if (settingsModalVisible) {
      Animated.parallel([
        Animated.timing(settingsSlideAnim, { toValue: height, duration: 250, useNativeDriver: true }),
        Animated.timing(settingsFadeAnim, { toValue: 0, duration: 250, useNativeDriver: true })
      ]).start(() => setSettingsModalVisible(false));
    }
  }, [showTextSettings]);

  // Data Fetching
  const loadSongs = () => {
    const fetchedSongs = getCustomSongs();
    setSongs(fetchedSongs || []);
  };

  const loadFavorites = async () => {
    try {
      const stored = await AsyncStorage.getItem('@custom_songs_favs');
      if (stored) setFavorites(new Set(JSON.parse(stored)));
    } catch(e) { console.warn("Fav load error", e); }
  };

  const toggleFavorite = useCallback(async (songId) => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    setFavorites(prev => {
      const newFavs = new Set(prev);
      if (newFavs.has(songId)) newFavs.delete(songId); else newFavs.add(songId);
      AsyncStorage.setItem('@custom_songs_favs', JSON.stringify([...newFavs])).catch(e => console.warn(e));
      return newFavs;
    });
  }, [triggerHaptic]);

  // Filters & Sorting
  const filteredSongs = useMemo(() => {
    let filtered = songs.filter(song => {
      if (showFavoritesOnly && !favorites.has(song.id)) return false;
      if (search === '') return true;
      const term = search.toLowerCase().trim();
      const searchTamil = (song.title_tamil || '').toLowerCase();
      const searchThanglish = (song.title_thanglish || '').toLowerCase();
      const songNum = song.id.toString();
      return (songNum.includes(term)) || (searchTamil.includes(term)) || (searchThanglish.includes(term));
    });

    if (sortOrder === 'alpha') {
      filtered.sort((a, b) => (a.title_tamil || '').localeCompare(b.title_tamil || ''));
    } else {
      filtered.sort((a, b) => a.id - b.id);
    }
    return filtered;
  }, [songs, search, showFavoritesOnly, sortOrder, favorites]);

  // Actions
  const handleShare = async (song) => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    try { await Share.share({ message: `${song.id} - ${song.title_tamil}\n\n${song.lyrics}\n\n~ Shared from Adventist Tamil Tool` }); } catch (error) { console.log(error.message); }
  };

  const clearAllFilters = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    setSearch('');
    setShowFavoritesOnly(false);
    setSortOrder('number');
  };

  const hasFiltersActive = search !== '' || showFavoritesOnly || sortOrder !== 'number';

  // --- FORM MECHANICS (ADD & EDIT) ---
  const openAddForm = () => {
    triggerHaptic();
    setEditingId(null);
    setFormTamil('');
    setFormThanglish('');
    setFormLyrics('');
    setIsFormVisible(true);
  };

  const openEditForm = () => {
    triggerHaptic();
    setEditingId(activeSong.id);
    setFormTamil(activeSong.title_tamil);
    setFormThanglish(activeSong.title_thanglish || '');
    setFormLyrics(activeSong.lyrics);
    setActiveSong(null);
    setIsFormVisible(true);
  };

  const saveSong = () => {
    if (!formTamil.trim() || !formLyrics.trim()) {
      Alert.alert("Missing Info", "Please provide at least a Tamil Name and Lyrics.");
      return;
    }

    // --- NEW SANITIZATION LOGIC ---
    // This looks for en-dashes (–) and em-dashes (—) and replaces them with a standard hyphen (-)
    const cleanTamil = formTamil.replace(/[–—]/g, '-');
    const cleanThanglish = formThanglish.replace(/[–—]/g, '-');
    const cleanLyrics = formLyrics.replace(/[–—]/g, '-');

    if (editingId) {
      updateCustomSong(editingId, cleanTamil, cleanThanglish, cleanLyrics);
    } else {
      addCustomSong(cleanTamil, cleanThanglish, cleanLyrics);
    }
    
    triggerHaptic(Haptics.ImpactFeedbackStyle.Success);
    setIsFormVisible(false);
    loadSongs();
  };

  const confirmDelete = () => {
    Alert.alert(
      "Delete Song?",
      "Are you sure you want to permanently delete this song?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => {
            deleteCustomSong(activeSong.id);
            triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
            setActiveSong(null);
            loadSongs();
          } 
        }
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient colors={isDark ? ['#0A1929', colors.background] : ['#FFFFFF', colors.background]} style={StyleSheet.absoluteFillObject} />

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        
        {/* HEADER AREA */}
        <Animated.View style={[styles.headerWrapper, { transform: [{ translateY: headerSlide }] }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <ScalePressable onPress={() => { triggerHaptic(); navigation.navigate('Songs'); }} style={{ marginRight: 10 }}>
              <View style={{ height: 50, width: 50, borderRadius: 25, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="chevron-back" size={28} color={colors.primary} />
              </View>
            </ScalePressable>

            <View style={[styles.searchPill, { flex: 1, backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="search" size={20} color={colors.subtext} style={{ marginRight: 8 }} />
              <TextInput 
                style={[styles.searchInput, { color: colors.text, fontSize: appFontSize }]} 
                placeholder="Search Title or Num..." 
                placeholderTextColor={colors.subtext} 
                value={search} 
                onChangeText={setSearch} 
                autoCorrect={false} 
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')} style={{ paddingHorizontal: 5 }}>
                  <Ionicons name="close-circle" size={20} color={colors.subtext} />
                </TouchableOpacity>
              )}
            </View>

            {/* ADD BUTTON - Now using Neon Blue (primary) */}
            <ScalePressable onPress={openAddForm} style={{ marginLeft: 10 }}>
              <View style={{ height: 50, width: 50, borderRadius: 25, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5 }}>
                <Ionicons name="add" size={32} color={isDark ? '#000000' : '#FFFFFF'} />
              </View>
            </ScalePressable>
          </View>

          {/* FILTER CHIPS */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipsRow}>
            {hasFiltersActive && (
              <ScalePressable onPress={clearAllFilters} style={{ marginRight: 8 }}>
                <View style={[styles.chipBtn, { borderColor: '#FF3B30', backgroundColor: 'rgba(255,59,48,0.1)' }]}>
                  <Ionicons name="close" size={14} color="#FF3B30" />
                  <Text style={{ color: "#FF3B30", marginLeft: 4, fontSize: appFontSize - 2, fontWeight: 'bold' }}>Clear All</Text>
                </View>
              </ScalePressable>
            )}

            <ScalePressable onPress={() => { triggerHaptic(); setShowSortMenu(true); Keyboard.dismiss(); }} style={{ marginRight: 8 }}>
              <View style={[styles.chipBtn, { borderColor: colors.border, backgroundColor: colors.card }]}>
                <MaterialCommunityIcons name={sortOrder === 'number' ? "sort-numeric-ascending" : "sort-alphabetical-ascending"} size={16} color={colors.text} />
                <Text style={{ color: colors.text, marginLeft: 6, fontSize: appFontSize - 2, fontWeight: 'bold' }}>Sort</Text>
              </View>
            </ScalePressable>

            <ScalePressable onPress={() => { triggerHaptic(); setShowFavoritesOnly(!showFavoritesOnly); }} style={{ marginRight: 8 }}>
              <View style={[styles.chipBtn, { borderColor: colors.border, backgroundColor: showFavoritesOnly ? 'rgba(255,0,0,0.1)' : colors.card }]}>
                <Ionicons name={showFavoritesOnly ? "heart" : "heart-outline"} size={14} color={showFavoritesOnly ? "red" : colors.text} />
                <Text style={{ color: showFavoritesOnly ? "red" : colors.text, marginLeft: 6, fontSize: appFontSize - 2, fontWeight: 'bold' }}>Favorites</Text>
              </View>
            </ScalePressable>
          </ScrollView>
        </Animated.View>

        {/* LIST AREA */}
        <FlatList 
          data={filteredSongs} 
          keyExtractor={(item) => item.id.toString()} 
          contentContainerStyle={{ paddingHorizontal: 15, paddingBottom: 100, paddingTop: 10 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          ListEmptyComponent={
            <View style={{ alignItems: 'center', justifyContent: 'center', marginTop: 100 }}>
               <Ionicons name="musical-notes-outline" size={60} color={colors.primary} />
               <Text style={{ color: colors.subtext, fontSize: appFontSize, marginTop: 15, textAlign: 'center', paddingHorizontal: 20 }}>
                 You haven't added any custom songs yet. Click the + icon above to write your first song!
               </Text>
            </View>
          }
          renderItem={({ item }) => (
            <ScalePressable onPress={() => { triggerHaptic(Haptics.ImpactFeedbackStyle.Light); Keyboard.dismiss(); setActiveSong(item); }}>
              <View style={[styles.songCard, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: isDark ? 'transparent' : '#ccc', elevation: isDark ? 0 : 2 }]}>
                {/* Number Circle - Now using Neon Blue (primary) */}
                <View style={[styles.numberCircle, { borderColor: colors.primary, backgroundColor: colors.glow }]}>
                  <Text style={{ color: colors.primary, fontWeight: '900', fontSize: appFontSize }}>{item.id}</Text>
                </View>
                <View style={styles.titleContainer}>
                  <Text style={[styles.songTitle, { color: colors.text, fontFamily: 'Tamil008', fontSize: appFontSize + 2 }]} numberOfLines={1}>{item.title_tamil}</Text>
                  {item.title_thanglish ? (
                    <Text style={{ color: colors.subtext, fontSize: appFontSize - 2 }} numberOfLines={1}>{item.title_thanglish}</Text>
                  ) : null}
                </View>
                <AnimatedHeart isFavorite={favorites.has(item.id)} onPress={() => toggleFavorite(item.id)} inactiveColor={colors.subtext} activeColor="red" />
              </View>
            </ScalePressable>
          )}
        />
      </SafeAreaView>

      {/* ------------------------------------------- */}
      {/* SORT MENU MODAL                             */}
      {/* ------------------------------------------- */}
      <Modal visible={showSortMenu} transparent animationType="fade">
        <BlurView intensity={60} tint="dark" style={styles.modalBg}>
          <View style={[styles.sortModalCard, { backgroundColor: isDark ? '#12161E' : '#FFFFFF', borderColor: colors.border, borderWidth: 1 }]}>
            <Text style={[styles.modalHeaderTitle, { color: colors.text, fontSize: appFontSize + 4 }]}>Sort Options</Text>
            <ScalePressable onPress={() => { triggerHaptic(); setSortOrder('number'); setShowSortMenu(false); }}>
              <View style={[styles.sortBtn, { borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
                <MaterialCommunityIcons name="sort-numeric-ascending" size={28} color={sortOrder === 'number' ? colors.primary : colors.text} />
                <Text style={{ color: sortOrder === 'number' ? colors.primary : colors.text, fontSize: appFontSize + 2, fontWeight: 'bold', marginLeft: 15 }}>🔢 எண் வரிசை (Number Order)</Text>
              </View>
            </ScalePressable>
            <ScalePressable onPress={() => { triggerHaptic(); setSortOrder('alpha'); setShowSortMenu(false); }}>
              <View style={styles.sortBtn}>
                <MaterialCommunityIcons name="sort-alphabetical-ascending" size={28} color={sortOrder === 'alpha' ? colors.primary : colors.text} />
                <Text style={{ color: sortOrder === 'alpha' ? colors.primary : colors.text, fontSize: appFontSize + 2, fontWeight: 'bold', marginLeft: 15 }}>🔠 அகர வரிசை (Alphabetical)</Text>
              </View>
            </ScalePressable>
            <TouchableOpacity onPress={() => setShowSortMenu(false)} style={{ padding: 20, alignItems: 'center', borderTopWidth: 1, borderColor: colors.border }}>
              <Text style={{ color: '#FF3B30', fontSize: appFontSize, fontWeight: 'bold' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </BlurView>
      </Modal>

      {/* ------------------------------------------- */}
      {/* 1. ADD / EDIT SONG MODAL (Keyboard Fixed)   */}
      {/* ------------------------------------------- */}
      <Modal visible={isFormVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setIsFormVisible(false)}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          style={{ flex: 1, backgroundColor: colors.background }}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <SafeAreaView style={{ flex: 1 }}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <TouchableOpacity onPress={() => setIsFormVisible(false)} style={{ padding: 10 }}>
                <Text style={{ color: colors.subtext, fontSize: 16 }}>Cancel</Text>
              </TouchableOpacity>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: 'bold' }}>
                {editingId ? "Edit Song" : "Add Your Song"}
              </Text>
              {/* SAVE BUTTON - Now using Neon Blue (primary) */}
              <TouchableOpacity onPress={saveSong} style={{ padding: 10 }}>
                <Text style={{ color: colors.primary, fontSize: 16, fontWeight: 'bold' }}>Save</Text>
              </TouchableOpacity>
            </View>

            <View style={{ flex: 1, padding: 20 }}>
              <Text style={{ color: colors.primary, marginBottom: 5, fontWeight: 'bold' }}>Song Name in Tamil (Required)</Text>
              <TextInput 
                style={[styles.inputBox, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]} 
                placeholder="எ.கா: தேவனுக்கு மகிமை" 
                placeholderTextColor={colors.subtext}
                value={formTamil}
                onChangeText={setFormTamil}
              />

              <Text style={{ color: colors.primary, marginBottom: 5, fontWeight: 'bold' }}>Song Name in Thanglish (Optional)</Text>
              <TextInput 
                style={[styles.inputBox, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]} 
                placeholder="Ex: Devanukku magimai" 
                placeholderTextColor={colors.subtext}
                value={formThanglish}
                onChangeText={setFormThanglish}
              />

              <Text style={{ color: colors.primary, marginBottom: 5, fontWeight: 'bold' }}>Song Lyrics (Required)</Text>
              <TextInput 
                style={[styles.inputBox, styles.textArea, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]} 
                placeholder="Type your lyrics here..." 
                placeholderTextColor={colors.subtext}
                multiline
                textAlignVertical="top"
                value={formLyrics}
                onChangeText={setFormLyrics}
              />
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

      {/* ------------------------------------------- */}
      {/* 2. LYRICS READING MODAL                     */}
      {/* ------------------------------------------- */}
      <Modal visible={activeSong !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setActiveSong(null)}>
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <LinearGradient colors={isDark ? ['#0A1929', colors.background] : ['#FFFFFF', colors.background]} style={StyleSheet.absoluteFillObject} />
          
          <SafeAreaView style={{ flex: 1 }}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <ScalePressable onPress={() => setActiveSong(null)}>
                <View style={{ padding: 10 }}>
                  <Ionicons name="chevron-down" size={32} color={BRIGHT_YELLOW} />
                </View>
              </ScalePressable>
              
              <View style={{ flex: 1, alignItems: 'center', paddingHorizontal: 10 }}>
                 <Text style={{ color: colors.primary, fontFamily: 'Tamil008', fontSize: titleSize, letterSpacing: titleSpacing, textShadowColor: isDark ? colors.glow : 'transparent', textShadowRadius: 10 }} numberOfLines={1}>
                   {activeSong?.id} - {activeSong?.title_tamil}
                 </Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <ScalePressable onPress={() => { triggerHaptic(); setShowTextSettings(true); }}>
                  <View style={styles.textSettingsBtn}>
                    <Text style={{ color: BRIGHT_YELLOW, fontWeight: 'bold', marginRight: 4, fontSize: appFontSize }}>Aa</Text>
                  </View>
                </ScalePressable>
                <ScalePressable onPress={() => handleShare(activeSong)}>
                  <View style={{ padding: 8 }}>
                    <Ionicons name="share-outline" size={24} color={BRIGHT_YELLOW} />
                  </View>
                </ScalePressable>
                <ScalePressable onPress={openEditForm}>
                  <View style={{ padding: 8 }}>
                    <Ionicons name="pencil" size={22} color={BRIGHT_YELLOW} />
                  </View>
                </ScalePressable>
                <ScalePressable onPress={confirmDelete}>
                  <View style={{ padding: 8 }}>
                    <Ionicons name="trash" size={22} color="#FF3B30" />
                  </View>
                </ScalePressable>
              </View>
            </View>

            <ScrollView contentContainerStyle={{ padding: 30, paddingBottom: 150 }}>
              <Text style={{ color: colors.text, fontSize: lyricsSize, fontFamily: 'Tamil003', lineHeight: lyricsLineHeight, letterSpacing: lyricsSpacing }}>
                {activeSong?.lyrics}
              </Text>
            </ScrollView>
          </SafeAreaView>

          {/* SETTINGS MODAL (Font size etc) */}
          {settingsModalVisible && (
            <Animated.View style={[StyleSheet.absoluteFill, { zIndex: 999 }]} pointerEvents={showTextSettings ? 'auto' : 'none'}>
              <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.7)', opacity: settingsFadeAnim }]}>
                <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowTextSettings(false)} />
              </Animated.View>
              <Animated.View style={[styles.settingsCard, { position: 'absolute', bottom: 0, width: '100%', backgroundColor: isDark ? '#12161E' : '#FFFFFF', borderColor: colors.border, borderWidth: 1, transform: [{ translateY: settingsSlideAnim }] }]}>
                <View style={styles.settingsHeader}>
                  <Text style={{ color: colors.text, fontSize: appFontSize + 2, fontWeight: 'bold' }}>Reading Preferences</Text>
                  <ScalePressable onPress={() => { triggerHaptic(); setShowTextSettings(false); }}>
                    <Ionicons name="close" size={28} color={colors.text} />
                  </ScalePressable>
                </View>
                <ScrollView showsVerticalScrollIndicator={false}>
                  <Text style={[styles.settingLabel, { color: colors.primary, fontSize: appFontSize - 2 }]}>Title Settings</Text>
                  <Text style={{ color: colors.subtext, fontSize: appFontSize }}>Font Size: {titleSize}</Text>
                  <Slider minimumValue={16} maximumValue={30} step={1} value={titleSize} onValueChange={setTitleSize} minimumTrackTintColor={colors.primary} maximumTrackTintColor={colors.border} />
                  <Text style={[styles.settingLabel, { color: colors.primary, marginTop: 25, fontSize: appFontSize - 2 }]}>Lyrics Settings</Text>
                  <Text style={{ color: colors.subtext, fontSize: appFontSize }}>Font Size: {lyricsSize}</Text>
                  <Slider minimumValue={12} maximumValue={35} step={1} value={lyricsSize} onValueChange={setLyricsSize} minimumTrackTintColor={colors.primary} maximumTrackTintColor={colors.border} />
                  <Text style={{ color: colors.subtext, fontSize: appFontSize }}>Line Spacing: {lyricsLineHeight}</Text>
                  <Slider minimumValue={20} maximumValue={60} step={1} value={lyricsLineHeight} onValueChange={setLyricsLineHeight} minimumTrackTintColor={colors.primary} maximumTrackTintColor={colors.border} />
                  <ScalePressable onPress={() => { triggerHaptic(Haptics.ImpactFeedbackStyle.Success); restoreDefaultTextSettings(); }}>
                    <View style={[styles.restoreBtn, { backgroundColor: colors.glow, borderColor: colors.primary, borderWidth: 1 }]}>
                      <Ionicons name="refresh" size={20} color={colors.primary} />
                      <Text style={{ color: colors.primary, fontWeight: 'bold', marginLeft: 8, fontSize: appFontSize }}>Restore Defaults</Text>
                    </View>
                  </ScalePressable>
                </ScrollView>
              </Animated.View>
            </Animated.View>
          )}

        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerWrapper: { paddingHorizontal: 15, paddingBottom: 10, paddingTop: 5 },
  searchPill: { flexDirection: 'row', alignItems: 'center', borderRadius: 30, borderWidth: 1, paddingLeft: 15, paddingRight: 10, height: 50, marginBottom: 12 },
  searchInput: { flex: 1, height: '100%' },
  filterChipsRow: { flexDirection: 'row', alignItems: 'center' },
  chipBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, marginRight: 8 },
  songCard: { flexDirection: 'row', alignItems: 'center', padding: 10, marginBottom: 8, borderRadius: 16, borderWidth: 1 },
  numberCircle: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12, borderWidth: 1 },
  titleContainer: { flex: 1, justifyContent: 'center' },
  songTitle: { marginBottom: 2 },
  modalContainer: { flex: 1, position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 10, borderBottomWidth: 1 },
  textSettingsBtn: { flexDirection: 'row', alignItems: 'center', padding: 8, backgroundColor: 'rgba(128,128,128,0.2)', borderRadius: 12, marginRight: 5 },
  modalBg: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  sortModalCard: { width: '85%', borderRadius: 24, overflow: 'hidden' },
  sortBtn: { flexDirection: 'row', alignItems: 'center', padding: 25 },
  modalHeaderTitle: { fontWeight: '900', textAlign: 'center', padding: 25, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  settingsCard: { width: '100%', maxHeight: '80%', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 30 },
  settingsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
  settingLabel: { fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 15 },
  restoreBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 16, borderRadius: 16, marginTop: 40, marginBottom: 20 },
  inputBox: { borderWidth: 1, borderRadius: 12, padding: 15, fontSize: 16, marginBottom: 20 },
  textArea: { flex: 1, minHeight: 150 }
});
