import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context'; 
import * as FileSystem from 'expo-file-system/legacy'; 
import * as Sharing from 'expo-sharing';
import * as IntentLauncher from 'expo-intent-launcher'; // New Tool for Android PDF Viewer
import * as WebBrowser from 'expo-web-browser'; 
import { Ionicons } from '@expo/vector-icons';
import { EGW_BOOKS_DATA } from '../data/egwBooks'; 
import { useSettings } from '../context/SettingsContext';

export default function EGWBooksListScreen({ navigation }) {
  const { colors } = useSettings();
  const [downloadedFiles, setDownloadedFiles] = useState({});
  const [downloadingId, setDownloadingId] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState({}); 

  useEffect(() => {
    checkDownloadedFiles();
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
      "எச்சரிக்கை", // First Confirmation
      `'${book.title_tamil}' புத்தகத்தை நீக்க விரும்புகிறீர்களா?`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Yes", 
          onPress: () => {
            // Second Confirmation
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
                      setDownloadedFiles(prev => ({ ...prev, [book.id]: false })); // Updates UI instantly
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

  // 2. Open Directly in PDF Viewer (No more Share screen on Android!)
  const handleOpenPdf = async (bookId) => {
    const fileUri = FileSystem.documentDirectory + `${bookId}.pdf`;
    
    try {
      if (Platform.OS === 'android') {
        // Android Specific: Get content URI and open directly in PDF Reader
        const contentUri = await FileSystem.getContentUriAsync(fileUri);
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: contentUri,
          flags: 1,
          type: 'application/pdf',
        });
      } else {
        // iOS Specific: Sharing module handles PDFs perfectly
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
            <TouchableOpacity style={styles.onlineBtn} onPress={() => handleOnlineView(item.website_url)}>
              <Ionicons name="globe-outline" size={18} color="#fff" />
              <Text style={styles.btnText}>Online</Text>
            </TouchableOpacity>
          )}

          {item.pdf_url && (
            isDownloaded ? (
              // Show READ button and DUSTBIN icon side-by-side
              <View style={styles.downloadedActions}>
                <TouchableOpacity style={styles.openBtn} onPress={() => handleOpenPdf(item.id)}>
                  <Ionicons name="book-outline" size={18} color="#fff" />
                  <Text style={styles.btnText}>Read</Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item)}>
                  <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                </TouchableOpacity>
              </View>

            ) : isDownloading ? (
              <View style={styles.loadingBtn}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={{color: colors.primary, fontSize: 11, marginTop: 4, fontWeight: 'bold'}}>{progress}%</Text>
              </View>
            ) : (
              <TouchableOpacity style={[styles.downloadBtn, { borderColor: colors.primary }]} onPress={() => handleDownload(item)}>
                <Ionicons name="download-outline" size={20} color={colors.primary} />
              </TouchableOpacity>
            )
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.navigate('Books')} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
          <Text style={[styles.backText, { color: colors.primary }]}>Back</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.banner, { backgroundColor: 'rgba(0, 240, 255, 0.1)' }]}>
        <Text style={[styles.bannerText, { color: colors.text }]}>To view official EGW Estate Tamil resources online, visit:</Text>
        <TouchableOpacity onPress={() => handleOnlineView('https://m.egwwritings.org/ta/folders/1082')}>
          <Text style={[styles.bannerLink, { color: colors.primary }]}>m.egwwritings.org</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={EGW_BOOKS_DATA}
        keyExtractor={(item) => item.id}
        renderItem={renderBookItem}
        contentContainerStyle={{ paddingBottom: 20, paddingTop: 10 }}
        removeClippedSubviews={true}
        maxToRenderPerBatch={5}
        windowSize={5}
        initialNumToRender={8}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', padding: 16, alignItems: 'center' },
  backButton: { flexDirection: 'row', alignItems: 'center' },
  backText: { fontSize: 16, marginLeft: 8, fontWeight: 'bold' },
  banner: { padding: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255, 255, 255, 0.05)' },
  bannerText: { fontSize: 13, textAlign: 'center' },
  bannerLink: { fontSize: 14, fontWeight: 'bold', textAlign: 'center', marginTop: 4 },
  
  bookCard: { marginHorizontal: 16, marginTop: 12, padding: 16, borderRadius: 12, borderWidth: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  iconCircle: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 12, marginTop: 2 },
  bookInfo: { flex: 1, marginBottom: 12 },
  
  titleTamil: { fontSize: 18, fontFamily: 'Tamil003', lineHeight: 26 }, // Custom font fixed
  titleEnglish: { fontSize: 13, marginTop: 2 },
  
  actionButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 8 },
  downloadedActions: { flexDirection: 'row', gap: 10, alignItems: 'center' }, // Layout for Read + Delete
  
  onlineBtn: { flexDirection: 'row', backgroundColor: '#F5A623', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  openBtn: { flexDirection: 'row', backgroundColor: '#4CAF50', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  
  // Dustbin Button Styles
  deleteBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: 'rgba(255,59,48,0.1)', justifyContent: 'center', alignItems: 'center' },
  
  downloadBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  loadingBtn: { paddingHorizontal: 14, paddingVertical: 4, justifyContent: 'center', alignItems: 'center' },
  btnText: { color: '#fff', marginLeft: 6, fontSize: 14, fontWeight: 'bold' }
});
