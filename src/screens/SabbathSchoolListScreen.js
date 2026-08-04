import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, ActivityIndicator, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSettings } from '../context/SettingsContext';
import * as Haptics from 'expo-haptics';

// ROOT CAUSE FIX (same as Reader):
// Adventech API URL needs "ta/2026/03" but .index gives "ta-2026-03"
const indexToPath = (index) => index.split('-').join('/');

const safeFetch = async (url) => {
  const res = await fetch(url);
  const text = await res.text();
  if (text.trim().startsWith('<')) throw new Error('HTML_RESPONSE');
  return JSON.parse(text);
};

const shortDate = (str) => {
  if (!str) return '';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(str)
    ? new Date(str + 'T00:00:00')
    : new Date(str);
  return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
};

const parseYMD = (str) => {
  if (!str) return 0;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split('-');
    return new Date(Number(y), Number(m) - 1, Number(d)).getTime();
  }
  return 0;
};

export default function SabbathSchoolListScreen() {
  const navigation = useNavigation();
  const { colors, appFontSize, hapticsEnabled } = useSettings();

  const [lessons, setLessons] = useState([]);
  const [quarterTitle, setQuarterTitle] = useState('');
  const [quarterIndex, setQuarterIndex] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => { fetchQuarterlyData(); }, []);

  const fetchQuarterlyData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Try Tamil first, fall back to English
      let quartersData;
      try {
        quartersData = await safeFetch('https://sabbath-school.adventech.io/api/v1/ta/quarterlies/index.json');
      } catch {
        quartersData = await safeFetch('https://sabbath-school.adventech.io/api/v1/en/quarterlies/index.json');
      }

      if (!Array.isArray(quartersData) || !quartersData.length) throw new Error('No data');

      const quarter = quartersData[0];
      const qPath = indexToPath(quarter.index); // "ta-2026-03" → "ta/2026/03"

      setQuarterTitle(quarter.title || 'Sabbath School');
      setQuarterIndex(quarter.index);

      const lessonsData = await safeFetch(
        `https://sabbath-school.adventech.io/api/v1/${qPath}/index.json`
      );
      const fetched = lessonsData.lessons || [];
      if (!fetched.length) throw new Error('No lessons');
      setLessons(fetched);

    } catch (err) {
      setError('Failed to load. Check your internet and try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleLessonPress = useCallback((lesson) => {
    if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('SabbathSchoolReader', {
      lessonIndex: lesson.index,
      lessonTitle: lesson.title,
    });
  }, [hapticsEnabled, navigation]);

  const today = Date.now();
  const isCurrentWeek = (lesson) => {
    const s = parseYMD(lesson.start_date);
    const e = parseYMD(lesson.end_date);
    return today >= s && today <= e;
  };

  const renderItem = ({ item }) => {
    const current = isCurrentWeek(item);
    return (
      <TouchableOpacity
        style={[
          styles.card,
          {
            backgroundColor: current ? 'rgba(0,240,255,0.07)' : colors.card,
            borderColor: current ? colors.primary : colors.border,
            borderWidth: current ? 1.5 : 1,
          },
        ]}
        onPress={() => handleLessonPress(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.badge, { backgroundColor: current ? colors.primary : 'rgba(0,240,255,0.1)' }]}>
          <Text style={{ color: current ? '#000' : colors.primary, fontWeight: '800', fontSize: 14 }}>
            {item.id}
          </Text>
        </View>

        <View style={styles.textBlock}>
          {current && (
            <View style={[styles.pill, { backgroundColor: colors.primary }]}>
              <Text style={styles.pillText}>THIS WEEK</Text>
            </View>
          )}
          <Text style={[styles.lessonTitle, { color: colors.text, fontSize: appFontSize + 1 }]} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={{ color: colors.subtext, fontSize: appFontSize - 3 }}>
            {shortDate(item.start_date)} – {shortDate(item.end_date)}
          </Text>
        </View>

        <Ionicons name="chevron-forward" size={18} color={current ? colors.primary : colors.subtext} />
      </TouchableOpacity>
    );
  };

  const ListHeader = () => (
    <View style={[styles.banner, { backgroundColor: 'rgba(0,240,255,0.05)', borderColor: colors.border }]}>
      <Ionicons name="calendar-outline" size={15} color={colors.primary} style={{ marginRight: 7 }} />
      <Text style={{ color: colors.subtext, fontSize: 12 }}>
        {lessons.length} lessons · {quarterIndex}
      </Text>
    </View>
  );

  const ListFooter = () => (
    <View style={styles.footer}>
      <Text style={{ color: colors.subtext, fontSize: 12, textAlign: 'center' }}>
        Content provided by the open-source community at{' '}
      </Text>
      <TouchableOpacity onPress={() => Linking.openURL('https://github.com/adventech')}>
        <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700', textAlign: 'center', marginTop: 3 }}>
          Adventech (MIT License)
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>

      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[styles.headerTitle, { color: colors.text, fontSize: appFontSize + 4 }]} allowFontScaling={false} numberOfLines={1}>
            {quarterTitle || 'ஓய்வுநாள் பள்ளி'}
          </Text>
          <Text style={[{ color: colors.subtext, fontSize: appFontSize - 1, fontFamily: 'Tamil003', marginTop: 2 }]} allowFontScaling={false}>
            முழு ஓய்வுநாள் பள்ளி
          </Text>
        </View>
      </View>

      <View style={{ flex: 1 }}>
        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={{ color: colors.subtext, marginTop: 16 }}>Loading lessons...</Text>
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Ionicons name="cloud-offline-outline" size={54} color={colors.subtext} />
            <Text style={{ color: colors.text, marginTop: 16, textAlign: 'center', lineHeight: 22, paddingHorizontal: 24 }}>{error}</Text>
            <TouchableOpacity
              style={[styles.retryBtn, { backgroundColor: colors.primary }]}
              onPress={fetchQuarterlyData}
              activeOpacity={0.8}
            >
              <Ionicons name="refresh" size={15} color="#000" style={{ marginRight: 6 }} />
              <Text style={{ color: '#000', fontWeight: '700' }}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={lessons}
            keyExtractor={(item) => item.id?.toString() || item.index}
            renderItem={renderItem}
            ListHeaderComponent={ListHeader}
            ListFooterComponent={ListFooter}
            contentContainerStyle={{ padding: 14, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews
            windowSize={8}
            initialNumToRender={8}
            maxToRenderPerBatch={5}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1 },
  headerTitle: { fontWeight: '700', includeFontPadding: false },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 28 },
  retryBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 22, paddingHorizontal: 22, paddingVertical: 11, borderRadius: 12 },
  banner: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 10, borderWidth: 1, marginBottom: 12 },
  card: { flexDirection: 'row', alignItems: 'center', padding: 14, marginBottom: 10, borderRadius: 14 },
  badge: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center', marginRight: 13, flexShrink: 0 },
  textBlock: { flex: 1, paddingRight: 8 },
  pill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5, marginBottom: 5, alignSelf: 'flex-start' },
  pillText: { color: '#000', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  lessonTitle: { fontWeight: '600', marginBottom: 3, fontFamily: 'Tamil003', includeFontPadding: false, lineHeight: 20 },
  footer: { alignItems: 'center', marginTop: 24, marginBottom: 16 },
});
