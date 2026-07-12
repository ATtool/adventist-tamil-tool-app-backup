import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, Dimensions,
  Alert, ScrollView, Share, Modal, BackHandler
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import { LinearGradient } from 'expo-linear-gradient';
import { useSettings } from '../context/SettingsContext';
import { getSafeDb, querySync, getTableNameSync } from '../utils/DatabaseManager';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import InAppBrowser from '../components/InAppBrowser';
import booksData from '../data/books.json';

const { width } = Dimensions.get('window');
const HISTORY_FILE = FileSystem.documentDirectory + 'dictionary_history.json';

const ALPHABET = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z'];

const DICTIONARIES = [
  {
    id: 'sda',
    name: 'SDA Biblical-Theological',
    subtitle: 'Official Adventist Resource',
    isOnline: true,
    url: 'https://dictionary.adventist.org/',
    accent: ['#F5A623', '#E8920A'],
    icon: 'globe-outline',
  },
  {
    id: 'smith',
    name: "Smith's Bible Dictionary",
    subtitle: 'By William Smith',
    dbName: 'smith_bibledict.db',
    downloadUrl: 'https://drive.google.com/uc?export=download&id=1E_orx8-xkeVKWVWVH58PfktZqxQEWt8V',
    accent: ['#4A90E2', '#2471C8'],
    icon: 'book-outline',
  },
  {
    id: 'easton',
    name: "Easton's Bible Dictionary",
    subtitle: 'By M. G. Easton',
    dbName: 'easton_ebd2.db',
    downloadUrl: 'https://drive.google.com/uc?export=download&id=1RqG9wmmSeWTCXY34Wqw1Sh62JWeqYdYI',
    accent: ['#9B59B6', '#7D3C98'],
    icon: 'library-outline',
  },
  {
    id: 'hastings',
    name: "Hastings' Dictionary",
    subtitle: 'By James Hastings',
    dbName: 'hastings_dict_bible.db',
    downloadUrl: 'https://drive.google.com/uc?export=download&id=1BuCPQHWgLlZigRniUbLr1Yfsmx2d1f4Y',
    accent: ['#1ABC9C', '#17A589'],
    icon: 'journal-outline',
  },
  {
    id: 'hitchcock',
    name: "Hitchcock's Bible Names",
    subtitle: 'Meanings of Biblical Names',
    dbName: 'hitchcock_bible_names.db',
    downloadUrl: 'https://drive.google.com/uc?export=download&id=1WJeNx3_-hBL_2F1LEVui-hZGBYXig-2d',
    accent: ['#E74C3C', '#CB4335'],
    icon: 'person-circle-outline',
  },
];

export default function DictionaryScreen({ onClose }) {
  const { colors, isDark, appFontSize, hapticsEnabled } = useSettings();
  const navigation = useNavigation();

  const [activeDict, setActiveDict] = useState(null);
  const [downloadStatus, setDownloadStatus] = useState({});
  const [downloadingId, setDownloadingId] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState(0);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLetter, setSelectedLetter] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedWord, setSelectedWord] = useState(null);
  const [readingFontSize, setReadingFontSize] = useState(appFontSize + 2);

  const [history, setHistory] = useState([]);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);

  const [translatedText, setTranslatedText] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationModalVisible, setTranslationModalVisible] = useState(false);

  const [isSpeaking, setIsSpeaking] = useState(false);

  const [verseModalVisible, setVerseModalVisible] = useState(false);
  const [modalVerseRef, setModalVerseRef] = useState('');
  const [modalVerseText, setModalVerseText] = useState('');

  const [browserVisible, setBrowserVisible] = useState(false);
  const [browserUrl, setBrowserUrl] = useState('');
  const [browserTitle, setBrowserTitle] = useState('');

  // Navigation - step-by-step back for both Android hardware button and iOS swipe/beforeRemove
  const handleStepBack = () => {
    if (translationModalVisible) {
      setTranslationModalVisible(false);
      return true;
    }
    if (verseModalVisible) {
      setVerseModalVisible(false);
      return true;
    }
    if (historyModalVisible) {
      setHistoryModalVisible(false);
      return true;
    }
    if (selectedWord) {
      setSelectedWord(null);
      setTranslatedText('');
      setTranslationModalVisible(false);
      if (isSpeaking) Speech.stop();
      return true;
    }
    if (activeDict && (searchQuery || selectedLetter)) {
      setSearchQuery('');
      setSelectedLetter('');
      setResults([]);
      return true;
    }
    if (activeDict) {
      setActiveDict(null);
      return true;
    }
    return false; // let default happen
  };

  useEffect(() => {
    // Android hardware back button
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      return handleStepBack();
    });
    return () => backHandler.remove();
  }, [translationModalVisible, verseModalVisible, historyModalVisible, selectedWord, activeDict, searchQuery, selectedLetter, isSpeaking]);

  useEffect(() => {
    // iOS swipe-back / beforeRemove
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      const handled = handleStepBack();
      if (handled) {
        e.preventDefault();
      }
    });
    return unsubscribe;
  }, [navigation, translationModalVisible, verseModalVisible, historyModalVisible, selectedWord, activeDict, searchQuery, selectedLetter, isSpeaking]);

  useEffect(() => { 
    loadHistory();
  }, []);

  // This acts as a motion sensor: it checks the database files
  // every single time the user navigates back to this screen.
  useFocusEffect(
    useCallback(() => {
      checkAllDatabases();
    }, [])
  );

  useEffect(() => {
    if (searchQuery.length > 1 && activeDict) {
      const timer = setTimeout(() => { fetchResults('search', searchQuery); }, 500);
      return () => clearTimeout(timer);
    } else if (searchQuery.length === 0 && selectedLetter === '') {
      setResults([]);
    }
  }, [searchQuery, activeDict]);

  const loadHistory = async () => {
    try {
      const fileInfo = await FileSystem.getInfoAsync(HISTORY_FILE);
      if (fileInfo.exists) {
        const content = await FileSystem.readAsStringAsync(HISTORY_FILE);
        const parsed = JSON.parse(content);
        setHistory(Array.isArray(parsed) ? parsed : []);
      } else {
        setHistory([]);
      }
    } catch (e) { 
      setHistory([]);
    }
  };

  const saveHistory = async (newHistory) => {
    try {
      const validHistory = Array.isArray(newHistory) ? newHistory : [];
      await FileSystem.writeAsStringAsync(HISTORY_FILE, JSON.stringify(validHistory, null, 2));
      setHistory(validHistory);
    } catch (e) { }
  };

  const addToHistory = (word) => {
    if (!word || !activeDict) return;
    
    const trimmedWord = String(word).trim();
    if (!trimmedWord) return;

    const newEntry = {
      id: Date.now(),
      word: trimmedWord,
      dict: activeDict?.name || 'Unknown',
      timestamp: new Date().toISOString()
    };
    
    let updated = [newEntry, ...history.filter(h => h.word !== newEntry.word)];
    if (updated.length > 20) updated = updated.slice(0, 20);
    saveHistory(updated);
  };

  const clearHistory = () => {
    Alert.alert('Clear History', 'Clear all search history?', [
      { text: 'Cancel' },
      { 
        text: 'Clear', 
        onPress: () => {
          saveHistory([]);
          if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        },
        style: 'destructive'
      }
    ]);
  };

  const handleSpeak = async () => {
    if (isSpeaking) {
      await Speech.stop();
      setIsSpeaking(false);
      return;
    }

    if (!selectedWord) return;

    try {
      setIsSpeaking(true);
      const textToSpeak = `${selectedWord.word}. ${selectedWord.definition}`;
      
      const voices = await Speech.getAvailableVoicesAsync();
      let selectedVoice = voices.find(v => v.language?.startsWith('en-US') && v.quality === 'Enhanced');
      if (!selectedVoice) {
        selectedVoice = voices.find(v => v.language?.startsWith('en'));
      }

      await Speech.speak(textToSpeak, {
        language: 'en-US',
        pitch: 1.0,
        rate: 0.85,
        ...(selectedVoice && { voice: selectedVoice.identifier }),
        onDone: () => setIsSpeaking(false),
        onError: () => setIsSpeaking(false),
      });
    } catch (e) {
      setIsSpeaking(false);
    }
  };

  const translateChunkWithRetry = async (text, retries = 3) => {
    // Trim and encode safely - handle any length text
    const trimmed = text.trim();
    if (!trimmed) return '';

    // Google Translate (unofficial) - most reliable for Tamil
    const tryGoogle = async () => {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ta&dt=t&q=${encodeURIComponent(trimmed)}`;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 12000);
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/91.0.4472.120 Mobile Safari/537.36',
          },
          signal: ctrl.signal,
        });
        clearTimeout(timer);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        // Response is array: [[["translated","original",...],...],...]
        if (Array.isArray(data) && Array.isArray(data[0])) {
          const parts = data[0]
            .filter(item => Array.isArray(item) && item[0])
            .map(item => item[0])
            .join('');
          if (parts && parts.trim()) return parts.trim();
        }
        throw new Error('Bad response');
      } catch (e) {
        clearTimeout(timer);
        throw e;
      }
    };

    // MyMemory API - fallback
    const tryMyMemory = async () => {
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(trimmed)}&langpair=en|ta`;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 10000);
      try {
        const response = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36' },
          signal: ctrl.signal,
        });
        clearTimeout(timer);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (data.responseStatus === 200 && data.responseData?.translatedText) {
          const t = data.responseData.translatedText;
          if (t && t !== trimmed) return t;
        }
        throw new Error('Bad response');
      } catch (e) {
        clearTimeout(timer);
        throw e;
      }
    };

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        return await tryGoogle();
      } catch (e) {
        if (attempt < retries - 1) {
          await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
        }
      }
    }

    // Google failed - try MyMemory
    try {
      return await tryMyMemory();
    } catch (e) {
      return `[${trimmed}]`;
    }
  };

  const splitIntoChunks = (text, maxLen = 400) => {
    if (!text || !text.trim()) return [];
    // For very short text (single word or short phrase), return as-is
    if (text.trim().length <= maxLen) return [text.trim()];

    const sentences = text.match(/[^.!?;]+[.!?;]+/g) || [];
    if (sentences.length === 0) {
      // No sentence boundaries - split by words
      const words = text.split(/\s+/);
      const chunks = [];
      let current = '';
      for (const word of words) {
        if ((current + ' ' + word).trim().length > maxLen) {
          if (current.trim()) chunks.push(current.trim());
          current = word;
        } else {
          current = (current + ' ' + word).trim();
        }
      }
      if (current.trim()) chunks.push(current.trim());
      return chunks.length > 0 ? chunks : [text.trim().slice(0, maxLen)];
    }

    const chunks = [];
    let current = '';
    for (const sentence of sentences) {
      if (sentence.length > maxLen) {
        // Single sentence too long - split by words
        if (current.trim()) { chunks.push(current.trim()); current = ''; }
        const words = sentence.split(/\s+/);
        let seg = '';
        for (const word of words) {
          if ((seg + ' ' + word).trim().length > maxLen) {
            if (seg.trim()) chunks.push(seg.trim());
            seg = word;
          } else {
            seg = (seg + ' ' + word).trim();
          }
        }
        if (seg.trim()) chunks.push(seg.trim());
      } else if ((current + sentence).length > maxLen) {
        if (current.trim()) chunks.push(current.trim());
        current = sentence;
      } else {
        current += sentence;
      }
    }
    if (current.trim()) chunks.push(current.trim());
    return chunks.length > 0 ? chunks : [text.trim().slice(0, maxLen)];
  };

  const handleTranslate = async () => {
    if (!selectedWord || !selectedWord.definition) return;
    setIsTranslating(true);
    try {
      const definition = selectedWord.definition.trim();
      if (!definition) {
        Alert.alert('Nothing to translate', 'This entry has no definition text.');
        return;
      }

      const chunks = splitIntoChunks(definition, 400);
      if (chunks.length === 0) {
        Alert.alert('Nothing to translate', 'This entry has no definition text.');
        return;
      }

      const translatedChunks = [];
      for (let i = 0; i < chunks.length; i++) {
        const translated = await translateChunkWithRetry(chunks[i], 3);
        translatedChunks.push(translated);
        // Small delay between chunks to avoid rate limiting
        if (i < chunks.length - 1) await new Promise(r => setTimeout(r, 400));
      }

      const finalText = translatedChunks.filter(Boolean).join(' ');
      setTranslatedText(finalText);
      setTranslationModalVisible(true);
      if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {
      Alert.alert('Translation Failed', 'Unable to translate. Check internet connection and try again.');
    } finally {
      setIsTranslating(false);
    }
  };

  const handleBack = () => {
    if (isSpeaking) Speech.stop();
    if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (selectedWord) {
      // word detail → back to search results list (keep dict/search/letter active)
      setSelectedWord(null);
      setTranslatedText('');
      setTranslationModalVisible(false);
    } else if (activeDict && (searchQuery || selectedLetter)) {
      // search results → back to empty search (still inside dict)
      setSearchQuery('');
      setSelectedLetter('');
      setResults([]);
    } else if (activeDict) {
      // empty dict search screen → back to dict list
      setActiveDict(null);
    } else {
      if (onClose) onClose();
      else navigation.goBack();
    }
  };

  const checkAllDatabases = async () => {
    const status = {};
    for (let dict of DICTIONARIES) {
      if (dict.isOnline) { status[dict.id] = true; continue; }
      try {
        const dbPath = FileSystem.documentDirectory + 'SQLite/' + dict.dbName;
        const info = await FileSystem.getInfoAsync(dbPath);
        status[dict.id] = info.exists && info.size > 50000;
      } catch (e) { status[dict.id] = false; }
    }
    setDownloadStatus(status);
  };

  const resolveGoogleDriveUrl = async (originalUrl) => {
    // Extract file ID from Google Drive URL
    const idMatch = originalUrl.match(/[?&]id=([^&]+)/);
    if (!idMatch) return originalUrl;
    const fileId = idMatch[1];
    // Use direct download URL that bypasses virus scan confirmation
    return `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`;
  };

  const handleDownload = async (dict) => {
    if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setDownloadingId(dict.id);
    setDownloadProgress(0);
    try {
      const sqliteDir = FileSystem.documentDirectory + 'SQLite';
      const dirInfo = await FileSystem.getInfoAsync(sqliteDir);
      if (!dirInfo.exists) await FileSystem.makeDirectoryAsync(sqliteDir, { intermediates: true });

      const uri = sqliteDir + '/' + dict.dbName;

      // Resolve Google Drive direct download URL
      const resolvedUrl = await resolveGoogleDriveUrl(dict.downloadUrl);

      const resumable = FileSystem.createDownloadResumable(
        resolvedUrl,
        uri,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/91.0.4472.120 Mobile Safari/537.36',
          },
        },
        (p) => {
          if (p.totalBytesExpectedToWrite > 0) {
            setDownloadProgress(p.totalBytesWritten / p.totalBytesExpectedToWrite);
          }
        }
      );

      const result = await resumable.downloadAsync();
      if (!result || !result.uri) throw new Error('Download returned no file');

      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (!fileInfo.exists || fileInfo.size < 50000) {
        await FileSystem.deleteAsync(uri, { idempotent: true });
        Alert.alert('Download Blocked', 'Could not download the database. Try again or check your connection.');
        setDownloadingId(null);
        return;
      }
      if (hapticsEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await checkAllDatabases();
    } catch (e) {
      Alert.alert('Network Error', `Download failed: ${e.message || 'Check internet connection and try again.'}`);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleBoxPress = (dict) => {
    if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (dict.isOnline) {
      setBrowserUrl(dict.url);
      setBrowserTitle(dict.name);
      setBrowserVisible(true);
    } else if (downloadStatus[dict.id]) {
      setActiveDict(dict);
    } else {
      handleDownload(dict);
    }
  };

  const fetchResults = (mode, value) => {
    if (!activeDict || activeDict.isOnline) return;
    setIsSearching(true);
    try {
      let query = '';
      let params = [];
      if (mode === 'search') {
        query = `SELECT word, definition FROM dictionary WHERE word LIKE ? ORDER BY word ASC LIMIT 100`;
        params = [`%${value}%`];
      } else if (mode === 'letter') {
        query = `SELECT word, definition FROM dictionary WHERE first_letter = ? ORDER BY word ASC LIMIT 200`;
        params = [value.toUpperCase()];
      }
      const res = querySync(activeDict.dbName, query, params);
      setResults(res || []);
    } catch (e) {
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleShare = async () => {
    if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try { 
      const message = translatedText
        ? `*${selectedWord.word}*\n\n${selectedWord.definition}\n\n📝 Tamil: ${translatedText}`
        : `*${selectedWord.word}*\n\n${selectedWord.definition}`;
      await Share.share({ message }); 
    } catch (e) {}
  };

  const fetchAndShowVerse = (refStr) => {
    if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setModalVerseRef(refStr);
    setModalVerseText('Loading verses...');
    setVerseModalVisible(true);
    try {
      const match = refStr.match(/([1-3]?\s?[A-Za-z]{2,})\.?\s(\d{1,3}):(\d{1,3})/);
      if (match) {
        const bookStr = match[1].trim().toLowerCase();
        const chapter = parseInt(match[2]);
        const verse = parseInt(match[3]);
        const book = booksData.find(b =>
          b.name_en.toLowerCase().startsWith(bookStr) || b.name_en.toLowerCase().includes(bookStr)
        );
        if (book) {
          const taTable = getTableNameSync('TAMIL.db');
          const resTa = querySync('TAMIL.db', `SELECT text FROM "${taTable}" WHERE book_id=? AND chapter=? AND verse=?`, [book.id, chapter, verse]);
          const textTa = (resTa && resTa.length > 0) ? resTa[0].text : 'Tamil verse not found.';

          const kjvTable = getTableNameSync('KJV.db');
          const resEn = querySync('KJV.db', `SELECT text FROM "${kjvTable}" WHERE book_id=? AND chapter=? AND verse=?`, [book.id, chapter, verse]);
          const textEn = (resEn && resEn.length > 0) ? resEn[0].text : 'English verse not found.';

          setModalVerseText(`${textTa}\n\n${textEn}`);
          return;
        }
      }
      setModalVerseText('Verse text could not be found.');
    } catch (e) { setModalVerseText('Error loading verses.'); }
  };

  const renderDefinitionText = (text) => {
    const verseRegex = /([1-3]?\s?[A-Za-z]{2,}\.?\s\d{1,3}:\d{1,3}(?:-\d{1,3})?)/g;
    const parts = [];
    let lastIndex = 0;

    let match;
    while ((match = verseRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: 'text', value: text.slice(lastIndex, match.index) });
      }
      parts.push({ type: 'verse', value: match[0] });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
      parts.push({ type: 'text', value: text.slice(lastIndex) });
    }

    return parts.map((part, i) => {
      if (part.type === 'text') return part.value;
      return (
        <Text
          key={i}
          style={{ color: activeDict?.accent?.[0] || colors.primary, fontWeight: '600' }}
          onPress={() => fetchAndShowVerse(part.value)}
        >
          {part.value}
        </Text>
      );
    });
  };

  if (!activeDict) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
          <TouchableOpacity onPress={handleBack} style={styles.headerIconBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.primary} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: colors.text, fontSize: appFontSize + 2 }]}>
              Dictionary
            </Text>
          </View>
          <TouchableOpacity 
            onPress={() => setHistoryModalVisible(true)} 
            style={styles.headerIconBtn}
          >
            <Ionicons name="time-outline" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={styles.selectionContent}>
          <View style={[styles.introBanner, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Ionicons name="information-circle-outline" size={24} color={colors.primary} style={{ marginRight: 12 }} />
            <Text style={[styles.introText, { color: colors.subtext, fontSize: appFontSize }]}>
              Choose a dictionary
            </Text>
          </View>

          {DICTIONARIES.map(dict => (
            <TouchableOpacity key={dict.id} onPress={() => handleBoxPress(dict)} activeOpacity={0.7}>
              <View style={[styles.dictCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
                <View style={[styles.cardStripe, { backgroundColor: dict.accent[0] }]} />
                <LinearGradient colors={dict.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cardIconCircle}>
                  <Ionicons name={dict.icon} size={26} color="#fff" />
                </LinearGradient>
                <View style={styles.cardBody}>
                  <Text style={[styles.cardName, { color: colors.text, fontSize: appFontSize + 1 }]}>
                    {dict.name}
                  </Text>
                  <Text style={[styles.cardSubtitle, { color: colors.subtext, fontSize: appFontSize - 1 }]}>
                    {dict.subtitle}
                  </Text>
                  {!dict.isOnline && downloadingId === dict.id && (
                    <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            backgroundColor: dict.accent[0],
                            width: `${Math.max(downloadProgress * 100, 2)}%`,
                          },
                        ]}
                      />
                    </View>
                  )}
                </View>
                <View style={[styles.statusBadge, { backgroundColor: downloadStatus[dict.id] ? colors.accent : colors.border }]}>
                  <Ionicons
                    name={downloadStatus[dict.id] ? 'checkmark-circle' : 'cloud-download-outline'}
                    size={16}
                    color={downloadStatus[dict.id] ? dict.accent[0] : colors.subtext}
                  />
                  <Text
                    style={[
                      styles.statusLabel,
                      { color: downloadStatus[dict.id] ? dict.accent[0] : colors.subtext, fontSize: appFontSize - 2, marginLeft: 4 }
                    ]}
                  >
                    {downloadingId === dict.id ? `${Math.round(downloadProgress * 100)}%` : downloadStatus[dict.id] ? (dict.isOnline ? 'Visit' : 'Ready') : 'Download'}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Modal
          visible={historyModalVisible}
          animationType="slide"
          transparent={false}
          onRequestClose={() => setHistoryModalVisible(false)}
        >
          <SafeAreaView edges={Platform.OS === 'ios' ? ["bottom","left","right"] : ["top","bottom","left","right"]} style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.card, paddingTop: Platform.OS === 'ios' ? 12 : 0 }]}>
              <TouchableOpacity onPress={() => setHistoryModalVisible(false)} style={styles.headerIconBtn}>
                <Ionicons name="chevron-back" size={24} color={colors.primary} />
              </TouchableOpacity>
              <View style={styles.headerCenter}>
                <Text style={[styles.headerTitle, { color: colors.text, fontSize: appFontSize + 2 }]}>
                  History ({history.length})
                </Text>
              </View>
              <TouchableOpacity 
                onPress={clearHistory} 
                style={styles.headerIconBtn}
              >
                <Ionicons name="trash-outline" size={20} color="#E74C3C" />
              </TouchableOpacity>
            </View>

            {history.length === 0 ? (
              <View style={styles.centeredView}>
                <View style={[styles.emptyIconWrap, { backgroundColor: colors.card }]}>
                  <Ionicons name="time-outline" size={48} color={colors.subtext} />
                </View>
                <Text style={[{ color: colors.subtext, fontSize: appFontSize, marginTop: 16 }]}>
                  No history
                </Text>
              </View>
            ) : (
              <FlatList
                data={history}
                keyExtractor={item => item.id.toString()}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    onPress={() => {
                      setHistoryModalVisible(false);
                      const foundDict = DICTIONARIES.find(d => d.name === item.dict);
                      if (foundDict && !foundDict.isOnline && downloadStatus[foundDict.id]) {
                        setActiveDict(foundDict);
                      }
                      setSearchQuery(item.word);
                    }}
                    style={[styles.resultRow, { borderBottomColor: colors.border }]}
                  >
                    <View style={[styles.resultDot, { backgroundColor: colors.accent }]} />
                    <View style={styles.resultBody}>
                      <Text style={[{ color: colors.text, fontSize: appFontSize, fontWeight: '600' }]}>
                        {item.word}
                      </Text>
                      <Text style={[{ color: colors.subtext, fontSize: appFontSize - 2, marginTop: 4 }]}>
                        {item.dict}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.subtext} />
                  </TouchableOpacity>
                )}
                contentContainerStyle={{ paddingVertical: 8 }}
              />
            )}
          </SafeAreaView>
        </Modal>

        <InAppBrowser visible={browserVisible} url={browserUrl} title={browserTitle} onClose={() => setBrowserVisible(false)} />
      </SafeAreaView>
    );
  }

  if (!selectedWord) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
          <TouchableOpacity onPress={handleBack} style={styles.headerIconBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.primary} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: colors.text, fontSize: appFontSize + 1 }]}>
              {activeDict.name}
            </Text>
          </View>
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={[styles.searchSection, { borderBottomColor: colors.border }]}>
            <View style={[styles.searchPill, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <Ionicons name="search-outline" size={18} color={colors.subtext} />
              <TextInput
                style={[styles.searchInput, { color: colors.text, marginLeft: 8 }]}
                placeholder="Search word..."
                placeholderTextColor={colors.subtext}
                value={searchQuery}
                onChangeText={(text) => {
                  setSearchQuery(text);
                }}
                returnKeyType="search"
                onSubmitEditing={() => { if (searchQuery.length > 1) addToHistory(searchQuery); }}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={18} color={colors.subtext} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            style={[styles.alphaSection, { borderBottomColor: colors.border }]}
            contentContainerStyle={{ paddingHorizontal: 8, paddingVertical: 12 }}
          >
            {ALPHABET.map(letter => (
              <TouchableOpacity
                key={letter}
                onPress={() => {
                  if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSearchQuery('');
                  setSelectedLetter(letter === selectedLetter ? '' : letter);
                  if (letter !== selectedLetter) {
                    addToHistory(letter);
                    fetchResults('letter', letter);
                  }
                }}
                activeOpacity={0.7}
                style={[
                  selectedLetter === letter ? styles.letterActive : styles.letterInactive,
                  {
                    backgroundColor: selectedLetter === letter ? '#FFD700' : 'transparent',
                    borderColor: colors.border,
                  }
                ]}
              >
                <Text
                  style={{
                    color: selectedLetter === letter ? '#000' : colors.text,
                    fontSize: appFontSize + 4,
                    fontWeight: '700',
                    letterSpacing: 0.5
                  }}
                >
                  {letter}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {results.length > 0 && (
            <View style={[styles.countRow, { borderBottomColor: colors.border }]}>
              <View style={[styles.countBadge, { backgroundColor: colors.accent }]}>
                <Text style={{ color: colors.background, fontWeight: '600', fontSize: appFontSize - 1 }}>
                  {results.length} result{results.length !== 1 ? 's' : ''}
                </Text>
              </View>
            </View>
          )}

          {isSearching ? (
            <View style={styles.centeredView}>
              <ActivityIndicator size="large" color={colors.accent} />
            </View>
          ) : results.length === 0 && (searchQuery || selectedLetter) ? (
            <View style={styles.centeredView}>
              <View style={[styles.emptyIconGrad, { backgroundColor: colors.card }]}>
                <Ionicons name="search-outline" size={44} color={colors.subtext} />
              </View>
              <Text style={{ color: colors.subtext, fontSize: appFontSize, marginTop: 12 }}>
                No results
              </Text>
            </View>
          ) : (
            <FlatList
              data={results}
              keyExtractor={(item, i) => i.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedWord(item);
                    addToHistory(item.word);
                  }}
                  style={[styles.resultRow, { borderBottomColor: colors.border }]}
                >
                  <View style={[styles.resultDot, { backgroundColor: activeDict.accent[0] }]} />
                  <View style={styles.resultBody}>
                    <Text style={[{ color: colors.text, fontSize: appFontSize, fontWeight: '600' }]}>
                      {item.word}
                    </Text>
                    <Text style={[{ color: colors.subtext, fontSize: appFontSize - 1, marginTop: 4 }]} numberOfLines={1}>
                      {item.definition}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.subtext} />
                </TouchableOpacity>
              )}
              scrollEnabled={true}
              contentContainerStyle={{ paddingBottom: 20 }}
            />
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.readToolbar, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
        <TouchableOpacity onPress={handleBack} style={styles.readBackBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
          <Text style={[styles.readBackText, { color: colors.primary, fontSize: appFontSize }]}>
            Back
          </Text>
        </TouchableOpacity>

        <View style={styles.readToolGroup}>
          <TouchableOpacity
            onPress={handleSpeak}
            style={[
              styles.toolPill,
              {
                backgroundColor: isSpeaking ? '#000000' : colors.card,
                borderColor: colors.border,
                borderWidth: 1
              }
            ]}
          >
            <Ionicons
              name={isSpeaking ? 'pause-circle' : 'volume-high'}
              size={20}
              color={isSpeaking ? '#FF0000' : colors.primary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleTranslate}
            disabled={isTranslating}
            style={[
              styles.toolPill,
              {
                backgroundColor: translationModalVisible ? colors.accent : colors.card,
                borderColor: colors.border,
                borderWidth: 1
              }
            ]}
          >
            {isTranslating ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={{ fontSize: 16, fontWeight: '700', color: translationModalVisible ? colors.background : colors.primary }}>
                த
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setReadingFontSize(Math.min(readingFontSize + 2, appFontSize + 8))}
            style={[styles.toolPill, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}
          >
            <Text style={{ fontSize: 20, fontWeight: '700', color: colors.primary }}>A+</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setReadingFontSize(Math.max(readingFontSize - 2, appFontSize))}
            style={[styles.toolPill, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}
          >
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.primary }}>A-</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleShare}
            style={[styles.toolPill, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}
          >
            <Ionicons name="share-social-outline" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <View style={[styles.wordHeadBlock, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
          <View style={[styles.wordAccentBar, { backgroundColor: activeDict.accent[0] }]} />
          <LinearGradient
            colors={[colors.card, colors.background]}
            style={styles.wordGradArea}
          >
            <Text style={[styles.wordTitle, { color: colors.text, fontSize: readingFontSize + 4 }]}>
              {selectedWord.word}
            </Text>
            <View style={[styles.dictChip, { backgroundColor: activeDict.accent[0] }]}>
              <Text style={{ color: '#fff', fontWeight: '600', fontSize: appFontSize - 2 }}>
                {activeDict.name}
              </Text>
            </View>
          </LinearGradient>
        </View>

        <View style={[styles.definitionPad]}>
          <Text style={{ color: colors.text, fontSize: readingFontSize, lineHeight: readingFontSize * 1.75 }}>
            {renderDefinitionText(selectedWord.definition)}
          </Text>
        </View>
      </ScrollView>

      <Modal
        visible={translationModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setTranslationModalVisible(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: '#000000' }]}>
          <View style={[styles.translationCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <LinearGradient
              colors={activeDict.accent}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.translationCardTop}
            >
              <Text style={styles.translationRefLabel}>
                Tamil Translation
              </Text>
              <TouchableOpacity onPress={() => setTranslationModalVisible(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </LinearGradient>

            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20 }}>
              <Text style={{ color: colors.text, fontSize: appFontSize + 2, lineHeight: (appFontSize + 2) * 1.8, fontFamily: 'Tamil003' }}>
                {translatedText}
              </Text>
            </ScrollView>

            <View style={[styles.translationFooter, { borderTopColor: colors.border }]}>
              <TouchableOpacity
                onPress={() => setTranslationModalVisible(false)}
                style={[styles.translationCloseBtn, { backgroundColor: activeDict.accent[0] }]}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: appFontSize }}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={verseModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setVerseModalVisible(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: '#000000' }]}>
          <View style={[styles.verseCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <LinearGradient
              colors={activeDict.accent}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.verseCardTop}
            >
              <Text style={styles.verseRefLabel}>
                {modalVerseRef}
              </Text>
            </LinearGradient>

            <ScrollView style={{ maxHeight: 350 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20 }}>
              <Text style={{ color: colors.text, fontSize: appFontSize, lineHeight: appFontSize * 1.75, fontStyle: 'italic' }}>
                {modalVerseText}
              </Text>
            </ScrollView>

            <TouchableOpacity
              onPress={() => setVerseModalVisible(false)}
              style={[styles.verseCloseBtn, { borderTopColor: colors.border }]}
            >
              <Text style={{ color: colors.subtext, fontWeight: '600', fontSize: appFontSize - 1 }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <InAppBrowser visible={browserVisible} url={browserUrl} title={browserTitle} onClose={() => setBrowserVisible(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  headerIconBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerCenter: { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
  headerTitle: { fontWeight: '800', letterSpacing: 0.2, textAlign: 'center' },
  selectionContent: { padding: 16, paddingBottom: 100 },
  introBanner: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, marginBottom: 20 },
  introText: { flex: 1, lineHeight: 20 },
  dictCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, marginBottom: 12, overflow: 'hidden', paddingVertical: 16, paddingRight: 14, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6 },
  cardStripe: { width: 5, alignSelf: 'stretch' },
  cardIconCircle: { width: 50, height: 50, borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginHorizontal: 14 },
  cardBody: { flex: 1 },
  cardName: { fontWeight: '700', marginBottom: 3, lineHeight: 22 },
  cardSubtitle: { lineHeight: 16 },
  progressTrack: { height: 5, borderRadius: 3, marginTop: 10, overflow: 'hidden', width: '92%' },
  progressFill: { height: 5, borderRadius: 3 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, marginLeft: 6 },
  statusLabel: { fontWeight: '700' },
  searchSection: { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  searchPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, height: 46, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
  searchInput: { flex: 1 },
  alphaSection: { borderBottomWidth: StyleSheet.hairlineWidth },
  letterActive: { width: 44, height: 44, borderRadius: 10, marginHorizontal: 3, justifyContent: 'center', alignItems: 'center' },
  letterInactive: { width: 44, height: 44, borderRadius: 10, marginHorizontal: 3, justifyContent: 'center', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth },
  countRow: { paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  countBadge: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  resultRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingRight: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  resultDot: { width: 4, height: 44, borderRadius: 2, marginLeft: 16, marginRight: 14 },
  resultBody: { flex: 1 },
  centeredView: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 80 },
  emptyIconWrap: { width: 76, height: 76, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  emptyIconGrad: { width: 88, height: 88, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  readToolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  readBackBtn: { flexDirection: 'row', alignItems: 'center' },
  readBackText: { fontWeight: '600', marginLeft: 2 },
  readToolGroup: { flexDirection: 'row', alignItems: 'center' },
  toolPill: { width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginLeft: 6 },
  wordHeadBlock: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  wordAccentBar: { width: 5 },
  wordGradArea: { flex: 1, padding: 20, paddingLeft: 16, paddingBottom: 16 },
  wordTitle: { fontWeight: '900', letterSpacing: 0.3, marginBottom: 12, lineHeight: undefined },
  dictChip: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  definitionPad: { padding: 20 },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000000', padding: 24 },
  translationCard: { width: '100%', height: '80%', borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', flexDirection: 'column' },
  translationCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  translationRefLabel: { color: '#fff', fontWeight: '700', fontSize: 16 },
  translationFooter: { paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 20 },
  translationCloseBtn: { paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  verseCard: { width: '100%', borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  verseCardTop: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 },
  verseRefLabel: { color: '#fff', fontWeight: '700', fontSize: 14 },
  verseCloseBtn: { paddingVertical: 16, borderTopWidth: StyleSheet.hairlineWidth, alignItems: 'center' },
});
