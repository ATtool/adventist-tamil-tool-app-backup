import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Linking, Share, Modal, BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { WebView } from 'react-native-webview';
import DateTimePicker from '@react-native-community/datetimepicker';
import Slider from '@react-native-community/slider';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSettings } from '../context/SettingsContext';
import { saveSabbathLesson, getSabbathLessonByDate } from '../utils/UserDataDB';

// ─────────────────────────────────────────────────────────────────────────────
// YOUR GIST FALLBACK — paste your Sabbath School JSON here weekly
// Format: { "lessons": { "YYYY-MM-DD": { "title": "...", "content": "<p>...</p>" } } }
// ─────────────────────────────────────────────────────────────────────────────
const GIST_URL = 'https://gist.githubusercontent.com/ATtool/YOUR_GIST_ID/raw/sabbath.json';
const CACHE_KEY = '@sabbath_gist_data';

// ─── URL HELPER ──────────────────────────────────────────────────────────────
// THE ROOT CAUSE FIX:
// Adventech API URL needs: /api/v1/ta/2026/03/index.json
// But currentQuarter.index gives: "ta-2026-03"
// We must split on "-" to convert: "ta-2026-03" → "ta/2026/03"
const indexToPath = (index) => index.split('-').join('/');

// ─── DATE HELPERS ─────────────────────────────────────────────────────────────
const toYMD = (dateObj) => {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const parseYMD = (str) => {
  if (!str) return 0;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split('-');
    return new Date(Number(y), Number(m) - 1, Number(d)).getTime();
  }
  return new Date(str).getTime();
};

const displayDate = (dateObj) =>
  `${dateObj.getDate()}/${dateObj.getMonth() + 1}/${dateObj.getFullYear()}`;

// ─── SAFE FETCH ───────────────────────────────────────────────────────────────
const safeFetch = async (url) => {
  const res = await fetch(url);
  const text = await res.text();
  if (text.trim().startsWith('<')) throw new Error('HTML_RESPONSE');
  return JSON.parse(text);
};

// ─── EXTRACT CONTENT ─────────────────────────────────────────────────────────
const extractContent = (data) => {
  if (!data) return '';
  if (Array.isArray(data)) return data[0]?.content || '';
  if (typeof data.content === 'string') return data.content;
  if (Array.isArray(data.content)) return data.content.map(b => b.text || b.content || '').join('\n');
  return '';
};

// ─── COMPONENT ───────────────────────────────────────────────────────────────
export default function SabbathSchoolReaderScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors, appFontSize, isDark } = useSettings();

  // If opened from ListScreen for a specific week
  const { lessonIndex: passedLessonIndex } = route.params || {};

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showFontSettings, setShowFontSettings] = useState(false);
  const [readerFontSize, setReaderFontSize] = useState(appFontSize + 4);

  const [lessonTitle, setLessonTitle] = useState('ஓய்வுநாள் பாடம்');
  const [lessonContent, setLessonContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isFromCache, setIsFromCache] = useState(false);

  // Store all days of current week so prev/next can jump between them
  const allDaysRef = useRef([]);
  const currentDayIndexRef = useRef(0);

  // ── BACK HANDLER ────────────────────────────────────────────────────────────
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (showFontSettings) { setShowFontSettings(false); return true; }
      return false;
    });
    return () => sub.remove();
  }, [showFontSettings]);

  // ── LOAD ON DATE CHANGE ──────────────────────────────────────────────────────
  useEffect(() => {
    loadLesson(selectedDate);
  }, [selectedDate]);

  // ─────────────────────────────────────────────────────────────────────────────
  const loadLesson = useCallback(async (dateObj) => {
    setIsLoading(true);
    setError(null);
    setIsFromCache(false);

    const dateStr = toYMD(dateObj); // YYYY-MM-DD

    try {
      // ── 1. SQLite offline cache ───────────────────────────────────────────
      const cached = getSabbathLessonByDate(dateStr);
      if (cached?.content) {
        setLessonTitle(cached.title || 'ஓய்வுநாள் பாடம்');
        setLessonContent(cached.content);
        setIsFromCache(true);
        setIsLoading(false);
        // Still try to refresh in background silently
        fetchFromAPI(dateStr, dateObj).catch(() => {});
        return;
      }

      // ── 2. Try Adventech API ──────────────────────────────────────────────
      const apiSuccess = await fetchFromAPI(dateStr, dateObj);
      if (apiSuccess) return;

      // ── 3. Try your Gist fallback ─────────────────────────────────────────
      const gistSuccess = await fetchFromGist(dateStr);
      if (gistSuccess) return;

      setError('no_content');

    } catch (err) {
      console.warn('[Sabbath] loadLesson error:', err.message);
      setError('network');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  const fetchFromAPI = async (dateStr, dateObj) => {
    try {
      // Step A: Get quarter list
      let quartersData;
      try {
        quartersData = await safeFetch('https://sabbath-school.adventech.io/api/v1/ta/quarterlies/index.json');
      } catch {
        quartersData = await safeFetch('https://sabbath-school.adventech.io/api/v1/en/quarterlies/index.json');
      }

      if (!Array.isArray(quartersData) || !quartersData.length) return false;
      const quarter = quartersData[0];

      // ROOT CAUSE FIX: convert "ta-2026-03" → "ta/2026/03" for the URL
      const quarterPath = indexToPath(quarter.index);

      // Step B: Get lessons list
      const lessonsData = await safeFetch(
        `https://sabbath-school.adventech.io/api/v1/${quarterPath}/index.json`
      );
      const lessons = lessonsData.lessons || [];
      if (!lessons.length) return false;

      // Step C: Find the right week
      const dateTime = parseYMD(dateStr);
      let targetLesson = lessons[0];

      if (passedLessonIndex) {
        // If called from ListScreen, use the passed lesson index
        targetLesson = lessons.find(l => l.index === passedLessonIndex) || lessons[0];
      } else {
        for (const lesson of lessons) {
          const s = parseYMD(lesson.start_date);
          const e = parseYMD(lesson.end_date);
          if (dateTime >= s && dateTime <= e) { targetLesson = lesson; break; }
        }
      }

      const lessonPath = indexToPath(targetLesson.index);

      // Step D: Get days of that week
      const daysData = await safeFetch(
        `https://sabbath-school.adventech.io/api/v1/${lessonPath}/index.json`
      );
      const days = daysData.days || [];
      if (!days.length) return false;

      // Store all days for prev/next navigation
      allDaysRef.current = days;

      // Step E: Find today's day
      let targetDay = days[0];
      let dayIdx = 0;
      for (let i = 0; i < days.length; i++) {
        if (days[i].date === dateStr) { targetDay = days[i]; dayIdx = i; break; }
      }
      currentDayIndexRef.current = dayIdx;

      const dayPath = indexToPath(targetDay.index);

      // Step F: Get reading content
      const readData = await safeFetch(
        `https://sabbath-school.adventech.io/api/v1/${dayPath}/read/index.json`
      );
      const content = extractContent(readData);
      if (!content) return false;

      setLessonTitle(targetDay.title || 'ஓய்வுநாள் பாடம்');
      setLessonContent(content);
      setIsFromCache(false);
      setIsLoading(false);

      // Save to SQLite for offline
      saveSabbathLesson(
        quarter.index, targetLesson.index, targetDay.index,
        targetDay.title, targetDay.date || dateStr, content
      );

      return true;
    } catch (err) {
      console.warn('[Sabbath] API failed:', err.message);
      return false;
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  const fetchFromGist = async (dateStr) => {
    try {
      // Try cached Gist first
      let gistData = null;
      const savedGist = await AsyncStorage.getItem(CACHE_KEY);
      if (savedGist) {
        try { gistData = JSON.parse(savedGist); } catch {}
      }

      // Fetch fresh from GitHub
      const fresh = await fetch(`${GIST_URL}?t=${Date.now()}`);
      if (fresh.ok) {
        const text = await fresh.text();
        try {
          gistData = JSON.parse(text);
          await AsyncStorage.setItem(CACHE_KEY, text);
        } catch {}
      }

      if (!gistData?.lessons?.[dateStr]) return false;

      const lesson = gistData.lessons[dateStr];
      setLessonTitle(lesson.title || 'ஓய்வுநாள் பாடம்');
      setLessonContent(lesson.content || '');
      setIsFromCache(false);
      setIsLoading(false);
      return true;
    } catch {
      return false;
    }
  };

  // ─── NAVIGATION ───────────────────────────────────────────────────────────
  const goToPrevDay = () => {
    const prev = new Date(selectedDate);
    prev.setDate(prev.getDate() - 1);
    setSelectedDate(prev);
  };

  const goToNextDay = () => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + 1);
    setSelectedDate(next);
  };

  // ─── SHARE ────────────────────────────────────────────────────────────────
  const shareLesson = async () => {
    const plain = lessonContent.replace(/<[^>]*>/g, '').trim();
    try {
      await Share.share({
        message: `📖 ஓய்வுநாள் பாடம் - ${displayDate(selectedDate)}\n\n${lessonTitle}\n\n${plain}\n\n📲 Adventist Tamil Tool App`,
      });
    } catch {}
  };

  // ─── HTML DOCUMENT ────────────────────────────────────────────────────────
  const getHtml = () => `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
<style>
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  html, body {
    margin: 0; padding: 0;
    background-color: ${colors.background};
    color: ${colors.text};
    font-family: -apple-system, 'Noto Sans Tamil', Roboto, sans-serif;
    font-size: ${readerFontSize}px;
    line-height: 1.8;
  }
  body { padding: 16px 16px 48px; }
  h1,h2 { color: ${colors.primary}; font-size: ${readerFontSize + 4}px; margin: 24px 0 10px; line-height: 1.3; }
  h3,h4 { color: ${colors.primary}; font-size: ${readerFontSize + 1}px; margin: 18px 0 8px; }
  p { margin: 0 0 14px; }
  blockquote {
    border-left: 3px solid ${colors.primary};
    margin: 18px 0; padding: 10px 14px;
    background: ${colors.card};
    border-radius: 0 8px 8px 0;
    font-style: italic; color: ${colors.subtext};
  }
  .ss-memory-verse, .memory-verse {
    background: ${colors.card};
    border-left: 4px solid ${colors.primary};
    border-radius: 0 10px 10px 0;
    padding: 14px 16px; margin: 18px 0;
    font-style: italic;
  }
  img { max-width: 100%; height: auto; border-radius: 8px; }
  strong { font-weight: 700; }
  hr { border: none; border-top: 1px solid rgba(255,255,255,0.08); margin: 20px 0; }
  table { width: 100%; overflow-x: auto; display: block; }
</style>
</head>
<body>${lessonContent}</body>
</html>`;

  // ─── RENDER ───────────────────────────────────────────────────────────────
  const hasContent = !!lessonContent;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>

      {/* ── HEADER ── */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>

        {/* Date picker button — like Manna */}
        <TouchableOpacity style={[styles.datePill, { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: colors.border }]} onPress={() => setShowDatePicker(true)}>
          <Text style={[styles.dateText, { color: colors.text }]}>{displayDate(selectedDate)}</Text>
          <Ionicons name="calendar-outline" size={14} color={colors.subtext} style={{ marginLeft: 6 }} />
        </TouchableOpacity>

        <View style={styles.headerTools}>
          <TouchableOpacity onPress={() => loadLesson(selectedDate)} style={styles.iconBtn} disabled={isLoading}>
            <Ionicons name="sync" size={21} color={isLoading ? colors.subtext : colors.primary} />
          </TouchableOpacity>
          {hasContent && (
            <>
              <TouchableOpacity onPress={() => setShowFontSettings(true)} style={styles.iconBtn}>
                <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: 15 }}>Aa</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={shareLesson} style={styles.iconBtn}>
                <Ionicons name="share-social-outline" size={21} color={colors.primary} />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {/* ── DATE PICKER ── */}
      {showDatePicker && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          onChange={(e, date) => { setShowDatePicker(false); if (date) setSelectedDate(date); }}
        />
      )}

      {/* ── FONT SETTINGS MODAL ── */}
      <Modal visible={showFontSettings} transparent animationType="fade" onRequestClose={() => setShowFontSettings(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowFontSettings(false)}>
          <TouchableOpacity style={[styles.fontCard, { backgroundColor: '#12161E', borderColor: colors.border }]} activeOpacity={1}>
            <Text style={{ color: colors.text, fontSize: 16, marginBottom: 20, fontFamily: 'Tamil003' }}>எழுத்து அளவு</Text>
            <View style={styles.sliderRow}>
              <Text style={{ color: colors.subtext, fontSize: 14 }}>A</Text>
              <Slider
                style={{ flex: 1, marginHorizontal: 12 }}
                minimumValue={14}
                maximumValue={36}
                step={2}
                value={readerFontSize}
                onValueChange={setReaderFontSize}
                minimumTrackTintColor={colors.primary}
                thumbTintColor={colors.primary}
                maximumTrackTintColor={colors.border}
              />
              <Text style={{ color: colors.text, fontSize: 24, fontWeight: 'bold' }}>A</Text>
            </View>
            <TouchableOpacity style={{ marginTop: 22, padding: 10 }} onPress={() => setShowFontSettings(false)}>
              <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: 16 }}>Done</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── LESSON TITLE STRIP ── */}
      {hasContent && !isLoading && (
        <View style={[styles.titleStrip, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <Text style={[styles.lessonTitleText, { color: colors.text, fontSize: appFontSize + 1, fontFamily: 'Tamil003' }]} numberOfLines={2}>
            {lessonTitle}
          </Text>
          {isFromCache && (
            <View style={[styles.cachePill, { borderColor: colors.border }]}>
              <Text style={{ color: colors.subtext, fontSize: 9 }}>CACHED</Text>
            </View>
          )}
        </View>
      )}

      {/* ── CONTENT ── */}
      <View style={styles.content}>
        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={{ color: colors.subtext, marginTop: 16, fontFamily: 'Tamil003', fontSize: 15 }}>பாடத்தை ஏற்றுகிறது...</Text>
          </View>

        ) : error ? (
          <View style={styles.center}>
            <Ionicons name="cloud-offline-outline" size={54} color={colors.subtext} />
            <Text style={{ color: colors.text, marginTop: 16, textAlign: 'center', fontSize: 15, lineHeight: 24, paddingHorizontal: 30 }}>
              {error === 'no_content'
                ? 'இந்த நாளுக்கு பாடம் இல்லை.\nThis day\'s lesson is not available yet.'
                : 'இணைய இணைப்பை சரிபார்க்கவும்.\nCheck your connection and try again.'}
            </Text>
            <TouchableOpacity
              style={[styles.retryBtn, { backgroundColor: colors.primary }]}
              onPress={() => loadLesson(selectedDate)}
              activeOpacity={0.8}
            >
              <Ionicons name="refresh" size={16} color="#000" style={{ marginRight: 6 }} />
              <Text style={{ color: '#000', fontWeight: '700' }}>மீண்டும் முயற்சிக்க</Text>
            </TouchableOpacity>

            {/* Prev/Next even on error screen */}
            <View style={styles.navRow}>
              <TouchableOpacity style={[styles.navBtn, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={goToPrevDay}>
                <Ionicons name="chevron-back" size={20} color={colors.text} />
                <Text style={{ color: colors.text, marginLeft: 4, fontFamily: 'Tamil003', fontSize: 13 }}>முந்தைய நாள்</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.navBtn, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={goToNextDay}>
                <Text style={{ color: colors.text, marginRight: 4, fontFamily: 'Tamil003', fontSize: 13 }}>அடுத்த நாள்</Text>
                <Ionicons name="chevron-forward" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>
          </View>

        ) : hasContent ? (
          <View style={{ flex: 1 }}>
            <WebView
              originWhitelist={['*']}
              source={{ html: getHtml() }}
              style={{ backgroundColor: colors.background, flex: 1 }}
              showsVerticalScrollIndicator={false}
              javaScriptEnabled={false}
              domStorageEnabled={false}
              setSupportMultipleWindows={false}
            />

            {/* ── BOTTOM BAR: Prev / Next + Credit ── */}
            <View style={[styles.bottomBar, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
              <TouchableOpacity style={styles.navBtnSmall} onPress={goToPrevDay}>
                <Ionicons name="chevron-back" size={18} color={colors.primary} />
                <Text style={{ color: colors.primary, fontSize: 12, marginLeft: 2, fontFamily: 'Tamil003' }}>முந்தையது</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => Linking.openURL('https://github.com/adventech')}
                style={styles.creditCenter}
              >
                <Text style={{ color: colors.subtext, fontSize: 10 }}>
                  Content © <Text style={{ color: colors.primary, fontWeight: '700' }}>Adventech</Text> MIT
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.navBtnSmall} onPress={goToNextDay}>
                <Text style={{ color: colors.primary, fontSize: 12, marginRight: 2, fontFamily: 'Tamil003' }}>அடுத்தது</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  datePill: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  dateText: { fontSize: 15, fontWeight: '600' },
  headerTools: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: { paddingHorizontal: 8, paddingVertical: 4, justifyContent: 'center', alignItems: 'center' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  fontCard: { width: '85%', padding: 24, borderRadius: 22, borderWidth: 1, alignItems: 'center', elevation: 10 },
  sliderRow: { flexDirection: 'row', alignItems: 'center', width: '100%' },

  titleStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  lessonTitleText: { flex: 1, fontWeight: '600', lineHeight: 22 },
  cachePill: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    marginLeft: 8,
  },

  content: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 28 },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 22,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 12,
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 40,
    gap: 10,
  },
  navBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
  },

  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderTopWidth: 1,
  },
  navBtnSmall: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6 },
  creditCenter: { flex: 1, alignItems: 'center' },
});
