import MixedText from '../components/MixedText.js';
// FILE: src/screens/EGWBooksListScreen.js
// REPLACE THE ENTIRE FILE WITH THIS CODE

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator,
  Alert, Platform, Animated, Easing, RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as IntentLauncher from 'expo-intent-launcher';
import * as WebBrowser from 'expo-web-browser';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { EGW_BOOKS_DATA } from '../data/egwBooks';
import { useSettings } from '../context/SettingsContext';

// How many books have a PDF (used for the "x / y downloaded" strip)
const DOWNLOADABLE_TOTAL = EGW_BOOKS_DATA.filter(b => b.pdf_url).length;

// -------------------------------------------------------------
// 1. Press animation + light haptic tap
// -------------------------------------------------------------
const ScalePressable = ({ children, onPress, style, scaleTo = 0.90, disabled = false }) => {
  const { hapticsEnabled } = useSettings();
  const scale = useRef(new Animated.Value(1)).current;
  const handlePressIn = () => !disabled && Animated.spring(scale, { toValue: scaleTo, useNativeDriver: true, friction: 5 }).start();
  const handlePressOut = () => !disabled && Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 5 }).start();
  const handlePress = () => {
    if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (onPress) onPress();
  };
  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <TouchableOpacity onPressIn={handlePressIn} onPressOut={handlePressOut} onPress={handlePress} activeOpacity={0.8} delayPressIn={50} disabled={disabled}>
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
};

// -------------------------------------------------------------
// 2. "Pop" entrance (used when a button / badge changes state)
// -------------------------------------------------------------
const PopIn = ({ children, style }) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }).start();
  }, []);
  return (
    <Animated.View style={[{ opacity: anim, transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }] }, style]}>
      {children}
    </Animated.View>
  );
};

// -------------------------------------------------------------
// 3. Glowing ring around the icon while a book is downloading
// -------------------------------------------------------------
const PulseRing = ({ color, active }) => {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active) return undefined;
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1200, easing: Easing.out(Easing.quad), useNativeDriver: true })
    );
    loop.start();
    return () => { loop.stop(); pulse.setValue(0); };
  }, [active]);
  if (!active) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.pulseRing, {
        borderColor: color,
        opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }),
        transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] }) }]
      }]}
    />
  );
};

// -------------------------------------------------------------
// 4. "3 / 12 downloaded" strip with animated bar
// -------------------------------------------------------------
const StatsStrip = ({ done, total, colors, typography }) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: total > 0 ? done / total : 0, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [done, total]);
  return (
    <View style={[styles.statsWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.statsRow}>
        <Ionicons name="download-outline" size={18} color={colors.primary} />
        <MixedText style={[styles.statsText, { color: colors.text, fontSize: typography.subtext.fontSize }]}>
          {done} / {total} downloaded for offline reading
        </MixedText>
      </View>
      <View style={[styles.statsTrack, { backgroundColor: colors.border }]}>
        <Animated.View style={[styles.statsFill, { backgroundColor: colors.primary, width: anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
      </View>
    </View>
  );
};

// -------------------------------------------------------------
// 5. One book card (own animations per card)
// -------------------------------------------------------------
const BookCard = ({
  item, index, colors, typography, ready,
  isDownloaded, isDownloading, busy, progress,
  onOnline, onDownload, onOpen, onDelete
}) => {
  const enter = useRef(new Animated.Value(0)).current;
  const barAnim = useRef(new Animated.Value(0)).current;

  // Slide-up + fade-in. Only the first 6 cards are staggered.
  useEffect(() => {
    const anim = Animated.timing(enter, {
      toValue: 1, duration: 450, delay: index < 6 ? index * 80 : 0,
      easing: Easing.out(Easing.cubic), useNativeDriver: true
    });
    anim.start();
    return () => anim.stop();
  }, []);

  // Smoothly move the progress bar
  useEffect(() => {
    Animated.timing(barAnim, { toValue: progress, duration: 250, useNativeDriver: false }).start();
  }, [progress]);

  return (
    <Animated.View style={[styles.cardShadow, {
      backgroundColor: colors.card,
      opacity: enter,
      transform: [
        { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) },
        { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }
      ]
    }]}>
      <View style={[styles.bookCard, { backgroundColor: colors.card, borderColor: colors.border }]}>

        {/* Coloured edge: cyan normally, green when downloaded */}
        <Animated.View style={[styles.accentBar, { backgroundColor: isDownloaded ? '#4CAF50' : colors.primary, transform: [{ scaleY: enter }] }]} />

        <View style={styles.cardHeader}>
          <View style={[styles.iconCircle, { backgroundColor: 'rgba(0, 240, 255, 0.1)' }]}>
            <PulseRing color={colors.primary} active={isDownloading} />
            <Ionicons name={item.icon || "book-outline"} size={24} color={colors.primary} />
            {isDownloaded && (
              <PopIn style={[styles.badge, { borderColor: colors.card }]}>
                <Ionicons name="checkmark" size={10} color="#fff" />
              </PopIn>
            )}
          </View>
          <View style={styles.bookInfo}>
            <MixedText style={[styles.titleTamil, { color: colors.text, fontSize: typography.title.fontSize }]}>{item.title_tamil}</MixedText>
            <MixedText style={[styles.titleEnglish, { color: colors.subtext, fontSize: typography.subtext.fontSize }]}>{item.title_english}</MixedText>
          </View>
        </View>

        <View style={styles.actionButtons}>
          {item.website_url && (
            <ScalePressable onPress={() => onOnline(item.website_url)}>
              <LinearGradient colors={['#F5A623', '#FFC857']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.onlineBtn}>
                <Ionicons name="globe-outline" size={18} color="#fff" />
                <MixedText style={[styles.btnText, { fontSize: typography.subtext.fontSize }]}>Online</MixedText>
              </LinearGradient>
            </ScalePressable>
          )}

          {item.pdf_url && ready && (
            isDownloaded ? (
              <PopIn key="done" style={styles.downloadedActions}>
                <ScalePressable onPress={() => onOpen(item.id)}>
                  <LinearGradient colors={['#4CAF50', '#81C784']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.openBtn}>
                    <Ionicons name="book-outline" size={18} color="#fff" />
                    <MixedText style={[styles.btnText, { fontSize: typography.subtext.fontSize }]}>Read</MixedText>
                  </LinearGradient>
                </ScalePressable>

                <ScalePressable onPress={() => onDelete(item)}>
                  <View style={styles.deleteBtn}>
                    <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                  </View>
                </ScalePressable>
              </PopIn>
            ) : isDownloading ? (
              <PopIn key="loading">
                <View style={styles.loadingBtn}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <MixedText style={{ color: colors.primary, fontSize: typography.caption.fontSize, marginTop: 4, fontWeight: 'bold' }}>{progress}%</MixedText>
                </View>
              </PopIn>
            ) : (
              <PopIn key="idle">
                <ScalePressable disabled={busy} style={{ opacity: busy ? 0.4 : 1 }} onPress={() => onDownload(item)}>
                  <View style={[styles.downloadBtn, { borderColor: colors.primary }]}>
                    <Ionicons name="download-outline" size={20} color={colors.primary} />
                  </View>
                </ScalePressable>
              </PopIn>
            )
          )}
        </View>

        {/* Download progress bar along the bottom edge */}
        {isDownloading && (
          <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
            <Animated.View style={[styles.progressFill, {
              backgroundColor: colors.primary,
              width: barAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'], extrapolate: 'clamp' })
            }]} />
          </View>
        )}
      </View>
    </Animated.View>
  );
};

// -------------------------------------------------------------
// MAIN SCREEN
// -------------------------------------------------------------
export default function EGWBooksListScreen({ navigation }) {
  const { colors, typography, hapticsEnabled } = useSettings();
  const [downloadedFiles, setDownloadedFiles] = useState({});
  const [statusReady, setStatusReady] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState({});
  const [showNote, setShowNote] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showTop, setShowTop] = useState(false);

  const mountedRef = useRef(true);
  const noteOpen = useRef(false);
  const showTopRef = useRef(false);
  const listRef = useRef(null);

  const topEnter = useRef(new Animated.Value(0)).current;
  const noteAnim = useRef(new Animated.Value(0)).current;
  const fabAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    mountedRef.current = true;
    checkDownloadedFiles();
    Animated.spring(topEnter, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true }).start();
    return () => { mountedRef.current = false; };
  }, []);

  // Show / hide the "scroll to top" button
  useEffect(() => {
    Animated.spring(fabAnim, { toValue: showTop ? 1 : 0, friction: 6, tension: 80, useNativeDriver: true }).start();
  }, [showTop]);

  const checkDownloadedFiles = async () => {
    const status = {};
    try {
      await Promise.all(
        EGW_BOOKS_DATA.filter(b => b.pdf_url).map(async (book) => {
          const info = await FileSystem.getInfoAsync(FileSystem.documentDirectory + `${book.id}.pdf`);
          status[book.id] = info.exists;
        })
      );
    } catch (e) {
      // ignore - buttons will just show "download"
    }
    if (mountedRef.current) {
      setDownloadedFiles(status);
      setStatusReady(true);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await checkDownloadedFiles();
    if (mountedRef.current) setRefreshing(false);
  };

  const handleScroll = (e) => {
    const shouldShow = e.nativeEvent.contentOffset.y > 350;
    if (shouldShow !== showTopRef.current) {
      showTopRef.current = shouldShow;
      setShowTop(shouldShow);
    }
  };

  const scrollToTop = () => {
    if (listRef.current) listRef.current.scrollToOffset({ offset: 0, animated: true });
  };

  const toggleNote = () => {
    if (!noteOpen.current) {
      noteOpen.current = true;
      setShowNote(true);
      Animated.spring(noteAnim, { toValue: 1, friction: 7, tension: 60, useNativeDriver: true }).start();
    } else {
      noteOpen.current = false;
      Animated.timing(noteAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start(({ finished }) => {
        if (finished && mountedRef.current) setShowNote(false);
      });
    }
  };

  const handleOnlineView = async (url) => {
    await WebBrowser.openBrowserAsync(url);
  };

  const handleDownload = async (book) => {
    if (downloadingId) return; // one download at a time
    setDownloadingId(book.id);
    const fileUri = FileSystem.documentDirectory + `${book.id}.pdf`;

    const downloadResumable = FileSystem.createDownloadResumable(
      book.pdf_url,
      fileUri,
      {},
      (p) => {
        const total = p.totalBytesExpectedToWrite;
        const pct = total > 0 ? Math.round((p.totalBytesWritten / total) * 100) : 0;
        setDownloadProgress(prev => ({ ...prev, [book.id]: pct }));
      }
    );

    try {
      const result = await downloadResumable.downloadAsync();
      if (!result || result.status < 200 || result.status >= 300) {
        await FileSystem.deleteAsync(fileUri, { idempotent: true });
        throw new Error('Bad response');
      }
      if (mountedRef.current) setDownloadedFiles(prev => ({ ...prev, [book.id]: true }));
      if (hapticsEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (error) {
      Alert.alert("Error", "Download failed. Please check your internet connection.");
    } finally {
      if (mountedRef.current) {
        setDownloadingId(null);
        setDownloadProgress(prev => {
          const newProg = { ...prev };
          delete newProg[book.id];
          return newProg;
        });
      }
    }
  };

  // Double Confirmation Delete Feature
  const handleDelete = (book) => {
    Alert.alert(
      "Warning",
      `Do you want to delete '${book.title_tamil}'?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes",
          onPress: () => {
            Alert.alert(
              "Confirm Delete",
              "Are you sure you want to permanently delete this from your device?",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete",
                  style: "destructive",
                  onPress: async () => {
                    const fileUri = FileSystem.documentDirectory + `${book.id}.pdf`;
                    try {
                      await FileSystem.deleteAsync(fileUri, { idempotent: true });
                      setDownloadedFiles(prev => ({ ...prev, [book.id]: false }));
                    } catch (e) {
                      Alert.alert("Error", "Could not delete the file.");
                    }
                  }
                }
              ]
            );
          }
        }
      ]
    );
  };

  // Open Directly in PDF Viewer
  const handleOpenPdf = async (bookId) => {
    const fileUri = FileSystem.documentDirectory + `${bookId}.pdf`;

    try {
      if (Platform.OS === 'android') {
        const contentUri = await FileSystem.getContentUriAsync(fileUri);
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: contentUri,
          flags: 1,
          type: 'application/pdf',
        });
      } else {
        await Sharing.shareAsync(fileUri, { UTI: 'com.adobe.pdf', mimeType: 'application/pdf' });
      }
    } catch (error) {
      Alert.alert("பிழை", "உங்கள் போனில் PDF பைலை திறக்க வசதி இல்லை.");
    }
  };

  const renderBookItem = ({ item, index }) => (
    <BookCard
      item={item}
      index={index}
      colors={colors}
      typography={typography}
      ready={statusReady}
      isDownloaded={!!downloadedFiles[item.id]}
      isDownloading={downloadingId === item.id}
      busy={!!downloadingId && downloadingId !== item.id}
      progress={downloadProgress[item.id] || 0}
      onOnline={handleOnlineView}
      onDownload={handleDownload}
      onOpen={handleOpenPdf}
      onDelete={handleDelete}
    />
  );

  const downloadedCount = Object.values(downloadedFiles).filter(Boolean).length;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>

      {/* ONE-LINE TOP BAR: Back | EGW link | Note button */}
      <Animated.View style={[styles.topBar, {
        backgroundColor: colors.card,
        borderColor: colors.border,
        opacity: topEnter,
        transform: [{ translateY: topEnter.interpolate({ inputRange: [0, 1], outputRange: [-40, 0] }) }]
      }]}>
        <ScalePressable onPress={() => navigation.goBack()}>
          <View style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.primary} />
            <MixedText style={[styles.backText, { color: colors.primary, fontSize: typography.body.fontSize }]}>Back</MixedText>
          </View>
        </ScalePressable>

        <ScalePressable style={styles.linkWrap} onPress={() => handleOnlineView('https://m.egwwritings.org/ta/folders/1082')}>
          <MixedText style={[styles.headerLink, { color: colors.primary, fontSize: typography.subtext.fontSize }]}>
           <MixedText style={[styles.headerLinkUnderline, { color: colors.primary }]}>View EGW</MixedText>
          </MixedText>
        </ScalePressable>

        <ScalePressable onPress={toggleNote}>
          <View style={styles.noteBtn}>
            <Ionicons name={showNote ? "chevron-up-outline" : "information-circle-outline"} size={16} color="#fff" />
            <MixedText style={[styles.noteBtnText, { fontSize: typography.subtext.fontSize }]}>Note</MixedText>
          </View>
        </ScalePressable>
      </Animated.View>

      {/* Note box slides open under the top bar */}
      {showNote && (
        <Animated.View style={[styles.noteBox, {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: noteAnim,
          transform: [
            { translateY: noteAnim.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) },
            { scale: noteAnim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }
          ]
        }]}>
          <MixedText style={[styles.noteText, { color: colors.text, fontSize: typography.body.fontSize }]}>
            The books listed on this page are not owned or created by Adventist Tamil Tool. We are simply providing links so you can read these valuable books with ease. We heartily give thanks to the creators of these books, and all credit belongs to them alone.
          </MixedText>
        </Animated.View>
      )}

      <FlatList
        ref={listRef}
        style={{ flex: 1 }}
        data={EGW_BOOKS_DATA}
        extraData={{ downloadedFiles, downloadingId, downloadProgress, statusReady }}
        keyExtractor={(item) => item.id}
        renderItem={renderBookItem}
        ListHeaderComponent={
          DOWNLOADABLE_TOTAL > 0
            ? <StatsStrip done={downloadedCount} total={DOWNLOADABLE_TOTAL} colors={colors} typography={typography} />
            : null
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        }
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: 90, paddingTop: 4 }}
        removeClippedSubviews={true}
        maxToRenderPerBatch={5}
        windowSize={5}
        initialNumToRender={8}
      />

      {/* Floating "back to top" button */}
      <Animated.View
        pointerEvents={showTop ? 'auto' : 'none'}
        style={[styles.fab, { opacity: fabAnim, transform: [{ scale: fabAnim }] }]}
      >
        <ScalePressable onPress={scrollToTop}>
          <View style={[styles.fabInner, { backgroundColor: colors.primary }]}>
            <Ionicons name="arrow-up" size={22} color={colors.background} />
          </View>
        </ScalePressable>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // ---- Top bar (one row) ----
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 12, marginTop: 6, paddingHorizontal: 8, paddingVertical: 8,
    borderRadius: 14, borderWidth: 1,
    elevation: 3, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }
  },
  backButton: { flexDirection: 'row', alignItems: 'center', padding: 4 },
  backText: { fontSize: 16, marginLeft: 4, fontWeight: 'bold' },
  linkWrap: { flex: 1, marginHorizontal: 8 },
  headerLink: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
  headerLinkUnderline: { fontWeight: 'bold', textDecorationLine: 'underline' },

  noteBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5A623', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, maxWidth: 110 },
  noteBtnText: { color: '#fff', fontSize: 13, fontWeight: 'bold', marginLeft: 4, flexShrink: 1 },
  noteBox: { marginHorizontal: 12, marginTop: 8, padding: 14, borderRadius: 12, borderWidth: 1 },
  noteText: { fontSize: 14, lineHeight: 22, textAlign: 'left' },

  // ---- Stats strip ----
  statsWrap: { marginHorizontal: 16, marginTop: 10, padding: 12, borderRadius: 12, borderWidth: 1 },
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  statsText: { fontSize: 12, fontWeight: '600', marginLeft: 8 },
  statsTrack: { height: 6, borderRadius: 3, marginTop: 10, overflow: 'hidden' },
  statsFill: { height: 6, borderRadius: 3 },

  // ---- Book card ----
  cardShadow: {
    marginHorizontal: 16, marginTop: 12, borderRadius: 12,
    elevation: 3, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }
  },
  bookCard: { padding: 16, borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  accentBar: { position: 'absolute', left: 0, top: 14, bottom: 14, width: 4, borderTopRightRadius: 4, borderBottomRightRadius: 4 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  iconCircle: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 12, marginTop: 2 },
  pulseRing: { position: 'absolute', top: 0, left: 0, width: 44, height: 44, borderRadius: 22, borderWidth: 2 },
  badge: { position: 'absolute', right: -4, bottom: -4, width: 18, height: 18, borderRadius: 9, backgroundColor: '#4CAF50', borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  bookInfo: { flex: 1, marginBottom: 12 },

  titleTamil: { fontSize: 18, fontFamily: 'Tamil003', lineHeight: 26 },
  titleEnglish: { fontSize: 13, marginTop: 2 },

  actionButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 8 },
  downloadedActions: { flexDirection: 'row', gap: 10, alignItems: 'center' },

  onlineBtn: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  openBtn: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },

  deleteBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: 'rgba(255,59,48,0.1)', justifyContent: 'center', alignItems: 'center' },

  downloadBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  loadingBtn: { paddingHorizontal: 14, paddingVertical: 4, justifyContent: 'center', alignItems: 'center' },
  btnText: { color: '#fff', marginLeft: 6, fontSize: 14, fontWeight: 'bold' },

  progressTrack: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 4 },
  progressFill: { height: 4 },

  // ---- Back-to-top button ----
  fab: { position: 'absolute', right: 20, bottom: 24 },
  fabInner: {
    width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center',
    elevation: 6, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }
  }
});