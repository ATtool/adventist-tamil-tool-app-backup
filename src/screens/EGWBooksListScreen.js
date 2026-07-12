import React, { useState, useEffect, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Platform, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context'; 
import * as FileSystem from 'expo-file-system/legacy'; 
import * as Sharing from 'expo-sharing';
import * as IntentLauncher from 'expo-intent-launcher'; 
import * as WebBrowser from 'expo-web-browser'; 
import { Ionicons } from '@expo/vector-icons';
import { EGW_BOOKS_DATA } from '../data/egwBooks'; 
import { useSettings } from '../context/SettingsContext';

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

export default function EGWBooksListScreen({ navigation }) {
  const { colors } = useSettings();
  const [downloadedFiles, setDownloadedFiles] = useState({});
  const [downloadingId, setDownloadingId] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState({}); 
  const [showNote, setShowNote] = useState(false);

  // Entrance Animation Refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    checkDownloadedFiles();
    
    // Trigger smooth list entrance
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 40, useNativeDriver: true })
    ]).start();
  }, []);

  const checkDownloadedFiles = async () => {
    const status = {};
    for (let book of EGW_BOOKS_DATA) {
      if (book.pdf_url) {
        const fileUri = FileSystem.documentDirectory + `${book.id}.pdf`;
        const fileInfo = await FileSystem.getInfoAsync(fileUri);
        status[book.id] = fileInfo.exists;
      }
    }
    setDownloadedFiles(status);
  };

  const handleOnlineView = async (url) => {
    await WebBrowser.openBrowserAsync(url);
  };

  const handleDownload = async (book) => {
    setDownloadingId(book.id);
    const fileUri = FileSystem.documentDirectory + `${book.id}.pdf`;

    const downloadResumable = FileSystem.createDownloadResumable(
      book.pdf_url,
      fileUri,
      {},
      (downloadProgress) => {
        const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
        setDownloadProgress(prev => ({ ...prev, [book.id]: Math.round(progress * 100) }));
      }
    );
    
    try {
      await downloadResumable.downloadAsync();
      setDownloadedFiles(prev => ({ ...prev, [book.id]: true }));
    } catch (error) {
      Alert.alert("பிழை", "டவுன்லோடு செய்ய முடியவில்லை. இணைய இணைப்பை சரிபார்க்கவும்.");
    } finally {
      setDownloadingId(null);
      setDownloadProgress(prev => {
        const newProg = {...prev};
        delete newProg[book.id];
        return newProg;
      });
    }
  };

  // 1. Double Confirmation Delete Feature
  const handleDelete = (book) => {
    Alert.alert(
      "எச்சரிக்கை", 
      `'${book.title_tamil}' புத்தகத்தை நீக்க விரும்புகிறீர்களா?`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Yes", 
          onPress: () => {
            Alert.alert(
              "உறுதிப்படுத்தவும்", 
              "நிச்சயமாக போனில் இருந்து நீக்க வேண்டுமா?",
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
                      Alert.alert("பிழை", "நீக்க முடியவில்லை.");
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

  // 2. Open Directly in PDF Viewer
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

  const renderBookItem = ({ item }) => {
    const isDownloaded = downloadedFiles[item.id];
    const isDownloading = downloadingId === item.id;
    const progress = downloadProgress[item.id] || 0;

    return (
      <View style={[styles.bookCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        
        <View style={styles.cardHeader}>
          <View style={[styles.iconCircle, { backgroundColor: 'rgba(0, 240, 255, 0.1)' }]}>
             <Ionicons name={item.icon || "book-outline"} size={24} color={colors.primary} />
          </View>
          <View style={styles.bookInfo}>
            <Text style={[styles.titleTamil, { color: colors.text }]}>{item.title_tamil}</Text>
            <Text style={[styles.titleEnglish, { color: colors.subtext }]}>{item.title_english}</Text>
          </View>
        </View>

        <View style={styles.actionButtons}>
          {item.website_url && (
            <ScalePressable onPress={() => handleOnlineView(item.website_url)}>
              <View style={styles.onlineBtn}>
                <Ionicons name="globe-outline" size={18} color="#fff" />
                <Text style={styles.btnText}>Online</Text>
              </View>
            </ScalePressable>
          )}

          {item.pdf_url && (
            isDownloaded ? (
              <View style={styles.downloadedActions}>
                <ScalePressable onPress={() => handleOpenPdf(item.id)}>
                  <View style={styles.openBtn}>
                    <Ionicons name="book-outline" size={18} color="#fff" />
                    <Text style={styles.btnText}>Read</Text>
                  </View>
                </ScalePressable>
                
                <ScalePressable onPress={() => handleDelete(item)}>
                  <View style={styles.deleteBtn}>
                    <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                  </View>
                </ScalePressable>
              </View>

            ) : isDownloading ? (
              <View style={styles.loadingBtn}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={{color: colors.primary, fontSize: 11, marginTop: 4, fontWeight: 'bold'}}>{progress}%</Text>
              </View>
            ) : (
              <ScalePressable onPress={() => handleDownload(item)}>
                <View style={[styles.downloadBtn, { borderColor: colors.primary }]}>
                  <Ionicons name="download-outline" size={20} color={colors.primary} />
                </View>
              </ScalePressable>
            )
          )}
        </View>
      </View>
    );
  };

  const ListHeader = () => (
    <View>
      <View style={styles.header}>
        <ScalePressable onPress={() => navigation.goBack()}>
          <View style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.primary} />
            <Text style={[styles.backText, { color: colors.primary }]}>Back</Text>
          </View>
        </ScalePressable>
      </View>

      <ScalePressable onPress={() => handleOnlineView('https://m.egwwritings.org/ta/folders/1082')}>
        <Text style={[styles.headerLink, { color: colors.primary }]}>
          To view official EGW Estate Tamil resources online, visit: <Text style={[styles.headerLinkUnderline, { color: colors.primary }]}>m.egwwritings.org</Text>
        </Text>
      </ScalePressable>

      <View style={styles.noteWrapper}>
        <ScalePressable onPress={() => setShowNote(!showNote)}>
          <View style={styles.noteBtn}>
            <Ionicons name={showNote ? "chevron-up-outline" : "information-circle-outline"} size={16} color="#fff" />
            <Text style={styles.noteBtnText}>Read Important Note</Text>
          </View>
        </ScalePressable>

        {showNote && (
          <View style={[styles.noteBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.noteText, { color: colors.text }]}>
              The books listed on this page are not owned or created by Adventist Tamil Tool. We are simply providing links so you can read these valuable books with ease. We heartily give thanks to the creators of these books, and all credit belongs to them alone.
            </Text>
          </View>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }], flex: 1 }}>
        <FlatList
          data={EGW_BOOKS_DATA}
          keyExtractor={(item) => item.id}
          renderItem={renderBookItem}
          ListHeaderComponent={ListHeader}
          contentContainerStyle={{ paddingBottom: 20, paddingTop: 10 }}
          removeClippedSubviews={true}
          maxToRenderPerBatch={5}
          windowSize={5}
          initialNumToRender={8}
        />
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', padding: 16, alignItems: 'center', justifyContent: 'space-between' },
  backButton: { flexDirection: 'row', alignItems: 'center', padding: 4 },
  backText: { fontSize: 16, marginLeft: 8, fontWeight: 'bold' },
  headerLink: { fontSize: 12, fontWeight: '600', textAlign: 'center', paddingHorizontal: 24, marginBottom: 12 },
  headerLinkUnderline: { fontWeight: 'bold', textDecorationLine: 'underline' },

  noteWrapper: { alignItems: 'center', marginBottom: 12 },
  noteBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5A623', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  noteBtnText: { color: '#fff', fontSize: 13, fontWeight: 'bold', marginLeft: 6 },
  noteBox: { marginHorizontal: 16, marginTop: 10, padding: 14, borderRadius: 12, borderWidth: 1, alignSelf: 'stretch' },
  noteText: { fontSize: 14, lineHeight: 22, textAlign: 'left' },
  
  bookCard: { marginHorizontal: 16, marginTop: 12, padding: 16, borderRadius: 12, borderWidth: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  iconCircle: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 12, marginTop: 2 },
  bookInfo: { flex: 1, marginBottom: 12 },
  
  titleTamil: { fontSize: 18, fontFamily: 'Tamil003', lineHeight: 26 }, 
  titleEnglish: { fontSize: 13, marginTop: 2 },
  
  actionButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 8 },
  downloadedActions: { flexDirection: 'row', gap: 10, alignItems: 'center' }, 
  
  onlineBtn: { flexDirection: 'row', backgroundColor: '#F5A623', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  openBtn: { flexDirection: 'row', backgroundColor: '#4CAF50', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  
  deleteBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: 'rgba(255,59,48,0.1)', justifyContent: 'center', alignItems: 'center' },
  
  downloadBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  loadingBtn: { paddingHorizontal: 14, paddingVertical: 4, justifyContent: 'center', alignItems: 'center' },
  btnText: { color: '#fff', marginLeft: 6, fontSize: 14, fontWeight: 'bold' }
});
