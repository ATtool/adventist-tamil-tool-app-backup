import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, Modal, ScrollView,
  TextInput, ActivityIndicator, Alert, Platform, Animated, Dimensions,
  PanResponder
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as SQLite from 'expo-sqlite';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSettings } from '../context/SettingsContext';
import booksData from '../data/books.json';
import BiblePickers from '../components/bible/BiblePickers';

const DB_FILENAME = 'bible_concordance_final.db';
const DB_PATH = FileSystem.documentDirectory + 'SQLite/' + DB_FILENAME;
const DOWNLOAD_URL = 'https://drive.google.com/uc?export=download&id=1mdYSmnLkdSg7izEKDlfGLc25FZOLRJmx';

const STRONGS_TAG_REGEX = /<([HG]\d+)>/g;
const HTML_TAG_REGEX = /<\/?(em|i|b|div|p|br)[^>]*>/gi;

// Array of short English book names
const SHORT_BOOKS = ["Gen","Exo","Lev","Num","Deut","Josh","Judg","Ruth","1Sam","2Sam","1Kgs","2Kgs","1Chron","2Chron","Ezra","Neh","Esth","Job","Ps","Prov","Eccles","Song","Isa","Jer","Lam","Ezek","Dan","Hos","Joel","Amos","Obad","Jonah","Mic","Nah","Hab","Zeph","Hag","Zech","Mal","Matt","Mark","Luke","John","Acts","Rom","1Cor","2Cor","Gal","Eph","Phil","Col","1Thess","2Thess","1Tim","2Tim","Titus","Philem","Heb","Jas","1Pet","2Pet","1John","2John","3John","Jude","Rev"];

// Helper function to get the correct name based on language
const getBookName = (bookId, language) => {
  const id = parseInt(bookId, 10);
  const book = booksData.find(b => b.id === id);
  if (!book) return bookId;
  if (language === 'tamil') return book.name_ta;
  return SHORT_BOOKS[id - 1] || book.name_en;
};

export default function ConcordanceScreen({ navigation }) {
  const {
    colors, isDark, appFontSize, bibleLanguage,
    bibleFontSize: globalBibleFontSize,
    bibleLineHeight: globalBibleLineHeight,
    bibleLetterSpacing: globalBibleLetterSpacing,
    hapticsEnabled
  } = useSettings();

  const [verseSize, setVerseSize] = useState(globalBibleFontSize || 20);
  const [verseLineHeight, setVerseLineHeight] = useState(globalBibleLineHeight || 32);
  const [verseSpacing, setVerseSpacing] = useState(globalBibleLetterSpacing || 0);
  const [sheetFontSize, setSheetFontSize] = useState(18);

  const [isEngineDownloaded, setIsEngineDownloaded] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [db, setDb] = useState(null);

  const [hasLoadedState, setHasLoadedState] = useState(false);
  const [activeBookId, setActiveBookId] = useState(1);
  const [activeChapter, setActiveChapter] = useState(1);
  const [verses, setVerses] = useState([]);
  const [isLoadingVerses, setIsLoadingVerses] = useState(false);
  const [highlightedVerse, setHighlightedVerse] = useState(null);
  const flatListRef = useRef(null);
  const pendingJumpVerseRef = useRef(null);

  const [showTypography, setShowTypography] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerStep, setPickerStep] = useState('book');
  const [selectedTestament, setSelectedTestament] = useState('OT');
  const [pickerVerses, setPickerVerses] = useState([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedLetter, setSelectedLetter] = useState(null);
  const [browseWords, setBrowseWords] = useState([]);

  const [showBottomSheet, setShowBottomSheet] = useState(false);
  const [selectedStrongId, setSelectedStrongId] = useState(null);
  const [strongsData, setStrongsData] = useState(null);
  const [strongsRawRefs, setStrongsRawRefs] = useState('');
  const [strongsVerses, setStrongsVerses] = useState([]);
  const [isLoadingSheet, setIsLoadingSheet] = useState(false);

  // ── Swipe-down-to-close for the Strong's bottom sheet ──
  const sheetPanY = useRef(new Animated.Value(0)).current;

  const closeBottomSheet = () => {
    Animated.timing(sheetPanY, {
      toValue: 900,
      duration: 200,
      useNativeDriver: false,
    }).start(() => {
      setShowBottomSheet(false);
    });
  };

  const sheetPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_evt, gestureState) =>
        Math.abs(gestureState.dy) > 6 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
      onPanResponderMove: (_evt, gestureState) => {
        if (gestureState.dy > 0) sheetPanY.setValue(gestureState.dy);
      },
      onPanResponderRelease: (_evt, gestureState) => {
        if (gestureState.dy > 120 || gestureState.vy > 0.9) {
          closeBottomSheet();
        } else {
          Animated.spring(sheetPanY, {
            toValue: 0,
            useNativeDriver: false,
            bounciness: 4,
          }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    if (showBottomSheet) sheetPanY.setValue(0);
  }, [showBottomSheet]);

  useEffect(() => {
    const initApp = async () => {
      try {
        const savedLoc = await AsyncStorage.getItem('@concordance_last_loc');
        if (savedLoc) {
          const { b, c } = JSON.parse(savedLoc);
          setActiveBookId(b);
          setActiveChapter(c);
        }
      } catch (e) {}
      setHasLoadedState(true);
      checkEngineInstallation();
      loadTypographySettings();
    };
    initApp();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => checkEngineInstallation());
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    if (hasLoadedState) {
      AsyncStorage.setItem('@concordance_last_loc', JSON.stringify({ b: activeBookId, c: activeChapter }));
      if (db && isEngineDownloaded) loadVerses(db, activeBookId, activeChapter);
    }
  }, [activeBookId, activeChapter, hasLoadedState, db, isEngineDownloaded]);

  const triggerHaptic = (style = Haptics.ImpactFeedbackStyle.Medium) => {
    if (hapticsEnabled) Haptics.impactAsync(style);
  };

  const checkEngineInstallation = async () => {
    try {
      const info = await FileSystem.getInfoAsync(DB_PATH);
      if (info.exists && info.size > 13000000) {
        const database = await SQLite.openDatabaseAsync(DB_FILENAME);
        setDb(database);
        setIsEngineDownloaded(true);
        if (hasLoadedState) loadVerses(database, activeBookId, activeChapter);
      } else {
        if (info.exists) await FileSystem.deleteAsync(DB_PATH, { idempotent: true });
        setIsEngineDownloaded(false);
        if (db) { await db.closeAsync(); setDb(null); }
      }
    } catch (e) {
      setIsEngineDownloaded(false);
    }
  };

  const loadTypographySettings = async () => {
    try {
      const saved = await AsyncStorage.getItem('@concordance_typography');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.verseSize) setVerseSize(parsed.verseSize);
        if (parsed.verseLineHeight) setVerseLineHeight(parsed.verseLineHeight);
        if (parsed.verseSpacing) setVerseSpacing(parsed.verseSpacing);
        if (parsed.sheetFontSize) setSheetFontSize(parsed.sheetFontSize);
      }
    } catch (e) {}
  };

  const saveTypographySettings = async (updates) => {
    try {
      const current = { verseSize, verseLineHeight, verseSpacing, sheetFontSize, ...updates };
      await AsyncStorage.setItem('@concordance_typography', JSON.stringify(current));
    } catch (e) {}
  };

  const downloadEngine = async () => {
    try {
      triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
      setIsDownloading(true);
      setDownloadProgress(0);

      const sqliteDir = FileSystem.documentDirectory + 'SQLite';
      const dirInfo = await FileSystem.getInfoAsync(sqliteDir);
      if (!dirInfo.exists) await FileSystem.makeDirectoryAsync(sqliteDir, { intermediates: true });

      const downloadResumable = FileSystem.createDownloadResumable(
        DOWNLOAD_URL, DB_PATH, {},
        (progressData) => {
          const progress = progressData.totalBytesWritten / progressData.totalBytesExpectedToWrite;
          setDownloadProgress(isNaN(progress) ? 0 : progress);
        }
      );

      const result = await downloadResumable.downloadAsync();

      if (result && result.status === 200) {
        setIsDownloading(false);
        setIsEngineDownloaded(true);
        const database = await SQLite.openDatabaseAsync(DB_FILENAME);
        setDb(database);
        loadVerses(database, activeBookId, activeChapter);
      } else {
        throw new Error('Download execution failure');
      }
    } catch (error) {
      setIsDownloading(false);
      Alert.alert('Download Error', 'Could not complete the concordance installation.');
    }
  };

  const loadVerses = async (database, bookId, chapter) => {
    if (!database) return;
    setIsLoadingVerses(true);
    try {
      const query = 'SELECT book_id, chapter, verse, tagged_text FROM bible_verses WHERE book_id = ? AND chapter = ? ORDER BY verse ASC;';
      const results = await database.getAllAsync(query, [bookId, chapter]);
      setVerses(results || []);
    } catch (error) {
      console.error(error);
      try {
        const tables = await database.getAllAsync("SELECT name FROM sqlite_master WHERE type='table'");
        Alert.alert('Table Mismatch', "Couldn't find 'bible_verses'. Tables:\n" + tables.map(t => t.name).join(', '));
      } catch (e) {}
    } finally {
      setIsLoadingVerses(false);
    }
  };

  // FIX: normalise Strong's ID from verse tags like H430 → H0430 correctly
  // The verse text uses <H430> but the DB stores H0430 (zero-padded to 4 digits).
  // We also handle cases where verses use H0430 already — both must match.
  const normalizeStrongs = (id) => id ? id.trim().toUpperCase().replace(/\s+/g, '') : '';

  const padStrongs = (id) => {
    const clean = normalizeStrongs(id);
    if (!clean) return '';
    const letter = clean.charAt(0);
    const num = clean.slice(1);
    if (isNaN(num) || num === '') return clean;
    // pad to 4 digits for Hebrew (H) and 4 digits for Greek (G)
    return `${letter}${num.padStart(4, '0')}`;
  };

  // Also try without padding — some DBs store H430 not H0430
  const tryBothFormats = async (database, id, isGreek) => {
    const padded = padStrongs(id);
    const unpadded = normalizeStrongs(id);
    const table = isGreek ? 'greek_concordance_mappings' : 'hebrew_concordance_mappings';

    let result = await database.getAllAsync(`SELECT * FROM ${table} WHERE strongs_id = ? LIMIT 1;`, [padded]);
    if (!result || result.length === 0) {
      result = await database.getAllAsync(`SELECT * FROM ${table} WHERE strongs_id = ? LIMIT 1;`, [unpadded]);
    }
    // also try stripping leading zeros: H0430 → H430
    if (!result || result.length === 0) {
      const stripped = `${unpadded.charAt(0)}${parseInt(unpadded.slice(1), 10)}`;
      result = await database.getAllAsync(`SELECT * FROM ${table} WHERE strongs_id = ? LIMIT 1;`, [stripped]);
    }
    return result;
  };

  const renderTaggedText = (taggedText) => {
    if (!taggedText) return null;
    const cleanText = taggedText.replace(HTML_TAG_REGEX, '');
    const parts = cleanText.split(/<([HG]\d+)>/);
    return parts.map((part, index) => {
      if (index % 2 === 1) {
        return (
          <TouchableOpacity
            key={`tag-${index}`}
            style={[styles.strongTagChip, { backgroundColor: colors.glow }]}
            onPress={() => openStrongsSheet(part)}
            hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
          >
            <Text style={[styles.strongTagText, { color: colors.primary }]}>{part}</Text>
          </TouchableOpacity>
        );
      }
      if (!part) return null;
      return (
        <Text
          key={`text-${index}`}
          style={{
            color: colors.text,
            fontSize: verseSize,
            lineHeight: verseLineHeight,
            letterSpacing: verseSpacing,
            fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
          }}
        >
          {part}
        </Text>
      );
    });
  };

  const openStrongsSheet = async (rawId) => {
    if (!db) return;
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    const isGreek = rawId.toUpperCase().startsWith('G');
    const displayId = padStrongs(rawId);

    setSelectedStrongId(displayId);
    setStrongsData(null);
    setStrongsRawRefs('');
    setStrongsVerses([]);
    setIsLoadingSheet(true);
    setShowBottomSheet(true);

    try {
      const mappingResult = await tryBothFormats(db, rawId, isGreek);

      if (mappingResult && mappingResult.length > 0) {
        const row = mappingResult[0];

        const combinedDict = {
          lemma: row.strongs_id || displayId,
          word: row.word || '—',
          transliteration: row.transliteration || '—',
          pronunciation: row.pronunciation || '—',
          translations: row.kjv_translations || '—',
          definition: isGreek ? (row.strongs_def || '—') : (row.meaning || '—'),
          secondaryDef: isGreek ? (row.kjv_def || '—') : (row.usage || '—'),
          extraInfo: isGreek ? (row.derivation || '—') : (row.part_of_speech || '—'),
          refsRaw: row.references_list || '',
          isGreek,
        };
        setStrongsData(combinedDict);
        setStrongsRawRefs(row.references_list || '');

        if (row.references_list) {
          let parsedRefs = [];
          try {
            const refStr = row.references_list.trim();
            if (refStr.startsWith('[')) {
              parsedRefs = JSON.parse(refStr);
            } else {
              // format: "42;1;5, 44;7;40" — split by comma or semicolons
              // detect if it's "book;chapter;verse" comma-separated groups
              const groups = refStr.split(',').map(s => s.trim()).filter(Boolean);
              for (const g of groups) {
                const parts = g.split(';');
                if (parts.length === 3) {
                  parsedRefs.push({ b: parseInt(parts[0]), c: parseInt(parts[1]), v: parseInt(parts[2]) });
                }
              }
            }
          } catch (e) { parsedRefs = []; }

          const limitedRefs = parsedRefs.filter(r => !isNaN(r.b) && !isNaN(r.c) && !isNaN(r.v)).slice(0, 60);
          const fetchedVerses = [];
          for (const ref of limitedRefs) {
            const vRes = await db.getAllAsync(
              'SELECT book_id, chapter, verse, tagged_text FROM bible_verses WHERE book_id = ? AND chapter = ? AND verse = ? LIMIT 1;',
              [ref.b, ref.c, ref.v]
            );
            if (vRes && vRes.length > 0) fetchedVerses.push(vRes[0]);
          }
          setStrongsVerses(fetchedVerses);
        } else {
          setStrongsVerses([]);
        }
      } else {
        setStrongsData(null);
        setStrongsVerses([]);
      }
    } catch (e) {
      console.error(e);
      try {
        const tables = await db.getAllAsync("SELECT name FROM sqlite_master WHERE type='table'");
        Alert.alert('Database Error', 'Missing mapped tables. Tables:\n' + tables.map(t => t.name).join(', '));
      } catch (err) {}
      setShowBottomSheet(false);
    } finally {
      setIsLoadingSheet(false);
    }
  };

  const executeSearch = async (text) => {
    if (!db || !text.trim()) return;
    setIsSearching(true);
    setSelectedLetter(null);
    try {
      const cleanText = text.trim();
      let query = '';
      let params = [];

      if (/^[HGhg]\s*\d+/.test(cleanText)) {
        const targetId = padStrongs(cleanText);
        const unpadded = normalizeStrongs(cleanText);
        const stripped = `${unpadded.charAt(0)}${parseInt(unpadded.slice(1), 10)}`;
        query = `
          SELECT strongs_id, kjv_translations as word_use FROM greek_concordance_mappings
          WHERE strongs_id = ? OR strongs_id = ? OR strongs_id = ?
          UNION
          SELECT strongs_id, kjv_translations as word_use FROM hebrew_concordance_mappings
          WHERE strongs_id = ? OR strongs_id = ? OR strongs_id = ?
          LIMIT 50;
        `;
        params = [targetId, unpadded, stripped, targetId, unpadded, stripped];
      } else {
        query = `
          SELECT strongs_id, kjv_translations as word_use FROM greek_concordance_mappings WHERE kjv_translations LIKE ?
          UNION
          SELECT strongs_id, kjv_translations as word_use FROM hebrew_concordance_mappings WHERE kjv_translations LIKE ?
          LIMIT 100;
        `;
        params = [`%${cleanText}%`, `%${cleanText}%`];
      }

      const rows = await db.getAllAsync(query, params);
      setSearchResults(rows || []);
    } catch (e) { console.error(e); } finally { setIsSearching(false); }
  };

  const handleLetterSelect = async (letter) => {
    if (!db) return;
    triggerHaptic();
    setSelectedLetter(letter);
    setSearchQuery('');
    setIsSearching(true);
    try {
      const query = `
        SELECT strongs_id, kjv_translations as word_use FROM greek_concordance_mappings WHERE SUBSTR(LTRIM(kjv_translations), 1, 1) = ?
        UNION
        SELECT strongs_id, kjv_translations as word_use FROM hebrew_concordance_mappings WHERE SUBSTR(LTRIM(kjv_translations), 1, 1) = ?
        LIMIT 200;
      `;
      const rows = await db.getAllAsync(query, [letter.toUpperCase(), letter.toUpperCase()]);
      setBrowseWords(rows || []);
    } catch (e) { console.error(e); } finally { setIsSearching(false); }
  };

  const handleCrossReferenceJump = (bookId, chapter, verse) => {
    setShowBottomSheet(false);
    setShowSearch(false);
    setPickerVisible(false);

    const sameChapter = bookId === activeBookId && chapter === activeChapter;

    if (sameChapter) {
      // Already viewing this chapter — scroll + highlight right away, no need to wait for a reload.
      requestAnimationFrame(() => {
        setHighlightedVerse(verse);
        if (flatListRef.current) {
          flatListRef.current.scrollToIndex({ index: verse - 1, animated: true, viewPosition: 0.2 });
        }
        setTimeout(() => setHighlightedVerse(null), 1000);
      });
    } else {
      // Jumping to a different chapter — the verse list has to load first.
      // Stash the target verse; the effect below fires once loading finishes.
      pendingJumpVerseRef.current = verse;
      setActiveBookId(bookId);
      setActiveChapter(chapter);
    }
  };

  // Completes a cross-reference jump into a different chapter: waits for the
  // freshly-loaded verse list to be ready, then scrolls to and highlights the
  // target verse — same behaviour as picking a verse from the verse picker.
  useEffect(() => {
    if (pendingJumpVerseRef.current != null && !isLoadingVerses && verses.length > 0) {
      const verse = pendingJumpVerseRef.current;
      pendingJumpVerseRef.current = null;
      requestAnimationFrame(() => {
        setHighlightedVerse(verse);
        if (flatListRef.current) {
          flatListRef.current.scrollToIndex({ index: verse - 1, animated: true, viewPosition: 0.2 });
        }
        setTimeout(() => setHighlightedVerse(null), 1000);
      });
    }
  }, [verses, isLoadingVerses]);

  const SHORT_BOOKS = ["Gen","Exo","Lev","Num","Deut","Josh","Judg","Ruth","1Sam","2Sam","1Kgs","2Kgs","1Chron","2Chron","Ezra","Neh","Esth","Job","Ps","Prov","Eccles","Song","Isa","Jer","Lam","Ezek","Dan","Hos","Joel","Amos","Obad","Jonah","Mic","Nah","Hab","Zeph","Hag","Zech","Mal","Matt","Mark","Luke","John","Acts","Rom","1Cor","2Cor","Gal","Eph","Phil","Col","1Thess","2Thess","1Tim","2Tim","Titus","Philem","Heb","Jas","1Pet","2Pet","1John","2John","3John","Jude","Rev"];

  const getBookName = (id) => {
    // Forces the short English name (Gen, Exo, etc.) regardless of app language settings
    return SHORT_BOOKS[id - 1] || 'Unknown';
  };

  const availableChapters = useMemo(() => {
    const book = booksData.find(b => b.id === activeBookId);
    const count = book?.chapters || 50;
    return Array.from({ length: count }, (_, i) => i + 1);
  }, [activeBookId]);

  // Parse references_list string into array of {b,c,v} objects
  const parseRefsString = (refsStr) => {
    if (!refsStr) return [];
    try {
      const str = refsStr.trim();
      if (str.startsWith('[')) return JSON.parse(str);
      const groups = str.split(',').map(s => s.trim()).filter(Boolean);
      return groups.map(g => {
        const parts = g.split(';');
        return parts.length === 3
          ? { b: parseInt(parts[0]), c: parseInt(parts[1]), v: parseInt(parts[2]) }
          : null;
      }).filter(r => r && !isNaN(r.b));
    } catch (e) { return []; }
  };

  // Format references_list as human-readable string: "book chapter:verse, ..."
  const formatRefsDisplay = (refsStr) => {
    const refs = parseRefsString(refsStr);
    if (!refs.length) return refsStr || '—';
    return refs.map(r => `${getBookName(r.b)} ${r.c}:${r.v}`).join(',  ');
  };

  // ─── DOWNLOAD SCREEN ──────────────────────────────────────────────────────────
  if (!isEngineDownloaded) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
            <Ionicons name="arrow-back" size={28} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text, fontSize: appFontSize + 4 }]}>Concordance</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.centerContent}>
          <View style={[styles.downloadIconRing, { borderColor: colors.primary + '40', backgroundColor: colors.glow }]}>
            <Ionicons name="library-outline" size={52} color={colors.primary} />
          </View>

          <Text style={[styles.downloadPrompt, { color: colors.text, fontSize: appFontSize + 2 }]}>
            Concordance Engine
          </Text>
          <Text style={{ color: colors.primary, fontSize: appFontSize, fontWeight: 'bold', marginBottom: 10 }}>
            வேதாகம கான்கார்டன்ஸ் பதிவிறக்கம்
          </Text>
          
          <Text style={[styles.downloadSub, { color: colors.subtext, fontSize: appFontSize - 2, marginBottom: 5 }]}>
            Download once to unlock full Strong's dictionary, Hebrew and Greek definitions — fully offline.
          </Text>
          <Text style={{ color: colors.subtext, fontSize: appFontSize - 4, textAlign: 'center', paddingHorizontal: 20, marginBottom: 20 }}>
            எபிரேய மற்றும் கிரேக்க மூல வார்த்தைகளின் அர்த்தங்கள் அடங்கியுள்ளது.
          </Text>

          <View style={{ backgroundColor: 'rgba(255, 59, 48, 0.1)', padding: 15, borderRadius: 10, marginBottom: 25, marginHorizontal: 20 }}>
            <Text style={{ color: '#FF3B30', fontWeight: 'bold', textAlign: 'center', marginBottom: 5 }}>
              ⚠️ WARNING: Do not close the app or go back while downloading!
            </Text>
            <Text style={{ color: '#FF3B30', fontWeight: 'bold', textAlign: 'center', fontSize: 12 }}>
              எச்சரிக்கை: பதிவிறக்கம் செய்யும் போது செயலியை மூடவோ அல்லது பின்னால் செல்லவோ கூடாது!
            </Text>
          </View>

          {isDownloading ? (
            <View style={styles.progressContainer}>
              <Text style={{ color: colors.primary, fontWeight: '700', marginBottom: 12, fontSize: 15 }}>
                Installing… {Math.round(downloadProgress * 100)}%
              </Text>
              <View style={[styles.progressBarBg, { backgroundColor: colors.border }]}>
                <View style={[styles.progressBarFill, { backgroundColor: colors.primary, width: `${downloadProgress * 100}%` }]} />
              </View>
              <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 16 }} />
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.downloadBtn, { backgroundColor: colors.primary }]}
              onPress={downloadEngine}
              activeOpacity={0.85}
            >
              <Ionicons name="cloud-download-outline" size={20} color="#000" style={{ marginRight: 8 }} />
              <Text style={styles.downloadBtnText}>Download Now</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    );
  }

  // ─── MAIN SCREEN ──────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>

      {/* HEADER */}
      <View style={styles.headerWrapper}>
        <BlurView
          intensity={isDark ? 40 : 80}
          tint={isDark ? 'dark' : 'light'}
          style={[styles.actionHeader, { borderColor: colors.border }]}
        >
          <TouchableOpacity
            onPress={() => { triggerHaptic(); navigation.goBack(); }}
            style={styles.iconBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>

          <View style={styles.centerPickersContainer}>
            <TouchableOpacity
              onPress={() => { triggerHaptic(); setPickerStep('book'); setPickerVisible(true); }}
              style={[styles.pickerBtn, { borderRightWidth: 1, borderRightColor: colors.border }]}
            >
              <Text style={{ color: colors.primary, fontSize: appFontSize, fontWeight: '800' }} numberOfLines={1}>
                {getBookName(activeBookId)}
              </Text>
              <Ionicons name="caret-down" size={11} color={colors.primary} style={{ marginLeft: 4 }} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => { triggerHaptic(); setPickerStep('chapter'); setPickerVisible(true); }}
              style={styles.pickerBtn}
            >
              <Text style={{ color: colors.primary, fontSize: appFontSize, fontWeight: '800' }}>
                {activeChapter}
              </Text>
              <Ionicons name="caret-down" size={11} color={colors.primary} style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity
              onPress={() => { triggerHaptic(); setShowTypography(true); }}
              style={styles.iconBtn}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            >
              <Ionicons name="text" size={21} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { triggerHaptic(); setShowSearch(true); }}
              style={styles.iconBtn}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
            >
              <Ionicons name="search" size={21} color={colors.text} />
            </TouchableOpacity>
          </View>
        </BlurView>
      </View>

      {/* VERSE LIST */}
      {isLoadingVerses ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={verses}
          keyExtractor={(item) => `v-${item.verse}`}
          contentContainerStyle={{ padding: 15, paddingBottom: 100 }}
          onScrollToIndexFailed={(info) => {
            setTimeout(() => {
              if (flatListRef.current) {
                flatListRef.current.scrollToIndex({ index: info.index, animated: true });
              }
            }, 500);
          }}
          renderItem={({ item }) => {
            const isHighlighted = highlightedVerse === item.verse;
            return (
              <Animated.View style={[
                styles.verseContainer,
                isHighlighted && { backgroundColor: 'rgba(255,215,0,0.22)', borderRadius: 10, padding: 6 }
              ]}>
                <View style={[styles.verseNumBubble, { backgroundColor: colors.glow, borderColor: colors.primary }]}>
                  <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 11 }}>{item.verse}</Text>
                </View>
                <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>
                  {renderTaggedText(item.tagged_text)}
                </View>
              </Animated.View>
            );
          }}
        />
      )}

      {/* BOOK / CHAPTER / VERSE PICKER */}
      <BiblePickers
        visible={pickerVisible}
        pickerStep={pickerStep}
        selectedTestament={selectedTestament}
        availableChapters={availableChapters}
        availableVerses={pickerVerses}
        colors={colors}
        isDark={isDark}
        appFontSize={appFontSize}
        bibleLanguage="english"
        onClose={() => setPickerVisible(false)}
        onBack={() => {
          if (pickerStep === 'verse') setPickerStep('chapter');
          else if (pickerStep === 'chapter') setPickerStep('book');
        }}
        onTestamentSelect={setSelectedTestament}
        onBookSelect={(id) => {
          triggerHaptic();
          setActiveBookId(id);
          setPickerStep('chapter');
        }}
        onChapterSelect={async (ch) => {
          triggerHaptic();
          setActiveChapter(ch);
          setPickerStep('verse');
          if (db) {
            try {
              const res = await db.getAllAsync(
                'SELECT MAX(verse) as maxVerse FROM bible_verses WHERE book_id = ? AND chapter = ?',
                [activeBookId, ch]
              );
              const maxV = res[0]?.maxVerse || 30;
              setPickerVerses(Array.from({ length: maxV }, (_, i) => i + 1));
            } catch (e) {
              setPickerVerses(Array.from({ length: 30 }, (_, i) => i + 1));
            }
          }
        }}
        onVerseSelect={(v) => {
          triggerHaptic();
          handleCrossReferenceJump(activeBookId, activeChapter, v);
        }}
      />

      {/* TYPOGRAPHY MODAL */}
      <Modal visible={showTypography} transparent animationType="fade" onRequestClose={() => setShowTypography(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowTypography(false)}>
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFillObject} />
          <View
            style={[styles.bottomSheet, { backgroundColor: isDark ? '#0F131A' : '#FFFFFF', borderColor: colors.border }]}
            onStartShouldSetResponder={() => true}
          >
            <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
              <Text style={{ color: colors.text, fontSize: appFontSize + 2, fontWeight: '700' }}>Typography</Text>
              <TouchableOpacity onPress={() => setShowTypography(false)}>
                <Ionicons name="close-circle" size={26} color={colors.subtext} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ padding: 20 }} showsVerticalScrollIndicator={false}>
              <Text style={[styles.sectionTitle, { color: colors.subtext }]}>BIBLE TEXT SIZE</Text>
              <View style={styles.toggleRow}>
                <TouchableOpacity
                  style={[styles.controlBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
                  onPress={() => { const s = Math.max(14, verseSize - 2); setVerseSize(s); saveTypographySettings({ verseSize: s }); }}
                >
                  <Text style={{ color: colors.text, fontWeight: '700' }}>A−</Text>
                </TouchableOpacity>
                <Text style={{ color: colors.text, fontWeight: '800', fontSize: 20 }}>{verseSize}</Text>
                <TouchableOpacity
                  style={[styles.controlBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
                  onPress={() => { const s = Math.min(36, verseSize + 2); setVerseSize(s); saveTypographySettings({ verseSize: s }); }}
                >
                  <Text style={{ color: colors.text, fontWeight: '700' }}>A+</Text>
                </TouchableOpacity>
              </View>

              <Text style={[styles.sectionTitle, { color: colors.subtext, marginTop: 16 }]}>LINE HEIGHT</Text>
              <View style={styles.toggleRow}>
                <TouchableOpacity
                  style={[styles.controlBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
                  onPress={() => { const l = Math.max(22, verseLineHeight - 2); setVerseLineHeight(l); saveTypographySettings({ verseLineHeight: l }); }}
                >
                  <Ionicons name="remove" size={18} color={colors.text} />
                </TouchableOpacity>
                <Text style={{ color: colors.text, fontWeight: '800' }}>{verseLineHeight}</Text>
                <TouchableOpacity
                  style={[styles.controlBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
                  onPress={() => { const l = Math.min(52, verseLineHeight + 2); setVerseLineHeight(l); saveTypographySettings({ verseLineHeight: l }); }}
                >
                  <Ionicons name="add" size={18} color={colors.text} />
                </TouchableOpacity>
              </View>

              <Text style={[styles.sectionTitle, { color: colors.subtext, marginTop: 16 }]}>LETTER SPACING</Text>
              <View style={[styles.toggleRow, { marginBottom: 20 }]}>
                <TouchableOpacity
                  style={[styles.controlBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
                  onPress={() => { const s = parseFloat(Math.max(-0.5, verseSpacing - 0.25).toFixed(2)); setVerseSpacing(s); saveTypographySettings({ verseSpacing: s }); }}
                >
                  <Ionicons name="remove" size={18} color={colors.text} />
                </TouchableOpacity>
                <Text style={{ color: colors.text, fontWeight: '800' }}>{verseSpacing.toFixed(1)}</Text>
                <TouchableOpacity
                  style={[styles.controlBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
                  onPress={() => { const s = parseFloat(Math.min(3, verseSpacing + 0.25).toFixed(2)); setVerseSpacing(s); saveTypographySettings({ verseSpacing: s }); }}
                >
                  <Ionicons name="add" size={18} color={colors.text} />
                </TouchableOpacity>
              </View>

              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              <Text style={[styles.sectionTitle, { color: colors.subtext, marginTop: 16 }]}>DEFINITION SHEET SIZE</Text>
              <View style={[styles.toggleRow, { marginBottom: 30 }]}>
                <TouchableOpacity
                  style={[styles.controlBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
                  onPress={() => { const s = Math.max(12, sheetFontSize - 2); setSheetFontSize(s); saveTypographySettings({ sheetFontSize: s }); }}
                >
                  <Text style={{ color: colors.text, fontWeight: '700' }}>A−</Text>
                </TouchableOpacity>
                <Text style={{ color: colors.text, fontWeight: '800', fontSize: 20 }}>{sheetFontSize}</Text>
                <TouchableOpacity
                  style={[styles.controlBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
                  onPress={() => { const s = Math.min(30, sheetFontSize + 2); setSheetFontSize(s); saveTypographySettings({ sheetFontSize: s }); }}
                >
                  <Text style={{ color: colors.text, fontWeight: '700' }}>A+</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* SEARCH MODAL */}
      <Modal visible={showSearch} transparent animationType="slide" onRequestClose={() => setShowSearch(false)}>
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
          <View style={[styles.searchHeaderRow, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setShowSearch(false)} style={styles.iconBtn}>
              <Ionicons name="close" size={26} color={colors.text} />
            </TouchableOpacity>
            <View style={[styles.searchBox, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <Ionicons name="search" size={17} color={colors.subtext} style={{ marginRight: 8 }} />
              <TextInput
                style={{ flex: 1, color: colors.text, fontSize: 15 }}
                placeholder="Word or Strong's ID (e.g. G5485, H7225)"
                placeholderTextColor={colors.subtext}
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={() => executeSearch(searchQuery)}
                returnKeyType="search"
                autoFocus
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults([]); }} style={{ padding: 4 }}>
                  <Ionicons name="close-circle" size={16} color={colors.subtext} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {!searchQuery && (
            <View style={styles.azWrapper}>
              <Text style={[styles.sectionTitle, { color: colors.subtext, marginHorizontal: 16, marginBottom: 12 }]}>
                BROWSE BY LETTER
              </Text>
              <View style={styles.azGridContainer}>
                {['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z'].map((letter) => (
                  <TouchableOpacity
                    key={letter}
                    style={[
                      styles.azLetterCard,
                      { borderColor: colors.border, backgroundColor: colors.card },
                      selectedLetter === letter && { backgroundColor: colors.primary, borderColor: colors.primary }
                    ]}
                    onPress={() => handleLetterSelect(letter)}
                  >
                    <Text style={{ color: selectedLetter === letter ? '#000' : colors.text, fontWeight: '800', fontSize: 13 }}>
                      {letter}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {isSearching ? (
            <View style={styles.centerContent}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <FlatList
              data={selectedLetter ? browseWords : searchResults}
              keyExtractor={(item, index) => `search-${index}`}
              contentContainerStyle={{ paddingHorizontal: 15, paddingBottom: 50 }}
              ListEmptyComponent={
                (searchQuery || selectedLetter) ? (
                  <View style={styles.centerContent}>
                    <Ionicons name="search-outline" size={40} color={colors.border} style={{ marginBottom: 10 }} />
                    <Text style={{ color: colors.subtext, textAlign: 'center' }}>No results found</Text>
                    <Text style={{ color: colors.primary, textAlign: 'center', fontSize: appFontSize - 2, marginTop: 15, lineHeight: 22 }}>
                      {`If data failed to load, go to:
Settings -> Manage Storage -> Delete Concordance
and redownload the file fully.`}
                    </Text>
                  </View>
                ) : null
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.searchResultCard, { borderColor: colors.border, backgroundColor: colors.card }]}
                  onPress={() => {
                    setShowSearch(false);
                    setTimeout(() => openStrongsSheet(item.strongs_id), 300);
                  }}
                  activeOpacity={0.75}
                >
                  <View style={[styles.strongTagChip, { backgroundColor: colors.glow, paddingHorizontal: 8, paddingVertical: 4 }]}>
                    <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 12 }}>{item.strongs_id}</Text>
                  </View>
                  <Text style={{ color: colors.text, fontSize: 15, marginLeft: 12, flex: 1 }} numberOfLines={1}>
                    {item.word_use}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.border} />
                </TouchableOpacity>
              )}
            />
          )}
        </SafeAreaView>
      </Modal>

      {/* STRONG'S BOTTOM SHEET */}
      <Modal visible={showBottomSheet} transparent animationType="slide" onRequestClose={closeBottomSheet}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={closeBottomSheet} />

          <Animated.View
            style={[
              styles.bottomSheet,
              styles.bottomSheetShadow,
              {
                height: '92%',
                backgroundColor: isDark ? '#0A0E14' : '#FAFAFA',
                borderColor: colors.border,
                transform: [{ translateY: sheetPanY }],
              },
            ]}
          >
            {/* Drag zone — handle + header. Swipe down anywhere here to close. */}
            <View {...sheetPanResponder.panHandlers}>
              <View style={[styles.sheetHandle, { backgroundColor: colors.primary + '55' }]} />

              {/* Sheet top header — just close button */}
              <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
                <Text style={{ color: colors.subtext, fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', fontFamily: Platform.OS === 'ios' ? 'Avenir-Heavy' : 'sans-serif-condensed' }}>
                  {strongsData ? (strongsData.isGreek ? 'New Testament · Greek' : 'Old Testament · Hebrew') : 'Strong\'s Definition'}
                </Text>
                <TouchableOpacity
                  onPress={closeBottomSheet}
                  style={[styles.sheetCloseBtn, { backgroundColor: colors.card }]}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close" size={18} color={colors.text} />
                </TouchableOpacity>
              </View>
            </View>

            {isLoadingSheet ? (
              <View style={styles.centerContent}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={{ color: colors.subtext, marginTop: 12, fontSize: 13 }}>Loading definition…</Text>
              </View>
            ) : !strongsData ? (
              <View style={styles.centerContent}>
                <Ionicons name="help-circle-outline" size={44} color={colors.border} style={{ marginBottom: 10 }} />
                <Text style={{ color: colors.subtext, textAlign: 'center', fontSize: 15 }}>
                  No definition found for {selectedStrongId}
                </Text>
                <Text style={{ color: colors.subtext, textAlign: 'center', fontSize: 12, marginTop: 8, paddingHorizontal: 24 }}>
                  This Strong's ID may not exist in the database or uses a different format.
                </Text>
              </View>
            ) : (
              <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>

                {/* ── IDENTITY BLOCK ── */}
                <View style={[styles.identityBlock, { borderBottomColor: colors.border }]}>

                  {/* Strong ID — small pill badge */}
                  <View style={[styles.strongIdBadge, { backgroundColor: colors.glow, borderColor: colors.primary + '40' }]}>
                    <Text style={[styles.strongIdLabel, { color: colors.primary }]}>
                      {strongsData.lemma}
                    </Text>
                  </View>

                  {/* Original word — center, big */}
                  <Text style={[styles.originalWord, { color: colors.text }]}>
                    {strongsData.word}
                  </Text>

                  {/* Transliteration — center, italic serif */}
                  <Text style={[styles.transliterationText, { color: colors.subtext }]}>
                    {strongsData.transliteration}
                  </Text>

                  {/* Small accent rule — closes off the identity block */}
                  <View style={[styles.identityRule, { backgroundColor: colors.primary }]} />
                </View>

                {/* ── DETAIL ROWS ── */}
                <View style={styles.detailBlock}>

                  {/* pronunciation */}
                  {strongsData.pronunciation && strongsData.pronunciation !== '—' && (
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, { color: colors.primary }]}>pronunciation</Text>
                      <Text style={[styles.detailValue, { color: colors.text, fontSize: sheetFontSize }]}>
                        {strongsData.pronunciation}
                      </Text>
                    </View>
                  )}

                  {/* derivation / part of speech */}
                  {strongsData.extraInfo && strongsData.extraInfo !== '—' && (
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, { color: colors.primary }]}>
                        {strongsData.isGreek ? 'derivation' : 'part of speech'}
                      </Text>
                      <Text style={[styles.detailValue, { color: colors.text, fontSize: sheetFontSize }]}>
                        {strongsData.extraInfo}
                      </Text>
                    </View>
                  )}

                  {/* strongs def / meaning */}
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.primary }]}>
                      {strongsData.isGreek ? 'strongs def' : 'meaning'}
                    </Text>
                    <Text style={[styles.detailValue, { color: colors.text, fontSize: sheetFontSize }]}>
                      {strongsData.definition || '—'}
                    </Text>
                  </View>

                  {/* kjv def / usage */}
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.primary }]}>
                      {strongsData.isGreek ? 'KJV def' : 'usage'}
                    </Text>
                    <Text style={[styles.detailValue, { color: colors.text, fontSize: sheetFontSize }]}>
                      {strongsData.secondaryDef || '—'}
                    </Text>
                  </View>

                  {/* kjv translations */}
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.primary }]}>KJV translations</Text>
                    <Text style={[styles.detailValue, { color: colors.text, fontSize: sheetFontSize }]}>
                      {strongsData.translations || '—'}
                    </Text>
                  </View>

                  {/* references list — as tappable pill chips */}
                  {strongsRawRefs ? (
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, { color: colors.primary }]}>references list</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 2 }}>
                        {parseRefsString(strongsRawRefs).map((ref, idx) => (
                          <TouchableOpacity
                            key={`ref-${idx}`}
                            onPress={() => handleCrossReferenceJump(ref.b, ref.c, ref.v)}
                            activeOpacity={0.6}
                            style={[styles.refChip, { backgroundColor: colors.card, borderColor: colors.border }]}
                          >
                            <Text style={[styles.refChipText, { color: colors.primary, fontSize: sheetFontSize - 3 }]}>
                              {getBookName(ref.b)} {ref.c}:{ref.v}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  ) : null}
                </View>

                {/* ── VERSE CARDS ── */}
                {strongsVerses.length > 0 && (
                  <View style={[styles.versesSection, { borderTopColor: colors.border }]}>
                    <Text style={[styles.sectionTitle, { color: colors.primary, paddingHorizontal: 20, paddingTop: 20, marginBottom: 12 }]}>
                      VERSES  ({strongsVerses.length})
                    </Text>
                    {strongsVerses.map((vItem, idx) => (
                      <TouchableOpacity
                        key={`ctx-${idx}`}
                        style={[
                          styles.contextVerseCard,
                          { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: colors.primary, marginHorizontal: 16 },
                        ]}
                        onPress={() => handleCrossReferenceJump(vItem.book_id, vItem.chapter, vItem.verse)}
                        activeOpacity={0.75}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 7 }}>
                          <View style={[styles.refBadge, { backgroundColor: colors.glow }]}>
                            <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700' }}>
                              {getBookName(vItem.book_id)} {vItem.chapter}:{vItem.verse}
                            </Text>
                          </View>
                          <Ionicons name="arrow-forward-outline" size={13} color={colors.primary} style={{ marginLeft: 6 }} />
                        </View>
                        <Text style={{ color: colors.text, fontSize: sheetFontSize - 2, lineHeight: sheetFontSize + 8 }} numberOfLines={3}>
                          {vItem.tagged_text.replace(HTML_TAG_REGEX, '').replace(/<[HG]\d+>/g, '')}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </ScrollView>
            )}
          </Animated.View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },

  // Download screen
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 15 },
  headerTitle: { fontWeight: 'bold' },
  downloadIconRing: { width: 110, height: 110, borderRadius: 55, borderWidth: 2, justifyContent: 'center', alignItems: 'center', marginBottom: 28 },
  downloadPrompt: { fontWeight: '800', marginBottom: 10, textAlign: 'center' },
  downloadSub: { textAlign: 'center', marginBottom: 30, paddingHorizontal: 28, lineHeight: 22 },
  downloadBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 28 },
  downloadBtnText: { color: '#000', fontWeight: '800', fontSize: 16 },
  progressContainer: { width: '100%', alignItems: 'center', marginTop: 10 },
  progressBarBg: { width: '78%', height: 6, borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 3 },

  // Header
  headerWrapper: { paddingHorizontal: 14, paddingBottom: 8, paddingTop: 4 },
  actionHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, paddingVertical: 6, borderRadius: 22, borderWidth: 1, overflow: 'hidden' },
  iconBtn: { padding: 9 },
  centerPickersContainer: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(128,128,128,0.09)', borderRadius: 14, marginHorizontal: 6 },
  pickerBtn: { flex: 1, paddingVertical: 8, justifyContent: 'center', alignItems: 'center', flexDirection: 'row' },

  // Verse list
  verseContainer: { flexDirection: 'row', marginBottom: 16, paddingHorizontal: 4 },
  verseNumBubble: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center', marginRight: 12, marginTop: 5, flexShrink: 0 },
  strongTagChip: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5, marginHorizontal: 1.5, justifyContent: 'center', alignItems: 'center' },
  strongTagText: { fontSize: 10, fontWeight: '700' },

  // Modals
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  bottomSheet: { width: '100%', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, overflow: 'hidden' },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(128,128,128,0.35)', alignSelf: 'center', marginTop: 10, marginBottom: 2 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 14, borderBottomWidth: 1 },
  sheetCloseBtn: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  strongIdBadge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, marginBottom: 14 },

  // ── NEW: Identity block (top of sheet) ──
  identityBlock: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 22,
    borderBottomWidth: 1,
  },
  strongIdLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontFamily: Platform.OS === 'ios' ? 'Avenir-Heavy' : 'sans-serif-condensed',
  },
  originalWord: {
    fontSize: 36,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    textAlign: 'center',
    marginBottom: 8,
  },
  transliterationText: {
    fontSize: 18,
    fontStyle: 'italic',
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  identityRule: {
    width: 32,
    height: 3,
    borderRadius: 2,
    marginTop: 16,
    opacity: 0.55,
  },

  // ── NEW: Detail block (label + value rows) ──
  detailBlock: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  detailRow: {
    marginBottom: 20,
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginBottom: 6,
    fontFamily: Platform.OS === 'ios' ? 'Avenir-Heavy' : 'sans-serif-condensed',
  },
  detailValue: {
    lineHeight: 28,
    letterSpacing: 0.15,
  },
  refChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    marginRight: 6,
    marginBottom: 6,
  },
  refChipText: {
    fontWeight: '600',
  },

  // ── Verses section ──
  versesSection: { borderTopWidth: 1, paddingBottom: 20 },

  // Typography modal
  sectionTitle: { fontSize: 12, fontWeight: '900', letterSpacing: 1.4, marginBottom: 10, fontFamily: Platform.OS === 'ios' ? 'Avenir-Heavy' : 'sans-serif-condensed' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 6 },
  controlBtn: { width: 46, height: 46, borderRadius: 13, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  divider: { height: 1, marginVertical: 8 },

  // Search modal
  searchHeaderRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1 },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 18, paddingHorizontal: 12, height: 44, marginLeft: 8 },
  azWrapper: { paddingVertical: 14 },
  azGridContainer: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, justifyContent: 'space-between' },
  azLetterCard: { width: '14%', aspectRatio: 1, borderRadius: 10, borderWidth: 1, justifyContent: 'center', alignItems: 'center', marginBottom: 9 },
  searchResultCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 9 },

  // Bottom sheet content (kept for verse cards)
  contextVerseCard: { padding: 14, borderRadius: 14, borderWidth: 1, borderLeftWidth: 3, marginBottom: 10 },
  refBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },

  bottomSheetShadow: Platform.select({
    ios: { shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: -4 } },
    android: { elevation: 18 },
  }),
});
