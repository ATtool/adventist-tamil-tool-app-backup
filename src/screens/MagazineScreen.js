import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SectionList, ActivityIndicator, Alert, Image, Animated, Linking, Platform, LogBox, LayoutAnimation, UIManager } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as IntentLauncher from 'expo-intent-launcher'; 
import { Audio } from 'expo-av';
import { useSettings } from '../context/SettingsContext';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

LogBox.ignoreLogs(['[expo-av]']);

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

      async function playSound() {
        try {
          const { sound } = await Audio.Sound.createAsync(require('../../assets/data/sparrow.mp3'));
          await sound.playAsync();
          setTimeout(() => { sound.unloadAsync(); }, 2000);
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

  const renderListHeader = () => (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      <View style={[styles.brandingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.brandRow}>
          <Image source={require('../../assets/data/sparrow logo.png')} style={styles.logoImg} resizeMode="contain" />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'Tamil008', fontSize: 28, color: colors.primary }}>சிட்டுக்குருவி</Text>
            <Text style={{ color: colors.text, fontSize: 14, marginTop: 2, letterSpacing: 1 }}>( மாத இதழ் )</Text>
            <Text style={{ fontFamily: 'Tamil003', fontSize: 16, color: '#FFD700', marginTop: 6 }}>இது பரலோகம் செல்ல வழி</Text>
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
              <Text style={{ fontFamily: 'Tamil003', color: '#fff', marginLeft: 8, fontWeight: 'bold' }}>தொடர்பு கொள்ள</Text>
            </View>
          </ScalePressable>
        </View>
      </View>
    </Animated.View>
  );

  const renderSectionHeader = ({ section: { title } }) => {
    const isExpanded = expandedYear === title;
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
            { backgroundColor: isExpanded ? 'rgba(0, 240, 255, 0.05)' : colors.card, borderColor: isExpanded ? colors.primary : colors.border }
          ]}>
            <Text style={[styles.yearText, { color: isExpanded ? colors.primary : colors.text }]}>{title} ஆம் ஆண்டு</Text>
            <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={20} color={isExpanded ? colors.primary : colors.subtext} />
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

    return (
      <View style={styles.treeItemContainer}>
        <View style={styles.treeLineContainer}>
          <View style={[styles.treeLine, { backgroundColor: colors.border }]} />
          <View style={[styles.climateIconWrapper, { backgroundColor: colors.background }]}>
            <Ionicons name={climate.name} size={18} color={isDownloaded ? '#4CAF50' : climate.color} />
          </View>
        </View>

        <View style={styles.treeItemContent}>
          <View style={[styles.magCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.magHeader}>
              <View style={[styles.iconBox, { backgroundColor: isDownloaded ? 'rgba(76, 175, 80, 0.1)' : 'rgba(0, 240, 255, 0.1)' }]}>
                <Ionicons name={isDownloaded ? "checkmark-circle" : "document-text"} size={26} color={isDownloaded ? '#4CAF50' : colors.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: 15 }}>
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
                <View style={[styles.actionBtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.primary, flex: 1, justifyContent: 'center' }]}>
                   <ActivityIndicator size="small" color={colors.primary} />
                   <Text style={{color: colors.primary, fontSize: 12, marginLeft: 8, fontWeight: 'bold'}}>{progress}%</Text>
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
        <ScalePressable onPress={() => navigation.navigate('Home')}>
          <View style={{ padding: 5 }}>
            <Ionicons name="arrow-back" size={26} color={colors.text} />
          </View>
        </ScalePressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Monthly Magazine</Text>
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
            ListEmptyComponent={<Text style={{ color: colors.subtext, textAlign: 'center', marginTop: 40 }}>No magazines available yet.</Text>}
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
  
  treeHeaderContainer: { flexDirection: 'row', paddingHorizontal: 15 },
  treeLineContainer: { width: 30, alignItems: 'center' },
  treeLine: { position: 'absolute', top: 0, bottom: 0, width: 2 },
  treeYearDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 3, marginTop: 28, zIndex: 1 },
  
  treeBranchBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 10, padding: 15, borderRadius: 14, borderWidth: 1, marginLeft: 10 },
  yearText: { fontSize: 16, fontWeight: '900', letterSpacing: 1 },

  treeItemContainer: { flexDirection: 'row', paddingHorizontal: 15 },
  climateIconWrapper: { marginTop: 45, zIndex: 1, paddingVertical: 4 }, 
  treeItemContent: { flex: 1, paddingLeft: 10, paddingBottom: 15 },

  magCard: { padding: 18, borderRadius: 16, borderWidth: 1 },
  magHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  iconBox: { width: 50, height: 50, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  actionRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', paddingTop: 15, marginTop: 5 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderRadius: 10 },
  btnText: { fontWeight: 'bold', marginLeft: 8, fontSize: 13 }
});
