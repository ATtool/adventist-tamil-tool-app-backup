import { getZionDb, getThiruDb } from '../utils/SongDb';
import React, { useRef, useCallback, useState, useMemo, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Animated, Modal, TextInput, FlatList, Keyboard, Share, Dimensions, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSettings } from '../context/SettingsContext';
import * as SQLite from 'expo-sqlite';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
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

export default function SongsScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets(); 
  const { colors, isDark, appFontSize, hapticsEnabled, titleSize, setTitleSize, titleSpacing, setTitleSpacing, lyricsSize, setLyricsSize, lyricsSpacing, setLyricsSpacing, lyricsLineHeight, setLyricsLineHeight, restoreDefaultTextSettings } = useSettings();

  // --- ANIMATION VALUES ---
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const cardAnims = useRef([...Array(5)].map(() => new Animated.Value(50))).current; 
  const cardOpacities = useRef([...Array(5)].map(() => new Animated.Value(0))).current;

  // --- GLOBAL SEARCH STATE ---
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [allSongsCache, setAllSongsCache] = useState([]);
  const [isFetching, setIsFetching] = useState(false);
  const [activeGlobalSong, setActiveGlobalSong] = useState(null);

  // --- TEXT SETTINGS STATE ---
  const [showTextSettings, setShowTextSettings] = useState(false);
  const settingsSlideAnim = useRef(new Animated.Value(height)).current;
  const settingsFadeAnim = useRef(new Animated.Value(0)).current;

  const triggerHaptic = useCallback((style = Haptics.ImpactFeedbackStyle.Medium) => { 
    if (hapticsEnabled) Haptics.impactAsync(style); 
  }, [hapticsEnabled]);

  useFocusEffect(
    useCallback(() => {
      headerOpacity.setValue(0);
      cardAnims.forEach(anim => anim.setValue(50));
      cardOpacities.forEach(anim => anim.setValue(0));

      const animations = cardAnims.map((anim, index) => {
        return Animated.parallel([
          Animated.spring(anim, { toValue: 0, friction: 8, tension: 50, useNativeDriver: true }),
          Animated.timing(cardOpacities[index], { toValue: 1, duration: 300, useNativeDriver: true })
        ]);
      });

      Animated.sequence([
        Animated.timing(headerOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.stagger(100, animations)
      ]).start();

      return () => {};
    }, [])
  );

  useEffect(() => {
    if (activeGlobalSong !== null) activateKeepAwakeAsync(); else deactivateKeepAwake();
  }, [activeGlobalSong]);

  // Handle Text Settings Modal Animation
  useEffect(() => {
    if (showTextSettings) {
      Animated.parallel([
        Animated.spring(settingsSlideAnim, { toValue: 0, friction: 9, tension: 65, useNativeDriver: true }),
        Animated.timing(settingsFadeAnim, { toValue: 1, duration: 200, useNativeDriver: true })
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(settingsSlideAnim, { toValue: height, duration: 250, useNativeDriver: true }),
        Animated.timing(settingsFadeAnim, { toValue: 0, duration: 250, useNativeDriver: true })
      ]).start();
    }
  }, [showTextSettings]);

  const lyricStanzas = useMemo(() => {
    const text = activeGlobalSong && activeGlobalSong.lyrics ? activeGlobalSong.lyrics : '';
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
  }, [activeGlobalSong]);

  // --- THE GLOBAL FETCH ENGINE ---
  const openGlobalSearch = async () => {
    triggerHaptic();
    setIsSearchOpen(true);
    
    // Only fetch if we haven't already cached it during this session
    if (allSongsCache.length === 0) {
      setIsFetching(true);
      try {
        let masterList = [];

        // 1. Fetch Zion 
        const zionDb = await getZionDb();
        const zionRes = await zionDb.getAllAsync('SELECT * FROM songs');
        masterList = [...masterList, ...zionRes.map((s, index) => ({
          global_id: `zion_${index}`,
          source: 'சீயோன் இனிய கீதங்கள்',
          sourceColor: ACCENT_ZION,
          num: s.song_number || '?', 
          title_tamil: s.title_tamil || 'Unknown Title',
          search_en: s.title_english || '',
          lyrics: s.lyrics
        }))];

        // 2. Fetch Thirumarai (Old & Hope) 
        const thiruDb = await getThiruDb();
        const thiruRes = await thiruDb.getAllAsync('SELECT * FROM SongListTable');
        
        // We use forEach instead of map so one row can safely create TWO search results if needed!
        thiruRes.forEach((s, index) => {
          const hasHope = s.Song_number_by_Nambikaiyen_Geethagal != null && s.Song_number_by_Nambikaiyen_Geethagal !== '';
          const hasOld = s.song_number != null && s.song_number !== '';

          if (hasHope) {
            masterList.push({
              global_id: `thiru_hope_${index}`,
              source: 'திருமறைத்திருப் பாடல் நம்பிக்கையின் கீதங்கள் புத்தக வரிசை',
              sourceColor: ACCENT_HOPE,
              num: s.Song_number_by_Nambikaiyen_Geethagal,
              title_tamil: s.song_title_tamil || 'Unknown Title',
              search_en: s.song_title_english || '',
              lyrics: s.lyrics
            });
          }

          if (hasOld) {
            masterList.push({
              global_id: `thiru_old_${index}`,
              source: 'திருமறைத்திருப் பாடல் பழைய புத்தக வரிசை',
              sourceColor: ACCENT_OLD,
              num: s.song_number,
              title_tamil: s.song_title_tamil || 'Unknown Title',
              search_en: s.song_title_english || '',
              lyrics: s.lyrics
            });
          }
        });

        // 3. Fetch Other Songs from GIST
        try {
          const GIST_RAW_URL = 'https://gist.githubusercontent.com/ATtool/cf27796976a73404f254b4bc81240f5f/raw/other_songs.json';
          const cacheBusterUrl = `${GIST_RAW_URL}?t=${new Date().getTime()}`;
          const response = await fetch(cacheBusterUrl, {
            headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
          });
          const otherRes = await response.json();
          masterList = [...masterList, ...(otherRes || []).map((s, index) => ({
            global_id: `other_${index}`,
            source: 'இதர பாடல்கள்',
            sourceColor: ACCENT_OTHER,
            num: s.song_number || s.id || '?', 
            title_tamil: s.title_tamil || 'Unknown Title',
            search_en: s.title_english || s.title_thanglish || '',
            lyrics: s.lyrics || ''
          }))];
        } catch (gistError) {
          console.error("Global Search - Other Songs Fetch Error:", gistError);
        }

        // 4. Fetch Custom Songs
        const customRes = getCustomSongs();
        masterList = [...masterList, ...customRes.map((s, index) => ({
          global_id: `custom_${index}`,
          source: 'எனது பாடல்கள்',
          sourceColor: ACCENT_CUSTOM,
          num: s.id.toString(),
          title_tamil: s.title_tamil || 'Unknown Title',
          search_en: s.title_thanglish || '',
          lyrics: s.lyrics
        }))];

        setAllSongsCache(masterList);
      } catch (error) {
        console.error("Global Search Fetch Error:", error);
      }
      setIsFetching(false);
    }
  };

  const filteredGlobalSongs = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const term = searchQuery.toLowerCase().trim();
    
    return allSongsCache.filter(song => {
      const numStr = song.num ? song.num.toString().toLowerCase() : '';
      const tamStr = song.title_tamil ? song.title_tamil.toLowerCase() : '';
      const engStr = song.search_en ? song.search_en.toString().toLowerCase() : '';
      
      // FIXED RULE: Numbers must match exactly. Text can match partially.
      const isExactNumberMatch = numStr === term;
      const isPartialTextMatch = tamStr.includes(term) || engStr.includes(term);
      
      return isExactNumberMatch || isPartialTextMatch;
      
    }).slice(0, 70); // Limit to 70 to keep Android fast
  }, [searchQuery, allSongsCache]);

  const handleShare = async (song) => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    try { await Share.share({ message: `${song.num} - ${song.title_tamil}\n\n${song.lyrics}\n\n✨join our WhatsApp channel:\nhttps://whatsapp.com/channel/0029Vb6Pu8FLI8YfM5H49e0p \n\n📲Download our APP in Play Store : https://play.google.com/store/apps/details?id=com.adventisttamiltool.adventisttamiltool` }); } catch (error) { console.log(error.message); }
  };

  const openScreen = (screenName) => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate(screenName);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      
      {/* Main Header */}
      <Animated.View style={[styles.headerContainer, { opacity: headerOpacity }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.text }]} allowFontScaling={false}>பாடல் புத்தகங்கள்</Text>
          <Text style={[styles.headerSubtitle, { color: colors.subtext }]} allowFontScaling={false}>Song Books</Text>
        </View>
        <ScalePressable onPress={openGlobalSearch} style={styles.searchIconBtn}>
          <Ionicons name="search" size={26} color={colors.primary} />
        </ScalePressable>
      </Animated.View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Box 1: Zion */}
        <Animated.View style={{ opacity: cardOpacities[0], transform: [{ translateY: cardAnims[0] }] }}>
          <TouchableOpacity activeOpacity={0.75} style={[styles.card, { backgroundColor: colors.card, borderLeftColor: ACCENT_ZION }]} onPress={() => openScreen('ZionSongs')}>
            <View style={[styles.iconContainer, { backgroundColor: ACCENT_ZION + '22' }]}><Ionicons name="musical-notes" size={22} color={ACCENT_ZION} /></View>
            <View style={styles.textContainer}><Text style={[styles.tamilText, { color: colors.text, fontSize: appFontSize + 7, lineHeight: appFontSize + 10 }]}>சீயோன் இனிய கீதங்கள்</Text></View>
            <Ionicons name="chevron-forward" size={20} color={colors.subtext} />
          </TouchableOpacity>
        </Animated.View>

        {/* Box 2: Thirumarai Hope */}
        <Animated.View style={{ opacity: cardOpacities[1], transform: [{ translateY: cardAnims[1] }] }}>
          <TouchableOpacity activeOpacity={0.75} style={[styles.card, { backgroundColor: colors.card, borderLeftColor: ACCENT_HOPE }]} onPress={() => openScreen('ThirumaraiHope')}>
            <View style={[styles.iconContainer, { backgroundColor: ACCENT_HOPE + '22' }]}><Ionicons name="star" size={22} color={ACCENT_HOPE} /></View>
            <View style={styles.textContainer}>
              <Text style={[styles.tamilText, { color: colors.text, fontSize: appFontSize + 7, lineHeight: appFontSize + 10 }]}>திருமறைத்திருப் பாடல்கள்</Text>
              <Text style={[styles.tamilSubText, { color: BRIGHT_YELLOW, fontSize: appFontSize +1, lineHeight: appFontSize + 2 }]}>( நம்பிக்கையின் கீதங்கள் புத்தக வரிசை )</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.subtext} />
          </TouchableOpacity>
        </Animated.View>

        {/* Box 3: Thirumarai Old */}
        <Animated.View style={{ opacity: cardOpacities[2], transform: [{ translateY: cardAnims[2] }] }}>
          <TouchableOpacity activeOpacity={0.75} style={[styles.card, { backgroundColor: colors.card, borderLeftColor: ACCENT_OLD }]} onPress={() => openScreen('ThirumaraiOld')}>
            <View style={[styles.iconContainer, { backgroundColor: ACCENT_OLD + '22' }]}><Ionicons name="book" size={22} color={colors.primary} /></View>
            <View style={styles.textContainer}>
              <Text style={[styles.tamilText, { color: colors.text, fontSize: appFontSize + 7, lineHeight: appFontSize + 8 }]}>திருமறைத்திருப் பாடல்கள்</Text>
              <Text style={[styles.tamilSubText, { color: BRIGHT_YELLOW, fontSize: appFontSize +1, lineHeight: appFontSize + 2 }]}>( பழைய புத்தக வரிசை )</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.subtext} />
          </TouchableOpacity>
        </Animated.View>

        {/* Box 4: Other Songs */}
        <Animated.View style={{ opacity: cardOpacities[3], transform: [{ translateY: cardAnims[3] }] }}>
          <TouchableOpacity activeOpacity={0.75} style={[styles.card, { backgroundColor: colors.card, borderLeftColor: ACCENT_OTHER }]} onPress={() => openScreen('OtherSongs')}>
            <View style={[styles.iconContainer, { backgroundColor: ACCENT_OTHER + '22' }]}><Ionicons name="library" size={22} color={ACCENT_OTHER} /></View>
            <View style={styles.textContainer}><Text style={[styles.tamilText, { color: colors.text, fontSize: appFontSize + 7, lineHeight: appFontSize + 8 }]}>இதர பாடல்கள்</Text></View>
            <Ionicons name="chevron-forward" size={20} color={colors.subtext} />
          </TouchableOpacity>
        </Animated.View>

        {/* Box 5: Custom Songs */}
        <Animated.View style={{ opacity: cardOpacities[4], transform: [{ translateY: cardAnims[4] }] }}>
          <TouchableOpacity activeOpacity={0.75} style={[styles.card, { backgroundColor: colors.card, borderLeftColor: ACCENT_CUSTOM }]} onPress={() => openScreen('CustomSongs')}>
            <View style={[styles.iconContainer, { backgroundColor: ACCENT_CUSTOM + '22' }]}><Ionicons name="create" size={22} color={ACCENT_CUSTOM} /></View>
            <View style={styles.textContainer}>
              <Text style={[styles.tamilText, { color: colors.text, fontSize: appFontSize + 7, lineHeight: appFontSize + 8 }]}>எனது பாடல்கள்</Text>
              <Text style={[styles.tamilSubText, { color: BRIGHT_YELLOW, fontSize: appFontSize +1, lineHeight: appFontSize + 2 }]}>( Custom Songs )</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.subtext} />
          </TouchableOpacity>
        </Animated.View>

      </ScrollView>

      {/* ------------------------------------------- */}
      {/* GLOBAL SEARCH MODAL                         */}
      {/* ------------------------------------------- */}
      <Modal visible={isSearchOpen} animationType="fade" onRequestClose={() => setIsSearchOpen(false)}>
        {/* Exact notch padding instead of buggy SafeAreaView in Modal */}
        <View style={[styles.container, { backgroundColor: colors.background, paddingTop: Math.max(insets.top, 20) }]}>
            
            {/* Search Bar Header */}
            <View style={[styles.globalSearchHeader, { borderBottomColor: colors.border }]}>
              <ScalePressable onPress={() => { triggerHaptic(); setIsSearchOpen(false); setSearchQuery(''); }}>
                <Ionicons name="arrow-back" size={28} color={colors.text} style={{ padding: 5 }} />
              </ScalePressable>
              
              <View style={[styles.globalSearchInputBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Ionicons name="search" size={20} color={colors.subtext} style={{ marginRight: 8 }} />
                <TextInput 
                  style={{ flex: 1, color: colors.text, fontSize: appFontSize }}
                  placeholder="Search all song books..."
                  placeholderTextColor={colors.subtext}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoFocus
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
                <Text style={{ color: colors.primary, fontSize: appFontSize }}>Loading databases...</Text>
              </View>
            ) : (
              <FlatList
                data={filteredGlobalSongs}
                keyExtractor={(item) => item.global_id}
                contentContainerStyle={{ padding: 15, paddingBottom: 50 }}
                keyboardDismissMode="on-drag"
                ListEmptyComponent={
                  <View style={{ alignItems: 'center', marginTop: 100 }}>
                    <Ionicons name="search" size={50} color={colors.border} />
                    <Text style={{ color: colors.subtext, marginTop: 15, fontSize: appFontSize, textAlign: 'center' }}>
                      {searchQuery ? "No songs found." : "Type an exact song number, or part of a Tamil/English title..."}
                    </Text>
                  </View>
                }
                renderItem={({ item }) => (
                  <ScalePressable onPress={() => { 
                    triggerHaptic(); 
                    Keyboard.dismiss(); 
                    setIsSearchOpen(false); // Step 1: Close the search list first
                    
                    // Step 2: Wait 150 milliseconds for the animation to finish, then safely open lyrics
                    setTimeout(() => {
                      setActiveGlobalSong(item); 
                    }, 150); 
                  }}>
                    <View style={[styles.globalSongCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <View style={[styles.numberCircle, { borderColor: item.sourceColor, backgroundColor: item.sourceColor + '20' }]}>
                        <Text style={{ color: item.sourceColor, fontWeight: '900', fontSize: appFontSize }}>{item.num}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.songTitle, { color: colors.text, fontFamily: 'Tamil008', fontSize: appFontSize + 2 }]} numberOfLines={1}>{item.title_tamil}</Text>
                        <Text style={{ color: item.sourceColor, fontSize: appFontSize - 2, fontFamily: 'Tamil003', includeFontPadding: false }}>{item.source}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color={colors.border} />
                    </View>
                  </ScalePressable>
                )}
              />
            )}
        </View>
      </Modal>

      {/* ------------------------------------------- */}
      {/* READING VIEW MODAL (Standalone)             */}
      {/* ------------------------------------------- */}
      <Modal visible={activeGlobalSong !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setActiveGlobalSong(null)}>
        {/* Safe Area applied specifically inside the reading modal for clean reading */}
        <View style={[styles.modalContainer, { backgroundColor: colors.background, paddingTop: Math.max(insets.top, 20) }]}>
          <LinearGradient colors={isDark ? ['#0A1929', colors.background] : ['#FFFFFF', colors.background]} style={StyleSheet.absoluteFillObject} />
          
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <ScalePressable onPress={() => setActiveGlobalSong(null)}>
                <View style={{ padding: 10 }}>
                  <Ionicons name="chevron-down" size={32} color={activeGlobalSong?.sourceColor || BRIGHT_YELLOW} />
                </View>
              </ScalePressable>
              
              <View style={{ flex: 1, alignItems: 'center', paddingHorizontal: 10 }}>
                 <Text style={{ color: colors.primary, fontFamily: 'Tamil008', fontSize: titleSize, letterSpacing: titleSpacing, textShadowColor: isDark ? colors.glow : 'transparent', textShadowRadius: 10 }} numberOfLines={1}>
                   {activeGlobalSong?.num} - {activeGlobalSong?.title_tamil}
                 </Text>
                 <Text style={{ color: activeGlobalSong?.sourceColor, fontSize: 11, fontFamily: 'Tamil003' }}>{activeGlobalSong?.source}</Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <ScalePressable onPress={() => { triggerHaptic(); setShowTextSettings(true); }}>
                  <View style={styles.textSettingsBtn}>
                    <Text style={{ color: activeGlobalSong?.sourceColor || BRIGHT_YELLOW, fontWeight: 'bold', marginRight: 4, fontSize: appFontSize }}>Aa</Text>
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
                        {line.content.trim() === '' ? ' ' : line.content}
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
  tamilText: { fontFamily: 'Tamil003', marginBottom: 2 },
  tamilSubText: { fontFamily: 'Tamil003' },
  
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
  settingLabel: { fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 15 },
  restoreBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 16, borderRadius: 16, marginTop: 40, marginBottom: 20 }
});
