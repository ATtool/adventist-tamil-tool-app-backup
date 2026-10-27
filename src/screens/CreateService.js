import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Animated, KeyboardAvoidingView, Platform, Dimensions, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSettings } from '../context/SettingsContext';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as SQLite from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';

import booksData from '../data/books.json';
import { getCustomSongs } from '../utils/UserDataDB';

const { height } = Dimensions.get('window');

const BLOCK_TYPES = [
  { type: 'Opening Song', tamil: 'ஆரம்பப் பாடல்', icon: 'musical-notes', color: '#FF2D55', category: 'song' },
  { type: 'Opening Prayer', tamil: 'ஆரம்ப ஜெபம்', icon: 'person', color: '#FF9F0A', category: 'person' },
  { type: 'Song Service', tamil: 'பாடல் ஆராதனை', icon: 'mic', color: '#FF3B30', category: 'song' },
  { type: 'Bible Verse', tamil: 'வேதபாடம்', icon: 'book', color: '#32ADE6', category: 'bible' },
  { type: 'Tithe & Offering', tamil: 'காணிக்கை', icon: 'wallet', color: '#FFD60A', category: 'tithe' }, 
  { type: 'Special Song', tamil: 'சிறப்புப் பாடல்', icon: 'star', color: '#BF5AF2', category: 'song' },
  { type: 'Closing Prayer', tamil: 'முடிவு ஜெபம்', icon: 'person', color: '#5E5CE6', category: 'person' },
  { type: 'Closing Song', tamil: 'முடிவுப் பாடல்', icon: 'musical-notes', color: '#FF2D55', category: 'song' },
  { type: 'Vote of Thanks', tamil: 'நன்றியுரை', icon: 'chatbubbles', color: '#0A84FF', category: 'person' },
  { type: 'Custom Note', tamil: 'குறிப்பு', icon: 'document-text', color: '#8E8E93', category: 'note' },
];

const MARRIAGE_TEMPLATE = [
  { type: 'Welcome', tamil: 'வரவேற்பு', icon: 'hand-left', color: '#FF9F0A', category: 'person' },
  { type: 'Opening Song', tamil: 'ஆரம்பப் பாடல்', icon: 'musical-notes', color: '#FF2D55', category: 'song' },
  { type: 'Scripture Reading', tamil: 'வேதபாடம்', icon: 'book', color: '#32ADE6', category: 'bible' },
  { type: 'Opening Prayer', tamil: 'ஆரம்ப ஜெபம்', icon: 'person', color: '#FF9F0A', category: 'person' },
  { type: 'Intro the Groom', tamil: 'மணமகன் அறிமுகம்', icon: 'man', color: '#8E8E93', category: 'person' },
  { type: 'Intro the Bride', tamil: 'மணமகள் அறிமுகம்', icon: 'woman', color: '#8E8E93', category: 'person' },
  { type: 'Special Song', tamil: 'சிறப்புப் பாடல்', icon: 'star', color: '#BF5AF2', category: 'song' },
  { type: 'The Word Of God', tamil: 'தேவ செய்தி', icon: 'book', color: '#32ADE6', category: 'person' },
  { type: 'Solemnization', tamil: 'திருமண வாக்குத்தத்தம்', icon: 'heart', color: '#FF2D55', category: 'person' },
  { type: 'Dedication Prayer', tamil: 'பிரதிஷ்டை ஜெபம்', icon: 'person', color: '#FF9F0A', category: 'person' },
  { type: 'Registration', tamil: 'பதிவு செய்தல்', icon: 'document-text', color: '#8E8E93', category: 'note' },
  { type: 'Special Song', tamil: 'சிறப்புப் பாடல்', icon: 'star', color: '#BF5AF2', category: 'song' },
  { type: 'Closing Song', tamil: 'முடிவுப் பாடல்', icon: 'musical-notes', color: '#FF2D55', category: 'song' },
  { type: 'Prayer of Blessings', tamil: 'ஆசீர்வாத ஜெபம்', icon: 'person', color: '#FF9F0A', category: 'person' },
  { type: 'Vote Of Thanks', tamil: 'நன்றியுரை', icon: 'chatbubbles', color: '#0A84FF', category: 'person' },
  { type: 'Intro the Couple', tamil: 'தம்பதியினர் அறிமுகம்', icon: 'people', color: '#8E8E93', category: 'person' },
];

const SONGBOOKS = [
  { id: 'Zion', ta: 'சீயோன் இனிய கீதங்கள்', en: 'Zion Iniya Geethangal' },
  { id: 'Hope', ta: 'திருமறைத்திருப் (நம்பிக்கை)', en: 'Thirumarai (Hope)' },
  { id: 'Old', ta: 'திருமறைத்திருப் (பழையது)', en: 'Thirumarai (Old)' },
  { id: 'Custom', ta: 'எனது பாடல்கள் (Custom)', en: 'Enathu Paadalgal' }
];

export default function CreateService() {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors, isDark, appFontSize, hapticsEnabled } = useSettings();

  const [serviceId, setServiceId] = useState(null); // Used for editing an existing service
  const [meetingName, setMeetingName] = useState('');
  const [meetingDate, setMeetingDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false); 
  
  const [blocks, setBlocks] = useState([]);
  const [expandedBlockId, setExpandedBlockId] = useState(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [activeConfigType, setActiveConfigType] = useState(null); 
  const [pendingBlockTemplate, setPendingBlockTemplate] = useState(null);
  const [editingBlockId, setEditingBlockId] = useState(null); 
  
  const [livePreviewText, setLivePreviewText] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // Form Fields
  const [tempPersonName, setTempPersonName] = useState('');
  const [tempNoteText, setTempNoteText] = useState('');
  const [tempSongData, setTempSongData] = useState({ book: 'Zion', number: '', title: '' });
  const [tempBibleData, setTempBibleData] = useState({ book: 'ஆதியாகமம்', chapter: '1', verse: '1' });

  // Toggles
  const [isThanglishSong, setIsThanglishSong] = useState(false);
  const [isEnglishBible, setIsEnglishBible] = useState(false);

  const sheetAnim = useRef(new Animated.Value(height)).current;
  const configSheetAnim = useRef(new Animated.Value(height)).current;
  const songToggleAnim = useRef(new Animated.Value(0)).current;
  const bibleToggleAnim = useRef(new Animated.Value(0)).current;

  const triggerHaptic = (style = Haptics.ImpactFeedbackStyle.Light) => {
    if (hapticsEnabled) Haptics.impactAsync(style);
  };

  // --- NEW: Handle Editing Existing Service ---
  useEffect(() => {
    if (route.params?.editService) {
      const srv = route.params.editService;
      setServiceId(srv.id);
      setMeetingName(srv.name);
      setMeetingDate(new Date(srv.date));
      setBlocks(srv.agenda || []);
    }
  }, [route.params]);

  // Translate Bible book selector when language flips
  useEffect(() => {
    const currentBook = booksData.find(b => b.name_ta === tempBibleData.book || b.name_en === tempBibleData.book);
    if (currentBook) {
      const newBookName = isEnglishBible ? currentBook.name_en : currentBook.name_ta;
      setTempBibleData(prev => ({ ...prev, book: newBookName }));
      fetchBiblePreview(newBookName, tempBibleData.chapter, tempBibleData.verse, isEnglishBible);
    }
  }, [isEnglishBible]);

  const handleSaveService = async () => {
    if (!meetingName || blocks.length === 0) return;
    triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
    
    const newService = {
      id: serviceId || Date.now().toString(), // Use existing ID if we are editing
      name: meetingName,
      date: meetingDate.toISOString(),
      agenda: blocks
    };

    try {
      const existing = await AsyncStorage.getItem('@saved_services');
      let services = existing ? JSON.parse(existing) : [];
      
      if (serviceId) {
        // We are editing, so overwrite the old one
        const index = services.findIndex(s => s.id === serviceId);
        if (index !== -1) services[index] = newService;
        else services.push(newService);
      } else {
        services.push(newService);
      }
      
      await AsyncStorage.setItem('@saved_services', JSON.stringify(services));
      Alert.alert("Success", "Service saved successfully!");
      navigation.goBack();
    } catch (e) {
      console.error('Failed to save service', e);
      Alert.alert("Error", "Could not save the service.");
    }
  };

  const handleDateChange = (event, selectedDate) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (selectedDate) setMeetingDate(selectedDate);
  };

  const fetchSongPreview = async (bookId, searchText, isThanglish) => {
    if (!searchText || searchText.trim() === '') { 
      setLivePreviewText(''); 
      return; 
    }

    setIsSearching(true);

    if (bookId === 'Custom') {
      try {
        const customSongs = getCustomSongs();
        const term = searchText.toLowerCase().trim();
        const song = customSongs.find(s => 
          s.id.toString() === term || 
          (s.title_tamil && s.title_tamil.toLowerCase().includes(term)) || 
          (s.title_thanglish && s.title_thanglish.toLowerCase().includes(term))
        );

        if (song) {
          const title = isThanglish ? (song.title_thanglish || song.title_tamil) : song.title_tamil;
          setTempSongData(prev => ({ ...prev, title: title || 'Unknown Title', lyrics: song.lyrics }));
          setLivePreviewText(`[ Custom #${song.id} - ${title || 'Unknown'} ]\n\n${song.lyrics}`);
        } else {
          setLivePreviewText('No custom song found matching this search.');
        }
      } catch(e) {
        setLivePreviewText('Error fetching custom song data.');
      } finally {
        setIsSearching(false);
      }
      return; 
    }

    let db = null;
    try {
      let dbName = bookId === 'Zion' ? 'zion.db' : 'Thirumarai.db';
      db = await SQLite.openDatabaseAsync(dbName);
      
      // Dynamic table detector to prevent crash!
      const tableRes = await db.getAllAsync("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'android_metadata'");
      const tableName = tableRes && tableRes.length > 0 ? tableRes.find(t => t.name === 'songs' || t.name === 'SongListTable')?.name || tableRes[0].name : 'SongListTable';

      let query = '';
      let params = [searchText];

      if (bookId === 'Zion') {
        query = `SELECT * FROM "${tableName}" WHERE song_number = ? LIMIT 1`;
      } else if (bookId === 'Hope') {
        query = `SELECT * FROM "${tableName}" WHERE Song_number_by_Nambikaiyen_Geethagal = ? LIMIT 1`;
      } else if (bookId === 'Old') {
        query = `SELECT * FROM "${tableName}" WHERE song_number = ? LIMIT 1`;
      }

      const result = await db.getAllAsync(query, params);
      
      if (result && result.length > 0) {
        const song = result[0];
        // Parse Title depending on language mode
        const title = isThanglish 
          ? (song.title_english || song.song_title_english || song.title_tamil || song.song_title_tamil || 'Unknown Title')
          : (song.title_tamil || song.song_title_tamil || 'Unknown Title');
          
        // Parse Lyrics depending on language mode (falls back to tamil lyrics if no transliteration is found)
        const lyrics = isThanglish 
          ? (song.lyrics_transliteration || song.lyrics)
          : song.lyrics;

        setTempSongData(prev => ({ ...prev, title, lyrics }));
        setLivePreviewText(`[ ${searchText} - ${title} ]\n\n${lyrics}`);
      } else {
        setLivePreviewText('No song found matching this search.');
      }
    } catch(e) {
      setLivePreviewText('Error fetching song data.');
    } finally {
      if (db) await db.closeAsync().catch(() => {});
      setIsSearching(false);
    }
  };

  const fetchBiblePreview = async (bookName, chapterStr, verseStr, isEnglish) => {
    if (!bookName || !chapterStr || !verseStr) { 
      setLivePreviewText(''); 
      return; 
    }

    setIsSearching(true);
    let db = null;

    try {
      const bookObj = booksData.find(b => b.name_ta === bookName || b.name_en === bookName);
      if (!bookObj) return;

      const dbName = isEnglish ? 'KJV.db' : 'TAMIL.db';
      db = await SQLite.openDatabaseAsync(dbName);
      
      const tableRes = await db.getAllAsync("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'android_metadata'");
      if (!tableRes || tableRes.length === 0) return;
      const tableName = tableRes[0].name;

      const query = `SELECT text FROM "${tableName}" WHERE book_id = ? AND chapter = ? AND verse = ? LIMIT 1`;
      const result = await db.getAllAsync(query, [bookObj.id, parseInt(chapterStr), parseInt(verseStr)]);

      if (result && result.length > 0) {
        setLivePreviewText(result[0].text);
      } else {
        setLivePreviewText('Verse not found in database.');
      }
    } catch(e) {
      setLivePreviewText('Error fetching verse data.');
    } finally {
      if (db) await db.closeAsync().catch(() => {});
      setIsSearching(false);
    }
  };

  const openAddModal = () => {
    triggerHaptic();
    setShowAddModal(true);
    Animated.spring(sheetAnim, { toValue: 0, friction: 8, useNativeDriver: true }).start();
  };

  const closeAddModal = () => {
    Animated.timing(sheetAnim, { toValue: height, duration: 250, useNativeDriver: true }).start(() => setShowAddModal(false));
  };

  const addMarriageTemplate = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Success);
    const marriageBlocks = MARRIAGE_TEMPLATE.map((item, index) => ({
       id: Date.now().toString() + index,
       type: item.type,
       title: item.type,
       icon: item.icon,
       color: item.color,
       category: item.category,
       data: { 
         ledBy: '', 
         note: '', 
         book: item.category === 'song' ? 'Zion' : 'ஆதியாகமம்', 
         number: '', 
         chapter: item.category === 'bible' ? '1' : '', 
         verse: item.category === 'bible' ? '1' : '' 
       }
    }));
    
    if (!meetingName) setMeetingName("Marriage Program");
    setBlocks([...blocks, ...marriageBlocks]);
    closeAddModal();
  };

  const initiateBlockConfig = (template) => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    setEditingBlockId(null); 
    setPendingBlockTemplate(template);
    setTempPersonName(''); setTempNoteText(''); setLivePreviewText('');
    setTempSongData({ book: 'Zion', number: '', title: '' });
    
    // Reset to local language defaults
    setIsThanglishSong(false);
    setIsEnglishBible(false);
    setTempBibleData({ book: 'ஆதியாகமம்', chapter: '1', verse: '1' });
    songToggleAnim.setValue(0);
    bibleToggleAnim.setValue(0);

    Animated.timing(sheetAnim, { toValue: height, duration: 200, useNativeDriver: true }).start(() => {
      setShowAddModal(false);
      setActiveConfigType(template.category);
      Animated.spring(configSheetAnim, { toValue: 0, friction: 8, useNativeDriver: true }).start();
    });
  };

  const editBlock = (block) => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    setEditingBlockId(block.id);
    setPendingBlockTemplate({ type: block.type, icon: block.icon, color: block.color, category: block.category });
    setActiveConfigType(block.category);
    setExpandedBlockId(null); 

    setTempPersonName(block.data.ledBy || '');
    setTempNoteText(block.data.note || '');
    
    if (block.category === 'song') {
      setTempSongData({ book: block.data.book || 'Zion', number: block.data.number || '', title: block.data.title || '' });
      if (block.data.book && block.data.number) fetchSongPreview(block.data.book, block.data.number, isThanglishSong);
    } else {
      setTempSongData({ book: 'Zion', number: '', title: '' });
    }

    if (block.category === 'bible' || block.category === 'tithe') {
      setTempBibleData({ book: block.data.book || (isEnglishBible ? 'Genesis' : 'ஆதியாகமம்'), chapter: block.data.chapter || '1', verse: block.data.verse || '1' });
      if (block.data.book && block.data.chapter && block.data.verse) fetchBiblePreview(block.data.book, block.data.chapter, block.data.verse, isEnglishBible);
    } else {
      setTempBibleData({ book: (isEnglishBible ? 'Genesis' : 'ஆதியாகமம்'), chapter: '1', verse: '1' });
    }

    Animated.spring(configSheetAnim, { toValue: 0, friction: 8, useNativeDriver: true }).start();
  };

  const closeConfigModal = () => {
    Animated.timing(configSheetAnim, { toValue: height, duration: 250, useNativeDriver: true }).start(() => {
      setActiveConfigType(null);
      setPendingBlockTemplate(null);
      setEditingBlockId(null);
    });
  };

  const confirmAndAddBlock = () => {
    if (!pendingBlockTemplate) return;

    let finalData = {};
    let isMissingData = false;

    if (activeConfigType === 'person') {
      finalData = { ledBy: tempPersonName };
      if (!tempPersonName.trim()) isMissingData = true;
    } else if (activeConfigType === 'note') {
      finalData = { note: tempNoteText };
      if (!tempNoteText.trim()) isMissingData = true;
    } else if (activeConfigType === 'song') {
      finalData = { ...tempSongData, ledBy: tempPersonName };
      if (tempSongData.book === 'Custom' && !tempSongData.lyrics) {
         isMissingData = true;
      } else if (!tempSongData.number || livePreviewText.includes('Not found') || livePreviewText.includes('Error')) {
         isMissingData = true;
      }
    } else if (activeConfigType === 'bible') {
      finalData = { ...tempBibleData, ledBy: tempPersonName };
      if (!tempBibleData.chapter || !tempBibleData.verse || livePreviewText.includes('Not found')) isMissingData = true;
    } else if (activeConfigType === 'tithe') {
      finalData = { ledBy: tempPersonName, book: tempBibleData.book, chapter: tempBibleData.chapter, verse: tempBibleData.verse, note: tempNoteText };
    }

    if (isMissingData) {
      Alert.alert(
        "Missing Details",
        "Some details are empty or could not be found. Do you want to add this to the service anyway?",
        [
          { text: "No, Go Back", style: "cancel" },
          { text: "Yes, Add It", onPress: () => finalizeBlockAdd(finalData) }
        ]
      );
    } else {
      finalizeBlockAdd(finalData);
    }
  };

  const finalizeBlockAdd = (finalData) => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Success);
    let displayTitle = pendingBlockTemplate.type;

    if (pendingBlockTemplate.type === 'Song Service' && !editingBlockId) {
      const currentCount = blocks.filter(b => b.type === 'Song Service').length;
      displayTitle = `Song Service ${currentCount + 1}`;
    }

    const newBlock = {
      id: editingBlockId || Date.now().toString(),
      type: pendingBlockTemplate.type,
      title: editingBlockId ? blocks.find(b => b.id === editingBlockId).title : displayTitle, 
      icon: pendingBlockTemplate.icon,
      color: pendingBlockTemplate.color,
      category: activeConfigType,
      data: finalData
    };

    if (editingBlockId) {
      setBlocks(blocks.map(b => b.id === editingBlockId ? newBlock : b));
    } else {
      setBlocks([...blocks, newBlock]);
    }
    
    closeConfigModal();
  };

  const moveBlock = (index, direction) => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= blocks.length) return;
    
    const newBlocks = [...blocks];
    const temp = newBlocks[index];
    newBlocks[index] = newBlocks[newIndex];
    newBlocks[newIndex] = temp;
    setBlocks(newBlocks);
  };

  const removeBlock = (id) => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
    setBlocks(blocks.filter(b => b.id !== id));
    setExpandedBlockId(null);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
            <Ionicons name="chevron-back" size={28} color={colors.primary} />
            <Text style={{ color: colors.primary, fontSize: 17, fontFamily: 'Tamil003', includeFontPadding: false }}>Back</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{serviceId ? "Edit Service" : "Service Builder"}</Text>
          <TouchableOpacity onPress={handleSaveService} style={styles.headerBtn} disabled={!meetingName || blocks.length === 0}>
            <Text style={{ color: (meetingName && blocks.length > 0) ? colors.primary : colors.subtext, fontSize: 17, fontWeight: 'bold', fontFamily: 'Tamil003', includeFontPadding: false }}>Save</Text>
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            
            <View style={[styles.detailsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.label, { color: colors.subtext }]}>Service Name / ஆராதனை பெயர்</Text>
              <TextInput style={[styles.input, { color: colors.text, borderBottomColor: colors.border }]} placeholder="e.g. Sabbath Morning Worship" placeholderTextColor={colors.subtext} value={meetingName} onChangeText={setMeetingName} />
              
              <Text style={[styles.label, { color: colors.subtext, marginTop: 15 }]}>Date / தேதி</Text>
              
              <TouchableOpacity onPress={() => setShowDatePicker(true)} style={[styles.input, { borderBottomColor: 'transparent' }]}>
                <Text style={{ color: colors.text, fontSize: 18 }}>{meetingDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</Text>
              </TouchableOpacity>
              
              {showDatePicker && (
                <View style={{ marginTop: 10, backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7', borderRadius: 12, overflow: 'hidden' }}>
                  <DateTimePicker
                    value={meetingDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'inline' : 'calendar'}
                    onChange={handleDateChange}
                    themeVariant={isDark ? "dark" : "light"}
                  />
                  {Platform.OS === 'ios' && (
                    <TouchableOpacity onPress={() => setShowDatePicker(false)} style={{ padding: 15, alignItems: 'center', borderTopWidth: 1, borderColor: colors.border }}>
                      <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: 16 }}>Done</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>

            <Text style={[styles.sectionTitle, { color: colors.text }]}>Agenda / நிரல்</Text>
            {blocks.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="list" size={50} color={colors.border} />
                <Text style={{ color: colors.subtext, marginTop: 10 }}>Your agenda is empty.</Text>
              </View>
            ) : (
              blocks.map((block, index) => {
                const isExpanded = expandedBlockId === block.id;
                return (
                  <View key={block.id} style={[styles.blockWrapper, { backgroundColor: colors.card, borderColor: isExpanded ? colors.primary : colors.border }]}>
                    <TouchableOpacity style={styles.blockHeader} activeOpacity={0.7} onPress={() => { triggerHaptic(); setExpandedBlockId(isExpanded ? null : block.id); }}>
                      <View style={[styles.blockIconBadge, { backgroundColor: block.color + '20' }]}><Ionicons name={block.icon} size={20} color={block.color} /></View>
                      <View style={{ flex: 1, marginLeft: 15 }}>
                        <Text style={{ color: colors.text, fontSize: 18, fontWeight: 'bold' }}>{block.title}</Text>
                        
                        {/* Perfect Matching Formatting for Agenda View */}
                        {block.category === 'person' && block.data?.ledBy ? <Text style={{ color: colors.primary, fontSize: 14, marginTop: 2 }}>Led by: {block.data.ledBy}</Text> : null}
                        {block.category === 'note' && block.data?.note ? <Text style={{ color: colors.subtext, fontSize: 14, marginTop: 2 }} numberOfLines={1}>{block.data.note}</Text> : null}
                        
                        {block.category === 'song' && (
                          <Text style={{ color: colors.primary, fontSize: 14, marginTop: 2 }}>
                            {block.data?.book} #{block.data?.number} {block.data?.title ? `- ${block.data.title}` : ''} {block.data?.ledBy ? `(By ${block.data.ledBy})` : ''}
                          </Text>
                        )}
                        
                        {block.category === 'bible' && (
                          <Text style={{ color: colors.primary, fontSize: 14, marginTop: 2 }}>
                            {block.data?.book} {block.data?.chapter}:{block.data?.verse} {block.data?.ledBy ? `(By ${block.data.ledBy})` : ''}
                          </Text>
                        )}
                        
                        {block.category === 'tithe' && (
                          <View>
                            {block.data?.ledBy ? <Text style={{ color: colors.primary, fontSize: 14, marginTop: 2 }}>Led by: {block.data.ledBy}</Text> : null}
                            {block.data?.book && block.data?.chapter ? <Text style={{ color: colors.subtext, fontSize: 13, marginTop: 2 }}>{block.data.book} {block.data.chapter}:{block.data.verse}</Text> : null}
                          </View>
                        )}
                      </View>
                      <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={24} color={colors.subtext} />
                    </TouchableOpacity>

                    {isExpanded && (
                      <View style={[styles.expandedActions, { borderTopColor: colors.border }]}>
                        {/* Move Arrows */}
                        <View style={{ flexDirection: 'row' }}>
                          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]} onPress={() => moveBlock(index, -1)} disabled={index === 0}>
                            <Ionicons name="arrow-up" size={18} color={index === 0 ? colors.subtext : colors.text} />
                          </TouchableOpacity>
                          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, marginLeft: 8 }]} onPress={() => moveBlock(index, 1)} disabled={index === blocks.length - 1}>
                            <Ionicons name="arrow-down" size={18} color={index === blocks.length - 1 ? colors.subtext : colors.text} />
                          </TouchableOpacity>
                        </View>
                        {/* Edit & Remove */}
                        <View style={{ flexDirection: 'row' }}>
                          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.primary + '20', marginRight: 8 }]} onPress={() => editBlock(block)}>
                            <Ionicons name="pencil" size={18} color={colors.primary} />
                            <Text style={{ color: colors.primary, fontWeight: 'bold', marginLeft: 5 }}>Edit</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: 'rgba(255, 59, 48, 0.1)' }]} onPress={() => removeBlock(block.id)}>
                            <Ionicons name="trash" size={18} color="#FF3B30" />
                            <Text style={{ color: '#FF3B30', fontWeight: 'bold', marginLeft: 5 }}>Del</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>
                );
              })
            )}

            <TouchableOpacity style={[styles.addBlockBtn, { backgroundColor: colors.primary + '15', borderColor: colors.primary }]} onPress={openAddModal}>
              <Ionicons name="add-circle" size={24} color={colors.primary} />
              <Text style={{ color: colors.primary, fontSize: 16, fontWeight: 'bold', marginLeft: 8 }}>Add Item</Text>
            </TouchableOpacity>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* 1. BOTTOM SHEET: CHOOSE ITEM */}
      {showAddModal && (
        <View style={StyleSheet.absoluteFill}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={closeAddModal}>
            <BlurView intensity={isDark ? 50 : 80} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFillObject} />
          </TouchableOpacity>
          <Animated.View style={[styles.bottomSheet, { backgroundColor: isDark ? '#12161E' : '#FFFFFF', borderColor: colors.border, transform: [{ translateY: sheetAnim }] }]}>
            <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: 'bold' }}>Add to Service</Text>
              <TouchableOpacity onPress={closeAddModal}><Ionicons name="close-circle" size={28} color={colors.subtext} /></TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.gridContainer}>
              
              {/* THE MARRIAGE TEMPLATE BUTTON */}
              <TouchableOpacity 
                style={[styles.gridItem, { width: '100%', backgroundColor: colors.primary + '15', borderColor: colors.primary }]} 
                onPress={addMarriageTemplate}
              >
                <View style={{flexDirection: 'row', alignItems: 'center'}}>
                   <View style={[styles.gridIcon, { backgroundColor: colors.primary + '30', marginRight: 15 }]}><Ionicons name="heart" size={28} color={colors.primary} /></View>
                   <View>
                      <Text style={{ color: colors.primary, fontSize: 16, fontWeight: 'bold' }}>Marriage Program</Text>
                      <Text style={{ color: colors.primary, fontSize: 12, fontFamily: 'Tamil003', includeFontPadding: false }}>திருமண நிகழ்ச்சி நிரல்</Text>
                   </View>
                </View>
              </TouchableOpacity>

              {/* REGULAR BLOCKS */}
              {BLOCK_TYPES.map((item, index) => (
                <TouchableOpacity key={index} style={[styles.gridItem, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => initiateBlockConfig(item)}>
                  <View style={[styles.gridIcon, { backgroundColor: item.color + '15' }]}><Ionicons name={item.icon} size={28} color={item.color} /></View>
                  <Text style={{ color: colors.text, fontSize: 13, fontWeight: 'bold', textAlign: 'center', marginTop: 10 }}>{item.type}</Text>
                  <Text style={{ color: colors.subtext, fontSize: 10, fontFamily: 'Tamil003', textAlign: 'center', marginTop: 2, includeFontPadding: false }}>{item.tamil}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Animated.View>
        </View>
      )}

      {/* 2. BOTTOM SHEET: COMPACT CONFIG WITH LIVE PREVIEW */}
      {activeConfigType && pendingBlockTemplate && (
        <View style={StyleSheet.absoluteFill}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={closeConfigModal}>
            <BlurView intensity={isDark ? 50 : 80} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFillObject} />
          </TouchableOpacity>
          <Animated.View style={[styles.configSheet, { backgroundColor: isDark ? '#12161E' : '#FFFFFF', borderColor: colors.border, transform: [{ translateY: configSheetAnim }] }]}>
            
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
              <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
                <Text style={{ color: colors.text, fontSize: 18, fontWeight: 'bold' }}>Setup {pendingBlockTemplate.type}</Text>
                <TouchableOpacity onPress={closeConfigModal}><Ionicons name="close-circle" size={28} color={colors.subtext} /></TouchableOpacity>
              </View>
              
              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 15, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
                
                {/* BIBLE OR TITHE PICKER */}
                {(activeConfigType === 'bible' || activeConfigType === 'tithe') && (
                  <View>
                    <Text style={[styles.compactLabel, { color: colors.subtext }]}>Select Book</Text>
                    
                    {/* BIBLE LANGUAGE TOGGLE */}
                    <View style={{ alignItems: 'center', marginBottom: 15 }}>
                      <TouchableOpacity 
                        activeOpacity={0.9} 
                        onPress={() => {
                          triggerHaptic();
                          const next = !isEnglishBible;
                          setIsEnglishBible(next);
                          Animated.spring(bibleToggleAnim, { toValue: next ? 1 : 0, useNativeDriver: true }).start();
                        }}
                        style={[styles.toggleContainer, { backgroundColor: colors.card, borderColor: colors.border }]}
                      >
                        <Animated.View style={[styles.toggleThumb, { backgroundColor: colors.primary, transform: [{ translateX: bibleToggleAnim.interpolate({ inputRange: [0, 1], outputRange: [2, 108] }) }] }]} />
                        <View style={styles.toggleOption}><Text style={{ color: !isEnglishBible ? '#000' : colors.subtext, fontWeight: 'bold', fontFamily: 'Tamil003', fontSize: 13, includeFontPadding: false }}>தமிழ்</Text></View>
                        <View style={styles.toggleOption}><Text style={{ color: isEnglishBible ? '#000' : colors.subtext, fontWeight: 'bold', fontFamily: 'Tamil003', fontSize: 13, includeFontPadding: false }}>English</Text></View>
                      </TouchableOpacity>
                    </View>

                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 15 }}>
                      {booksData.map(book => {
                        const displayName = isEnglishBible ? book.name_en : book.name_ta;
                        return (
                          <TouchableOpacity 
                            key={book.id} 
                            onPress={() => { 
                              setTempBibleData({...tempBibleData, book: displayName}); 
                              triggerHaptic(); 
                              fetchBiblePreview(displayName, tempBibleData.chapter, tempBibleData.verse, isEnglishBible);
                            }} 
                            style={[styles.pill, { backgroundColor: tempBibleData.book === displayName ? colors.primary : colors.card, borderColor: tempBibleData.book === displayName ? colors.primary : colors.border }]}
                          >
                            <Text style={{ color: tempBibleData.book === displayName ? '#000' : colors.text, fontFamily: 'Tamil003', includeFontPadding: false }}>{displayName}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                      <View style={{ flex: 1, marginRight: 10 }}>
                        <Text style={[styles.compactLabel, { color: colors.subtext }]}>Chp / அதிகாரம்</Text>
                        <TextInput style={[styles.compactInput, { color: colors.text, borderColor: colors.border }]} keyboardType="numeric" value={tempBibleData.chapter} onChangeText={(text) => { setTempBibleData({...tempBibleData, chapter: text}); fetchBiblePreview(tempBibleData.book, text, tempBibleData.verse, isEnglishBible); }} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.compactLabel, { color: colors.subtext }]}>Ver / வசனம்</Text>
                        <TextInput style={[styles.compactInput, { color: colors.text, borderColor: colors.border }]} keyboardType="numeric" value={tempBibleData.verse} onChangeText={(text) => { setTempBibleData({...tempBibleData, verse: text}); fetchBiblePreview(tempBibleData.book, tempBibleData.chapter, text, isEnglishBible); }} />
                      </View>
                    </View>
                  </View>
                )}

                {/* SONG PICKER */}
                {activeConfigType === 'song' && (
                  <View>
                    <Text style={[styles.compactLabel, { color: colors.subtext }]}>Select Songbook</Text>
                    
                    {/* SONG LANGUAGE TOGGLE */}
                    <View style={{ alignItems: 'center', marginBottom: 15 }}>
                      <TouchableOpacity 
                        activeOpacity={0.9} 
                        onPress={() => {
                          triggerHaptic();
                          const next = !isThanglishSong;
                          setIsThanglishSong(next);
                          Animated.spring(songToggleAnim, { toValue: next ? 1 : 0, useNativeDriver: true }).start();
                        }}
                        style={[styles.toggleContainer, { backgroundColor: colors.card, borderColor: colors.border }]}
                      >
                        <Animated.View style={[styles.toggleThumb, { backgroundColor: colors.primary, transform: [{ translateX: songToggleAnim.interpolate({ inputRange: [0, 1], outputRange: [2, 108] }) }] }]} />
                        <View style={styles.toggleOption}><Text style={{ color: !isThanglishSong ? '#000' : colors.subtext, fontWeight: 'bold', fontFamily: 'Tamil003', fontSize: 13, includeFontPadding: false }}>தமிழ்</Text></View>
                        <View style={styles.toggleOption}><Text style={{ color: isThanglishSong ? '#000' : colors.subtext, fontWeight: 'bold', fontFamily: 'Tamil003', fontSize: 13, includeFontPadding: false }}>Thanglish</Text></View>
                      </TouchableOpacity>
                    </View>

                    {/* NEW 2x2 GRID FOR SONGBOOKS */}
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 15 }}>
                      {SONGBOOKS.map(book => (
                        <TouchableOpacity 
                          key={book.id} 
                          onPress={() => { 
                            setTempSongData({...tempSongData, book: book.id}); 
                            triggerHaptic(); 
                            fetchSongPreview(book.id, tempSongData.number, isThanglishSong);
                          }} 
                          style={[styles.gridPill, { backgroundColor: tempSongData.book === book.id ? colors.primary : colors.card, borderColor: tempSongData.book === book.id ? colors.primary : colors.border }]}
                        >
                          <Text style={{ color: tempSongData.book === book.id ? '#000' : colors.text, fontFamily: 'Tamil003', fontSize: 13, textAlign: 'center', includeFontPadding: false }}>
                            {isThanglishSong ? book.en : book.ta}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <Text style={[styles.compactLabel, { color: colors.subtext }]}>Search by Number or Name</Text>
                    <TextInput 
                      style={[styles.compactInput, { color: colors.text, borderColor: colors.border, marginBottom: 5 }]} 
                      placeholder="e.g. 45 or Guide me..." 
                      placeholderTextColor={colors.subtext} 
                      value={tempSongData.number} 
                      onChangeText={(text) => { 
                        setTempSongData({...tempSongData, number: text}); 
                        fetchSongPreview(tempSongData.book, text, isThanglishSong); 
                      }} 
                    />
                  </View>
                )}

                {/* LIVE PREVIEW BOX */}
                {(activeConfigType === 'song' || activeConfigType === 'bible' || activeConfigType === 'tithe') && (
                  <View style={[styles.previewBox, { backgroundColor: isDark ? '#1A1A1A' : '#F5F5F5', borderColor: colors.border }]}>
                    <Text style={{ color: colors.primary, fontSize: 12, fontWeight: 'bold', marginBottom: 5 }}>
                      {isSearching ? 'SEARCHING...' : 'LIVE PREVIEW'}
                    </Text>
                    <ScrollView style={{ maxHeight: 120 }} nestedScrollEnabled={true}>
                      <Text style={{ color: colors.text, fontStyle: 'italic', fontFamily: 'Tamil003', fontSize: appFontSize - 2, includeFontPadding: false }}>
                        {livePreviewText || 'Type a number or verse above to see the preview here.'}
                      </Text>
                    </ScrollView>
                  </View>
                )}

                {/* COMMON LED BY FIELD */}
                {(activeConfigType === 'person' || activeConfigType === 'song' || activeConfigType === 'bible' || activeConfigType === 'tithe') && (
                  <View style={{ marginTop: 5 }}>
                    <Text style={[styles.compactLabel, { color: colors.subtext }]}>Led By / யார் செய்வது? (Optional)</Text>
                    <TextInput style={[styles.compactInput, { color: colors.text, borderColor: colors.border }]} placeholder="Type name..." placeholderTextColor={colors.subtext} value={tempPersonName} onChangeText={setTempPersonName} />
                  </View>
                )}

                {/* CUSTOM NOTE FIELD */}
                {(activeConfigType === 'note' || activeConfigType === 'tithe') && (
                  <View style={{ marginTop: 10 }}>
                    <Text style={[styles.compactLabel, { color: colors.subtext }]}>Custom Text / குறிப்பு</Text>
                    <TextInput style={[styles.compactInput, { color: colors.text, borderColor: colors.border, height: 80 }]} placeholder="Type your notes here..." placeholderTextColor={colors.subtext} value={tempNoteText} onChangeText={setTempNoteText} multiline />
                  </View>
                )}

                {/* ALWAYS ENABLED BUTTON! */}
                <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={confirmAndAddBlock}>
                  <Text style={{ color: '#000', fontSize: 16, fontWeight: 'bold', textAlign: 'center', fontFamily: 'Tamil003', includeFontPadding: false }}>
                    {editingBlockId ? "Save Changes" : "Add to Service"}
                  </Text>
                </TouchableOpacity>

              </ScrollView>
            </KeyboardAvoidingView>
          </Animated.View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 12, borderBottomWidth: 1 },
  headerBtn: { flexDirection: 'row', alignItems: 'center', padding: 5, width: 80 },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  detailsCard: { padding: 20, borderRadius: 16, borderWidth: 1, marginBottom: 25 },
  label: { fontSize: 13, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  input: { fontSize: 18, paddingVertical: 10, borderBottomWidth: 1, fontWeight: '500' },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 15 },
  emptyState: { padding: 40, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: 'gray', borderRadius: 16 },
  blockWrapper: { borderRadius: 16, borderWidth: 1, marginBottom: 12, overflow: 'hidden' },
  blockHeader: { flexDirection: 'row', alignItems: 'center', padding: 15 },
  blockIconBadge: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  expandedActions: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, borderTopWidth: 1, backgroundColor: 'rgba(0,0,0,0.02)' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 10 },
  addBlockBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 18, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', marginTop: 10 },
  
  bottomSheet: { position: 'absolute', bottom: 0, width: '100%', height: '70%', borderTopLeftRadius: 30, borderTopRightRadius: 30, borderWidth: 1 },
  configSheet: { position: 'absolute', bottom: 0, width: '100%', height: '85%', borderTopLeftRadius: 30, borderTopRightRadius: 30, borderWidth: 1 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 1 },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', padding: 15, justifyContent: 'space-between' },
  gridItem: { width: '48%', borderRadius: 20, borderWidth: 1, justifyContent: 'center', alignItems: 'center', padding: 15, marginBottom: 15 },
  gridIcon: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  
  compactLabel: { fontSize: 12, fontWeight: 'bold', marginBottom: 5 },
  compactInput: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 15 },
  pill: { paddingVertical: 8, paddingHorizontal: 15, borderRadius: 20, marginRight: 10, borderWidth: 1, borderColor: 'transparent' },
  gridPill: { width: '48%', paddingVertical: 12, paddingHorizontal: 5, borderRadius: 12, borderWidth: 1, marginBottom: 10, justifyContent: 'center', alignItems: 'center' },
  previewBox: { padding: 15, borderRadius: 12, borderWidth: 1, marginVertical: 10 },
  saveBtn: { padding: 16, borderRadius: 15, marginTop: 15 },

  toggleContainer: { width: 220, height: 36, borderRadius: 18, flexDirection: 'row', alignItems: 'center', borderWidth: 1, position: 'relative' },
  toggleThumb: { position: 'absolute', width: 108, height: 30, borderRadius: 15 },
  toggleOption: { flex: 1, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
});