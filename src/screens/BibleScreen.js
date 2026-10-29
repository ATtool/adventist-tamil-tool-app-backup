import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Share, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native'; // Added to allow screen jumping!

import { useSettings } from '../context/SettingsContext';
import booksData from '../data/books.json';
import { getSafeDb, getTableNameSync } from '../utils/DatabaseManager';
import { requestChapter, cancelAllRequests } from '../utils/DatabaseWorker';

import VerseRenderer from '../components/bible/VerseRenderer';
import BibleHeader from '../components/bible/BibleHeader';
import BibleActionBar from '../components/bible/BibleActionBar';
import BiblePickers from '../components/bible/BiblePickers';
import { CrossRefModal } from '../components/bible/BibleModals';
import BibleLeftMenu from '../components/bible/BibleLeftMenu';
import BibleSearch from '../components/bible/BibleSearch';

export default function BibleScreen() {
  const navigation = useNavigation(); // Hooking up navigation so we can jump to Concordance & Explanations
  const { colors, isDark, appFontSize, hapticsEnabled, bibleLanguage, activeEnglishVersion, bibleFontSize, bibleLineHeight, bibleLetterSpacing } = useSettings();

  const [activeBookId, setActiveBookId] = useState(1);
  const [activeChapter, setActiveChapter] = useState(1);
  const [verses, setVerses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [maxChaptersForActiveBook, setMaxChaptersForActiveBook] = useState(50);

  const flatListRef = useRef(null);
  const [targetVerse, setTargetVerse] = useState(null);
  const [highlightedVerse, setHighlightedVerse] = useState(null);
  const [highlightedWord, setHighlightedWord] = useState(null);

  const [selectedVerses, setSelectedVerses] = useState([]);
  const [showCrossRefs, setShowCrossRefs] = useState(false);
  const [crossRefsList, setCrossRefsList] = useState([]);

  const [userHighlights, setUserHighlights] = useState([]);
  const [userFavorites, setUserFavorites] = useState([]); 

  const [showHighlightPalette, setShowHighlightPalette] = useState(false);
  const [showLeftMenu, setShowLeftMenu] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  // NEW: History stack to remember locations before a Cross-Reference jump
  const [jumpHistory, setJumpHistory] = useState([]);

  const [isPickerVisible, setIsPickerVisible] = useState(false);
  const [pickerStep, setPickerStep] = useState('book');
  const [selectedTestament, setSelectedTestament] = useState('OT');
  const [tempBookId, setTempBookId] = useState(1);
  const tempChapterRef = useRef(1);
  const [availableChapters, setAvailableChapters] = useState([]);
  const [availableVerses, setAvailableVerses] = useState([]);

  function triggerHaptic(style = Haptics.ImpactFeedbackStyle.Light) {
    if (hapticsEnabled) Haptics.impactAsync(style);
  }

  function getBookName(id) {
    const book = booksData.find(b => b.id === id);
    return book ? (bibleLanguage === 'english' ? book.name_en : book.name_ta) : '';
  }

  useEffect(() => {
    setIsLoading(true);
    requestChapter(
      activeBookId, activeChapter, bibleLanguage, activeEnglishVersion,
      (combinedVerses, maxChapters, highlights, favorites) => {
        setVerses(combinedVerses);
        setMaxChaptersForActiveBook(maxChapters);
        setUserHighlights(highlights);
        setUserFavorites(favorites.map(x => x.verse)); 
        setIsLoading(false);
        setSelectedVerses([]);
        setShowHighlightPalette(false);
        flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
      },
      (err) => { setIsLoading(false); console.error(err); }
    );
    return () => cancelAllRequests();
  }, [activeBookId, activeChapter, bibleLanguage, activeEnglishVersion]);

  useEffect(() => {
    if (!isLoading && targetVerse && verses.length > 0) {
      const index = verses.findIndex(v => v.verse === targetVerse);
      if (index !== -1 && flatListRef.current) {
        setTimeout(() => {
          try { flatListRef.current.scrollToIndex({ index, animated: true, viewPosition: 0.3 }); } catch (e) {}
          setHighlightedVerse(targetVerse);
          setTimeout(() => { setHighlightedVerse(null); setTargetVerse(null); }, 1500);
        }, 800);
      }
    }
  }, [isLoading, targetVerse, verses]);

  function handleNextChapter() {
    triggerHaptic();
    setJumpHistory([]); // Clear history on manual navigation
    if (activeChapter < maxChaptersForActiveBook) setActiveChapter(prev => prev + 1);
    else if (activeBookId < 66) { setActiveBookId(prev => prev + 1); setActiveChapter(1); }
  }

  function handlePrevChapter() {
    triggerHaptic();
    setJumpHistory([]); // Clear history on manual navigation
    if (activeChapter > 1) setActiveChapter(prev => prev - 1);
    else if (activeBookId > 1) { setActiveBookId(prev => prev - 1); setActiveChapter(1); }
  }

  function openChapterPicker() {
    triggerHaptic(); setTempBookId(activeBookId); setPickerStep('chapter'); setIsPickerVisible(true);
    try {
      const db = getSafeDb('TAMIL.db');
      const table = getTableNameSync('TAMIL.db');
      const res = db.getAllSync(`SELECT MAX(chapter) as maxCh FROM "${table}" WHERE book_id = ?`, [activeBookId]);
      setAvailableChapters(Array.from({ length: res[0]?.maxCh || 1 }, (_, i) => i + 1));
    } catch (e) {}
  }

  function handleBookSelect(id) {
    triggerHaptic(); setTempBookId(id); setPickerStep('chapter');
    try {
      const db = getSafeDb('TAMIL.db');
      const table = getTableNameSync('TAMIL.db');
      const res = db.getAllSync(`SELECT MAX(chapter) as maxCh FROM "${table}" WHERE book_id = ?`, [id]);
      setAvailableChapters(Array.from({ length: res[0]?.maxCh || 1 }, (_, i) => i + 1));
    } catch (e) {}
  }

  function handleChapterSelect(ch) {
    triggerHaptic(); tempChapterRef.current = ch;
    try {
      const db = getSafeDb('TAMIL.db');
      const table = getTableNameSync('TAMIL.db');
      const res = db.getAllSync(`SELECT MAX(verse) as maxV FROM "${table}" WHERE book_id = ? AND chapter = ?`, [tempBookId, ch]);
      setAvailableVerses(Array.from({ length: res[0]?.maxV ?? 1 }, (_, i) => i + 1));
      setPickerStep('verse');
    } catch (e) {
      setActiveBookId(tempBookId); setActiveChapter(ch); setIsPickerVisible(false);
    }
  }

  function refreshUserDataSync() {
    try {
      const userDb = getSafeDb('UserData.db');
      setUserHighlights(userDb.getAllSync(`SELECT verse, color FROM highlights WHERE book_id = ? AND chapter = ?`, [activeBookId, activeChapter]) ?? []);
      setUserFavorites((userDb.getAllSync(`SELECT verse FROM favorites WHERE book_id = ? AND chapter = ?`, [activeBookId, activeChapter]) ?? []).map(x => x.verse));
    } catch (e) {}
  }

  function saveFavorite() {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Success);
    try {
      const db = getSafeDb('UserData.db');
      const allFavorited = selectedVerses.every(v => userFavorites.includes(v.verse));
      
      for (const v of selectedVerses) {
        db.runSync(`DELETE FROM favorites WHERE book_id=? AND chapter=? AND verse=?`, [activeBookId, activeChapter, v.verse]);
        if (!allFavorited) {
          db.runSync(`INSERT INTO favorites (book_id, chapter, verse) VALUES (?, ?, ?)`, [activeBookId, activeChapter, v.verse]);
        }
      }
      setSelectedVerses([]); 
      refreshUserDataSync();
    } catch (e) {}
  }

  function saveHighlight(color) {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Success);
    try {
      const db = getSafeDb('UserData.db');
      for (const v of selectedVerses) {
        db.runSync(`DELETE FROM highlights WHERE book_id=? AND chapter=? AND verse=?`, [activeBookId, activeChapter, v.verse]);
        if (color) db.runSync(`INSERT INTO highlights (book_id, chapter, verse, color) VALUES (?, ?, ?, ?)`, [activeBookId, activeChapter, v.verse, color]);
      }
      setShowHighlightPalette(false); setSelectedVerses([]); refreshUserDataSync();
    } catch (e) {}
  }

  async function handleShare() {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    let shareText = `${getBookName(activeBookId)} ${activeChapter}\n\n`;
    
    [...selectedVerses].sort((a, b) => a.verse - b.verse).forEach(v => { 
      let verseContent = '';
      if (v.text_ta) verseContent += v.text_ta;
      if (v.text_en) verseContent += (v.text_ta ? '\n' : '') + v.text_en;
      shareText += `[${v.verse}] ${verseContent}\n\n`; 
    });
    
    shareText += `Join our WhatsApp channel:\nhttps://whatsapp.com/channel/0029Vb6Pu8FLI8YfM5H49e0p\n\n📲Download our APP in Play Store : https://play.google.com/store/apps/details?id=com.adventisttamiltool.adventisttamiltool`;
    
    try { await Share.share({ message: shareText }); } catch (e) {}
    setSelectedVerses([]);
  }

  function openCrossRefs() {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    if (!selectedVerses[0]?.verse) return;
    try {
      const db = getSafeDb('cross_references.db');
      setCrossRefsList(db.getAllSync(`SELECT to_book_id, to_chapter, to_verse FROM refs WHERE from_book_id = ? AND from_chapter = ? AND from_verse = ? LIMIT 20`, [activeBookId, activeChapter, selectedVerses[0].verse]) ?? []);
      setShowCrossRefs(true);
    } catch (e) {}
  }

  function jumpToLocation(book, chapter, verse, wordToHighlight = null) {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
    setShowCrossRefs(false); setShowLeftMenu(false); setShowSearch(false); setSelectedVerses([]);
    setActiveBookId(book); setActiveChapter(chapter); setTargetVerse(verse);
    if (wordToHighlight) { setHighlightedWord(wordToHighlight); setTimeout(() => setHighlightedWord(null), 3000); }
  }

  function toggleVerseSelection(verseObj) {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    setSelectedVerses(prev => prev.find(v => v.verse === verseObj.verse) ? prev.filter(v => v.verse !== verseObj.verse) : [...prev, verseObj]);
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient colors={isDark ? ['#0A1929', colors.background] : ['#FFFFFF', colors.background]} style={StyleSheet.absoluteFillObject} />

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <BibleHeader
          colors={colors} isDark={isDark} appFontSize={appFontSize} bibleLanguage={bibleLanguage}
          bookName={getBookName(activeBookId)} chapter={activeChapter}
          onMenuPress={() => { triggerHaptic(); setShowLeftMenu(true); }}
          onBookPress={() => { triggerHaptic(); setPickerStep('book'); setIsPickerVisible(true); }}
          onChapterPress={openChapterPicker}
          onSearchPress={() => setShowSearch(true)}
        />

        {isLoading ? (
          <View style={styles.bodyCenter}><ActivityIndicator size="large" color={colors.primary} /></View>
        ) : (
          <FlatList
            ref={flatListRef} data={verses} keyExtractor={(item) => `${item.lang ?? 'v'}-${item.verse}-${item.combinedIndex}`}
            contentContainerStyle={{ padding: 15, paddingBottom: 160 }} showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <VerseRenderer
                item={item} isDark={isDark} colors={colors} bibleLanguage={bibleLanguage}
                bibleFontSize={bibleFontSize} bibleLineHeight={bibleLineHeight} bibleLetterSpacing={bibleLetterSpacing}
                isTargetHighlighted={highlightedVerse === item.verse} isSelected={selectedVerses.some(v => v.verse === item.verse)}
                userHighlight={userHighlights.find(h => h.verse === item.verse)} 
                isFavorite={userFavorites.includes(item.verse)} 
                highlightedWord={highlightedWord}
                onToggleSelection={toggleVerseSelection}
                onLongPress={(verse) => { if (selectedVerses.length === 0) { triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy); setSelectedVerses([verse]); } }}
              />
            )}
            ListFooterComponent={
              <View style={styles.navButtonsContainer}>
                <TouchableOpacity style={[styles.navBtn, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={handlePrevChapter} disabled={activeBookId === 1 && activeChapter === 1}>
                  <Ionicons name="arrow-back" size={24} color={activeBookId === 1 && activeChapter === 1 ? colors.border : colors.text} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.navBtn, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={handleNextChapter} disabled={activeBookId === 66 && activeChapter === 22}>
                  <Ionicons name="arrow-forward" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>
            }
          />
        )}

        <BibleActionBar
          colors={colors} isDark={isDark} selectedVerses={selectedVerses} userFavorites={userFavorites}
          showHighlightPalette={showHighlightPalette} onCancel={() => { triggerHaptic(); setSelectedVerses([]); }}
          onFavorite={saveFavorite} 
          onToggleHighlightPalette={() => { triggerHaptic(); setShowHighlightPalette(!showHighlightPalette); }} onSaveHighlight={saveHighlight}
          onCrossRef={openCrossRefs} onShare={handleShare}
          onConcordance={() => {
            if (selectedVerses.length === 1) {
              triggerHaptic();
              const v = selectedVerses[0];
              setSelectedVerses([]);
              navigation.navigate('Concordance', {
                targetBookId: activeBookId,
                targetChapter: activeChapter,
                targetVerse: v.verse,
                jumpTimestamp: Date.now()
              });
            }
          }}
          onExplanations={() => {
            if (selectedVerses.length === 1) {
              triggerHaptic();
              const v = selectedVerses[0];
              setSelectedVerses([]);
              navigation.navigate('StudyExplanations', {
                targetBookId: activeBookId,
                targetChapter: activeChapter,
                targetVerse: v.verse,
                jumpTimestamp: Date.now()
              });
            }
          }}
        />
      </SafeAreaView>

      <BiblePickers
        visible={isPickerVisible} pickerStep={pickerStep} selectedTestament={selectedTestament}
        availableChapters={availableChapters} availableVerses={availableVerses}
        colors={colors} isDark={isDark} appFontSize={appFontSize} bibleLanguage={bibleLanguage}
        onClose={() => { triggerHaptic(); setIsPickerVisible(false); }}
        onBack={() => { triggerHaptic(); setPickerStep(pickerStep === 'verse' ? 'chapter' : 'book'); }}
        onTestamentSelect={setSelectedTestament} onBookSelect={handleBookSelect} onChapterSelect={handleChapterSelect}
        onVerseSelect={(v) => { triggerHaptic(Haptics.ImpactFeedbackStyle.Medium); setJumpHistory([]); setActiveBookId(tempBookId); setActiveChapter(tempChapterRef.current); setTargetVerse(v); setIsPickerVisible(false); }}
      />

      <BibleLeftMenu
        visible={showLeftMenu}
        onClose={() => setShowLeftMenu(false)}
        onDataChange={refreshUserDataSync}
        onJumpToVerse={jumpToLocation}
      />
      
      <BibleSearch visible={showSearch} onClose={() => setShowSearch(false)} onJumpToVerse={(b, c, v) => { setJumpHistory([]); jumpToLocation(b, c, v); }} />
      
      <CrossRefModal visible={showCrossRefs} colors={colors} isDark={isDark} appFontSize={appFontSize} bibleLanguage={bibleLanguage} crossRefsList={crossRefsList} getBookName={getBookName} 
        onJump={(book, chapter, verse) => {
          setJumpHistory(prev => [...prev, {
            bookId: activeBookId,
            chapter: activeChapter,
            verse: selectedVerses[0]?.verse || 1
          }]);
          jumpToLocation(book, chapter, verse);
        }} 
        onClose={() => setShowCrossRefs(false)} 
      />

      {jumpHistory.length > 0 && (
        <View style={[styles.jumpBackContainer, { backgroundColor: colors.primary }]}>
          <TouchableOpacity 
            activeOpacity={0.8}
            style={styles.jumpBackMainBtn}
            onPress={() => {
              triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
              const lastLoc = jumpHistory[jumpHistory.length - 1];
              setJumpHistory(prev => prev.slice(0, -1)); 
              jumpToLocation(lastLoc.bookId, lastLoc.chapter, lastLoc.verse);
            }}
          >
            <Ionicons name="arrow-undo" size={20} color={isDark ? '#000' : '#FFF'} />
            <Text style={{ color: isDark ? '#000' : '#FFF', fontWeight: 'bold', marginLeft: 8, fontSize: 14 }}>
              Back to {getBookName(jumpHistory[jumpHistory.length - 1].bookId)} {jumpHistory[jumpHistory.length - 1].chapter}:{jumpHistory[jumpHistory.length - 1].verse}
            </Text>
          </TouchableOpacity>

          <View style={{ width: 1, backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.3)', marginVertical: 8 }} />

          <TouchableOpacity 
            activeOpacity={0.8}
            style={styles.jumpBackCloseBtn}
            onPress={() => {
              triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
              setJumpHistory([]); 
            }}
          >
            <Ionicons name="close" size={22} color={isDark ? '#000' : '#FFF'} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  bodyCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  navButtonsContainer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 30, paddingHorizontal: 10 },
  navBtn: { width: 60, height: 60, borderRadius: 30, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  jumpBackContainer: { position: 'absolute', bottom: 160, alignSelf: 'center', flexDirection: 'row', alignItems: 'stretch', borderRadius: 25, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 8 },
  jumpBackMainBtn: { flexDirection: 'row', alignItems: 'center', paddingLeft: 20, paddingRight: 12, paddingVertical: 12 },
  jumpBackCloseBtn: { justifyContent: 'center', alignItems: 'center', paddingLeft: 12, paddingRight: 18 }
});