import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Modal, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import Slider from '@react-native-community/slider';
import * as SQLite from 'expo-sqlite';
import * as Haptics from 'expo-haptics';
import { useSettings } from '../context/SettingsContext';

const GIST_URL = 'https://gist.githubusercontent.com/ATtool/515dee23d057c967636146fded6645f4/raw/9de3ccd674fca98961d3dfae15364dacb47224f0/SSl-Ta';
const CACHE_KEY = '@sabbath_quarterly_data';

const DAY_NAMES = {
  "01": "ஓய்வுநாள் பிற்பகல்",
  "02": "ஞாயிற்றுக்கிழமை",
  "03": "திங்கட்கிழமை",
  "04": "செவ்வாய்க்கிழமை",
  "05": "புதன்கிழமை",
  "06": "வியாழக்கிழமை",
  "07": "வெள்ளிக்கிழமை",
  "inside-story": "மிஷன் கதை (Inside Story)"
};

const BOOK_MAP = {
  "ஆதி": 1, "யாத்": 2, "லேவி": 3, "எண்": 4, "உபா": 5, "யோசு": 6, "நியா": 7, "ரூத்": 8, "1 சாமு": 9, "2 சாமு": 10,
  "1 இரா": 11, "2 இரா": 12, "1 நாளா": 13, "2 நாளா": 14, "எஸ்றா": 15, "நெகே": 16, "எஸ்தர்": 17, "யோபு": 18,
  "சங்": 19, "நீதி": 20, "பிர": 21, "உன்": 22, "ஏசா": 23, "எரே": 24, "புல": 25, "எசே": 26, "தானி": 27,
  "ஓசியா": 28, "யோவேல்": 29, "ஆமோஸ்": 30, "ஒப": 31, "யோனா": 32, "மீகா": 33, "நாகூம்": 34, "ஆப": 35,
  "செப்": 36, "ஆகாய்": 37, "சக": 38, "மல்": 39, "மத்": 40, "மாற்கு": 41, "லூக்": 42, "யோவா": 43, "அப்": 44,
  "ரோமர்": 45, "1 கொரி": 46, "2 கொரி": 47, "கலா": 48, "எபே": 49, "பிலி": 50, "கொலோ": 51, "1 தெச": 52,
  "2 தெச": 53, "1 தீமோ": 54, "2 தீமோ": 55, "தீத்து": 56, "பிலே": 57, "எபி": 58, "யாக்": 59, "1 பேது": 60,
  "2 பேது": 61, "1 யோவா": 62, "2 யோவா": 63, "3 யோவா": 64, "யூதா": 65, "வெளி": 66
};

export default function SabbathSchoolScreen() {
  const { colors, appFontSize, isDark, hapticsEnabled } = useSettings();
  const navigation = useNavigation();
  
  const [quarterData, setQuarterData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0); 
  const [isExpired, setIsExpired] = useState(false);

  const [actualTodayWeek, setActualTodayWeek] = useState(null);
  const [actualTodayDay, setActualTodayDay] = useState(null);
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [showIntro, setShowIntro] = useState(false);

  const [showFontSettings, setShowFontSettings] = useState(false);
  const [readerFontSize, setReaderFontSize] = useState(appFontSize + 2);

  // Verse Popup State
  const [showVersePopup, setShowVersePopup] = useState(false);
  const [popupVerseText, setPopupVerseText] = useState('');
  const [popupVerseRef, setPopupVerseRef] = useState('');
  const [currentDbBook, setCurrentDbBook] = useState(null);
  const [currentDbChapter, setCurrentDbChapter] = useState(null);
  const [currentDbVerse, setCurrentDbVerse] = useState(null);

  // Highlight State
  const [highlights, setHighlights] = useState(new Set());
  
  // Custom Double Tap Memory
  const lastTapRef = useRef({});

  // Smooth Animation Engines
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const fadeAnimVerse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    fetchData(false);
  }, []);

  useEffect(() => {
    if (selectedWeek && selectedDay) loadHighlights();
  }, [selectedWeek, selectedDay]);

  useEffect(() => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  }, [activeTab, selectedDay, selectedWeek, showIntro]);

  const parseDateStr = (dateStr) => {
    if (!dateStr) return new Date(0);
    const parts = dateStr.split('/');
    if (parts.length === 3) return new Date(parts[2], parts[1] - 1, parts[0]);
    return new Date(0);
  };

  const fetchData = async (forceReload = false) => {
    setIsLoading(true);
    setIsExpired(false);
    try {
      if (forceReload) {
        await AsyncStorage.removeItem(CACHE_KEY);
      } else {
        const cachedData = await AsyncStorage.getItem(CACHE_KEY);
        if (cachedData) {
          const parsed = JSON.parse(cachedData);
          if (checkExpiration(parsed)) {
            await AsyncStorage.removeItem(CACHE_KEY);
          } else {
            setQuarterData(parsed);
            calculateToday(parsed);
            setIsLoading(false);
            return;
          }
        }
      }

      const response = await fetch(GIST_URL);
      if (response.ok) {
        const rawText = await response.text();
        const json = JSON.parse(rawText);
        
        if (checkExpiration(json)) {
          setIsExpired(true);
        } else {
          setQuarterData(json);
          calculateToday(json);
          await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(json)); 
        }
      }
    } catch (error) {
      console.warn("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const checkExpiration = (data) => {
    if (!data || !data.quarter_info) return true;
    const endDate = parseDateStr(data.quarter_info.info.end_date);
    const today = new Date();
    today.setHours(0,0,0,0);
    return today > endDate; 
  };

  const calculateToday = (data) => {
    if (!data || !data.lessons) return;
    const today = new Date();
    today.setHours(0,0,0,0);

    let foundWeek = "01"; 
    let foundDay = "01";  

    Object.keys(data.lessons).forEach(weekKey => {
      const weekData = data.lessons[weekKey];
      const startDate = parseDateStr(weekData.info.start_date);
      const endDate = parseDateStr(weekData.info.end_date);

      if (today >= startDate && today <= endDate) {
        foundWeek = weekKey;
        for (let i = 1; i <= 7; i++) {
          const dayKey = `0${i}`;
          if (weekData[dayKey]) {
            const match = weekData[dayKey].match(/date:\s*(\d{2}\/\d{2}\/\d{4})/);
            if (match && match[1]) {
              const lessonDate = parseDateStr(match[1]);
              if (lessonDate.getTime() === today.getTime()) foundDay = dayKey;
            }
          }
        }
      }
    });

    setActualTodayWeek(foundWeek);
    setActualTodayDay(foundDay);
    
    if (activeTab === 0) {
      setSelectedWeek(foundWeek);
      setSelectedDay(foundDay);
    }
  };

  const handleTabPress = (index) => {
    if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTab(index);
    if (index === 0) {
      setSelectedWeek(actualTodayWeek);
      setSelectedDay(actualTodayDay);
      setShowIntro(false);
    } else if (index === 1) {
      setSelectedWeek(actualTodayWeek);
      setSelectedDay(null);
      setShowIntro(false);
    } else if (index === 2) {
      setSelectedWeek(null);
      setSelectedDay(null);
      setShowIntro(false);
    }
  };

  // --- HIGHLIGHT ENGINE ---
  const getHighlightKey = () => `@highlight_${quarterData?.quarter_info?.info?.start_date}_${selectedWeek}_${selectedDay}`;

  const loadHighlights = async () => {
    try {
      const saved = await AsyncStorage.getItem(getHighlightKey());
      if (saved) setHighlights(new Set(JSON.parse(saved)));
      else setHighlights(new Set());
    } catch (e) {}
  };

  const toggleHighlight = async (paragraphIndex) => {
    if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const newHighlights = new Set(highlights);
    if (newHighlights.has(paragraphIndex)) newHighlights.delete(paragraphIndex);
    else newHighlights.add(paragraphIndex);
    
    setHighlights(newHighlights);
    await AsyncStorage.setItem(getHighlightKey(), JSON.stringify([...newHighlights]));
  };

  const handleParagraphPress = (index) => {
    const now = Date.now();
    const lastTap = lastTapRef.current[index] || 0;
    if (now - lastTap < 300) {
      toggleHighlight(index); 
      lastTapRef.current[index] = 0; 
    } else {
      lastTapRef.current[index] = now;
    }
  };

  // --- VERSE ENGINE ---
  const openVersePopup = async (bookId, chapter, verse, refName) => {
    setPopupVerseRef(refName);
    setPopupVerseText("வசனத்தை தேடுகிறது...");
    setCurrentDbBook(bookId);
    setCurrentDbChapter(chapter);
    setCurrentDbVerse(verse);
    setShowVersePopup(true);

    try {
      const db = await SQLite.openDatabaseAsync('TAMIL.db');
      const result = await db.getFirstAsync(
        'SELECT text FROM amp WHERE book_id = ? AND chapter = ? AND verse = ?',
        [bookId, chapter, verse]
      );
      if (result) setPopupVerseText(result.text);
      else setPopupVerseText("மன்னிக்கவும், வசனம் கிடைக்கவில்லை.");
    } catch (error) {
      setPopupVerseText("Error loading verse.");
    }
  };

  const handleVerseClick = (verseStr) => {
    if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const match = verseStr.match(/([1-3]?\s*[\u0B80-\u0BFF]+)?\s*(\d+):(\d+)/);
    if (match) {
      let bookName = match[1] ? match[1].trim() : "";
      const chapter = parseInt(match[2]);
      const verse = parseInt(match[3]);

      if (bookName === "1கொரி") bookName = "1 கொரி";
      if (bookName === "2கொரி") bookName = "2 கொரி";
      if (bookName === "1சாமு") bookName = "1 சாமு";
      if (bookName === "2சாமு") bookName = "2 சாமு";

      const bookId = BOOK_MAP[bookName];
      if (bookId) {
        openVersePopup(bookId, chapter, verse, `${bookName} ${chapter}:${verse}`);
      }
    }
  };

  const navigateVerse = async (direction) => {
    if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!currentDbBook) return;
    const nextVerse = currentDbVerse + direction;
    
    // Smooth Crossfade Animation (Flicker Fix)
    Animated.timing(fadeAnimVerse, { toValue: 0.3, duration: 100, useNativeDriver: true }).start(async () => {
      const bookName = Object.keys(BOOK_MAP).find(key => BOOK_MAP[key] === currentDbBook);
      setPopupVerseRef(`${bookName} ${currentDbChapter}:${nextVerse}`);
      setCurrentDbVerse(nextVerse);
      
      try {
        const db = await SQLite.openDatabaseAsync('TAMIL.db');
        const result = await db.getFirstAsync(
          'SELECT text FROM amp WHERE book_id = ? AND chapter = ? AND verse = ?',
          [currentDbBook, currentDbChapter, nextVerse]
        );
        if (result) setPopupVerseText(result.text);
        else setPopupVerseText("மன்னிக்கவும், வசனம் கிடைக்கவில்லை.");
      } catch (error) {
        setPopupVerseText("Error loading verse.");
      }
      Animated.timing(fadeAnimVerse, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    });
  };

  // --- MARKDOWN RENDERER (The Reading Memory Engine) ---
  const renderBookText = (rawText) => {
    if (!rawText) return null;
    let cleanText = rawText.replace(/---\n[\s\S]*?\n---\n/, '').trim();
    cleanText = cleanText.replace(/<\/?[a-z][^>]*>/gi, '');

    const paragraphs = cleanText.split('\n\n');
    let lastBookSeen = "ஆதி"; // Brains: Remembers the last book

    return paragraphs.map((paragraph, index) => {
      const isHighlighted = highlights.has(index);

      if (paragraph.trim().startsWith('>')) {
        let blockText = paragraph.replace(/>/g, '').trim(); 
        return (
          <TouchableOpacity key={index} onPress={() => handleParagraphPress(index)} onLongPress={() => toggleHighlight(index)} delayLongPress={500} activeOpacity={0.9}>
            <View style={[styles.memoryVerseBox, { backgroundColor: isHighlighted ? 'rgba(255, 215, 0, 0.15)' : colors.card, borderLeftColor: colors.primary }]}>
              <Text style={{ color: colors.text, fontSize: readerFontSize - 2, fontFamily: 'Tamil003', lineHeight: readerFontSize * 1.6 }}>
                {blockText}
              </Text>
            </View>
          </TouchableOpacity>
        );
      }

      const verseRegex = /([1-3]?\s*[\u0B80-\u0BFF]+)?\s*(\d+):(\d+(?:[-,]\d+)*)/g;
      const parts = paragraph.split(verseRegex);
      
      let elements = [];
      if (parts.length > 1) {
        let i = 0;
        while (i < parts.length) {
          if (parts[i]) elements.push(<Text key={`text-${i}`}>{parts[i].replace(/\*\*/g, '')}</Text>);
          
          if (i + 3 < parts.length) {
            let bookMatch = parts[i+1];
            const chapMatch = parts[i+2];
            const verseMatch = parts[i+3];

            // Memory Engine: Inject the book name if it's missing!
            if (bookMatch && bookMatch.trim() !== '') {
              lastBookSeen = bookMatch.trim();
            } else {
              bookMatch = lastBookSeen; 
            }

            const fullVerseRef = `${bookMatch} ${chapMatch}:${verseMatch}`;

            elements.push(
              <Text key={`verse-${i}`} style={{ color: '#30D158', fontFamily: 'Tamil003' }} onPress={() => handleVerseClick(fullVerseRef)}>
                {fullVerseRef}
              </Text>
            );
            i += 3;
          }
          i++;
        }
      } else {
        const boldParts = paragraph.split(/(\*\*.*?\*\*)/g);
        elements = boldParts.map((part, i) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <Text key={i} style={{ fontFamily: 'Tamil003', color: colors.primary }}>{part.replace(/\*\*/g, '')}</Text>;
          }
          return part.replace(/_([^_]+)_/g, '$1'); 
        });
      }

      return (
        <TouchableOpacity key={index} onPress={() => handleParagraphPress(index)} onLongPress={() => toggleHighlight(index)} delayLongPress={500} activeOpacity={0.9}>
          <View style={{ backgroundColor: isHighlighted ? 'rgba(255, 215, 0, 0.15)' : 'transparent', borderRadius: 8, padding: isHighlighted ? 5 : 0, marginBottom: 15 }}>
            <Text style={{ color: colors.text, fontSize: readerFontSize, fontFamily: 'Tamil003', lineHeight: readerFontSize * 1.8 }}>
              {elements}
            </Text>
          </View>
        </TouchableOpacity>
      );
    });
  };

  const renderDayDetail = (weekKey, dayKey) => {
    const weekData = quarterData.lessons[weekKey];
    const insideStory = weekData["inside-story"];
    const isFriday = dayKey === "07";
    const isInsideStory = dayKey === "inside-story";
    
    // If we clicked inside story, render that. Otherwise, render the standard day data.
    const dataToRender = isInsideStory ? insideStory : weekData[dayKey];

    const titleMatch = dataToRender ? dataToRender.match(/title:\s*(.*)/) : null;
    const rawTitle = titleMatch ? titleMatch[1].trim() : (isInsideStory ? "மிஷன் கதை" : "பாடம்");
    
    const dateMatch = dataToRender ? dataToRender.match(/date:\s*(\d{2}\/\d{2}\/\d{4})/) : null;
    const rawDate = dateMatch ? dateMatch[1] : "";

    // Setup Smart Navigation Logic
    const isPrevDisabled = dayKey === "01";
    const isNextDisabled = isInsideStory || (isFriday && !insideStory);

    const handlePrev = () => {
      if (isInsideStory) setSelectedDay("07");
      else setSelectedDay(`0${parseInt(dayKey) - 1}`);
    };

    const handleNext = () => {
      if (isFriday) setSelectedDay("inside-story");
      else setSelectedDay(`0${parseInt(dayKey) + 1}`);
    };

    return (
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        {activeTab !== 0 && (
          <TouchableOpacity onPress={() => setSelectedDay(null)} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color={colors.subtext} />
            <Text style={{ color: colors.subtext, marginLeft: 5, fontFamily: 'Tamil003' }}>பட்டியலுக்கு திரும்பு</Text>
          </TouchableOpacity>
        )}

        <Text style={{ color: '#FFD700', fontSize: readerFontSize + 4, fontFamily: 'Tamil003', marginBottom: 10, textAlign: 'center' }}>
          {isInsideStory ? rawTitle : `பாடம் ${parseInt(dayKey)} : ${rawTitle}`}
        </Text>
        
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, paddingBottom: 10, borderBottomWidth: 1, borderColor: colors.border }}>
          <Text style={{ color: colors.primary, fontFamily: 'Tamil003', fontSize: readerFontSize - 2 }}>{DAY_NAMES[dayKey]}</Text>
          {!!rawDate && <Text style={{ color: '#00F0FF', fontFamily: 'Tamil003', fontSize: readerFontSize - 2 }}>{rawDate}</Text>}
        </View>

        {renderBookText(dataToRender)}

        {/* ONLY append inside story at the bottom if we are on Tab 0 (Today) and it's Friday */}
        {activeTab === 0 && isFriday && insideStory && (
          <View style={[styles.missionStoryBox, { borderColor: colors.border }]}>
             <Text style={{ color: colors.primary, fontSize: readerFontSize + 2, fontFamily: 'Tamil003', marginBottom: 15, textAlign: 'center' }}>
               மிஷன் கதை (Inside Story)
             </Text>
             {renderBookText(insideStory)}
          </View>
        )}

        <View style={styles.navRow}>
          <TouchableOpacity 
            style={[styles.navBtn, { backgroundColor: colors.card, borderColor: colors.border, opacity: isPrevDisabled ? 0.3 : 1 }]} 
            disabled={isPrevDisabled} onPress={handlePrev}
          >
            <Ionicons name="chevron-back" size={20} color={colors.text} />
            <Text style={{ color: colors.text, marginLeft: 5, fontFamily: 'Tamil003' }}>முந்தைய</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.navBtn, { backgroundColor: colors.card, borderColor: colors.border, opacity: isNextDisabled ? 0.3 : 1 }]} 
            disabled={isNextDisabled} onPress={handleNext}
          >
            <Text style={{ color: colors.text, marginRight: 5, fontFamily: 'Tamil003' }}>அடுத்த</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  };

  const renderWeekList = (weekKey) => {
    const weekData = quarterData.lessons[weekKey];
    return (
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        {activeTab === 2 && (
          <TouchableOpacity onPress={() => setSelectedWeek(null)} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color={colors.subtext} />
            <Text style={{ color: colors.subtext, marginLeft: 5, fontFamily: 'Tamil003' }}>காலாண்டுக்கு திரும்பு</Text>
          </TouchableOpacity>
        )}

        <View style={[styles.weekHeaderBox, { backgroundColor: colors.primary + '20' }]}>
          <Text style={{ color: colors.primary, fontSize: appFontSize + 4, fontFamily: 'Tamil003', textAlign: 'center' }}>
            {weekData.info.title}
          </Text>
          <Text style={{ color: colors.text, fontSize: appFontSize + 2, fontFamily: 'Tamil003', marginTop: 5 }}>
            {weekData.info.start_date} - {weekData.info.end_date}
          </Text>
        </View>

        <View style={{ marginTop: 20 }}>
          {/* Dynamically push 'inside-story' into the array if it exists for this week */}
          {["01", "02", "03", "04", "05", "06", "07", ...(weekData["inside-story"] ? ["inside-story"] : [])].map(day => {
            if (!weekData[day]) return null;
            
            const isInsideStory = day === "inside-story";
            const titleMatch = weekData[day].match(/title:\s*(.*)/);
            const rawTitle = titleMatch ? titleMatch[1].trim() : (isInsideStory ? "மிஷன் கதை" : "பாடம்");
            
            // Show 'MS' (Mission Story) inside the circle icon instead of the long 'inside-story' text
            const circleIconText = isInsideStory ? "MS" : day; 
            
            return (
              <TouchableOpacity key={day} activeOpacity={0.75} style={[styles.card, { backgroundColor: colors.card, borderLeftColor: '#BF5AF2' }]} onPress={() => setSelectedDay(day)}>
                <View style={[styles.iconContainer, { backgroundColor: '#BF5AF222' }]}><Text style={{ color: '#BF5AF2', fontFamily: 'Tamil003', fontSize: 16 }}>{circleIconText}</Text></View>
                <View style={styles.textContainer}>
                  <Text style={[styles.cardTitle, { color: colors.text, fontSize: appFontSize + 2, fontFamily: 'Tamil003' }]} numberOfLines={1}>{rawTitle}</Text>
                  <Text style={[styles.cardSub, { color: colors.subtext, fontSize: appFontSize, fontFamily: 'Tamil003' }]}>{DAY_NAMES[day]}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.subtext} />
              </TouchableOpacity>
            );
          })}
        </View>
      </Animated.View>
    );
  };

  const renderQuarterList = () => {
    if (showIntro) {
      return (
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
          <TouchableOpacity onPress={() => setShowIntro(false)} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color={colors.subtext} />
            <Text style={{ color: colors.subtext, marginLeft: 5, fontFamily: 'Tamil003' }}>காலாண்டுக்கு திரும்பு</Text>
          </TouchableOpacity>
          <Text style={{ color: '#FFD700', fontSize: readerFontSize + 4, fontFamily: 'Tamil003', marginBottom: 15, lineHeight: 30, textAlign: 'center' }}>
            அறிமுகம் (Introduction)
          </Text>
          {renderBookText(quarterData.quarter_info.introduction)}
        </Animated.View>
      );
    }

    const sortedWeeks = Object.keys(quarterData.lessons).sort((a, b) => parseInt(a) - parseInt(b));

    return (
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <TouchableOpacity activeOpacity={0.75} style={[styles.card, { backgroundColor: colors.card, borderLeftColor: colors.primary, marginBottom: 25 }]} onPress={() => setShowIntro(true)}>
          <View style={[styles.iconContainer, { backgroundColor: colors.glow }]}><Ionicons name="book" size={20} color={colors.primary} /></View>
          <View style={styles.textContainer}>
            <Text style={[styles.cardTitle, { color: colors.text, fontSize: appFontSize + 2, fontFamily: 'Tamil003' }]}>அறிமுகம்</Text>
            <Text style={[styles.cardSub, { color: colors.subtext, fontSize: appFontSize, fontFamily: 'Tamil003' }]}>Introduction</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.subtext} />
        </TouchableOpacity>

        {sortedWeeks.map(week => {
          const wInfo = quarterData.lessons[week].info;
          return (
            <TouchableOpacity key={week} activeOpacity={0.75} style={[styles.card, { backgroundColor: colors.card, borderLeftColor: '#30D158' }]} onPress={() => setSelectedWeek(week)}>
              <View style={[styles.iconContainer, { backgroundColor: '#30D15822' }]}><Text style={{ color: '#30D158', fontFamily: 'Tamil003', fontSize: 16 }}>{week}</Text></View>
              <View style={styles.textContainer}>
                <Text style={[styles.cardTitle, { color: colors.text, fontSize: appFontSize + 2, fontFamily: 'Tamil003' }]} numberOfLines={1}>{wInfo.title}</Text>
                <Text style={[styles.cardSub, { color: colors.subtext, fontSize: appFontSize, fontFamily: 'Tamil003' }]}>{wInfo.start_date} - {wInfo.end_date}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.subtext} />
            </TouchableOpacity>
          );
        })}
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      
      {/* HEADER: Perfectly Centered */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={{ width: 80, alignItems: 'flex-start' }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 5 }}>
            <Ionicons name="arrow-back" size={26} color={colors.text} />
          </TouchableOpacity>
        </View>
        
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ color: colors.text, fontSize: appFontSize + 2, fontFamily: 'Tamil003' }} numberOfLines={1}>
             {quarterData && !isExpired ? quarterData.quarter_info.info.title : "ஓய்வுநாள் பள்ளி"}
          </Text>
        </View>

        <View style={[styles.headerTools, { width: 80, justifyContent: 'flex-end' }]}>
          <TouchableOpacity onPress={() => fetchData(true)} style={styles.iconBtn}>
            <Ionicons name="sync" size={22} color={isLoading ? colors.subtext : "#00F0FF"} />
          </TouchableOpacity>
          {!isExpired && (
            <TouchableOpacity onPress={() => setShowFontSettings(true)} style={styles.iconBtn}>
              <Text style={{ color: "#00F0FF", fontFamily: 'Tamil003', fontSize: 16 }}>Aa</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* TABS */}
      {!isExpired && (
        <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
          {['இன்று', 'இந்த வாரம்', 'காலாண்டு'].map((tab, index) => (
            <TouchableOpacity key={index} activeOpacity={0.7} style={[styles.tabButton, activeTab === index && { borderBottomColor: colors.primary, borderBottomWidth: 3 }]} onPress={() => handleTabPress(index)}>
              <Text style={{ color: activeTab === index ? colors.primary : colors.subtext, fontFamily: activeTab === index ? 'Tamil003' : 'Tamil003', fontSize: appFontSize - 1 }}>
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* MAIN CONTENT */}
      <ScrollView contentContainerStyle={styles.scrollArea} showsVerticalScrollIndicator={false}>
        {isLoading && !quarterData ? (
          <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
        ) : isExpired ? (
          <View style={styles.center}>
             <Ionicons name="calendar-outline" size={60} color={colors.border} />
             <Text style={{ color: colors.text, marginTop: 20, fontSize: appFontSize, fontFamily: 'Tamil003', textAlign: 'center', lineHeight: 28 }}>
               புதிய காலாண்டு பாடங்கள் இன்னும் பதிவேற்றப்படவில்லை. (New quarter not available yet).{"\n"}
               தற்காலிகமாக மாற்று வழிகளை பயன்படுத்தவும். (Please use other options temporarily).
             </Text>
             <TouchableOpacity onPress={() => fetchData(true)} style={[styles.navBtn, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 30, paddingHorizontal: 20 }]}>
               <Ionicons name="reload" size={20} color={colors.primary} />
               <Text style={{ color: colors.primary, marginLeft: 10, fontFamily: 'Tamil003' }}>Reload / புதுப்பிக்கவும்</Text>
             </TouchableOpacity>
          </View>
        ) : !quarterData ? (
          <View style={styles.center}><Text style={{ color: colors.text, fontFamily: 'Tamil003' }}>தரவுகள் கிடைக்கவில்லை.</Text></View>
        ) : (
          <>
            {activeTab === 0 && selectedDay && renderDayDetail(selectedWeek, selectedDay)}
            {activeTab === 1 && !selectedDay && renderWeekList(selectedWeek)}
            {activeTab === 1 && selectedDay && renderDayDetail(selectedWeek, selectedDay)}
            {activeTab === 2 && !selectedWeek && renderQuarterList()}
            {activeTab === 2 && selectedWeek && !selectedDay && renderWeekList(selectedWeek)}
            {activeTab === 2 && selectedWeek && selectedDay && renderDayDetail(selectedWeek, selectedDay)}
          </>
        )}
      </ScrollView>

      {/* FONT SETTINGS MODAL */}
      <Modal visible={showFontSettings} transparent animationType="fade" onRequestClose={() => setShowFontSettings(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowFontSettings(false)}>
          <TouchableOpacity style={[styles.fontCard, { backgroundColor: isDark ? '#12161E' : '#FFFFFF', borderColor: colors.border }]} activeOpacity={1}>
            <Text style={{ color: colors.text, fontSize: 16, marginBottom: 20, fontFamily: 'Tamil003' }}>எழுத்து அளவு (Font Size)</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%', justifyContent: 'center' }}>
              <Text style={{ color: colors.subtext, fontSize: 14 }}>A</Text>
              <Slider
                style={{ width: 180, height: 40, marginHorizontal: 10 }}
                minimumValue={14} maximumValue={36} step={2}
                value={readerFontSize} onValueChange={setReaderFontSize}
                maximumTrackTintColor={colors.border} thumbTintColor="#00F0FF" minimumTrackTintColor="#00F0FF"
              />
              <Text style={{ color: colors.text, fontSize: 24, fontFamily: 'Tamil003' }}>A</Text>
            </View>
            <Text style={{ color: colors.subtext, fontSize: 12, marginTop: 15, fontFamily: 'Tamil003', textAlign: 'center' }}>Double tap or long press paragraphs to highlight.</Text>
            <TouchableOpacity style={{ marginTop: 25, padding: 10 }} onPress={() => setShowFontSettings(false)}>
              <Text style={{ color: '#00F0FF', fontFamily: 'Tamil003', fontSize: 16 }}>Close</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* VERSE POPUP MODAL (Smooth Animation Wrapper) */}
      <Modal visible={showVersePopup} transparent animationType="slide" onRequestClose={() => setShowVersePopup(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.versePopup, { backgroundColor: isDark ? '#12161E' : '#FFFFFF', borderColor: colors.border }]}>
            
            <View style={[styles.versePopupHeader, { borderBottomColor: colors.border }]}>
              <Text style={{ color: colors.primary, fontSize: 18, fontFamily: 'Tamil003' }}>{popupVerseRef}</Text>
              <TouchableOpacity onPress={() => setShowVersePopup(false)}>
                <Ionicons name="close-circle" size={28} color={colors.subtext} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={{ maxHeight: 250, padding: 20 }}>
              <Animated.View style={{ opacity: fadeAnimVerse }}>
                <Text style={{ color: colors.text, fontSize: readerFontSize, fontFamily: 'Tamil003', lineHeight: readerFontSize * 1.6 }}>
                  {popupVerseText}
                </Text>
              </Animated.View>
            </ScrollView>

            {/* Verse Navigation Footer */}
            <View style={[styles.versePopupFooter, { borderTopColor: colors.border }]}>
              <TouchableOpacity onPress={() => navigateVerse(-1)} style={styles.popupNavBtn}>
                <Ionicons name="arrow-back" size={20} color={colors.primary} />
                <Text style={{ color: colors.primary, fontFamily: 'Tamil003', marginLeft: 5 }}>முந்தைய</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => navigateVerse(1)} style={styles.popupNavBtn}>
                <Text style={{ color: colors.primary, fontFamily: 'Tamil003', marginRight: 5 }}>அடுத்த</Text>
                <Ionicons name="arrow-forward" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 12, borderBottomWidth: 1 },
  headerTools: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: { paddingHorizontal: 8, paddingVertical: 5, justifyContent: 'center', alignItems: 'center' },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1 },
  tabButton: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  scrollArea: { padding: 20, paddingBottom: 60 },
  center: { marginTop: 80, alignItems: 'center' },
  backBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, alignSelf: 'flex-start', padding: 5 },
  
  memoryVerseBox: { padding: 15, borderRadius: 8, borderLeftWidth: 4, marginBottom: 20, marginTop: 10 },
  missionStoryBox: { marginTop: 30, paddingTop: 20, borderTopWidth: 1, borderStyle: 'dashed' },
  weekHeaderBox: { padding: 15, borderRadius: 12, alignItems: 'center', marginBottom: 10 },
  
  card: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, borderLeftWidth: 4, marginBottom: 12, elevation: 2 },
  iconContainer: { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  textContainer: { flex: 1 },
  cardTitle: { marginBottom: 3 },
  
  navRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 40, gap: 10 },
  navBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, borderWidth: 1 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  fontCard: { width: '85%', padding: 25, borderRadius: 24, borderWidth: 1, alignItems: 'center' },
  versePopup: { width: '90%', borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  versePopupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 1 },
  versePopupFooter: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, borderTopWidth: 1 },
  popupNavBtn: { flexDirection: 'row', alignItems: 'center', padding: 5 }
});
