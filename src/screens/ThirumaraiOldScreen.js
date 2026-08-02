import { getThiruDb } from '../utils/SongDb';
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, Modal, ScrollView, Keyboard, Share, Animated, BackHandler, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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

const { height } = Dimensions.get('window');
const BRIGHT_YELLOW = '#FFD700';
const NEWLINE = String.fromCharCode(10);
const NEON_BLUE = '#00F0FF';

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

const SongItem = React.memo(({ item, index, listAnim, isFavorite, onPress, onToggleFavorite, colors, isDark, appFontSize }) => {
  const translateY = listAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [30 + (index % 10) * 5, 0] 
  });
  return (
    <Animated.View style={{ opacity: listAnim, transform: [{ translateY }] }}>
      <ScalePressable onPress={() => onPress(item)}>
        <View style={[styles.songCard, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: isDark ? 'transparent' : '#ccc', elevation: isDark ? 0 : 2 }]}>
          <View style={[styles.numberCircle, { borderColor: colors.primary, backgroundColor: colors.glow }]}>
            <Text style={{ color: colors.primary, fontWeight: '900', fontSize: appFontSize }}>{item.song_number || item.id || '?'}</Text>
          </View>
          <View style={styles.titleContainer}>
            <Text style={[styles.songTitle, { color: colors.text, fontFamily: 'Tamil008', fontSize: appFontSize + 2 }]} numberOfLines={1}>{item.title_tamil || 'Unknown'}</Text>
          </View>
          <AnimatedHeart isFavorite={isFavorite} onPress={() => onToggleFavorite(item.id)} inactiveColor={colors.subtext} activeColor="red" />
        </View>
      </ScalePressable>
    </Animated.View>
  );
});

const LetterGridItem = React.memo(({ letter, index, listAnim, onPress, colors, appFontSize }) => {
  const translateY = listAnim.interpolate({ inputRange: [0, 1], outputRange: [20 + (index % 5) * 5, 0] });
  return (
    <Animated.View style={{ flex: 1, margin: 5, opacity: listAnim, transform: [{ translateY }] }}>
      <ScalePressable onPress={() => onPress(letter)}>
        <View style={[styles.gridItemCompact, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: appFontSize + 2 }}>{letter}</Text>
        </View>
      </ScalePressable>
    </Animated.View>
  );
});

export default function ThirumaraiOldScreen() {
  const navigation = useNavigation();
  const { colors, isDark, appFontSize, hapticsEnabled, titleSize, setTitleSize, titleSpacing, setTitleSpacing, lyricsSize, setLyricsSize, lyricsSpacing, setLyricsSpacing, lyricsLineHeight, setLyricsLineHeight, restoreDefaultTextSettings } = useSettings();
  
  const [songs, setSongs] = useState([]);
  const [search, setSearch] = useState('');
  const [isNumericKeyboard, setIsNumericKeyboard] = useState(true);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [favorites, setFavorites] = useState(new Set());
  
  const [sortOrder, setSortOrder] = useState('number'); 
  const [selectedLetter, setSelectedLetter] = useState('All');
  const [isAlphabetMode, setIsAlphabetMode] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);

  const [selectedSongIndex, setSelectedSongIndex] = useState(null);
  const [showTextSettings, setShowTextSettings] = useState(false);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const flatListRef = useRef(null);
  const headerSlide = useRef(new Animated.Value(-50)).current;
  const listAnim = useRef(new Animated.Value(0)).current;
  const fabOpacity = useRef(new Animated.Value(0)).current;
  const fabTranslateY = useRef(new Animated.Value(50)).current;
  const settingsSlideAnim = useRef(new Animated.Value(height)).current;
  const settingsFadeAnim = useRef(new Animated.Value(0)).current;

  const numericInputRef = useRef(null);
  const textInputRef = useRef(null);
  const lyricsScrollRef = useRef(null);

  const triggerHaptic = useCallback((style = Haptics.ImpactFeedbackStyle.Medium) => { 
    if (hapticsEnabled) Haptics.impactAsync(style); 
  }, [hapticsEnabled]);

  useFocusEffect(
    useCallback(() => {
      headerSlide.setValue(-50);
      listAnim.setValue(0);
      Animated.parallel([
        Animated.timing(headerSlide, { toValue: 0, duration: 400, useNativeDriver: true }),
        Animated.timing(listAnim, { toValue: 1, duration: 500, useNativeDriver: true })
      ]).start();
    }, [])
  );

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fabOpacity, { toValue: showScrollTop ? 1 : 0, duration: 250, useNativeDriver: true }),
      Animated.spring(fabTranslateY, { toValue: showScrollTop ? 0 : 50, friction: 6, useNativeDriver: true })
    ]).start();
  }, [showScrollTop]);

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

  useEffect(() => {
    const backAction = () => {
      if (showTextSettings) { setShowTextSettings(false); return true; }
      if (selectedSongIndex !== null) { closeReadingScreen(); return true; }
      if (showSortMenu) { setShowSortMenu(false); return true; }
      if (isAlphabetMode) { 
        setIsAlphabetMode(false); 
        setSelectedLetter('All');
        setSortOrder('number');
        return true; 
      }
      return false; 
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [isAlphabetMode, selectedSongIndex, showSortMenu, showTextSettings]);

  useEffect(() => { loadFavorites(); fetchSongs(); }, []);
  useEffect(() => { if (selectedSongIndex !== null) activateKeepAwakeAsync(); else deactivateKeepAwake(); }, [selectedSongIndex]);

  const loadFavorites = async () => {
    try {
      const stored = await AsyncStorage.getItem('@thirumarai_old_favs');
      if (stored) setFavorites(new Set(JSON.parse(stored)));
    } catch(e) { console.warn("Fav load error", e); }
  };

  const toggleFavorite = useCallback(async (songId) => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    setFavorites(prev => {
      const newFavs = new Set(prev);
      if (newFavs.has(songId)) newFavs.delete(songId); else newFavs.add(songId);
      AsyncStorage.setItem('@thirumarai_old_favs', JSON.stringify([...newFavs])).catch(e => console.warn(e));
      return newFavs;
    });
  }, [triggerHaptic]);

  const fetchSongs = async () => {
    let db = null;
    try {
      db = await getThiruDb();
      const result = await db.getAllAsync('SELECT * FROM SongListTable'); 
      const validSongs = (result || []).filter(s => s.song_number != null && s.song_number !== '');
      const cleanedSongs = validSongs.map(s => ({ 
        ...s,
        id: s.song_number,
        song_number: s.song_number,
        title_tamil: s.song_title_tamil,
        title: s.song_title_tamil, 
        title_english: s.song_title_english,
        lyrics: s.lyrics
      }));
      setSongs(cleanedSongs);
    } catch (e) { 
      setSongs([]); 
    }
  };

  const alphabetLetters = useMemo(() => {
    try {
      const letters = new Set();
      songs.forEach(s => {
        if (s.title) {
          const match = s.title.match(/[\u0B85-\u0BB9][\u0BBE-\u0BCD]?|[A-Za-z]/);
          if (match) letters.add(match[0].toUpperCase());
        }
      });
      return Array.from(letters).sort((a, b) => a.localeCompare(b, 'ta')); 
    } catch(e) { return []; }
  }, [songs]);

  const filteredSongs = useMemo(() => {
    try {
      let filtered = songs.filter(song => {
        if (showFavoritesOnly && !favorites.has(song.id)) return false;
        if (selectedLetter !== 'All' && song.title) {
          const match = song.title.match(/[\u0B85-\u0BB9][\u0BBE-\u0BCD]?|[A-Za-z]/);
          const baseLetter = match ? match[0].toUpperCase() : '';
          if (baseLetter !== selectedLetter) return false;
        }
        if (search === '') return true;
        const term = search.toLowerCase().trim();
        const songNum = song.song_number || song.id || '';
        const searchTamil = song.title_tamil?.toLowerCase() || '';
        const searchEnglish = song.title_english?.toString().toLowerCase() || '';
        return (songNum.toString().includes(term)) || (searchTamil.includes(term)) || (searchEnglish.includes(term));
      });

      if (sortOrder === 'alpha' || selectedLetter !== 'All') {
        filtered.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
      } else {
        filtered.sort((a, b) => parseInt(a.song_number || a.id || 0) - parseInt(b.song_number || b.id || 0));
      }
      return filtered;
    } catch(e) { return songs; }
  }, [songs, search, showFavoritesOnly, selectedLetter, sortOrder, favorites]);

  const handleSearchTyping = (text) => {
    setSearch(text);
    if (showFavoritesOnly) setShowFavoritesOnly(false);
    if (isAlphabetMode) setIsAlphabetMode(false);
    if (selectedLetter !== 'All') setSelectedLetter('All');
  };

  const clearAllFilters = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    setSearch('');
    setShowFavoritesOnly(false);
    setSortOrder('number');
    setIsAlphabetMode(false);
    setSelectedLetter('All');
  };

  const hasFiltersActive = search !== '' || showFavoritesOnly || sortOrder !== 'number' || selectedLetter !== 'All';

  const handleToggleFavoritesList = () => {
    triggerHaptic();
    setShowFavoritesOnly(!showFavoritesOnly);
    setSearch('');
    setIsAlphabetMode(false);
    setSelectedLetter('All');
  };

  const selectNumberOrder = () => {
    triggerHaptic();
    setSortOrder('number');
    setIsAlphabetMode(false);
    setSelectedLetter('All');
    setShowSortMenu(false);
  };

  const selectAlphabetOrder = () => {
    triggerHaptic();
    setSortOrder('alpha');
    setIsAlphabetMode(true);
    setSelectedLetter('All');
    setShowSortMenu(false);
  };

  const handleShare = async (song) => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    try { await Share.share({ message: `${song.song_number || song.id} - ${song.title_tamil}\n\n${song.lyrics}\n\n✨join our WhatsApp channel:\nhttps://whatsapp.com/channel/0029Vb6Pu8FLI8YfM5H49e0p \n\n📲Download our APP in Play Store : https://play.google.com/store/apps/details?id=com.adventisttamiltool.adventisttamiltool` }); } catch (error) { console.log(error.message); }
  };

  const changeSong = (direction) => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    const newIndex = selectedSongIndex + direction;
    if (newIndex >= 0 && newIndex < filteredSongs.length) {
      setSelectedSongIndex(newIndex);
      lyricsScrollRef.current?.scrollTo({ y: 0, animated: false }); 
    }
  };

  const closeReadingScreen = () => { 
    setSelectedSongIndex(null); 
  };

  const toggleKeyboardType = (isNumeric) => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    setIsNumericKeyboard(isNumeric);
    setTimeout(() => { if (isNumeric) numericInputRef.current?.focus(); else textInputRef.current?.focus(); }, 50);
  };

  const handleScroll = (event) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    if (offsetY > 400 && !showScrollTop) setShowScrollTop(true);
    if (offsetY <= 400 && showScrollTop) setShowScrollTop(false);
  };

  const scrollToTop = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  const activeSong = selectedSongIndex !== null ? filteredSongs[selectedSongIndex] : null;

  const lyricStanzas = useMemo(() => {
    const text = activeSong && activeSong.lyrics ? activeSong.lyrics : '';
    if (!text) return [];
    const rawLines = text.split(NEWLINE);
    const numberPattern = /^\s*(\d{1,3}[.)])\s*(.*)$/;

    const isRefrainLine = (line, nextLine) => {
      const trimmed = line.trim();
      if (trimmed.indexOf('~') !== 0) return false;
      if (nextLine === undefined) return true;
      return nextLine.trim() === '';
    };

    const stanzas = [];
    let currentNumber = null;
    let currentLines = [];

    const flush = () => {
      while (currentLines.length > 0 && currentLines[currentLines.length - 1].content.trim() === '') currentLines.pop();
      while (currentLines.length > 0 && currentLines[0].content.trim() === '') currentLines.shift();
      if (currentLines.length > 0) stanzas.push({ number: currentNumber, lines: currentLines });
    };

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i];
      const nextLine = rawLines[i + 1];
      const match = line.match(numberPattern);
      if (match) {
        flush();
        currentNumber = match[1];
        const rest = match[2];
        currentLines = [{ content: rest, isRefrain: isRefrainLine(rest, nextLine) }];
      } else {
        currentLines.push({ content: line, isRefrain: isRefrainLine(line, nextLine) });
      }
    }
    flush();

    return stanzas.length > 0 ? stanzas : [{ number: null, lines: [{ content: text.trim(), isRefrain: false }] }];
  }, [activeSong]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient colors={isDark ? ['#0A1929', colors.background] : ['#FFFFFF', colors.background]} style={StyleSheet.absoluteFillObject} />

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        
        <Animated.View style={[styles.headerWrapper, { transform: [{ translateY: headerSlide }] }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <ScalePressable onPress={() => { triggerHaptic(); navigation.goBack(); }} style={{ marginRight: 10 }}>
              <View style={{ height: 50, width: 50, borderRadius: 25, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="chevron-back" size={28} color={colors.primary} />
              </View>
            </ScalePressable>

            <View style={[styles.searchPill, { flex: 1, backgroundColor: colors.card, borderColor: colors.border, marginBottom: 0 }]}>
              <View style={{ flex: 1 }}>
                <TextInput ref={textInputRef} style={[styles.searchInput, { color: colors.text, fontSize: appFontSize, fontFamily: 'Tamil003', display: !isNumericKeyboard ? 'flex' : 'none' }]} placeholder="ஏசுவின் / Yesuvin" placeholderTextColor={colors.subtext} keyboardType="default" value={search} onChangeText={handleSearchTyping} autoCorrect={false} />
                <TextInput ref={numericInputRef} style={[styles.searchInput, { color: colors.text, fontSize: appFontSize, fontFamily: 'Tamil003', display: isNumericKeyboard ? 'flex' : 'none' }]} placeholder="Search Number..." placeholderTextColor={colors.subtext} keyboardType="number-pad" value={search} onChangeText={handleSearchTyping} />
              </View>

              {search.length > 0 && (
                <ScalePressable onPress={() => { triggerHaptic(); setSearch(''); Keyboard.dismiss(); }} style={{ paddingHorizontal: 10 }}>
                  <Ionicons name="close-circle" size={20} color={colors.subtext} />
                </ScalePressable>
              )}

              <View style={[styles.inlineToggleContainer, { backgroundColor: isDark ? '#2A2D35' : '#E5E7EB' }]}>
                <TouchableOpacity style={[styles.inlineToggleBtn, !isNumericKeyboard && { backgroundColor: isDark ? '#FFFFFF' : '#111827' }]} onPress={() => toggleKeyboardType(false)}>
                  <Text style={{ color: !isNumericKeyboard ? (isDark ? '#000000' : '#FFFFFF') : colors.subtext, fontWeight: 'bold', fontSize: 12 }}>ABC</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.inlineToggleBtn, isNumericKeyboard && { backgroundColor: isDark ? '#FFFFFF' : '#111827' }]} onPress={() => toggleKeyboardType(true)}>
                  <Text style={{ color: isNumericKeyboard ? (isDark ? '#000000' : '#FFFFFF') : colors.subtext, fontWeight: 'bold', fontSize: 12 }}>123</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

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
              <View style={[styles.chipBtn, { borderColor: colors.border, backgroundColor: isAlphabetMode ? colors.primary + '20' : colors.card }]}>
                <MaterialCommunityIcons name={sortOrder === 'number' ? "sort-numeric-ascending" : "sort-alphabetical-ascending"} size={16} color={isAlphabetMode ? colors.primary : colors.text} />
                <Text style={{ color: isAlphabetMode ? colors.primary : colors.text, marginLeft: 6, fontSize: appFontSize - 2, fontWeight: 'bold' }}>Sort</Text>
              </View>
            </ScalePressable>

            <ScalePressable onPress={handleToggleFavoritesList} style={{ marginRight: 8 }}>
              <View style={[styles.chipBtn, { borderColor: colors.border, backgroundColor: showFavoritesOnly ? 'rgba(255,0,0,0.1)' : colors.card }]}>
                <Ionicons name={showFavoritesOnly ? "heart" : "heart-outline"} size={14} color={showFavoritesOnly ? "red" : colors.text} />
                <Text style={{ color: showFavoritesOnly ? "red" : colors.text, marginLeft: 6, fontSize: appFontSize - 2, fontWeight: 'bold' }}>Favorites</Text>
              </View>
            </ScalePressable>
          </ScrollView>
        </Animated.View>

        {isAlphabetMode ? (
          <FlatList 
            ref={flatListRef}
            key="grid-view-5-cols"
            data={alphabetLetters} 
            keyExtractor={(item) => item} 
            numColumns={5}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={false} 
            contentContainerStyle={{ paddingHorizontal: 10, paddingBottom: 120, paddingTop: 10 }}
            ListHeaderComponent={
              <ScalePressable onPress={() => { triggerHaptic(); selectNumberOrder(); }}>
                <View style={[styles.backToGridBtn, { backgroundColor: colors.primary + '20', borderColor: colors.primary, marginHorizontal: 5 }]}>
                  <Ionicons name="arrow-back" size={20} color={colors.primary} />
                  <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: appFontSize, marginLeft: 8 }}>Back to Numbers</Text>
                </View>
              </ScalePressable>
            }
            renderItem={({ item, index }) => (
              <LetterGridItem letter={item} index={index} listAnim={listAnim} colors={colors} appFontSize={appFontSize} onPress={(letter) => { triggerHaptic(Haptics.ImpactFeedbackStyle.Medium); setSelectedLetter(letter); setIsAlphabetMode(false); }} />
            )}
          />
        ) : (
          <FlatList 
            ref={flatListRef}
            key="list-view"
            data={filteredSongs} 
            keyExtractor={(item) => item.id.toString()} 
            numColumns={1}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={false} 
            keyboardShouldPersistTaps="handled" 
            keyboardDismissMode="on-drag" 
            contentContainerStyle={{ paddingHorizontal: 15, paddingBottom: 120, paddingTop: 10 }}
            ListHeaderComponent={
              selectedLetter !== 'All' ? (
                <ScalePressable onPress={() => { triggerHaptic(); setIsAlphabetMode(true); setSelectedLetter('All'); }}>
                  <View style={[styles.backToGridBtn, { backgroundColor: colors.primary + '20', borderColor: colors.primary }]}>
                    <Ionicons name="arrow-back" size={20} color={colors.primary} />
                    <Text style={{ color: colors.primary, fontFamily: 'Tamil003', fontSize: appFontSize, marginLeft: 8 }}>அகர வரிசைக்குச் செல் (Back)</Text>
                  </View>
                </ScalePressable>
              ) : null
            }
            renderItem={({ item, index }) => (
              <SongItem item={item} index={index} listAnim={listAnim} isFavorite={favorites.has(item.id)} colors={colors} isDark={isDark} appFontSize={appFontSize} onToggleFavorite={toggleFavorite} onPress={(song) => { triggerHaptic(Haptics.ImpactFeedbackStyle.Light); Keyboard.dismiss(); setSelectedSongIndex(index); }} />
            )}
            ListEmptyComponent={
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 100 }}>
                 <Ionicons name="search" size={60} color={colors.border} />
                 <Text style={{ color: colors.subtext, fontSize: appFontSize, marginTop: 15 }}>No songs found matching your search.</Text>
              </View>
            }
          />
        )}

        <Animated.View style={[styles.fabContainer, { opacity: fabOpacity, transform: [{ translateY: fabTranslateY }] }]} pointerEvents={showScrollTop ? 'auto' : 'none'}>
          <TouchableOpacity onPress={scrollToTop} style={[styles.fab, { backgroundColor: isDark ? '#1F2937' : '#FFFFFF', borderColor: colors.border }]} activeOpacity={0.8}>
            <Ionicons name="arrow-up" size={26} color={colors.primary} />
          </TouchableOpacity>
        </Animated.View>

      </SafeAreaView>

      <Modal visible={showSortMenu} transparent animationType="fade">
        <BlurView intensity={60} tint="dark" style={styles.modalBg}>
          <View style={[styles.sortModalCard, { backgroundColor: isDark ? '#12161E' : '#FFFFFF', borderColor: colors.border, borderWidth: 1 }]}>
            <Text style={[styles.modalHeaderTitle, { color: colors.text, fontSize: appFontSize + 4 }]}>Sort Options</Text>
            <ScalePressable onPress={selectNumberOrder}>
              <View style={[styles.sortBtn, { borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
                <MaterialCommunityIcons name="sort-numeric-ascending" size={28} color={sortOrder === 'number' ? colors.primary : colors.text} />
                <Text style={{ color: sortOrder === 'number' ? colors.primary : colors.text, fontSize: appFontSize + 2, fontFamily: 'Tamil003', marginLeft: 15 }}>🔢 எண் வரிசை (Number Order)</Text>
              </View>
            </ScalePressable>
            <ScalePressable onPress={selectAlphabetOrder}>
              <View style={styles.sortBtn}>
                <MaterialCommunityIcons name="sort-alphabetical-ascending" size={28} color={sortOrder === 'alpha' ? colors.primary : colors.text} />
                <Text style={{ color: sortOrder === 'alpha' ? colors.primary : colors.text, fontSize: appFontSize + 2, fontFamily: 'Tamil003', marginLeft: 15 }}>🔠 அகர வரிசை (Alphabetical)</Text>
              </View>
            </ScalePressable>
            <TouchableOpacity onPress={() => setShowSortMenu(false)} style={{ padding: 20, alignItems: 'center', borderTopWidth: 1, borderColor: colors.border }}>
              <Text style={{ color: '#FF3B30', fontSize: appFontSize, fontWeight: 'bold' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </BlurView>
      </Modal>

      <Modal visible={selectedSongIndex !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeReadingScreen} onDismiss={closeReadingScreen}>
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <LinearGradient colors={isDark ? ['#0A1929', colors.background] : ['#FFFFFF', colors.background]} style={StyleSheet.absoluteFillObject} />
          <SafeAreaView style={{ flex: 1 }}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <ScalePressable onPress={() => { triggerHaptic(); closeReadingScreen(); }}>
                <View style={{ padding: 10 }}>
                  <Ionicons name="chevron-down" size={32} color={BRIGHT_YELLOW} />
                </View>
              </ScalePressable>
              <View style={{ flex: 1, alignItems: 'center', paddingHorizontal: 10 }}>
                 <Text style={{ color: colors.primary, fontFamily: 'Tamil008', fontSize: titleSize, letterSpacing: titleSpacing, textShadowColor: isDark ? colors.glow : 'transparent', textShadowRadius: 10 }} numberOfLines={1}>
                   {activeSong?.song_number || activeSong?.id} - {activeSong?.title_tamil}
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
              </View>
            </View>

            <ScrollView ref={lyricsScrollRef} contentContainerStyle={{ padding: 30, paddingBottom: 150 }} keyboardDismissMode="on-drag">
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
                        {line.content.trim() === '' ? ' ' : line.content}
                      </Text>
                    ))}
                  </View>
                </View>
              ))}
            </ScrollView>

            {activeSong && (
              <View style={styles.floatCenterClear}>
                <ScalePressable onPress={() => { triggerHaptic(); closeReadingScreen(); }}>
                  <View style={{ padding: 10, marginRight: 5 }}>
                    <Ionicons name="chevron-down-circle" size={40} color={BRIGHT_YELLOW} />
                  </View>
                </ScalePressable>
                <AnimatedHeart isFavorite={favorites.has(activeSong.id)} onPress={() => toggleFavorite(activeSong.id)} inactiveColor={BRIGHT_YELLOW} activeColor={BRIGHT_YELLOW} size={40} />
              </View>
            )}

            {selectedSongIndex > 0 && (
              <BlurView intensity={80} tint={isDark ? "dark" : "light"} style={[styles.floatLeft, { backgroundColor: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.6)', borderColor: colors.border }]}>
                <ScalePressable onPress={() => changeSong(-1)}>
                  <View style={styles.blurBtnContent}>
                    <Ionicons name="arrow-back" size={28} color={BRIGHT_YELLOW} />
                  </View>
                </ScalePressable>
              </BlurView>
            )}

            {selectedSongIndex < filteredSongs.length - 1 && (
              <BlurView intensity={80} tint={isDark ? "dark" : "light"} style={[styles.floatRight, { backgroundColor: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.6)', borderColor: colors.border }]}>
                <ScalePressable onPress={() => changeSong(1)}>
                  <View style={styles.blurBtnContent}>
                    <Ionicons name="arrow-forward" size={28} color={BRIGHT_YELLOW} />
                  </View>
                </ScalePressable>
              </BlurView>
            )}
          </SafeAreaView>

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
                  <Text style={{ color: colors.subtext, fontSize: appFontSize }}>Letter Spacing: {lyricsSpacing}</Text>
                  <Slider minimumValue={0} maximumValue={5} step={0.5} value={lyricsSpacing} onValueChange={setLyricsSpacing} minimumTrackTintColor={colors.primary} maximumTrackTintColor={colors.border} />
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
  searchPill: { flexDirection: 'row', alignItems: 'center', borderRadius: 30, borderWidth: 1, paddingLeft: 15, paddingRight: 6, height: 50, marginBottom: 12 },
  searchInput: { flex: 1, height: '100%' },
  inlineToggleContainer: { flexDirection: 'row', borderRadius: 20, padding: 3, marginLeft: 8 },
  inlineToggleBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  filterChipsRow: { flexDirection: 'row', alignItems: 'center' },
  chipBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, marginRight: 8 },
  songCard: { flexDirection: 'row', alignItems: 'center', padding: 10, marginBottom: 8, borderRadius: 16, borderWidth: 1 },
  numberCircle: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12, borderWidth: 1 },
  titleContainer: { flex: 1, justifyContent: 'center' },
  songTitle: { marginBottom: 2 },
  backToGridBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 15, borderRadius: 16, marginBottom: 15, borderWidth: 1 },
  gridItemCompact: { paddingVertical: 12, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.2, shadowRadius: 3 },
  fabContainer: { position: 'absolute', bottom: 25, alignSelf: 'center', zIndex: 10 },
  fab: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', borderWidth: 1, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 8 },
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
  floatLeft: { position: 'absolute', bottom: 20, left: 20, borderRadius: 25, overflow: 'hidden', borderWidth: 1 },
  floatRight: { position: 'absolute', bottom: 20, right: 20, borderRadius: 25, overflow: 'hidden', borderWidth: 1 },
  floatCenterClear: { position: 'absolute', bottom: 25, left: '20%', right: '20%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  blurBtnContent: { width: 55, height: 55, justifyContent: 'center', alignItems: 'center' }
});
