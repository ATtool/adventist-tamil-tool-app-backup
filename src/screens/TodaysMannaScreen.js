import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Share, Modal, BackHandler, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Speech from 'expo-speech';
import * as Clipboard from 'expo-clipboard'; // NEW: The Clipboard Tool!
import DateTimePicker from '@react-native-community/datetimepicker';
import Slider from '@react-native-community/slider';
import { useSettings } from '../context/SettingsContext';

const DEVOTION_URL = 'https://gist.githubusercontent.com/ATtool/e3a8241e07503969cb06448a32eb4382/raw/manna.json';

export default function TodaysMannaScreen() {
  const { colors, appFontSize, isDark } = useSettings();
  const navigation = useNavigation();

  const [todayDevotion, setTodayDevotion] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const [showFontSettings, setShowFontSettings] = useState(false);
  const [readerFontSize, setReaderFontSize] = useState(appFontSize);

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
    Speech.stop();
    setIsPlaying(false);
  }, [selectedDate]);

  useEffect(() => {
    return () => Speech.stop();
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
        const parsedData = JSON.parse(savedData);
        if (parsedData.devotions && parsedData.devotions[dateString]) {
          foundDevotion = parsedData.devotions[dateString];
          setTodayDevotion(foundDevotion);
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
      const response = await fetch(DEVOTION_URL, { headers: { 'Cache-Control': 'no-cache' } });
      if (!response.ok) return null;

      const json = await response.json();
      await AsyncStorage.setItem('@manna_data', JSON.stringify(json));

      if (json.devotions && json.devotions[dateString]) {
        return json.devotions[dateString];
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

  const toggleSpeech = () => {
    if (isPlaying) {
      Speech.stop();
      setIsPlaying(false);
    } else {
      if (todayDevotion) {
        const textToRead = `${todayDevotion.title}. ${todayDevotion.verse}. ${todayDevotion.content}`;
        Speech.speak(textToRead, {
          language: 'ta-IN',
          rate: 0.85, 
          pitch: 1.0, 
          onDone: () => setIsPlaying(false),
          onStopped: () => setIsPlaying(false),
          onError: () => setIsPlaying(false),
        });
        setIsPlaying(true);
      }
    }
  };

  const displayDate = `${selectedDate.getDate()}/${selectedDate.getMonth() + 1}/${selectedDate.getFullYear()}`;

  // This creates the perfect text block we use for BOTH Sharing and Copying
  const getFullDevotionText = () => {
    if (!todayDevotion) return "";
    const textBlocks = [
      `[${displayDate}]`,
      todayDevotion.title,
      todayDevotion.verse,
      todayDevotion.content,
      "🌾 இன்றைய நாள் உங்களுக்கு ஆசிர்வாதமாக இருப்பதாக. 🌟",
      "🌾 தேவனுடைய கற்பனையின்படி நடக்க மறவாதீர்கள் 😇",
      "- Adventist Tamil Tool team\nJoin our WhatsApp channel: https://whatsapp.com/channel/0029Vb6Pu8FLI8YfM5H49e0p"
    ];
    return textBlocks.join('\n\n');
  };

  const copyDevotion = async () => {
    try {
      await Clipboard.setStringAsync(getFullDevotionText());
      Alert.alert("வெற்றிகரமாக நகலெடுக்கப்பட்டது", "You can now paste the devotion anywhere! (WhatsApp, Facebook, etc.)");
    } catch (error) {
      console.log("Error copying:", error);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        
        <TouchableOpacity onPress={() => navigation.navigate('Home')} style={{ padding: 5 }}>
          <Ionicons name="arrow-back" size={26} color={colors.text} />
        </TouchableOpacity>
        
        <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.datePickerBtn}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{displayDate}</Text>
          <Ionicons name="calendar-outline" size={16} color={colors.text} style={{ marginLeft: 6 }} />
        </TouchableOpacity>

        <View style={styles.headerTools}>
          {todayDevotion && (
            <>
              <TouchableOpacity onPress={toggleSpeech} style={styles.iconBtn}>
                <Ionicons name={isPlaying ? "stop-circle" : "volume-high"} size={22} color={isPlaying ? "#FF3B30" : "#00F0FF"} />
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setShowFontSettings(true)} style={styles.iconBtn}>
                <Text style={{ color: "#00F0FF", fontWeight: 'bold', fontSize: 16 }}>Aa</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={copyDevotion} style={styles.iconBtn}>
                <Ionicons name="copy-outline" size={22} color="#00F0FF" />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {showDatePicker && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display="default"
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
                minimumTrackTintColor="#00F0FF"
                maximumTrackTintColor={colors.border}
                thumbTintColor="#00F0FF"
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
          
          <Text style={[styles.title, { color: '#FFD700', fontSize: readerFontSize + 6 }]}>
            {todayDevotion.title}
          </Text>
          
          <View style={[styles.verseBox, { backgroundColor: colors.card, borderColor: 'rgba(0, 240, 255, 0.2)' }]}>
            <Text style={[styles.verseText, { color: '#00F0FF', fontSize: readerFontSize - 2 }]}>
              {todayDevotion.verse}
            </Text>
          </View>

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
  blessingText: { fontFamily: 'Tamil003', textAlign: 'center', lineHeight: 26 }
});
