import MixedText from '../components/MixedText.js';
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Share, Modal, BackHandler } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import Slider from '@react-native-community/slider';
import { useSettings } from '../context/SettingsContext';

const DEVOTION_URL = 'https://gist.githubusercontent.com/ATtool/e3a8241e07503969cb06448a32eb4382/raw/manna.json';

export default function TodaysMannaScreen() {
  const { colors, appFontSize, isDark, typography } = useSettings();
  const navigation = useNavigation();

  const [todayDevotion, setTodayDevotion] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

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
  }, [selectedDate]);

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

  const isToday = (date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const goToNextDay = () => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    const nextDate = new Date(selectedDate);
    nextDate.setDate(nextDate.getDate() + 1);

    if (nextDate <= today) {
      setSelectedDate(nextDate);
    }
  };

  const displayDate = `${selectedDate.getDate()}/${selectedDate.getMonth() + 1}/${selectedDate.getFullYear()}`;

  const getFullDevotionText = () => {
    if (!todayDevotion) return "";
    const textBlocks = [
      "🌻*இன்றைய மன்னா* - From ATT",
      `🗓️ *நாள் :* ${displayDate}`,
      `✨*இன்றைய தலைப்பு*✨ \n${todayDevotion.title}`,
      `✝️*இன்றைய வேதவசனம்*✝️ \n${todayDevotion.verse}`,
      todayDevotion.content,
      "🌾 இன்றைய நாள் உங்களுக்கு ஆசிர்வாதமாக இருப்பதாக. 🌟",
      "🌾 தேவனுடைய கற்பனையின்படி நடக்க மறவாதீர்கள் 😇",
      "✨join our WhatsApp channel:\nhttps://whatsapp.com/channel/0029Vb6Pu8FLI8YfM5H49e0p",
      "📲Download our APP in Play Store : \nhttps://play.google.com/store/apps/details?id=com.adventisttamiltool.adventisttamiltool"
    ];
    return textBlocks.join('\n\n'); 
  };

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
          <MixedText style={[styles.headerTitle, { color: colors.text, fontSize: typography.h1.fontSize }]}>{displayDate}</MixedText>
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
              <TouchableOpacity onPress={() => setShowFontSettings(true)} style={styles.iconBtn}>
                <MixedText style={{ color: "#00F0FF", fontWeight: 'bold', fontSize: typography.body.fontSize }}>Aa</MixedText>
              </TouchableOpacity>

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
          onChange={onChangeDate}
          maximumDate={new Date()}
        />
      )}

      {/* FLOATING FONT SETTINGS POPUP */}
      <Modal visible={showFontSettings} transparent animationType="fade" onRequestClose={() => setShowFontSettings(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowFontSettings(false)}>
          
          <TouchableOpacity style={[styles.fontCard, { backgroundColor: isDark ? '#12161E' : '#FFFFFF', borderColor: colors.border }]} activeOpacity={1}>
            <MixedText style={{ color: colors.text, fontSize: typography.body.fontSize, marginBottom: 20, fontFamily: 'Tamil003' }}>எழுத்து அளவு (Font Size)</MixedText>
            <View style={styles.sliderWrapper}>
              <MixedText style={{ color: colors.subtext, fontSize: typography.subtext.fontSize }}>A</MixedText>
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
              <MixedText style={{ color: colors.text, fontSize: typography.h2.fontSize, fontWeight: 'bold' }}>A</MixedText>
            </View>

            <TouchableOpacity style={{ marginTop: 25, padding: 10 }} onPress={() => setShowFontSettings(false)}>
              <MixedText style={{ color: '#00F0FF', fontWeight: 'bold', fontSize: typography.body.fontSize }}>Close</MixedText>
            </TouchableOpacity>
          </TouchableOpacity>

        </TouchableOpacity>
      </Modal>

      {/* MAIN CONTENT AREA */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#00F0FF" />
          <MixedText style={{ color: colors.subtext, marginTop: 15, fontFamily: 'Tamil003' }}>மன்னா தயாராகிறது...</MixedText>
        </View>
      ) : errorMsg ? (
        <View style={styles.center}>
          <Ionicons name="book-outline" size={60} color={colors.border} />
          <MixedText style={{ color: colors.text, marginTop: 20, fontSize: typography.body.fontSize, fontFamily: 'Tamil003', textAlign: 'center', paddingHorizontal: 30, lineHeight: 28 }}>{errorMsg}</MixedText>

          <TouchableOpacity
            onPress={() => loadDevotion(selectedDate)}
            style={[styles.retryBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#00F0FF" />
            ) : (
              <Ionicons name="reload" size={18} color="#00F0FF" />
            )}
            <MixedText style={{ color: '#00F0FF', marginLeft: 8, fontFamily: 'Tamil003', fontSize: typography.body.fontSize }}>
              மீண்டும் முயற்சிக்க
            </MixedText>
          </TouchableOpacity>

          {/* Added Navigation Buttons for when no devotion is found (e.g. Future Days) */}
          <View style={[styles.navButtonsContainer, { width: '100%', paddingHorizontal: 30, marginTop: 50 }]}>
            <TouchableOpacity  
              onPress={goToPreviousDay}
              style={[styles.dayNavBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <Ionicons name="chevron-back" size={20} color={colors.text} />
              <MixedText style={{ color: colors.text, marginLeft: 5, fontFamily: 'Tamil003', fontSize: typography.body.fontSize }}>முந்தைய நாள்</MixedText>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.dayNavBtn, { backgroundColor: colors.card, borderColor: colors.border, opacity: isToday(selectedDate) ? 0.4 : 1 }]} 
              onPress={goToNextDay}
              disabled={isToday(selectedDate)}
            >
              <MixedText style={{ color: isToday(selectedDate) ? colors.subtext : colors.text, marginRight: 5, fontFamily: 'Tamil003', fontSize: typography.body.fontSize }}>அடுத்த நாள்</MixedText>
              <Ionicons name="chevron-forward" size={20} color={isToday(selectedDate) ? colors.subtext : colors.text} />
            </TouchableOpacity>
          </View>

        </View>
      ) : todayDevotion ? (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          
          <MixedText style={[styles.title, { color: '#FFD700', fontSize: readerFontSize + 12 }]}>
            {todayDevotion.title}
          </MixedText>
          
          <View style={[styles.verseBox, { backgroundColor: colors.card, borderColor: 'rgba(0, 240, 255, 0.2)' }]}>
            <MixedText style={[styles.verseText, { color: '#00F0FF', fontSize: readerFontSize + 6 }]}>
              {todayDevotion.verse}
            </MixedText>          
          </View>

          <MixedText style={[styles.bodyText, { color: colors.text, fontSize: readerFontSize + 4, lineHeight: (readerFontSize + 3) * 1.8 }]}>
            {todayDevotion.content}
          </MixedText>

          <View style={[styles.blessingBox, { borderColor: colors.border }]}>
            <MixedText style={[styles.blessingText, { color: colors.subtext, fontSize: readerFontSize - 4 }]}>
              🌾 இன்றைய நாள் உங்களுக்கு ஆசிர்வாதமாக இருப்பதாக. 🌟
            </MixedText>
            <MixedText style={[styles.blessingText, { color: colors.subtext, fontSize: readerFontSize - 4, marginTop: 10 }]}>
              🌾 தேவனுடைய கற்பனையின்படி நடக்க மறவாதீர்கள் 😇
            </MixedText>
          </View>

          <View style={styles.navButtonsContainer}>
            <TouchableOpacity  
              onPress={goToPreviousDay}
              style={[styles.dayNavBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <Ionicons name="chevron-back" size={20} color={colors.text} />
              <MixedText style={{ color: colors.text, marginLeft: 5, fontFamily: 'Tamil003', fontSize: typography.body.fontSize }}>முந்தைய நாள்</MixedText>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.dayNavBtn, { backgroundColor: colors.card, borderColor: colors.border, opacity: isToday(selectedDate) ? 0.4 : 1 }]} 
              onPress={goToNextDay}
              disabled={isToday(selectedDate)}
            >
              <MixedText style={{ color: isToday(selectedDate) ? colors.subtext : colors.text, marginRight: 5, fontFamily: 'Tamil003', fontSize: typography.body.fontSize }}>அடுத்த நாள்</MixedText>
              <Ionicons name="chevron-forward" size={20} color={isToday(selectedDate) ? colors.subtext : colors.text} />
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
  retryBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 25, paddingVertical: 12, paddingHorizontal: 22, borderRadius: 25, borderWidth: 1 },
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
