import { getZionDb, getThiruDb } from '../utils/SongDb';
import React, { useRef, useCallback, useState, useMemo, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Animated, Easing, Modal, TextInput, FlatList, Keyboard, Share, Dimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSettings } from '../context/SettingsContext';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Slider from '@react-native-community/slider';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

// Import Custom Songs DB
import { getCustomSongs } from '../utils/UserDataDB';

const { height } = Dimensions.get('window');
const BRIGHT_YELLOW = '#FFD700';
const NEWLINE = String.fromCharCode(10);
const NEON_BLUE = '#00F0FF';

const ACCENT_ZION = '#30D158';
const ACCENT_HOPE = '#FF9F0A';
const ACCENT_OLD = '#00F0FF';
const ACCENT_OTHER = '#BF5AF2';
const ACCENT_CUSTOM = '#FF3B30'; 

const ScalePressable = ({ children, onPress, style, scaleTo = 0.94 }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const handlePressIn = () => Animated.spring(scale, { toValue: scaleTo, useNativeDriver: true, friction: 6, tension: 100 }).start();
  const handlePressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 6, tension: 100 }).start();
  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <TouchableOpacity onPressIn={handlePressIn} onPressOut={handlePressOut} onPress={onPress} activeOpacity={0.85} delayPressIn={30}>
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
};

export default function SongsScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets(); 
  const { colors, isDark, appFontSize, hapticsEnabled, titleSize, setTitleSize, titleSpacing, setTitleSpacing, lyricsSize, setLyricsSize, lyricsSpacing, setLyricsSpacing, lyricsLineHeight, setLyricsLineHeight, restoreDefaultTextSettings } = useSettings();

  // --- LANGUAGE TOGGLE STATE & ANIMATION ---
  const [isThanglish, setIsThanglish] = useState(false);
  const toggleSlideAnim = useRef(new Animated.Value(0)).current; // 0 = Tamil, 1 = Thanglish

  // Removed custom screenAnim to stop it from fighting the Native screen transition

  // --- GLOBAL SEARCH STATE ---
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [allSongsCache, setAllSongsCache] = useState([]);
  const [isFetching, setIsFetching] = useState(false);
  const [activeGlobalSong, setActiveGlobalSong] = useState(null);
  const [showCombinedLyrics, setShowCombinedLyrics] = useState(false);

  // --- TEXT SETTINGS STATE ---
  const [showTextSettings, setShowTextSettings] = useState(false);
  const settingsSlideAnim = useRef(new Animated.Value(height)).current;
  const settingsFadeAnim = useRef(new Animated.Value(0)).current;

  const triggerHaptic = useCallback((style = Haptics.ImpactFeedbackStyle.Medium) => { 
    if (hapticsEnabled) Haptics.impactAsync(style); 
  }, [hapticsEnabled]);

  const handleLanguageToggle = () => {
    triggerHaptic();
    const newValue = !isThanglish;
    setIsThanglish(newValue);
    
    Animated.timing(toggleSlideAnim, {
      toValue: newValue ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  useEffect(() => {
    if (activeGlobalSong !== null) activateKeepAwakeAsync(); else deactivateKeepAwake();
  }, [activeGlobalSong]);

  // Handle Text Settings Modal Animation only when toggled
  useEffect(() => {
    if (showTextSettings) {
      Animated.parallel([
        Animated.spring(settingsSlideAnim, { toValue: 0, friction: 9, tension: 65, useNativeDriver: true }),
        Animated.timing(settingsFadeAnim, { toValue: 1, duration: 200, useNativeDriver: true })
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(settingsSlideAnim, { toValue: height, duration: 220, useNativeDriver: true }),
        Animated.timing(settingsFadeAnim, { toValue: 0, duration: 220, useNativeDriver: true })
      ]).start();
    }
  }, [showTextSettings]);

  // Smart Parser for Global Search Reading Modal (Matches Zion & Thirumarai)
  const lyricStanzas = useMemo(() => {
    if (!activeGlobalSong) return [];
    const text = showCombinedLyrics
      ? (activeGlobalSong.lyrics_combined || activeGlobalSong.lyrics)
      : (isThanglish ? (activeGlobalSong.lyrics_transliteration || activeGlobalSong.lyrics) : activeGlobalSong.lyrics);

    if (!text) return [];
    const rawLines = text.split(NEWLINE);
    const stanzas = [];
    let currentNumber = null;
    let currentLines = [];
    let seenChorusText = null;
    let isCurrentBlockChorus = false;

    const isRefrainLine = (line, nextLine) => {
      const trimmed = line.trim();
      if (trimmed.indexOf('~') !== 0) return false;
      if (nextLine === undefined) return true;
      return nextLine.trim() === '';
    };

    const flush = () => {
      while (currentLines.length > 0 && currentLines[currentLines.length - 1].content.trim() === '') currentLines.pop();
      while (currentLines.length > 0 && currentLines[0].content.trim() === '') currentLines.shift();

      if (currentLines.length > 0) {
        const blockText = currentLines.map(l => l.content).join('\n').trim();
        if (isCurrentBlockChorus) {
          if (!seenChorusText) {
            seenChorusText = blockText;
            stanzas.push({ number: currentNumber, lines: currentLines });
          } else if (seenChorusText !== blockText) {
            stanzas.push({ number: currentNumber, lines: currentLines });
          }
        } else {
          stanzas.push({ number: currentNumber, lines: currentLines });
        }
      }
      currentLines = [];
      currentNumber = null;
      isCurrentBlockChorus = false;
    };

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i];
      const trimmed = line.trim();

      if (trimmed.toLowerCase() === '[chorus]') {
        flush();
        isCurrentBlockChorus = true;
        continue;
      }

      const verseMatch = trimmed.match(/^\[Verse\s+(\d+)\]$/i);
      if (verseMatch) {
        flush();
        currentNumber = verseMatch[1] + ".";
        continue;
      }

      const numMatch = trimmed.match(/^\s*(\d{1,3}[.)])\s*(.*)$/);
      if (numMatch && !isCurrentBlockChorus) {
        flush();
        currentNumber = numMatch[1];
        const rest = line.substring(line.indexOf(numMatch[1]) + numMatch[1].length).trim();
        const nextLine = rawLines[i + 1];
        if (rest) {
          currentLines.push({ content: rest, isRefrain: isRefrainLine(rest, nextLine) });
        }
        continue;
      }

      if (trimmed === '') {
        flush();
        continue;
      }

      const nextLine = rawLines[i + 1];
      currentLines.push({ content: line, isRefrain: isRefrainLine(line, nextLine) });
    }
    flush();

    return stanzas.length > 0 ? stanzas : [{ number: null, lines: [{ content: text.trim(), isRefrain: false }] }];
  }, [activeGlobalSong, showCombinedLyrics, isThanglish]);

  // --- THE OFFLINE-FIRST GLOBAL FETCH ENGINE ---
  const openGlobalSearch = async () => {
    triggerHaptic();
    setIsSearchOpen(true);
    
    // If already loaded, don't block the user!
    if (allSongsCache.length > 0) return;

    setIsFetching(true);
    let masterList = [];

    // 1. Fetch Zion (Offline SQLite - Instant)
    try {
      const zionDb = await getZionDb();
      const zionTables = await zionDb.getAllAsync("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'android_metadata'");
      const zionTableName = zionTables && zionTables.length > 0 ? (zionTables.find(t => t.name === 'songs')?.name || zionTables[0].name) : 'songs';
      const zionRes = await zionDb.getAllAsync(`SELECT * FROM "${zionTableName}"`);
      
      masterList.push(...(zionRes || []).map((s, index) => ({
        global_id: `zion_${s.id || index}`,
        source_ta: 'சீயோன் இனிய கீதங்கள்',
        source_en: 'Zion Iniya Geethangal',
        sourceColor: ACCENT_ZION,
        num: s.song_number || s.id || '?', 
        title_tamil: s.title_tamil || 'Unknown Title',
        title_english: s.title_english ? s.title_english.toString() : (s.title_tamil || 'Unknown Title'),
        search_en: s.title_english ? s.title_english.toString() : '',
        lyrics: s.lyrics || '',
        lyrics_transliteration: s.lyrics_transliteration || s.lyrics || '',
        lyrics_combined: s.lyrics_combined || s.lyrics || ''
      })));
    } catch (e) {
      console.warn("Global Search - Zion DB Error:", e);
    }

    // 2. Fetch Thirumarai Old & Hope (Offline SQLite - Instant)
    try {
      const thiruDb = await getThiruDb();
      const thiruTables = await thiruDb.getAllAsync("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'android_metadata'");
      const thiruTableName = thiruTables && thiruTables.length > 0 ? (thiruTables.find(t => t.name === 'songs' || t.name === 'SongListTable')?.name || thiruTables[0].name) : 'SongListTable';
      const thiruRes = await thiruDb.getAllAsync(`SELECT * FROM "${thiruTableName}"`);
      
      (thiruRes || []).forEach((s, index) => {
        const hasHope = s.Song_number_by_Nambikaiyen_Geethagal != null && s.Song_number_by_Nambikaiyen_Geethagal !== '';
        const hasOld = s.song_number != null && s.song_number !== '';
        const tamTitle = s.song_title_tamil || s.title_tamil || 'Unknown Title';
        const engTitle = s.song_title_english ? s.song_title_english.toString() : tamTitle;

        if (hasHope) {
          masterList.push({
            global_id: `thiru_hope_${index}`,
            source_ta: 'திருமறைத்திருப் பாடல் (நம்பிக்கையின் கீதங்கள்)',
            source_en: 'Thirumarai Thirupaadalgal (Hope)',
            sourceColor: ACCENT_HOPE,
            num: s.Song_number_by_Nambikaiyen_Geethagal,
            title_tamil: tamTitle,
            title_english: engTitle,
            search_en: engTitle,
            lyrics: s.lyrics || '',
            lyrics_transliteration: s.lyrics_transliteration || s.lyrics || '',
            lyrics_combined: s.lyrics_combined || s.lyrics || ''
          });
        }

        if (hasOld) {
          masterList.push({
            global_id: `thiru_old_${index}`,
            source_ta: 'திருமறைத்திருப் பாடல் (பழைய புத்தக வரிசை)',
            source_en: 'Thirumarai Thirupaadalgal (Old)',
            sourceColor: ACCENT_OLD,
            num: s.song_number,
            title_tamil: tamTitle,
            title_english: engTitle,
            search_en: engTitle,
            lyrics: s.lyrics || '',
            lyrics_transliteration: s.lyrics_transliteration || s.lyrics || '',
            lyrics_combined: s.lyrics_combined || s.lyrics || ''
          });
        }
      });
    } catch (e) {
      console.warn("Global Search - Thirumarai DB Error:", e);
    }

    // 3. Fetch Custom Songs (Offline DB - Instant, handles both sync & async)
    try {
      const customRes = await Promise.resolve(getCustomSongs());
      if (Array.isArray(customRes)) {
        masterList.push(...customRes.map((s, index) => ({
          global_id: `custom_${s.id || index}`,
          source_ta: 'எனது பாடல்கள்',
          source_en: 'Enathu Paadalgal',
          sourceColor: ACCENT_CUSTOM,
          num: (s.id || index + 1).toString(),
          title_tamil: s.title_tamil || 'Unknown Title',
          title_english: s.title_thanglish || s.title_tamil || 'Unknown Title',
          search_en: s.title_thanglish || '',
          lyrics: s.lyrics || '',
          lyrics_transliteration: s.lyrics || '',
          lyrics_combined: s.lyrics || ''
        })));
      }
    } catch (e) {
      console.warn("Global Search - Custom Songs Error:", e);
    }

    // UNLOCK THE SCREEN IMMEDIATELY WITH OFFLINE SONGS!
    setAllSongsCache(masterList);
    setIsFetching(false);

    // 4. Fetch Other Songs from GIST in the background (Non-blocking with 4s timeout)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const GIST_RAW_URL = 'https://gist.githubusercontent.com/ATtool/cf27796976a73404f254b4bc81240f5f/raw/other_songs.json';
      const response = await fetch(`${GIST_RAW_URL}?t=${new Date().getTime()}`, {
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' },
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      const otherRes = await response.json();
      if (Array.isArray(otherRes) && otherRes.length > 0) {
        const otherMapped = otherRes.map((s, index) => ({
          global_id: `other_${index}`,
          source_ta: 'இதர பாடல்கள்',
          source_en: 'Ithara Paadalgal',
          sourceColor: ACCENT_OTHER,
          num: s.song_number || s.id || '?', 
          title_tamil: s.title_tamil || 'Unknown Title',
          title_english: s.title_english || s.title_thanglish || s.title_tamil || 'Unknown Title',
          search_en: s.title_english || s.title_thanglish || '',
          lyrics: s.lyrics || '',
          lyrics_transliteration: s.lyrics_transliteration || s.lyrics || '',
          lyrics_combined: s.lyrics_combined || s.lyrics || ''
        }));
        setAllSongsCache(prev => [...prev, ...otherMapped]);
      }
    } catch (gistError) {
      // Silently ignore when offline so offline-first experience stays seamless
    }
  };

  const filteredGlobalSongs = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const term = searchQuery.toLowerCase().trim();
    
    return allSongsCache.filter(song => {
      const numStr = song.num ? song.num.toString().toLowerCase() : '';
      const tamStr = song.title_tamil ? song.title_tamil.toLowerCase() : '';
      const engStr = song.search_en ? song.search_en.toString().toLowerCase() : '';
      
      const isExactNumberMatch = numStr === term;
      const isPartialTextMatch = tamStr.includes(term) || engStr.includes(term);
      
      return isExactNumberMatch || isPartialTextMatch;
    }).slice(0, 70);
  }, [searchQuery, allSongsCache]);

  const handleShare = async (song) => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    const displayTitle = isThanglish ? (song.title_english || song.title_tamil) : song.title_tamil;
    const displayLyrics = isThanglish ? (song.lyrics_transliteration || song.lyrics) : song.lyrics;
    try {
      await Share.share({
        message: `${song.num} - ${displayTitle}\n\n${displayLyrics}\n\n✨join our WhatsApp channel:\nhttps://whatsapp.com/channel/0029Vb6Pu8FLI8YfM5H49e0p \n\n📲Download our APP in Play Store : https://play.google.com/store/apps/details?id=com.adventisttamiltool.adventisttamiltool`
      });
    } catch (error) {
      console.log(error.message);
    }
  };

  const openScreen = (screenName) => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate(screenName, { isThanglish });
  };

  const closeGlobalReadingModal = () => {
    setActiveGlobalSong(null);
    setShowCombinedLyrics(false);
  };

  // Modern Toggle Slider Translation Math
  const TOGGLE_WIDTH = 180;
  const thumbTranslateX = toggleSlideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [2, (TOGGLE_WIDTH / 2) - 2]
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      
      {/* Main Header */}
      <View style={styles.headerContainer}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.text }]} allowFontScaling={false}>பாடல் புத்தகங்கள்</Text>
          <Text style={[styles.headerSubtitle, { color: colors.subtext }]} allowFontScaling={false}>Song Books</Text>
        </View>
        <ScalePressable onPress={openGlobalSearch} style={styles.searchIconBtn}>
          <Ionicons name="search" size={26} color={colors.primary} />
        </ScalePressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Box 1: Zion */}
        <View style={{ marginBottom: 12 }}>
          <TouchableOpacity activeOpacity={0.75} style={[styles.card, { backgroundColor: colors.card, borderLeftColor: ACCENT_ZION }]} onPress={() => openScreen('ZionSongs')}>
            <View style={[styles.iconContainer, { backgroundColor: ACCENT_ZION + '22' }]}><Ionicons name="musical-notes" size={22} color={ACCENT_ZION} /></View>
            <View style={styles.textContainer}>
              <Text style={[styles.tamilText, { color: colors.text, fontSize: appFontSize + 7, lineHeight: appFontSize + 10 }]}>
                {isThanglish ? 'Zion Iniya Geethangal' : 'சீயோன் இனிய கீதங்கள்'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.subtext} />
          </TouchableOpacity>
        </View>

        {/* Box 2: Thirumarai Hope */}
        <View style={{ marginBottom: 12 }}>
          <TouchableOpacity activeOpacity={0.75} style={[styles.card, { backgroundColor: colors.card, borderLeftColor: ACCENT_HOPE }]} onPress={() => openScreen('ThirumaraiHope')}>
            <View style={[styles.iconContainer, { backgroundColor: ACCENT_HOPE + '22' }]}><Ionicons name="star" size={22} color={ACCENT_HOPE} /></View>
            <View style={styles.textContainer}>
              <Text style={[styles.tamilText, { color: colors.text, fontSize: appFontSize + 7, lineHeight: appFontSize + 10 }]}>
                {isThanglish ? 'Thirumarai Thirupaadalgal' : 'திருமறைத்திருப் பாடல்கள்'}
              </Text>
              <Text style={[styles.tamilSubText, { color: BRIGHT_YELLOW, fontSize: appFontSize + 1, lineHeight: appFontSize + 2 }]}>
                {isThanglish ? '( Songs of Hope )' : '( நம்பிக்கையின் கீதங்கள் புத்தக வரிசை )'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.subtext} />
          </TouchableOpacity>
        </View>

        {/* Box 3: Thirumarai Old */}
        <View style={{ marginBottom: 12 }}>
          <TouchableOpacity activeOpacity={0.75} style={[styles.card, { backgroundColor: colors.card, borderLeftColor: ACCENT_OLD }]} onPress={() => openScreen('ThirumaraiOld')}>
            <View style={[styles.iconContainer, { backgroundColor: ACCENT_OLD + '22' }]}><Ionicons name="book" size={22} color={colors.primary} /></View>
            <View style={styles.textContainer}>
              <Text style={[styles.tamilText, { color: colors.text, fontSize: appFontSize + 7, lineHeight: appFontSize + 8 }]}>
                {isThanglish ? 'Thirumarai Thirupaadalgal' : 'திருமறைத்திருப் பாடல்கள்'}
              </Text>
              <Text style={[styles.tamilSubText, { color: BRIGHT_YELLOW, fontSize: appFontSize + 1, lineHeight: appFontSize + 2 }]}>
                {isThanglish ? '( Old Song Book )' : '( பழைய புத்தக வரிசை )'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.subtext} />
          </TouchableOpacity>
        </View>

        {/* Box 4: Other Songs */}
        <View style={{ marginBottom: 12 }}>
          <TouchableOpacity activeOpacity={0.75} style={[styles.card, { backgroundColor: colors.card, borderLeftColor: ACCENT_OTHER }]} onPress={() => openScreen('OtherSongs')}>
            <View style={[styles.iconContainer, { backgroundColor: ACCENT_OTHER + '22' }]}><Ionicons name="library" size={22} color={ACCENT_OTHER} /></View>
            <View style={styles.textContainer}>
              <Text style={[styles.tamilText, { color: colors.text, fontSize: appFontSize + 7, lineHeight: appFontSize + 8 }]}>
                {isThanglish ? 'Ithara Paadalgal' : 'இதர பாடல்கள்'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.subtext} />
          </TouchableOpacity>
        </View>

        {/* Box 5: Custom Songs */}
        <View style={{ marginBottom: 12 }}>
          <TouchableOpacity activeOpacity={0.75} style={[styles.card, { backgroundColor: colors.card, borderLeftColor: ACCENT_CUSTOM }]} onPress={() => openScreen('CustomSongs')}>
            <View style={[styles.iconContainer, { backgroundColor: ACCENT_CUSTOM + '22' }]}><Ionicons name="create" size={22} color={ACCENT_CUSTOM} /></View>
            <View style={styles.textContainer}>
              <Text style={[styles.tamilText, { color: colors.text, fontSize: appFontSize + 7, lineHeight: appFontSize + 8 }]}>
                {isThanglish ? 'Enathu Paadalgal' : 'எனது பாடல்கள்'}
              </Text>
              <Text style={[styles.tamilSubText, { color: BRIGHT_YELLOW, fontSize: appFontSize + 1, lineHeight: appFontSize + 2 }]}>
                ( Custom Songs )
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.subtext} />
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* --- SMALL, MODERN ANIMATED TOGGLE BUTTON --- */}
      <View style={{ alignItems: 'center', paddingBottom: 15, paddingTop: 5 }}>
        <TouchableOpacity 
          activeOpacity={0.9} 
          onPress={handleLanguageToggle}
          style={{
            width: TOGGLE_WIDTH,
            height: 38,
            backgroundColor: colors.card,
            borderRadius: 19,
            flexDirection: 'row',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: colors.border,
            position: 'relative',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 3,
            elevation: 2
          }}
        >
          <Animated.View style={{
            position: 'absolute',
            width: (TOGGLE_WIDTH / 2) - 2,
            height: 32,
            backgroundColor: colors.primary,
            borderRadius: 16,
            transform: [{ translateX: thumbTranslateX }]
          }} />
          
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
            <Text style={{ color: !isThanglish ? (isDark ? '#000' : '#FFF') : colors.subtext, fontFamily: 'Tamil003', fontSize: 14, includeFontPadding: false }}>தமிழ்</Text>
          </View>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
            <Text style={{ color: isThanglish ? (isDark ? '#000' : '#FFF') : colors.subtext, fontFamily: 'Tamil003', fontSize: 14, includeFontPadding: false }}>Thanglish</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* ------------------------------------------- */}
      {/* GLOBAL SEARCH MODAL                         */}
      {/* ------------------------------------------- */}
      <Modal visible={isSearchOpen} animationType="fade" onRequestClose={() => setIsSearchOpen(false)}>
        <View style={[styles.container, { backgroundColor: colors.background, paddingTop: Math.max(insets.top, 20) }]}>
            
            {/* Search Bar Header */}
            <View style={[styles.globalSearchHeader, { borderBottomColor: colors.border }]}>
              <ScalePressable onPress={() => { triggerHaptic(); setIsSearchOpen(false); setSearchQuery(''); }}>
                <Ionicons name="arrow-back" size={28} color={colors.text} style={{ padding: 5 }} />
              </ScalePressable>
              
              <View style={[styles.globalSearchInputBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Ionicons name="search" size={20} color={colors.subtext} style={{ marginRight: 8 }} />
                <TextInput 
                  style={{ flex: 1, color: colors.text, fontSize: appFontSize, fontFamily: 'Tamil003', includeFontPadding: false }}
                  placeholder="Search number, Tamil or Thanglish..."
                  placeholderTextColor={colors.subtext}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoFocus
                  autoCorrect={false}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Ionicons name="close-circle" size={20} color={colors.subtext} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Results List */}
            {isFetching ? (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: colors.primary, fontSize: appFontSize, fontFamily: 'Tamil003', includeFontPadding: false }}>Loading databases...</Text>
              </View>
            ) : (
              <FlatList
                data={filteredGlobalSongs}
                keyExtractor={(item) => item.global_id}
                contentContainerStyle={{ padding: 15, paddingBottom: 50 }}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                ListEmptyComponent={
                  <View style={{ alignItems: 'center', marginTop: 100 }}>
                    <Ionicons name="search" size={50} color={colors.border} />
                    <Text style={{ color: colors.subtext, marginTop: 15, fontSize: appFontSize, textAlign: 'center', fontFamily: 'Tamil003', includeFontPadding: false }}>
                      {searchQuery ? "No songs found." : "Type an exact song number, or part of a Tamil/Thanglish title..."}
                    </Text>
                  </View>
                }
                renderItem={({ item }) => {
                  const displayTitle = isThanglish ? (item.title_english || item.title_tamil) : item.title_tamil;
                  const displaySource = isThanglish ? item.source_en : item.source_ta;

                  return (
                    <ScalePressable onPress={() => { 
                      triggerHaptic(); 
                      Keyboard.dismiss(); 
                      setIsSearchOpen(false);
                      setTimeout(() => {
                        setActiveGlobalSong(item); 
                      }, 150); 
                    }}>
                      <View style={[styles.globalSongCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <View style={[styles.numberCircle, { borderColor: item.sourceColor, backgroundColor: item.sourceColor + '20' }]}>
                          <Text style={{ color: item.sourceColor, fontSize: appFontSize, fontFamily: 'Tamil008', includeFontPadding: false }}>{item.num}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.songTitle, { color: colors.text, fontFamily: 'Tamil003', fontSize: appFontSize + (isThanglish ? 4 : 2), includeFontPadding: false }]} numberOfLines={1}>
                            {displayTitle}
                          </Text>
                          <Text style={{ color: item.sourceColor, fontSize: appFontSize - 2, fontFamily: 'Tamil003', includeFontPadding: false, marginTop: 3 }}>
                            {displaySource}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={colors.border} />
                      </View>
                    </ScalePressable>
                  );
                }}
              />
            )}
        </View>
      </Modal>

      {/* ------------------------------------------- */}
      {/* READING VIEW MODAL (Standalone)             */}
      {/* ------------------------------------------- */}
      <Modal visible={activeGlobalSong !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeGlobalReadingModal}>
        <View style={[styles.modalContainer, { backgroundColor: colors.background, paddingTop: Math.max(insets.top, 20) }]}>
          <LinearGradient colors={isDark ? ['#0A1929', colors.background] : ['#FFFFFF', colors.background]} style={StyleSheet.absoluteFillObject} />
          
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <ScalePressable onPress={closeGlobalReadingModal}>
                <View style={{ padding: 10 }}>
                  <Ionicons name="chevron-down" size={32} color={activeGlobalSong?.sourceColor || BRIGHT_YELLOW} />
                </View>
              </ScalePressable>
              
              <View style={{ flex: 1, alignItems: 'center', paddingHorizontal: 10 }}>
                 <Text style={{ color: colors.primary, fontFamily: 'Tamil008', fontSize: isThanglish ? titleSize + 2 : titleSize, letterSpacing: titleSpacing, textShadowColor: isDark ? colors.glow : 'transparent', textShadowRadius: 10, includeFontPadding: false }} numberOfLines={1}>
                   {activeGlobalSong?.num} - {isThanglish ? (activeGlobalSong?.title_english || activeGlobalSong?.title_tamil) : activeGlobalSong?.title_tamil}
                 </Text>
                 <Text style={{ color: activeGlobalSong?.sourceColor, fontSize: 11, fontFamily: 'Tamil003', includeFontPadding: false }}>
                   {isThanglish ? activeGlobalSong?.source_en : activeGlobalSong?.source_ta}
                 </Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <ScalePressable onPress={() => { triggerHaptic(); setShowCombinedLyrics(!showCombinedLyrics); }}>
                  <View style={[styles.textSettingsBtn, showCombinedLyrics && { backgroundColor: BRIGHT_YELLOW }]}>
                    <Ionicons name="language" size={20} color={showCombinedLyrics ? '#000' : (activeGlobalSong?.sourceColor || BRIGHT_YELLOW)} />
                  </View>
                </ScalePressable>

                <ScalePressable onPress={() => { triggerHaptic(); setShowTextSettings(true); }}>
                  <View style={styles.textSettingsBtn}>
                    <Text style={{ color: activeGlobalSong?.sourceColor || BRIGHT_YELLOW, marginRight: 4, fontSize: appFontSize, fontFamily: 'Tamil003', includeFontPadding: false }}>Aa</Text>
                  </View>
                </ScalePressable>
                <ScalePressable onPress={() => handleShare(activeGlobalSong)}>
                  <View style={{ padding: 8 }}>
                    <Ionicons name="share-outline" size={24} color={activeGlobalSong?.sourceColor || BRIGHT_YELLOW} />
                  </View>
                </ScalePressable>
              </View>
            </View>

            <ScrollView contentContainerStyle={{ padding: 30, paddingBottom: 150 }}>
              {lyricStanzas.map((stanza, idx) => (
                <View key={idx} style={{ flexDirection: 'row', marginBottom: stanza.number ? 22 : 18 }}>
                  <View style={{ width: 34 }}>
                    {stanza.number && (
                      <Text style={{ color: '#FFFFFF', fontSize: lyricsSize, fontFamily: 'Tamil003', lineHeight: lyricsLineHeight, includeFontPadding: false }}>
                        {stanza.number}
                      </Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    {stanza.lines.map((line, lineIdx) => (
                      <Text
                        key={lineIdx}
                        style={{
                          color: line.isRefrain ? NEON_BLUE : colors.text,
                          fontSize: lyricsSize,
                          fontFamily: 'Tamil003',
                          lineHeight: lyricsLineHeight,
                          letterSpacing: lyricsSpacing,
                          includeFontPadding: false,
                        }}
                      >
                        {line.content.trim() === '' ? ' ' : 
                          (showCombinedLyrics ? 
                            line.content.split(/([a-zA-Z]+)/).map((part, i) => 
                              /^[a-zA-Z]+$/.test(part) ? (
                                <Text key={i} style={{ color: colors.subtext, fontFamily: 'Tamil003', fontSize: lyricsSize, lineHeight: lyricsLineHeight, letterSpacing: lyricsSpacing, includeFontPadding: false }}>
                                  {part}
                                </Text>
                              ) : (
                                <Text key={i} style={{ color: line.isRefrain ? NEON_BLUE : colors.text, fontFamily: 'Tamil003', fontSize: lyricsSize, lineHeight: lyricsLineHeight, letterSpacing: lyricsSpacing, includeFontPadding: false }}>
                                  {part}
                                </Text>
                              )
                            ) 
                          : line.content)
                        }
                      </Text>
                    ))}
                  </View>
                </View>
              ))}
            </ScrollView>

          {/* STANDALONE TEXT SETTINGS */}
          {showTextSettings && (
            <Animated.View style={[StyleSheet.absoluteFill, { zIndex: 999 }]}>
              <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.7)', opacity: settingsFadeAnim }]}>
                <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowTextSettings(false)} />
              </Animated.View>
              <Animated.View style={[styles.settingsCard, { position: 'absolute', bottom: 0, width: '100%', backgroundColor: isDark ? '#12161E' : '#FFFFFF', borderColor: colors.border, borderWidth: 1, transform: [{ translateY: settingsSlideAnim }] }]}>
                <View style={styles.settingsHeader}>
                  <Text style={{ color: colors.text, fontSize: appFontSize + 2, fontFamily: 'Tamil008', includeFontPadding: false }}>Reading Preferences</Text>
                  <ScalePressable onPress={() => { triggerHaptic(); setShowTextSettings(false); }}>
                    <Ionicons name="close" size={28} color={colors.text} />
                  </ScalePressable>
                </View>
                <ScrollView showsVerticalScrollIndicator={false}>
                  <Text style={[styles.settingLabel, { color: colors.primary, fontSize: appFontSize - 2 }]}>Title Settings</Text>
                  <Text style={{ color: colors.subtext, fontSize: appFontSize, fontFamily: 'Tamil003' }}>Font Size: {titleSize}</Text>
                  <Slider minimumValue={16} maximumValue={30} step={1} value={titleSize} onValueChange={setTitleSize} minimumTrackTintColor={colors.primary} maximumTrackTintColor={colors.border} />
                  <Text style={[styles.settingLabel, { color: colors.primary, marginTop: 25, fontSize: appFontSize - 2 }]}>Lyrics Settings</Text>
                  <Text style={{ color: colors.subtext, fontSize: appFontSize, fontFamily: 'Tamil003' }}>Font Size: {lyricsSize}</Text>
                  <Slider minimumValue={12} maximumValue={35} step={1} value={lyricsSize} onValueChange={setLyricsSize} minimumTrackTintColor={colors.primary} maximumTrackTintColor={colors.border} />
                  <Text style={{ color: colors.subtext, fontSize: appFontSize, fontFamily: 'Tamil003' }}>Line Spacing: {lyricsLineHeight}</Text>
                  <Slider minimumValue={20} maximumValue={60} step={1} value={lyricsLineHeight} onValueChange={setLyricsLineHeight} minimumTrackTintColor={colors.primary} maximumTrackTintColor={colors.border} />
                  <ScalePressable onPress={() => { triggerHaptic(Haptics.ImpactFeedbackStyle.Success); restoreDefaultTextSettings(); }}>
                    <View style={[styles.restoreBtn, { backgroundColor: colors.glow, borderColor: colors.primary, borderWidth: 1 }]}>
                      <Ionicons name="refresh" size={20} color={colors.primary} />
                      <Text style={{ color: colors.primary, marginLeft: 8, fontSize: appFontSize, fontFamily: 'Tamil003', includeFontPadding: false }}>Restore Defaults</Text>
                    </View>
                  </ScalePressable>
                </ScrollView>
              </Animated.View>
            </Animated.View>
          )}
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginTop: 20, marginBottom: 15 },
  headerTitle: { fontSize: 32, fontFamily: 'Tamil003', includeFontPadding: false },
  headerSubtitle: { fontSize: 16, marginTop: 4, textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: '600', includeFontPadding: false },
  searchIconBtn: { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(128,128,128,0.1)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(128,128,128,0.2)' },
  
  scrollContent: { padding: 15, paddingBottom: 40 },
  card: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, borderLeftWidth: 4, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  iconContainer: { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  textContainer: { flex: 1, justifyContent: 'center' },
  
  tamilText: { fontFamily: 'Tamil003', marginBottom: 2, includeFontPadding: false },
  tamilSubText: { fontFamily: 'Tamil003', includeFontPadding: false },
  
  // Global Search Styles
  globalSearchHeader: { flexDirection: 'row', alignItems: 'center', padding: 10, borderBottomWidth: 1, paddingBottom: 15 },
  globalSearchInputBox: { flex: 1, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 45, marginLeft: 10 },
  globalSongCard: { flexDirection: 'row', alignItems: 'center', padding: 12, marginBottom: 10, borderRadius: 16, borderWidth: 1 },
  numberCircle: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12, borderWidth: 1 },
  songTitle: { marginBottom: 2 },

  // Modal Styles
  modalContainer: { flex: 1, position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 10, borderBottomWidth: 1 },
  textSettingsBtn: { flexDirection: 'row', alignItems: 'center', padding: 8, backgroundColor: 'rgba(128,128,128,0.2)', borderRadius: 12, marginRight: 5 },
  settingsCard: { width: '100%', maxHeight: '80%', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 30 },
  settingsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
  settingLabel: { fontFamily: 'Tamil008', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 15 },
  restoreBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 16, borderRadius: 16, marginTop: 40, marginBottom: 20 }
});