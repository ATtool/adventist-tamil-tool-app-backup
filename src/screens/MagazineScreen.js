import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SectionList, ActivityIndicator, Alert, Image, Animated, Linking, Platform, LogBox, LayoutAnimation, UIManager, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as IntentLauncher from 'expo-intent-launcher'; 
import { createAudioPlayer } from 'expo-audio';
import { useSettings } from '../context/SettingsContext';

// Short month labels for the archive timeline
const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// Slim animated progress bar shown while a magazine is downloading
const ProgressBar = ({ progress = 0, color = '#00F0FF', trackColor = 'rgba(255,255,255,0.1)' }) => (
  <View style={[styles.progressTrack, { backgroundColor: trackColor }]}>
    <View style={[styles.progressFill, { width: `${Math.max(4, progress)}%`, backgroundColor: color }]} />
  </View>
);

// Enable LayoutAnimation for Android
// LayoutAnimation is enabled by default in the New Architecture.
// if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
//   UIManager.setLayoutAnimationEnabledExperimental(true);
// }

// (removed — no longer needed after switching to expo-audio)

const MAGAZINE_GIST_URL = 'https://gist.githubusercontent.com/ATtool/9148fb9b8a3238acc50c2c5fb80d80bc/raw/magazines.json';

// -------------------------------------------------------------
// Reusable Premium Click Animation Wrapper
// -------------------------------------------------------------
const ScalePressable = ({ children, onPress, style, scaleTo = 0.90, disabled = false }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const handlePressIn = () => !disabled && Animated.spring(scale, { toValue: scaleTo, useNativeDriver: true, friction: 5 }).start();
  const handlePressOut = () => !disabled && Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 5 }).start();
  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <TouchableOpacity onPressIn={handlePressIn} onPressOut={handlePressOut} onPress={onPress} activeOpacity={0.8} delayPressIn={50} disabled={disabled}>
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
};

export default function MagazineScreen() {
  const { colors, appFontSize, isDark } = useSettings();
  const navigation = useNavigation();

  const [magazines, setMagazines] = useState([]);
  const [expandedYear, setExpandedYear] = useState(null); 
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [downloadedFiles, setDownloadedFiles] = useState({});
  const [downloadingId, setDownloadingId] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState({});
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const listFadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetchMagazines();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fadeAnim.setValue(0);
      slideAnim.setValue(30);
      listFadeAnim.setValue(0);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
        Animated.timing(listFadeAnim, { toValue: 1, duration: 1000, useNativeDriver: true })
      ]).start();

      function playSound() {
        try {
          const player = createAudioPlayer(require('../../assets/data/sparrow.mp3'));
          player.play();
          setTimeout(() => { player.remove(); }, 2000);
        } catch (error) { console.log("Audio Error", error); }
      }
      playSound();
      checkDownloadedStatus();

      return () => {};
    }, [])
  );

  const fetchMagazines = async () => {
    try {
      const cacheBustingUrl = `${MAGAZINE_GIST_URL}?t=${new Date().getTime()}`;
      const response = await fetch(cacheBustingUrl, { headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' } });
      
      if (response.ok) {
        const data = await response.json();
        const sorted = data.magazines.sort((a, b) => new Date(b.date_val) - new Date(a.date_val));
        
        const grouped = {};
        sorted.forEach(mag => {
          const year = mag.date_val.split('-')[0];
          if (!grouped[year]) grouped[year] = [];
          grouped[year].push(mag);
        });

        const sectionedData = Object.keys(grouped)
          .sort((a, b) => b - a) 
          .map(year => ({ title: year, data: grouped[year] }));

        setMagazines(sectionedData);
      } else {
        Alert.alert("Error", "Could not fetch latest magazines.");
      }
    } catch (e) {
      Alert.alert("Error", "Check your internet connection.");
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setIsRefreshing(true);
    await fetchMagazines();
    await checkDownloadedStatus();
    setIsRefreshing(false);
  };

  const checkDownloadedStatus = async () => {
    try {
      const dir = FileSystem.documentDirectory + 'SQLite';
      const dirInfo = await FileSystem.getInfoAsync(dir);
      if (!dirInfo.exists) return;

      const files = await FileSystem.readDirectoryAsync(dir);
      const status = {};
      
      files.forEach(f => {
        if (f.startsWith('mag_') && f.endsWith('.pdf')) {
          const id = f.replace('.pdf', '');
          status[id] = true;
        }
      });
      setDownloadedFiles(status);
    } catch (e) { console.log(e); }
  };

  const handleDownload = async (mag) => {
    setDownloadingId(mag.id);
    const dir = FileSystem.documentDirectory + 'SQLite';
    const dirInfo = await FileSystem.getInfoAsync(dir);
    if (!dirInfo.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true });

    const fileUri = dir + `/${mag.id}.pdf`;

    let finalDownloadUrl = mag.pdf_url;
    if (finalDownloadUrl.includes('drive.google.com/uc') && !finalDownloadUrl.includes('export=download')) {
      finalDownloadUrl += '&export=download';
    }

    const downloadResumable = FileSystem.createDownloadResumable(
      finalDownloadUrl, fileUri, {},
      (progressData) => {
        const progress = progressData.totalBytesWritten / progressData.totalBytesExpectedToWrite;
        setDownloadProgress(prev => ({ ...prev, [mag.id]: Math.round(progress * 100) }));
      }
    );
    
    try {
      await downloadResumable.downloadAsync();
      setDownloadedFiles(prev => ({ ...prev, [mag.id]: true }));
    } catch (error) {
      Alert.alert("Download Error", "Could not complete the download. Check your connection.");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = (mag) => {
    Alert.alert(
      "Delete Magazine",
      `Remove "${mag.title_english}" from your device?`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive", 
          onPress: async () => {
            try {
              const fileUri = FileSystem.documentDirectory + `SQLite/${mag.id}.pdf`;
              await FileSystem.deleteAsync(fileUri, { idempotent: true });
              setDownloadedFiles(prev => ({ ...prev, [mag.id]: false }));
            } catch (e) {
              Alert.alert("Error", "Could not delete file.");
            }
          }
        }
      ]
    );
  };

  const handleOpenPdf = async (magId) => {
    const fileUri = FileSystem.documentDirectory + `SQLite/${magId}.pdf`;
    
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
      Alert.alert("Error", "No PDF viewer found on your device.");
    }
  };

  const handleShare = async (magId) => {
    const fileUri = FileSystem.documentDirectory + `SQLite/${magId}.pdf`;
    try { await Sharing.shareAsync(fileUri, { dialogTitle: 'Share Magazine' }); } 
    catch (error) { console.log("Share error", error); }
  };

  const toggleYear = (year) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedYear(prev => (prev === year ? null : year));
  };

  const getClimateIcon = (dateString) => {
    const month = parseInt(dateString.split('-')[1], 10);
    switch(month) {
      case 1: return { name: 'thermometer-outline', color: '#00BCD4' }; 
      case 2: return { name: 'leaf-outline', color: '#8BC34A' };        
      case 3: return { name: 'sunny-outline', color: '#FFC107' };       
      case 4: return { name: 'sunny', color: '#FF9800' };               
      case 5: return { name: 'flame', color: '#F44336' };               
      case 6: return { name: 'rainy', color: '#2196F3' };               
      case 7: return { name: 'thunderstorm', color: '#3F51B5' };        
      case 8: return { name: 'water', color: '#03A9F4' };               
      case 9: return { name: 'cloud-outline', color: '#607D8B' };       
      case 10: return { name: 'partly-sunny', color: '#FFEB3B' };       
      case 11: return { name: 'moon-outline', color: '#9C27B0' };       
      case 12: return { name: 'snow-outline', color: '#00BCD4' };       
      default: return { name: 'ellipse', color: colors.subtext };
    }
  };

  const totalIssueCount = magazines.reduce((sum, s) => sum + s.data.length, 0);
  const latestMag = magazines[0]?.data?.[0] || null;

  const renderListHeader = () => (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      <View style={[styles.brandingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.brandRow}>
          <Image source={require('../../assets/data/sparrow logo.png')} style={styles.logoImg} resizeMode="contain" />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'Tamil008', fontSize: 28, color: colors.primary }}>சிட்டுக்குருவி</Text>
            <Text style={{ color: colors.text, fontSize: 14, marginTop: 2, letterSpacing: 1 }}>( மாத இதழ் )</Text>
            <Text style={{ fontFamily: 'Tamil003', fontSize: 16, color: '#FFD700', marginTop: 6 }}>இது பரலோகம் செல்ல வழி</Text>
            {totalIssueCount > 0 && (
              <View style={styles.issueCountPill}>
                <Ionicons name="library-outline" size={12} color={colors.primary} />
                <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700', marginLeft: 4 }}>{totalIssueCount} issues archived</Text>
              </View>
            )}
          </View>
        </View>
        <View style={[styles.authorBlock, { borderTopColor: colors.border }]}>
          <Text style={{ fontFamily: 'Tamil003', color: colors.text, fontSize: 15, marginBottom: 8 }}>ஆசிரியர் : ஆலன் அன்பரசன்</Text>
          <Text style={{ color: colors.subtext, fontSize: 11, lineHeight: 18 }}>
            Published by{"\n"}Danny’s Publications on behalf of{"\n"}God is Judge Ministries{"\n"}
            18/9B1-5, Citadel, 2nd floor, Mahatma Gandhi road,{"\n"}Municipal colony, Punnai nagar,{"\n"}Nagercoil – 629004.{"\n"}Ph : 8904072759
          </Text>
          <ScalePressable onPress={() => Linking.openURL('https://api.whatsapp.com/send/?phone=918904072759&text&type=phone_number&app_absent=0')}>
            <View style={styles.whatsappBtn}>
              <Ionicons name="logo-whatsapp" size={20} color="#fff" />
              <Text style={{ fontFamily: 'Tamil003', color: '#fff', marginLeft: 8 }}>தொடர்பு கொள்ள</Text>
            </View>
          </ScalePressable>
        </View>
      </View>

      {latestMag && (
        <View style={{ marginHorizontal: 15, marginBottom: 20 }}>
          <View style={styles.latestLabelRow}>
            <View style={styles.latestDot} />
            <Text style={[styles.latestLabel, { color: colors.subtext }]}>LATEST ISSUE</Text>
          </View>
          <ScalePressable
            scaleTo={0.97}
            onPress={() => downloadedFiles[latestMag.id] ? handleOpenPdf(latestMag.id) : handleDownload(latestMag)}
          >
            <LinearGradient
              colors={isDark ? ['#0F2A33', '#0A1520'] : ['#E4FBFF', '#F3FBFF']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={[styles.featuredCard, { borderColor: colors.primary + '40' }]}
            >
              <View style={[styles.featuredIconBox, { shadowColor: colors.primary }]}>
                <LinearGradient colors={[colors.primary, '#0080C0']} style={styles.featuredIconGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                  <Ionicons name={downloadedFiles[latestMag.id] ? "book" : "sparkles"} size={26} color="#FFF" />
                </LinearGradient>
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={{ color: colors.text, fontSize: appFontSize + 3, fontFamily: 'Tamil003' }} numberOfLines={1}>{latestMag.title_tamil}</Text>
                <Text style={{ color: colors.subtext, fontSize: appFontSize - 3, marginTop: 2, textTransform: 'uppercase', letterSpacing: 1 }} numberOfLines={1}>{latestMag.title_english}</Text>

                {downloadingId === latestMag.id ? (
                  <View style={{ marginTop: 10 }}>
                    <ProgressBar progress={downloadProgress[latestMag.id] || 0} color={colors.primary} />
                    <Text style={{ color: colors.primary, fontSize: 11, marginTop: 4, fontWeight: '700' }}>{downloadProgress[latestMag.id] || 0}% downloaded</Text>
                  </View>
                ) : (
                  <View style={[styles.featuredCta, { backgroundColor: colors.primary }]}>
                    <Ionicons name={downloadedFiles[latestMag.id] ? "book-outline" : "cloud-download-outline"} size={14} color={isDark ? '#000' : '#FFF'} />
                    <Text style={{ color: isDark ? '#000' : '#FFF', fontSize: 12, fontWeight: '700', marginLeft: 6 }}>
                      {downloadedFiles[latestMag.id] ? 'Read Now' : 'Download Now'}
                    </Text>
                  </View>
                )}
              </View>
            </LinearGradient>
          </ScalePressable>
        </View>
      )}

      {magazines.length > 0 && (
        <Text style={[styles.archiveLabel, { color: colors.subtext }]}>FULL ARCHIVE</Text>
      )}
    </Animated.View>
  );

  const renderSectionHeader = ({ section }) => {
    const { title } = section;
    const isExpanded = expandedYear === title;
    const isCurrentYear = title === String(new Date().getFullYear());
    const count = magazines.find(s => s.title === title)?.data?.length || 0;

    return (
      <View style={styles.treeHeaderContainer}>
        <View style={styles.treeLineContainer}>
          <View style={[styles.treeLine, { backgroundColor: colors.border }]} />
          <View style={[styles.treeYearDot, { borderColor: isExpanded ? colors.primary : colors.subtext, backgroundColor: colors.background }]} />
        </View>
        <ScalePressable 
          onPress={() => toggleYear(title)} 
          style={{ flex: 1 }}
        >
          <View style={[
            styles.treeBranchBtn, 
            { backgroundColor: isExpanded ? 'rgba(0, 240, 255, 0.06)' : colors.card, borderColor: isExpanded ? colors.primary : colors.border }
          ]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[styles.yearText, { color: isExpanded ? colors.primary : colors.text }]}>{title} ஆம் ஆண்டு</Text>
              {isCurrentYear && (
                <View style={styles.currentYearTag}>
                  <Text style={styles.currentYearTagText}>NOW</Text>
                </View>
              )}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={[styles.yearCountBadge, { backgroundColor: isExpanded ? colors.primary + '22' : 'rgba(127,127,127,0.15)' }]}>
                <Text style={{ color: isExpanded ? colors.primary : colors.subtext, fontSize: 11, fontWeight: '700' }}>{count}</Text>
              </View>
              <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={20} color={isExpanded ? colors.primary : colors.subtext} style={{ marginLeft: 8 }} />
            </View>
          </View>
        </ScalePressable>
      </View>
    );
  };

  const renderMagItem = ({ item }) => {
    const isDownloaded = downloadedFiles[item.id];
    const isDownloading = downloadingId === item.id;
    const progress = downloadProgress[item.id] || 0;
    const climate = getClimateIcon(item.date_val); 
    const monthIndex = parseInt(item.date_val.split('-')[1], 10) - 1;

    return (
      <View style={styles.treeItemContainer}>
        <View style={styles.treeLineContainer}>
          <View style={[styles.treeLine, { backgroundColor: colors.border }]} />
          <View style={[styles.climateIconWrapper, { backgroundColor: colors.background }]}>
            <Ionicons name={climate.name} size={16} color={isDownloaded ? '#4CAF50' : climate.color} />
          </View>
          <Text style={[styles.monthLabel, { color: colors.subtext }]}>{MONTH_ABBR[monthIndex] || ''}</Text>
        </View>

        <View style={styles.treeItemContent}>
          <View style={[styles.magCard, { backgroundColor: colors.card, borderColor: isDownloaded ? '#4CAF5030' : colors.border }]}>
            <View style={styles.magHeader}>
              <View style={[styles.iconBoxGlow, { shadowColor: isDownloaded ? '#4CAF50' : colors.primary }]}>
                <LinearGradient
                  colors={isDownloaded ? ['#66BB6A', '#2E7D32'] : [colors.primary, '#0080C0']}
                  style={styles.iconBox}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                >
                  <Ionicons name={isDownloaded ? "checkmark-circle" : "document-text"} size={24} color="#FFF" />
                </LinearGradient>
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={{ color: colors.text, fontSize: appFontSize + 2, fontFamily: 'Tamil003' }}>{item.title_tamil}</Text>
                <Text style={{ color: colors.subtext, fontSize: appFontSize - 2, marginTop: 2, textTransform: 'uppercase', letterSpacing: 1 }}>{item.title_english}</Text>
              </View>
            </View>

            <View style={styles.actionRow}>
              {isDownloaded ? (
                <View style={{ flexDirection: 'row', gap: 10, width: '100%' }}>
                  <ScalePressable style={{ flex: 1 }} onPress={() => handleOpenPdf(item.id)}>
                    <View style={[styles.actionBtn, { backgroundColor: '#4CAF50', justifyContent: 'center' }]}>
                      <Ionicons name="book" size={16} color="#fff" />
                      <Text style={[styles.btnText, { color: '#fff' }]}>Read</Text>
                    </View>
                  </ScalePressable>
                  <ScalePressable onPress={() => handleShare(item.id)}>
                    <View style={[styles.actionBtn, { backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 15 }]}>
                      <Ionicons name="share-social" size={18} color={colors.text} />
                    </View>
                  </ScalePressable>
                  <ScalePressable onPress={() => handleDelete(item)}>
                    <View style={[styles.actionBtn, { backgroundColor: 'rgba(244, 67, 54, 0.15)', paddingHorizontal: 15 }]}>
                      <Ionicons name="trash" size={18} color="#F44336" />
                    </View>
                  </ScalePressable>
                </View>
              ) : isDownloading ? (
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={{ color: colors.primary, fontSize: 12, fontWeight: 'bold' }}>Downloading…</Text>
                    <Text style={{ color: colors.primary, fontSize: 12, fontWeight: 'bold' }}>{progress}%</Text>
                  </View>
                  <ProgressBar progress={progress} color={colors.primary} />
                </View>
              ) : (
                <ScalePressable style={{ flex: 1 }} onPress={() => handleDownload(item)}>
                  <View style={[styles.actionBtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.primary, justifyContent: 'center' }]}>
                    <Ionicons name="cloud-download-outline" size={18} color={colors.primary} />
                    <Text style={[styles.btnText, { color: colors.primary }]}>Download</Text>
                  </View>
                </ScalePressable>
              )}
            </View>
          </View>
        </View>
      </View>
    );
  };

  const activeSections = magazines.map(section => ({
    ...section,
    data: section.title === expandedYear ? section.data : []
  }));

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <ScalePressable onPress={() => navigation.goBack()}>
          <View style={{ padding: 5 }}>
            <Ionicons name="arrow-back" size={26} color={colors.text} />
          </View>
        </ScalePressable>
        <View style={{ alignItems: 'center' }}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Monthly Magazine</Text>
          <Text style={{ color: colors.subtext, fontSize: 11, fontFamily: 'Tamil003', marginTop: 1 }}>சிட்டுக்குருவி இதழ்கள்</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {isLoading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ color: colors.subtext, marginTop: 15 }}>Loading archive...</Text>
        </View>
      ) : (
        <Animated.View style={{ flex: 1, opacity: listFadeAnim }}>
          <SectionList
            sections={activeSections}
            keyExtractor={(item) => item.id}
            renderItem={renderMagItem}
            renderSectionHeader={renderSectionHeader}
            ListHeaderComponent={renderListHeader}
            stickySectionHeadersEnabled={false}
            contentContainerStyle={{ paddingBottom: 60 }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
            }
            ListEmptyComponent={
              <View style={{ alignItems: 'center', marginTop: 40, paddingHorizontal: 30 }}>
                <Ionicons name="newspaper-outline" size={40} color={colors.subtext} />
                <Text style={{ color: colors.subtext, textAlign: 'center', marginTop: 12 }}>No magazines available yet.</Text>
                <Text style={{ color: colors.subtext, textAlign: 'center', marginTop: 4, fontSize: 12 }}>Pull down to refresh</Text>
              </View>
            }
          />
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 1 },
  headerTitle: { fontSize: 20, fontWeight: 'bold' },
  centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  brandingCard: { margin: 15, padding: 20, borderRadius: 20, borderWidth: 1, elevation: 8, shadowColor: '#00F0FF', shadowOpacity: 0.15, shadowOffset: {width: 0, height: 6}, shadowRadius: 10, marginBottom: 15 },
  brandRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  logoImg: { width: 75, height: 75, borderRadius: 37.5, marginRight: 15, borderWidth: 2, borderColor: 'rgba(255,255,255,0.1)' },
  authorBlock: { paddingTop: 15, borderTopWidth: 1 },
  whatsappBtn: { flexDirection: 'row', backgroundColor: '#25D366', alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 25, marginTop: 15, alignItems: 'center', elevation: 3 },
  issueCountPill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginTop: 8, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: 'rgba(0,240,255,0.1)' },

  latestLabelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, marginLeft: 2 },
  latestDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FF3B30', marginRight: 6 },
  latestLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  archiveLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginLeft: 20, marginBottom: 6 },

  featuredCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 20, borderWidth: 1, elevation: 4, shadowColor: '#000', shadowOpacity: 0.1, shadowOffset: { width: 0, height: 3 }, shadowRadius: 6 },
  featuredIconBox: { shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 5, borderRadius: 27 },
  featuredIconGradient: { width: 54, height: 54, borderRadius: 27, justifyContent: 'center', alignItems: 'center' },
  featuredCta: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginTop: 10, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },

  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden', width: '100%' },
  progressFill: { height: 6, borderRadius: 3 },

  treeHeaderContainer: { flexDirection: 'row', paddingHorizontal: 15 },
  treeLineContainer: { width: 30, alignItems: 'center' },
  treeLine: { position: 'absolute', top: 0, bottom: 0, width: 2 },
  treeYearDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 3, marginTop: 28, zIndex: 1 },
  
  treeBranchBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 10, padding: 15, borderRadius: 14, borderWidth: 1, marginLeft: 10 },
  yearText: { fontSize: 18, fontFamily: 'Tamil003', letterSpacing: 1 },
  yearCountBadge: { minWidth: 24, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 },
  currentYearTag: { marginLeft: 8, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: '#FF9F0A' },
  currentYearTagText: { fontSize: 9, fontWeight: '900', color: '#101010', letterSpacing: 0.5 },

  treeItemContainer: { flexDirection: 'row', paddingHorizontal: 15 },
  climateIconWrapper: { marginTop: 45, zIndex: 1, paddingVertical: 4 }, 
  monthLabel: { fontSize: 9, fontWeight: '700', marginTop: 2, textTransform: 'uppercase' },
  treeItemContent: { flex: 1, paddingLeft: 10, paddingBottom: 15 },

  magCard: { padding: 18, borderRadius: 16, borderWidth: 1 },
  magHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  iconBoxGlow: { shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.35, shadowRadius: 6, elevation: 4, borderRadius: 14 },
  iconBox: { width: 50, height: 50, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  actionRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', paddingTop: 15, marginTop: 5 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderRadius: 10 },
  btnText: { fontWeight: 'bold', marginLeft: 8, fontSize: 13 }
});
