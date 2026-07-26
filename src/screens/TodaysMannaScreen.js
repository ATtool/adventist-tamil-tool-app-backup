import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Share, Modal, BackHandler, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
// You can leave expo-clipboard imported if you use it later, or remove it.
import * as Clipboard from 'expo-clipboard'; 
import DateTimePicker from '@react-native-community/datetimepicker';
import Slider from '@react-native-community/slider';
import { useSettings } from '../context/SettingsContext';

const DEVOTION_URL = 'https://gist.githubusercontent.com/ATtool/e3a8241e07503969cb06448a32eb4382/raw/manna.json';

// --- FREE GOOGLE TRANSLATE TEXT-TO-SPEECH (no API key, no billing, no card needed) ---
// This uses the same voice you hear when you tap the speaker icon on translate.google.com.
// It's not the premium WaveNet voice, but it's a real natural voice, completely free forever.
const TTS_LANGUAGE_CODE = 'ta'; // Tamil
// Google Translate's TTS endpoint truncates long text, so we keep chunks short and safe.
const TTS_MAX_CHUNK_CHARS = 180;
// Playback speed for the devotion audio. 1.0 = normal, 0.5 = half speed.
const SPEECH_PLAYBACK_RATE = 1.2;

function buildTranslateTtsUrl(text) {
  return `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${TTS_LANGUAGE_CODE}&client=tw-ob`;
}

// Splits long text into speech-friendly chunks without cutting sentences in half.
function splitTextForSpeech(text, maxChars = TTS_MAX_CHUNK_CHARS) {
  const sentences = text.split(/(?<=[.!?।])\s+/).filter(Boolean);
  const chunks = [];
  let current = '';

  for (const sentence of sentences) {
    if ((current + ' ' + sentence).trim().length > maxChars) {
      if (current) chunks.push(current.trim());
      // A single sentence longer than maxChars: hard-split it.
      if (sentence.length > maxChars) {
        for (let i = 0; i < sentence.length; i += maxChars) {
          chunks.push(sentence.slice(i, i + maxChars));
        }
        current = '';
      } else {
        current = sentence;
      }
    } else {
      current = (current + ' ' + sentence).trim();
    }
  }
  if (current) chunks.push(current.trim());
  return chunks;
}

// Downloads one chunk of speech audio from Google Translate TTS and returns a local file URI.
async function synthesizeChunkToFile(text, index) {
  const url = buildTranslateTtsUrl(text);
  const fileUri = `${FileSystem.cacheDirectory}manna_tts_${index}_${Date.now()}.mp3`;

  const downloadResult = await FileSystem.downloadAsync(url, fileUri, {
    headers: {
      // Some free/unofficial endpoints reject requests with no browser-like User-Agent.
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
    },
  });

  if (downloadResult.status !== 200) {
    throw new Error(`Translate TTS request failed (status ${downloadResult.status})`);
  }
  return fileUri;
}

export default function TodaysMannaScreen() {
  const { colors, appFontSize, isDark } = useSettings();
  const navigation = useNavigation();

  const [todayDevotion, setTodayDevotion] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSpeechLoading, setIsSpeechLoading] = useState(false);
  // Refs so async playback logic always sees the latest state without stale closures.
  const [showFontSettings, setShowFontSettings] = useState(false);
  const [readerFontSize, setReaderFontSize] = useState(appFontSize);


  const soundRef = React.useRef(null);
  const stopRequestedRef = React.useRef(false);

  const unloadSound = async () => {
    if (soundRef.current) {
      try {
        soundRef.current.release();
      } catch (e) {
        // ignore
      }
      soundRef.current = null;
    }
  };

  const stopSpeech = async () => {
    stopRequestedRef.current = true;
    await unloadSound();
    setIsPlaying(false);
    setIsSpeechLoading(false);
  };

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      allowsRecording: false,
    });
  }, []);

  useEffect(() => {
    const backAction = () => {
      if (showFontSettings) {
        setShowFontSettings(false);
        return true; 
      }
      navigation.navigate('Home');
      return true; 
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove(); 
  }, [showFontSettings, navigation]);

  useEffect(() => {
    loadDevotion(selectedDate);
    stopSpeech();
  }, [selectedDate]);

  useEffect(() => {
    return () => { stopSpeech(); };
  }, []);

  const loadDevotion = async (dateObj) => {
    setIsLoading(true);
    setErrorMsg('');
    setTodayDevotion(null); 

    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;

    let foundDevotion = null;

    try {
      const savedData = await AsyncStorage.getItem('@manna_data');
      if (savedData) {
        try {
          const parsedData = JSON.parse(savedData);
          if (parsedData.devotions && parsedData.devotions[dateString]) {
            foundDevotion = parsedData.devotions[dateString];
            setTodayDevotion(foundDevotion);
          }
        } catch (error) {
          console.warn("Corrupt local manna data found and cleared.");
          await AsyncStorage.removeItem('@manna_data');
        }
      }

      const freshDevotion = await fetchFreshData(dateString);
      if (freshDevotion) {
        foundDevotion = freshDevotion;
        setTodayDevotion(foundDevotion);
      }
    } catch (error) {
      console.log("Error loading devotion:", error);
    } finally {
      if (!foundDevotion) {
        setErrorMsg(`இன்றைய மன்னா (${displayDate}) இன்னும் தயாராகவில்லை. பின்னர் முயற்சிக்கவும்!`);
      }
      setIsLoading(false);
    }
  };

  const fetchFreshData = async (dateString) => {
    try {
      // We add a timestamp to the URL so the phone NEVER uses a cached/old version!
      const cacheBusterUrl = `${DEVOTION_URL}?t=${new Date().getTime()}`;
      const response = await fetch(cacheBusterUrl, { headers: { 'Cache-Control': 'no-cache' } });
      if (!response.ok) return null;

      try {
        const rawText = await response.text();
        const json = JSON.parse(rawText.replace(/^\uFEFF/, '').trim());
        await AsyncStorage.setItem('@manna_data', JSON.stringify(json));

        if (json.devotions && json.devotions[dateString]) {
          return json.devotions[dateString];
        }
      } catch (error) {
        console.warn("API returned invalid JSON. Waiting for the dev to fix the typo on GitHub.");
        return null;
      }
    } catch (error) {
      return null;
    }
    return null;
  };

  const onChangeDate = (event, date) => {
    setShowDatePicker(false);
    if (date) setSelectedDate(date);
  };

  const goToPreviousDay = () => {
    const prevDate = new Date(selectedDate);
    prevDate.setDate(prevDate.getDate() - 1);
    setSelectedDate(prevDate);
  };

  const goToNextDay = () => {
    const nextDate = new Date(selectedDate);
    nextDate.setDate(nextDate.getDate() + 1);
    setSelectedDate(nextDate);
  };

  const isToday = () => {
    const today = new Date();
    return (
      selectedDate.getDate() === today.getDate() &&
      selectedDate.getMonth() === today.getMonth() &&
      selectedDate.getFullYear() === today.getFullYear()
    );
  };

  const playChunksSequentially = async (fileUris) => {
    for (let i = 0; i < fileUris.length; i++) {
  // Plays an array of local mp3 file URIs back-to-back.
      if (stopRequestedRef.current) break;

      soundRef.current = player;
      player.setPlaybackRate(SPEECH_PLAYBACK_RATE, 'high');

      const player = createAudioPlayer({ uri: fileUris[i] });
      await new Promise((resolve) => {
        const subscription = player.addListener('playbackStatusUpdate', (status) => {
          if (status.didJustFinish || stopRequestedRef.current) {
            subscription.remove();
            resolve();
          }
        });
        player.play();
      });

      player.release();
      soundRef.current = null;
    }
  };

  const toggleSpeech = async () => {
    if (isPlaying || isSpeechLoading) {
      await stopSpeech();
      return;
    }

    if (!todayDevotion) return;

    stopRequestedRef.current = false;
    setIsSpeechLoading(true);

    try {
      const textToRead = `${todayDevotion.title}. ${todayDevotion.verse}. ${todayDevotion.content}`;
      const chunks = splitTextForSpeech(textToRead);

      // Synthesize the first chunk before starting playback so audio starts promptly,
      // then synthesize the rest while the first chunk plays.
      const firstFile = await synthesizeChunkToFile(chunks[0], 0);
      if (stopRequestedRef.current) return;

      setIsSpeechLoading(false);
      setIsPlaying(true);

      const remainingFilesPromise = Promise.all(
        chunks.slice(1).map((chunk, idx) => synthesizeChunkToFile(chunk, idx + 1))
      );

      await playChunksSequentially([firstFile]);
      if (stopRequestedRef.current) return;

      const remainingFiles = await remainingFilesPromise;
      if (stopRequestedRef.current) return;

      await playChunksSequentially(remainingFiles);
    } catch (error) {
      console.log('TTS error:', error);
      Alert.alert('Audio error', 'Could not play audio for this devotion. Please try again.');
    } finally {
      setIsPlaying(false);
      setIsSpeechLoading(false);
    }
  };

  const displayDate = `${selectedDate.getDate()}/${selectedDate.getMonth() + 1}/${selectedDate.getFullYear()}`;

  // --- CHANGED: Formatting the specific text for sharing ---
  const getFullDevotionText = () => {
    if (!todayDevotion) return "";
    const textBlocks = [
      "🌻*இன்றைய மன்னா* - From ATT", // App name only in Tamil
      `🗓️ *நாள் :* ${displayDate}`,
      `✨*இன்றைய தலைப்பு*✨ \n${todayDevotion.title}`,
      `✝️*இன்றைய வேதவசனம்*✝️ \n${todayDevotion.verse}`,
      todayDevotion.content,
      "🌾 இன்றைய நாள் உங்களுக்கு ஆசிர்வாதமாக இருப்பதாக. 🌟",
      "🌾 தேவனுடைய கற்பனையின்படி நடக்க மறவாதீர்கள் 😇",
      "✨join our WhatsApp channel:\nhttps://whatsapp.com/channel/0029Vb6Pu8FLI8YfM5H49e0p"
    ];
    return textBlocks.join('\n\n'); // Joins everything together with neat line breaks
  };

  // --- CHANGED: Using React Native's Share API instead of Clipboard ---
  const shareDevotion = async () => {
    try {
      await Share.share({
        message: getFullDevotionText(),
      });
    } catch (error) {
      console.log("Error sharing:", error);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 5 }}>
          <Ionicons name="arrow-back" size={26} color={colors.text} />
        </TouchableOpacity>
        
        <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.datePickerBtn}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{displayDate}</Text>
          <Ionicons name="calendar-outline" size={16} color={colors.text} style={{ marginLeft: 6 }} />
        </TouchableOpacity>

        <View style={styles.headerTools}>

          <TouchableOpacity 
            onPress={() => loadDevotion(selectedDate)} 
            style={styles.iconBtn}
            disabled={isLoading}
          >
            <Ionicons name="sync" size={22} color={isLoading ? colors.subtext : "#00F0FF"} />
          </TouchableOpacity>

          {todayDevotion && (
            <>
              <TouchableOpacity onPress={toggleSpeech} style={styles.iconBtn} disabled={isSpeechLoading && !isPlaying}>
                {isSpeechLoading ? (
                  <ActivityIndicator size="small" color="#00F0FF" />
                ) : (
                  <Ionicons name={isPlaying ? "stop-circle" : "volume-high"} size={22} color={isPlaying ? "#FF3B30" : "#00F0FF"} />
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setShowFontSettings(true)} style={styles.iconBtn}>
                <Text style={{ color: "#00F0FF", fontWeight: 'bold', fontSize: 16 }}>Aa</Text>
              </TouchableOpacity>

              {/* CHANGED: Replaced the copy icon with a share icon and connected the new function */}
              <TouchableOpacity onPress={shareDevotion} style={styles.iconBtn}>
                <Ionicons name="share-social-outline" size={22} color="#00F0FF" />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {showDatePicker && (
        <DateTimePicker
          value={selectedDate}
          maximumDate={new Date()} 
          onChange={onChangeDate}
        />
      )}

      {/* FLOATING FONT SETTINGS POPUP */}
      <Modal visible={showFontSettings} transparent animationType="fade" onRequestClose={() => setShowFontSettings(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowFontSettings(false)}>
          
          <TouchableOpacity style={[styles.fontCard, { backgroundColor: isDark ? '#12161E' : '#FFFFFF', borderColor: colors.border }]} activeOpacity={1}>
            <Text style={{ color: colors.text, fontSize: 16, marginBottom: 20, fontFamily: 'Tamil003' }}>எழுத்து அளவு (Font Size)</Text>
            <View style={styles.sliderWrapper}>
              <Text style={{ color: colors.subtext, fontSize: 14 }}>A</Text>
              <Slider
                style={{ width: 180, height: 40, marginHorizontal: 10 }}
                minimumValue={14}
                maximumValue={36}
                step={2}
                value={readerFontSize}
                onValueChange={setReaderFontSize}
                maximumTrackTintColor={colors.border}
                thumbTintColor="#00F0FF"
            
                minimumTrackTintColor="#00F0FF"
              />
              <Text style={{ color: colors.text, fontSize: 24, fontWeight: 'bold' }}>A</Text>
            </View>

            <TouchableOpacity style={{ marginTop: 25, padding: 10 }} onPress={() => setShowFontSettings(false)}>
              <Text style={{ color: '#00F0FF', fontWeight: 'bold', fontSize: 16 }}>Close</Text>
            </TouchableOpacity>
          </TouchableOpacity>

        </TouchableOpacity>
      </Modal>

      {/* MAIN CONTENT AREA */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#00F0FF" />
          <Text style={{ color: colors.subtext, marginTop: 15, fontFamily: 'Tamil003' }}>மன்னா தயாராகிறது...</Text>
        </View>
      ) : errorMsg ? (
        <View style={styles.center}>
          <Ionicons name="book-outline" size={60} color={colors.border} />
          <Text style={{ color: colors.text, marginTop: 20, fontSize: appFontSize, fontFamily: 'Tamil003', textAlign: 'center', paddingHorizontal: 30, lineHeight: 28 }}>{errorMsg}</Text>
        </View>
      ) : todayDevotion ? (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          
          {/* Title is now readerFontSize + 5 (16 + 5 = 21) */}
          <Text style={[styles.title, { color: '#FFD700', fontSize: readerFontSize + 7 }]}>
            {todayDevotion.title}
          </Text>
          
          <View style={[styles.verseBox, { backgroundColor: colors.card, borderColor: 'rgba(0, 240, 255, 0.2)' }]}>
            {/* Verse is now readerFontSize + 2 (16 + 2 = 18) */}
            <Text style={[styles.verseText, { color: '#00F0FF', fontSize: readerFontSize + 2 }]}>
              {todayDevotion.verse}
            </Text>          
          {/* ALWAYS show the sync button so users can manually refresh the Gist */}
          mode="date"
          display="default"
          {/* Content is now readerFontSize (16) */}
          <Text style={[styles.bodyText, { color: colors.text, fontSize: readerFontSize, lineHeight: readerFontSize * 1.8 }]}>
            {todayDevotion.content}
          </Text>

          <View style={[styles.blessingBox, { borderColor: colors.border }]}>
            <Text style={[styles.blessingText, { color: colors.subtext, fontSize: readerFontSize - 4 }]}>
              🌾 இன்றைய நாள் உங்களுக்கு ஆசிர்வாதமாக இருப்பதாக. 🌟
            </Text>
            <Text style={[styles.blessingText, { color: colors.subtext, fontSize: readerFontSize - 4, marginTop: 10 }]}>
              🌾 தேவனுடைய கற்பனையின்படி நடக்க மறவாதீர்கள் 😇
            </Text>
          </View>

          <View style={styles.navButtonsContainer}>
            <TouchableOpacity  
              onPress={goToPreviousDay}
              style={[styles.dayNavBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <Ionicons name="chevron-back" size={20} color={colors.text} />
              <Text style={{ color: colors.text, marginLeft: 5, fontFamily: 'Tamil003', fontSize: 14 }}>முந்தைய நாள்</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.dayNavBtn, { backgroundColor: colors.card, borderColor: colors.border, opacity: isToday() ? 0.3 : 1 }]} 
              onPress={goToNextDay}
              disabled={isToday()}
            >
              <Text style={{ color: colors.text, marginRight: 5, fontFamily: 'Tamil003', fontSize: 14 }}>அடுத்த நாள்</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 12, borderBottomWidth: 1 },
  headerTitle: { fontSize: 16, fontWeight: 'bold' },
  datePickerBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  headerTools: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: { paddingHorizontal: 8, paddingVertical: 5, justifyContent: 'center', alignItems: 'center' },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  fontCard: { width: '85%', padding: 25, borderRadius: 24, borderWidth: 1, alignItems: 'center', elevation: 10, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 10 },
  sliderWrapper: { flexDirection: 'row', alignItems: 'center', width: '100%', justifyContent: 'center' },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 25, paddingBottom: 80 },
  
  title: { fontFamily: 'Tamil003', marginBottom: 25, textAlign: 'center', lineHeight: 36 },
  verseBox: { padding: 20, borderRadius: 16, borderWidth: 1, marginBottom: 30 },
  verseText: { fontFamily: 'Tamil003', textAlign: 'center', lineHeight: 28 },
  bodyText: { fontFamily: 'Tamil003', textAlign: 'justify' }, 
  
  blessingBox: { marginTop: 50, padding: 20, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center' },
  blessingText: { fontFamily: 'Tamil003', textAlign: 'center', lineHeight: 26 },
  
  navButtonsContainer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 40, paddingHorizontal: 5 },
  dayNavBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 15, borderRadius: 12, borderWidth: 1 }
});
