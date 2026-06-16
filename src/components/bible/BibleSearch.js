import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Animated, Dimensions, TextInput, FlatList, ActivityIndicator, Keyboard, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage'; 

import { useSettings } from '../../context/SettingsContext';
import booksData from '../../data/books.json';
// Import your centralized database manager instead of raw SQLite
import { getSafeDb, getTableNameSync } from '../../utils/DatabaseManager';

const { width } = Dimensions.get('window');

export default function BibleSearch({ visible, onClose, onJumpToVerse }) {
  const { colors, isDark, appFontSize, hapticsEnabled, bibleLanguage, activeEnglishVersion } = useSettings();

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]); 
  
  const [searchScope, setSearchScope] = useState('all');
  const [selectedBooks, setSelectedBooks] = useState([]); 
  const [showCustomPicker, setShowCustomPicker] = useState(false);

  const slideAnim = useRef(new Animated.Value(width)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Load History on Mount
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem('@bible_search_history');
        if (saved) setRecentSearches(JSON.parse(saved));
      } catch(e) {}
    })();
  }, []);

  useEffect(() => {
    if (visible) {
      setIsModalVisible(true);
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, friction: 9, tension: 60, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true })
      ]).start();
    } else {
      Keyboard.dismiss();
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: width, duration: 250, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 0, duration: 250, useNativeDriver: true })
      ]).start(() => {
        setIsModalVisible(false);
      });
    }
  }, [visible]);

  function triggerHaptic(style = Haptics.ImpactFeedbackStyle.Light) {
    if (hapticsEnabled) Haptics.impactAsync(style);
  }

  function handleClose() {
    triggerHaptic();
    onClose();
  }

  function getBookName(id) {
    const book = booksData.find(b => b.id === id);
    return book ? (bibleLanguage === 'english' ? book.name_en : book.name_ta) : '';
  }

  function toggleCustomBook(bookId) {
    triggerHaptic();
    if (selectedBooks.includes(bookId)) {
      setSelectedBooks(selectedBooks.filter(id => id !== bookId));
    } else {
      setSelectedBooks([...selectedBooks, bookId]);
    }
  }

  function highlightText(text, query) {
    if (!query || !text) return text;
    const safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${safeQuery})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? <Text key={index} style={{ color: '#FF3B30', fontWeight: 'bold' }}>{part}</Text> : <Text key={index}>{part}</Text>
    );
  }

  function removeHistoryItem(itemToRemove) {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    const updated = recentSearches.filter(item => item !== itemToRemove);
    setRecentSearches(updated);
    AsyncStorage.setItem('@bible_search_history', JSON.stringify(updated));
  }

  function executeSearch(queryOverride = null) {
    const q = typeof queryOverride === 'string' ? queryOverride : searchQuery;
    if (!q.trim()) return;
    
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    Keyboard.dismiss();
    setIsSearching(true);
    setResults([]);
    setSearchQuery(q); 

    const queryTrimmed = q.trim();
    const updatedSearches = [queryTrimmed, ...recentSearches.filter(item => item.toLowerCase() !== queryTrimmed.toLowerCase())].slice(0, 10);
    setRecentSearches(updatedSearches);
    AsyncStorage.setItem('@bible_search_history', JSON.stringify(updatedSearches));

    // Delay the search by 50ms so the "Searching..." animation renders first!
    setTimeout(() => {
      try {
        let bookFilter = '';
        let bookIds = [];

        if (searchScope === 'ot') bookIds = booksData.filter(b => b.testament === 'OT').map(b => b.id);
        else if (searchScope === 'nt') bookIds = booksData.filter(b => b.testament === 'NT').map(b => b.id);
        else if (searchScope === 'custom') {
          if (selectedBooks.length === 0) {
            Alert.alert("No Books Selected", "Please select at least one book to search within.");
            setIsSearching(false);
            return;
          }
          bookIds = selectedBooks;
        }
        else bookIds = booksData.map(b => b.id);

        bookFilter = `book_id IN (${bookIds.join(',')})`;
        
        // Removed regex escapes that conflict with SQLite
        const searchPattern = `%${queryTrimmed}%`; 
        
        let combinedResults = [];

        // Fetch using synchronous DatabaseManager methods
        if (bibleLanguage === 'tamil' || bibleLanguage === 'both') {
          const taDb = getSafeDb('TAMIL.db');
          const taTable = getTableNameSync('TAMIL.db');
          const taRes = taDb.getAllSync(`SELECT book_id, chapter, verse, text FROM "${taTable}" WHERE text LIKE ? AND ${bookFilter} LIMIT 200`, [searchPattern]);
          combinedResults = [...combinedResults, ...taRes.map(r => ({ ...r, lang: 'ta' }))];
        }

        if (bibleLanguage === 'english' || bibleLanguage === 'both') {
          const dbName = activeEnglishVersion ? `${activeEnglishVersion}.db` : 'KJV.db';
          const enDb = getSafeDb(dbName);
          const enTable = getTableNameSync(dbName);
          const enRes = enDb.getAllSync(`SELECT book_id, chapter, verse, text FROM "${enTable}" WHERE text LIKE ? AND ${bookFilter} LIMIT 200`, [searchPattern]);
          combinedResults = [...combinedResults, ...enRes.map(r => ({ ...r, lang: 'en' }))];
        }

        const grouped = [];
        combinedResults.forEach(r => {
          const existing = grouped.find(g => g.book_id === r.book_id && g.chapter === r.chapter && g.verse === r.verse);
          if (existing) {
            if (r.lang === 'ta') existing.text_ta = r.text;
            if (r.lang === 'en') existing.text_en = r.text;
          } else {
            grouped.push({
              book_id: r.book_id, chapter: r.chapter, verse: r.verse,
              text_ta: r.lang === 'ta' ? r.text : '',
              text_en: r.lang === 'en' ? r.text : ''
            });
          }
        });

        grouped.sort((a, b) => {
          if (a.book_id !== b.book_id) return a.book_id - b.book_id;
          if (a.chapter !== b.chapter) return a.chapter - b.chapter;
          return a.verse - b.verse;
        });

        setResults(grouped);
      } catch (e) {
        console.error("Search failed:", e);
        Alert.alert("Search Error", "An error occurred while searching.");
      } finally {
        setIsSearching(false);
      }
    }, 50);
  }

  function renderResultItem({ item }) {
    return (
      <TouchableOpacity 
        style={[styles.resultCard, { backgroundColor: colors.card, borderColor: colors.border }]} 
        onPress={() => {
          triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
          handleClose();
          setTimeout(() => onJumpToVerse(item.book_id, item.chapter, item.verse, searchQuery.trim()), 300);
        }}
      >
        <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: appFontSize, marginBottom: 5 }}>
          {getBookName(item.book_id)} {item.chapter}:{item.verse}
        </Text>
        {(bibleLanguage === 'tamil' || bibleLanguage === 'both') && item.text_ta ? (
          <Text style={{ color: colors.text, fontSize: appFontSize - 1, fontFamily: 'Tamil003', marginBottom: 4 }} numberOfLines={3}>
            {highlightText(item.text_ta, searchQuery.trim())}
          </Text>
        ) : null}
        {(bibleLanguage === 'english' || bibleLanguage === 'both') && item.text_en ? (
          <Text style={{ color: bibleLanguage === 'both' ? colors.subtext : colors.text, fontSize: appFontSize - 2 }} numberOfLines={3}>
            {highlightText(item.text_en, searchQuery.trim())}
          </Text>
        ) : null}
      </TouchableOpacity>
    );
  }

  return (
    <Modal visible={isModalVisible} transparent animationType="none">
      <View style={styles.overlay}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim }]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={handleClose} activeOpacity={1}>
             <BlurView intensity={isDark ? 50 : 20} tint="dark" style={StyleSheet.absoluteFillObject} />
          </TouchableOpacity>
        </Animated.View>

        <Animated.View style={[styles.panel, { backgroundColor: isDark ? '#05070A' : '#FCFAF5', transform: [{ translateX: slideAnim }] }]}>
          <SafeAreaView style={{ flex: 1 }}>
            
            <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.background }]}>
              <TouchableOpacity onPress={handleClose} style={styles.iconBtn}>
                <Ionicons name="arrow-back" size={28} color={colors.text} />
              </TouchableOpacity>
              
              <View style={[styles.searchBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <TextInput 
                  style={{ flex: 1, color: colors.text, fontSize: appFontSize, paddingVertical: 10, paddingHorizontal: 15 }}
                  placeholder="Search Bible..."
                  placeholderTextColor={colors.subtext}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  onSubmitEditing={() => executeSearch()}
                  returnKeyType="search"
                  autoFocus
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => { triggerHaptic(); setSearchQuery(''); setResults([]); }} style={{ padding: 10 }}>
                    <Ionicons name="close-circle" size={20} color={colors.subtext} />
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity onPress={() => executeSearch()} style={[styles.searchBtn, { backgroundColor: colors.primary }]}>
                <Ionicons name="search" size={20} color={isDark ? '#000' : '#FFF'} />
              </TouchableOpacity>
            </View>

            <View style={[styles.filterContainer, { borderBottomColor: colors.border }]}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 15, alignItems: 'center' }}>
                <Text style={{ color: colors.subtext, fontWeight: 'bold', marginRight: 15, fontSize: 12 }}>SCOPE:</Text>
                
                {['all', 'ot', 'nt', 'custom'].map(scope => (
                  <TouchableOpacity 
                    key={scope} 
                    style={[styles.filterChip, { backgroundColor: searchScope === scope ? colors.primary : colors.card, borderColor: searchScope === scope ? colors.primary : colors.border }]} 
                    onPress={() => { triggerHaptic(); setSearchScope(scope); if (scope === 'custom') setShowCustomPicker(true); }}
                  >
                    <Text style={{ color: searchScope === scope ? (isDark ? '#000' : '#FFF') : colors.text, fontWeight: 'bold', fontSize: 12, textTransform: 'uppercase' }}>
                      {scope === 'all' ? 'Whole Bible' : scope === 'ot' ? 'Old Testament' : scope === 'nt' ? 'New Testament' : 'Custom'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {isSearching ? (
              <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /><Text style={{ color: colors.primary, marginTop: 10 }}>Searching...</Text></View>
            ) : results.length > 0 ? (
              <FlatList
                data={results}
                keyExtractor={(item, idx) => idx.toString()}
                renderItem={renderResultItem}
                contentContainerStyle={{ padding: 15, paddingBottom: 100 }}
                keyboardShouldPersistTaps="handled"
                ListHeaderComponent={<Text style={{ color: colors.subtext, marginBottom: 15, fontWeight: 'bold' }}>Found {results.length} matches</Text>}
              />
            ) : (
              <View style={{ flex: 1 }}>
                {!isSearching && recentSearches.length > 0 ? (
                  <View style={{ padding: 20 }}>
                    <Text style={{ color: colors.subtext, fontWeight: 'bold', marginBottom: 15, fontSize: 12 }}>RECENT SEARCHES</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                      {recentSearches.map((s, idx) => (
                        <View key={idx} style={[styles.historyChip, { backgroundColor: colors.card, borderColor: colors.border }]}>
                          <TouchableOpacity onPress={() => executeSearch(s)} style={{ paddingVertical: 8, paddingLeft: 12, paddingRight: 6 }}>
                            <Text style={{ color: colors.text, fontSize: appFontSize - 2 }}>{s}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => removeHistoryItem(s)} style={{ paddingVertical: 8, paddingRight: 10, paddingLeft: 4 }}>
                            <Ionicons name="close" size={16} color={colors.subtext} />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : (
                  <View style={styles.center}>
                    <Ionicons name="search" size={80} color={colors.border} />
                    <Text style={{ color: colors.subtext, marginTop: 15, fontSize: appFontSize }}>Enter a word or phrase to search.</Text>
                  </View>
                )}
              </View>
            )}

          </SafeAreaView>
        </Animated.View>

        <Modal visible={showCustomPicker} transparent animationType="slide">
          <View style={{ flex: 1, justifyContent: 'flex-end' }}>
            <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFillObject} />
            <View style={[styles.bottomSheet, { backgroundColor: isDark ? '#12161E' : '#FFFFFF', borderColor: colors.border }]}>
              <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={() => { triggerHaptic(); setSelectedBooks([]); }} style={{ padding: 5 }}><Text style={{ color: colors.primary, fontWeight: 'bold' }}>Clear</Text></TouchableOpacity>
                <Text style={{ color: colors.text, fontSize: appFontSize + 2, fontWeight: 'bold' }}>Select Books</Text>
                <TouchableOpacity onPress={() => { triggerHaptic(); setShowCustomPicker(false); }} style={{ padding: 5 }}><Text style={{ color: colors.primary, fontWeight: 'bold' }}>Done</Text></TouchableOpacity>
              </View>
              <FlatList
                data={booksData}
                keyExtractor={item => item.id.toString()}
                extraData={selectedBooks}
                contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
                renderItem={({ item }) => {
                  const isSelected = selectedBooks.includes(item.id);
                  return (
                    <TouchableOpacity style={[styles.bookCheckItem, { borderBottomColor: colors.border }]} onPress={() => toggleCustomBook(item.id)}>
                      <Text style={{ color: isSelected ? colors.primary : colors.text, fontSize: appFontSize, fontWeight: isSelected ? 'bold' : 'normal', fontFamily: bibleLanguage === 'english' ? undefined : 'Tamil003' }}>
                        {bibleLanguage === 'english' ? item.name_en : item.name_ta}
                      </Text>
                      {isSelected ? <Ionicons name="checkmark-circle" size={24} color={colors.primary} /> : <Ionicons name="ellipse-outline" size={24} color={colors.subtext} />}
                    </TouchableOpacity>
                  );
                }}
              />
            </View>
          </View>
        </Modal>

      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, flexDirection: 'row' },
  panel: { width: '100%', height: '100%', position: 'absolute', right: 0 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 15, borderBottomWidth: 1 },
  iconBtn: { padding: 5 },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 15, marginHorizontal: 10, height: 45 },
  searchBtn: { height: 45, width: 45, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  filterContainer: { paddingVertical: 12, borderBottomWidth: 1 },
  filterChip: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, borderWidth: 1, marginRight: 10 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  resultCard: { padding: 15, borderWidth: 1, borderRadius: 15, marginBottom: 10 },
  historyChip: { flexDirection: 'row', alignItems: 'center', borderRadius: 20, borderWidth: 1, marginRight: 10, marginBottom: 10, overflow: 'hidden' },
  bottomSheet: { width: '100%', height: '80%', borderTopLeftRadius: 30, borderTopRightRadius: 30, borderWidth: 1, overflow: 'hidden' },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1 },
  bookCheckItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1 }
});
