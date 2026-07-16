import React, { useState, useEffect } from 'react';
import { View, Text, Switch, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert, ActivityIndicator, LayoutAnimation, UIManager, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSettings } from '../context/SettingsContext';
import { useNavigation } from '@react-navigation/native';
import { EGW_BOOKS_DATA } from '../data/egwBooks'; 

// Enable LayoutAnimation for Android
// LayoutAnimation is enabled by default in the New Architecture.
// if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
//   UIManager.setLayoutAnimationEnabledExperimental(true);
// }

const PROTECTED_DBS = ['KJV.db', 'TAMIL.db', 'zion.db', 'Zion.db', 'Thirumarai.db', 'cross_references.db', 'UserData.db', 'UserData.db-journal'];

const DICTIONARY_FILES = {
  'easton_ebd2.db': 'Easton’s Dictionary',
  'hastings_dict_bible.db': 'Hastings’ Dictionary',
  'hitchcock_bible_names.db': 'Hitchcock’s Names',
  'smith_bibledict.db': 'Smith’s Dictionary'
};

const CONCORDANCE_FILE = 'bible_concordance_final.db';
const STUDY_DB_FILE = 'study_optimized.db';
const MAPS_FOLDER = 'BibleMaps';

export default function SettingsScreen() {
  const navigation = useNavigation();
  const { colors, isDark, appFontSize, setAppFontSize, hapticsEnabled, setHapticsEnabled, activeEnglishVersion, setActiveEnglishVersion } = useSettings();

  const [showStorageModal, setShowStorageModal] = useState(false);
  const [downloadedBibles, setDownloadedBibles] = useState([]);
  const [downloadedDicts, setDownloadedDicts] = useState([]);
  const [downloadedMagazines, setDownloadedMagazines] = useState([]);
  const [downloadedEGWBooks, setDownloadedEGWBooks] = useState([]); 
  const [isConcordanceDownloaded, setIsConcordanceDownloaded] = useState(false);
  const [isStudyDownloaded, setIsStudyDownloaded] = useState(false);

  // Accordion state (null means all closed, otherwise stores the active section key)
  const [expandedSection, setExpandedSection] = useState(null);

  const fetchDownloadedVersions = async () => {
    try {
      const sqliteDirectory = FileSystem.documentDirectory + 'SQLite';
      const dirInfo = await FileSystem.getInfoAsync(sqliteDirectory);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(sqliteDirectory, { intermediates: true });
      }
      
      const files = await FileSystem.readDirectoryAsync(sqliteDirectory);
      const dictFilesArray = Object.keys(DICTIONARY_FILES);
      
      const bibles = files.filter(f => 
        f.endsWith('.db') && 
        !PROTECTED_DBS.includes(f) && 
        !dictFilesArray.includes(f) && 
        f.toLowerCase() !== CONCORDANCE_FILE &&
        f.toLowerCase() !== STUDY_DB_FILE &&
        !f.toLowerCase().includes('concordance')
      );
      const dicts = files.filter(f => dictFilesArray.includes(f));
      const magazines = files.filter(f => f.startsWith('mag_') && f.endsWith('.pdf'));
      
      setDownloadedBibles(bibles);
      setDownloadedDicts(dicts);
      setDownloadedMagazines(magazines);
      
      const concPath = sqliteDirectory + '/' + CONCORDANCE_FILE;
      const concInfo = await FileSystem.getInfoAsync(concPath);
      setIsConcordanceDownloaded(concInfo.exists && concInfo.size > 100 * 1024);

      const studyPath = sqliteDirectory + '/' + STUDY_DB_FILE;
      const studyInfo = await FileSystem.getInfoAsync(studyPath);
      setIsStudyDownloaded(studyInfo.exists && studyInfo.size > 100 * 1024);

      const rootFiles = await FileSystem.readDirectoryAsync(FileSystem.documentDirectory);
      const egwPdfs = rootFiles.filter(f => f.endsWith('.pdf') && !f.startsWith('mag_'));
      
      const matchedBooks = [];
      for (let file of egwPdfs) {
        const bookId = file.replace('.pdf', '');
        const bookData = EGW_BOOKS_DATA.find(b => b.id === bookId);
        if (bookData) {
          matchedBooks.push(bookData);
        }
      }
      setDownloadedEGWBooks(matchedBooks);
      
    } catch (error) {
      console.log("Error reading versions:", error);
    }
  };

  useEffect(() => {
    if (showStorageModal) {
      fetchDownloadedVersions();
    }
  }, [showStorageModal]);

  const toggleHaptics = () => {
    if (!hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); 
    setHapticsEnabled(!hapticsEnabled);
  };

  const toggleSection = (section) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedSection(prev => (prev === section ? null : section));
  };

  const getDisplayName = (fileName) => {
    if (fileName.startsWith('mag_')) return fileName.replace('mag_', '').replace('.pdf', '');
    if (DICTIONARY_FILES[fileName]) return DICTIONARY_FILES[fileName];
    if (fileName.toLowerCase() === CONCORDANCE_FILE) return "Strong's Concordance";
    return fileName.replace('.db', '');
  };

  const confirmDeleteEgwBook = (book) => {
    if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      "Delete Book",
      `Are you sure you want to permanently delete "${book.title_english}"?`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive", 
          onPress: async () => {
            try {
              const uri = FileSystem.documentDirectory + `${book.id}.pdf`;
              await FileSystem.deleteAsync(uri, { idempotent: true });
              fetchDownloadedVersions();
            } catch (e) { console.log("Delete error:", e); }
          } 
        }
      ]
    );
  };

  const confirmDelete = (fileName) => {
    if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (fileName === 'study_package') {
      Alert.alert(
        "Delete Package",
        "Are you sure you want to permanently delete Bible Verse Explanations (Database & Maps)?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: () => deleteStudyPackage() }
        ]
      );
      return;
    }

    Alert.alert(
      "Delete File",
      `Are you sure you want to permanently delete ${getDisplayName(fileName)}?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => deleteVersion(fileName) }
      ]
    );
  };

  const deleteStudyPackage = async () => {
    if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      const dbUri = FileSystem.documentDirectory + 'SQLite/' + STUDY_DB_FILE;
      const mapsUri = FileSystem.documentDirectory + MAPS_FOLDER;
      
      await FileSystem.deleteAsync(dbUri, { idempotent: true });
      await FileSystem.deleteAsync(mapsUri, { idempotent: true });
      
      setIsStudyDownloaded(false);
      fetchDownloadedVersions();
    } catch (e) { console.log("Delete error:", e); }
  };

  const deleteVersion = async (fileName) => {
    if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      const uri = FileSystem.documentDirectory + 'SQLite/' + fileName;
      await FileSystem.deleteAsync(uri, { idempotent: true });
      
      if (fileName.toLowerCase() === CONCORDANCE_FILE) {
        setIsConcordanceDownloaded(false);
      } else if (!fileName.startsWith('mag_')) {
        const versionId = fileName.replace('.db', '');
        if (activeEnglishVersion === versionId) {
          setActiveEnglishVersion('KJV');
        }
      }
      fetchDownloadedVersions();
    } catch (e) { console.log("Delete error:", e); }
  };

  // Helper to render accordion headers
  const renderAccordionHeader = (title, sectionKey, count) => {
    const isExpanded = expandedSection === sectionKey;
    return (
      <TouchableOpacity 
        activeOpacity={0.8} 
        onPress={() => toggleSection(sectionKey)} 
        style={[
          styles.accordionHeader, 
          { backgroundColor: isExpanded ? 'rgba(0, 240, 255, 0.05)' : colors.card, borderColor: isExpanded ? colors.primary : colors.border }
        ]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ color: isExpanded ? colors.primary : colors.text, fontSize: appFontSize, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 }}>{title}</Text>
          <Text style={{ color: colors.subtext, fontSize: appFontSize - 2, marginLeft: 8 }}>({count})</Text>
        </View>
        <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={20} color={isExpanded ? colors.primary : colors.subtext} />
      </TouchableOpacity>
    );
  };

  const toolsCount = (isStudyDownloaded ? 1 : 0) + (isConcordanceDownloaded ? 1 : 0);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient colors={isDark ? ['#0A1929', colors.background] : ['#FFFFFF', colors.background]} style={StyleSheet.absoluteFillObject} />
      
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        
        <View style={[styles.header, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 5 }}>
            <Ionicons name="arrow-back" size={26} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text, fontSize: appFontSize + 12 }]}>Settings</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
          
          <Text style={[styles.sectionTitle, { color: colors.primary, fontSize: appFontSize - 3 }]}>APPEARANCE & FEEL</Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.cardRow}>
              <View style={styles.rowLeft}>
                <Ionicons name="phone-portrait-outline" size={24} color={colors.text} />
                <Text style={[styles.rowText, { color: colors.text, fontSize: appFontSize + 1 }]}>Haptic Feedback</Text>
              </View>
              <Switch value={hapticsEnabled} onValueChange={toggleHaptics} trackColor={{ false: '#ccc', true: colors.primary }} thumbColor={'#fff'} />
            </View>
          </View>

          <Text style={[styles.sectionTitle, { color: colors.primary, marginTop: 30, fontSize: appFontSize - 3 }]}>GLOBAL APP TEXT SIZE</Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, paddingVertical: 20 }]}>
            <Text style={{ color: colors.subtext, marginBottom: 10, fontSize: appFontSize }}>App Font Size: {appFontSize}</Text>
            <Slider minimumValue={12} maximumValue={24} step={1} value={appFontSize} onValueChange={setAppFontSize} minimumTrackTintColor={colors.primary} maximumTrackTintColor={colors.border} />
          </View>

          <Text style={[styles.sectionTitle, { color: colors.primary, marginTop: 30, fontSize: appFontSize - 3 }]}>MANAGE STORAGE</Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, paddingHorizontal: 0 }]}>
            <TouchableOpacity 
              style={[styles.cardRow, { paddingHorizontal: 20 }]} 
              onPress={() => {
                if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowStorageModal(true);
              }}
            >
              <View style={styles.rowLeft}>
                <Ionicons name="server-outline" size={24} color={colors.text} />
                <Text style={[styles.rowText, { color: colors.text, fontSize: appFontSize + 1 }]}>Downloaded Databases</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.subtext} />
            </TouchableOpacity>
          </View>

        </ScrollView>
      </SafeAreaView>

      <Modal visible={showStorageModal} animationType="slide" transparent={true}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <BlurView intensity={isDark ? 50 : 80} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFillObject} />
          <View style={[styles.modalSheet, { backgroundColor: isDark ? '#12161E' : '#FFFFFF', borderColor: colors.border }]}>
            
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <View style={{ width: 34 }} />
              <Text style={{ color: colors.text, fontSize: appFontSize + 2, fontWeight: 'bold' }}>Manage Storage</Text>
              <TouchableOpacity onPress={() => { if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowStorageModal(false); }} style={{ padding: 5 }}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
              
              {/* SECTION: Deep Study Tools */}
              {renderAccordionHeader('Deep Study Tools', 'tools', toolsCount)}
              {expandedSection === 'tools' && (
                <View style={styles.accordionContent}>
                  <View style={[styles.versionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      <Ionicons name="library" size={24} color={isStudyDownloaded ? colors.primary : colors.subtext} style={{ marginRight: 15 }} />
                      <View style={{ flex: 1, paddingRight: 10 }}>
                        <Text style={{ color: colors.text, fontSize: appFontSize + 2, fontWeight: 'bold' }}>Bible Verse Explanations</Text>
                      </View>
                    </View>
                    {isStudyDownloaded ? (
                      <TouchableOpacity onPress={() => confirmDelete('study_package')} style={{ padding: 10, backgroundColor: 'rgba(255,59,48,0.1)', borderRadius: 10 }}>
                        <Ionicons name="trash" size={20} color="#FF3B30" />
                      </TouchableOpacity>
                    ) : (
                      <Text style={{ color: colors.subtext, fontSize: appFontSize - 2, fontStyle: 'italic' }}>Not Downloaded</Text>
                    )}
                  </View>

                  <View style={[styles.versionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      <Ionicons name="layers" size={24} color={isConcordanceDownloaded ? colors.primary : colors.subtext} style={{ marginRight: 15 }} />
                      <View style={{ flex: 1, paddingRight: 10 }}>
                        <Text style={{ color: colors.text, fontSize: appFontSize + 2, fontWeight: 'bold' }}>Strong's Concordance</Text>
                      </View>
                    </View>
                    {isConcordanceDownloaded ? (
                      <TouchableOpacity onPress={() => confirmDelete(CONCORDANCE_FILE)} style={{ padding: 10, backgroundColor: 'rgba(255,59,48,0.1)', borderRadius: 10 }}>
                        <Ionicons name="trash" size={20} color="#FF3B30" />
                      </TouchableOpacity>
                    ) : (
                      <Text style={{ color: colors.subtext, fontSize: appFontSize - 2, fontStyle: 'italic' }}>Not Downloaded</Text>
                    )}
                  </View>
                </View>
              )}

              {/* SECTION: EGW Books */}
              {renderAccordionHeader('EGW Books', 'egw', downloadedEGWBooks.length)}
              {expandedSection === 'egw' && (
                <View style={styles.accordionContent}>
                  {downloadedEGWBooks.length === 0 ? (
                    <Text style={[styles.emptyText, { color: colors.subtext, fontSize: appFontSize }]}>No EGW Books downloaded yet.</Text>
                  ) : (
                    downloadedEGWBooks.map((book) => (
                      <View key={book.id} style={[styles.versionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 10 }}>
                          <Ionicons name={book.icon || "book"} size={24} color={colors.primary} style={{ marginRight: 15 }} />
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: colors.text, fontSize: appFontSize + 1, fontWeight: 'bold' }} numberOfLines={1}>{book.title_english}</Text>
                            <Text style={{ color: colors.subtext, fontSize: appFontSize - 2, marginTop: 2 }} numberOfLines={1}>{book.title_tamil}</Text>
                          </View>
                        </View>
                        <TouchableOpacity onPress={() => confirmDeleteEgwBook(book)} style={{ padding: 10, backgroundColor: 'rgba(255,59,48,0.1)', borderRadius: 10 }}>
                          <Ionicons name="trash" size={20} color="#FF3B30" />
                        </TouchableOpacity>
                      </View>
                    ))
                  )}
                </View>
              )}

              {/* SECTION: Monthly Magazine */}
              {renderAccordionHeader('Monthly Magazine', 'mag', downloadedMagazines.length)}
              {expandedSection === 'mag' && (
                <View style={styles.accordionContent}>
                  {downloadedMagazines.length === 0 ? (
                    <Text style={[styles.emptyText, { color: colors.subtext, fontSize: appFontSize }]}>No magazines downloaded yet.</Text>
                  ) : (
                    downloadedMagazines.map((item) => (
                      <View key={item} style={[styles.versionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 10 }}>
                          <Ionicons name="document-text" size={24} color={colors.primary} style={{ marginRight: 15 }} />
                          <Text style={{ color: colors.text, fontSize: appFontSize + 1, fontWeight: 'bold' }} numberOfLines={1}>{getDisplayName(item)}</Text>
                        </View>
                        <TouchableOpacity onPress={() => confirmDelete(item)} style={{ padding: 10, backgroundColor: 'rgba(255,59,48,0.1)', borderRadius: 10 }}>
                          <Ionicons name="trash" size={20} color="#FF3B30" />
                        </TouchableOpacity>
                      </View>
                    ))
                  )}
                </View>
              )}

              {/* SECTION: Bible Versions */}
              {renderAccordionHeader('Bible Versions', 'bibles', downloadedBibles.length)}
              {expandedSection === 'bibles' && (
                <View style={styles.accordionContent}>
                  {downloadedBibles.length === 0 ? (
                    <Text style={[styles.emptyText, { color: colors.subtext, fontSize: appFontSize }]}>No extra Bible versions downloaded.</Text>
                  ) : (
                    downloadedBibles.map((item) => (
                      <View key={item} style={[styles.versionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                          <Ionicons name="book" size={24} color={colors.primary} style={{ marginRight: 15 }} />
                          <Text style={{ color: colors.text, fontSize: appFontSize + 2, fontWeight: 'bold' }}>{getDisplayName(item)}</Text>
                        </View>
                        <TouchableOpacity onPress={() => confirmDelete(item)} style={{ padding: 10, backgroundColor: 'rgba(255,59,48,0.1)', borderRadius: 10 }}>
                          <Ionicons name="trash" size={20} color="#FF3B30" />
                        </TouchableOpacity>
                      </View>
                    ))
                  )}
                </View>
              )}

              {/* SECTION: Dictionaries */}
              {renderAccordionHeader('Dictionaries', 'dicts', downloadedDicts.length)}
              {expandedSection === 'dicts' && (
                <View style={styles.accordionContent}>
                  {downloadedDicts.length === 0 ? (
                    <Text style={[styles.emptyText, { color: colors.subtext, fontSize: appFontSize }]}>No dictionaries downloaded yet.</Text>
                  ) : (
                    downloadedDicts.map((item) => (
                      <View key={item} style={[styles.versionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 10 }}>
                          <Ionicons name="library" size={24} color={colors.primary} style={{ marginRight: 15 }} />
                          <Text style={{ color: colors.text, fontSize: appFontSize + 1, fontWeight: 'bold' }} numberOfLines={1}>{getDisplayName(item)}</Text>
                        </View>
                        <TouchableOpacity onPress={() => confirmDelete(item)} style={{ padding: 10, backgroundColor: 'rgba(255,59,48,0.1)', borderRadius: 10 }}>
                          <Ionicons name="trash" size={20} color="#FF3B30" />
                        </TouchableOpacity>
                      </View>
                    ))
                  )}
                </View>
              )}

            </ScrollView>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  headerTitle: { fontWeight: '900' },
  sectionTitle: { fontWeight: 'bold', letterSpacing: 1, marginBottom: 10, marginLeft: 5 },
  card: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 20, overflow: 'hidden' },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15 },
  rowLeft: { flexDirection: 'row', alignItems: 'center' },
  rowText: { marginLeft: 15, fontWeight: '500' },
  modalSheet: { width: '100%', height: '70%', borderTopLeftRadius: 30, borderTopRightRadius: 30, borderWidth: 1, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1 },
  
  // Accordion Styles
  accordionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderRadius: 14, borderWidth: 1, marginTop: 10, marginBottom: 5 },
  accordionContent: { paddingBottom: 10, paddingTop: 5 },
  emptyText: { textAlign: 'center', marginVertical: 10, fontStyle: 'italic' },
  versionCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderWidth: 1, borderRadius: 12, marginBottom: 8 }
});
