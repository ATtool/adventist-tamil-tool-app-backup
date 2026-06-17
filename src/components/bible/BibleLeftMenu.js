import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Animated, Dimensions, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import Slider from '@react-native-community/slider';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import { useSettings } from '../../context/SettingsContext';
import booksData from '../../data/books.json'; 
import { querySync, executeRunSync } from '../../utils/DatabaseManager';

const { width } = Dimensions.get('window');

const VERSIONS = [
  { id: 'AMP', name: 'Amplified Bible', url: 'https://drive.google.com/uc?export=download&id=1a-WZVLodq52U4jBWlySTxdwbughOKN8Q' },
  { id: 'CSB', name: 'Christian Standard Bible', url: 'https://drive.google.com/uc?export=download&id=1CDcPeHjnigch-9Rn5wyIMfw-Fp_hhiF1' },
  { id: 'ESV', name: 'English Standard Version', url: 'https://drive.google.com/uc?export=download&id=1T9mwzC-msvfNttjtcnKrXzOZUATmlc_8' },
  { id: 'LSB', name: 'Legacy Standard Bible', url: 'https://drive.google.com/uc?export=download&id=1TL_OvmpEicyS0HZzF8HEDtyEwTq0WdPE' },
  { id: 'NIV', name: 'New International Version', url: 'https://drive.google.com/uc?export=download&id=1BhFsInDK5EVEH0N-XrDXBoC8PAL4XARS' },
  { id: 'NKJV', name: 'New King James Version', url: 'https://drive.google.com/uc?export=download&id=1rk6aVTG6mb6O7mIajcpy2j8Oam1OUGHC' },
  { id: 'NLT', name: 'New Living Translation', url: 'https://drive.google.com/uc?export=download&id=1nIbvZYfUs66r9P-GUKgRxB9a0yiNOCdX' }
];

export default function BibleLeftMenu({ visible, onClose, onJumpToVerse, onDataChange }) {
  const { colors, isDark, appFontSize, hapticsEnabled, bibleLanguage, setBibleLanguage, activeEnglishVersion, setActiveEnglishVersion, bibleFontSize, setBibleFontSize, bibleLineHeight, setBibleLineHeight, bibleLetterSpacing, setBibleLetterSpacing, restoreDefaultTextSettings } = useSettings();

  const [isModalVisible, setIsModalVisible] = useState(false); // Added for smooth exit animation
  const [activeView, setActiveView] = useState('main'); 
  const [downloadedDBs, setDownloadedDBs] = useState([]);
  const [downloadingId, setDownloadingId] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [myFavorites, setMyFavorites] = useState([]);

  // Animation Refs
  const slideAnim = React.useRef(new Animated.Value(-width)).current;
  const fadeAnim = React.useRef(new Animated.Value(0)).current; // Added for background fade

  useEffect(() => {
    if (visible) {
      setIsModalVisible(true);
      checkDownloadedVersions();
      fetchUserData();
      // Smooth Entrance
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, friction: 9, tension: 60, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true })
      ]).start();
    } else {
      // Smooth Exit
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: -width, duration: 250, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 0, duration: 250, useNativeDriver: true })
      ]).start(() => {
        setIsModalVisible(false);
        setActiveView('main');
      });
    }
  }, [visible]);

  function triggerHaptic(style = Haptics.ImpactFeedbackStyle.Light) {
    if (hapticsEnabled) Haptics.impactAsync(style);
  }

  function closeMenu() { triggerHaptic(); onClose(); }

  function getBookName(id) {
    const book = booksData.find(b => b.id === id);
    return book ? (bibleLanguage === 'english' ? book.name_en : book.name_ta) : '';
  }

  async function checkDownloadedVersions() {
    try {
      const sqliteDirectory = FileSystem.documentDirectory + 'SQLite';
      const files = await FileSystem.readDirectoryAsync(sqliteDirectory);
      const FILES_TO_HIDE = ['bible_concordance.db', 'easton_ebd2.db', 'smith_bibledict.db', 'hastings_dict_bible.db', 'hitchcock_bible_names.db'];
      const filteredFiles = files.filter(f => !FILES_TO_HIDE.includes(f));
      setDownloadedDBs(filteredFiles);
    } catch (e) { console.log(e); }
  }

  function fetchUserData() {
    try {
      if (activeView === 'favorites' || visible) {
        const favs = querySync('UserData.db', `SELECT * FROM favorites ORDER BY id DESC`, []) || [];
        setMyFavorites(favs);
      }
    } catch (e) {}
  }

  function deleteFavorite(id) {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    try {
      executeRunSync('UserData.db', `DELETE FROM favorites WHERE id = ?`, [id]);
      fetchUserData();
      if (onDataChange) onDataChange(); 
    } catch (e) {}
  }

  async function downloadVersion(version) {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    setDownloadingId(version.id); setDownloadProgress(0);
    const uri = FileSystem.documentDirectory + 'SQLite/' + version.id + '.db';
    try {
      const resumable = FileSystem.createDownloadResumable(version.url, uri, {}, (p) => setDownloadProgress(p.totalBytesWritten / p.totalBytesExpectedToWrite));
      await resumable.downloadAsync();
      triggerHaptic(Haptics.ImpactFeedbackStyle.Success);
      await checkDownloadedVersions();
    } catch (e) { Alert.alert('Download Failed', 'Check your internet.'); } 
    finally { setDownloadingId(null); }
  }

  async function deleteVersion(versionId) {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      const uri = FileSystem.documentDirectory + 'SQLite/' + versionId + '.db';
      await FileSystem.deleteAsync(uri, { idempotent: true });
      if (activeEnglishVersion === versionId) setActiveEnglishVersion('KJV'); 
      await checkDownloadedVersions();
    } catch (e) {}
  }

  function renderHeader(title, showBack = true) {
    return (
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        {showBack ? (
          <TouchableOpacity onPress={() => { triggerHaptic(); setActiveView('main'); }} style={styles.iconBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
        ) : <View style={{ width: 34 }} />}
        <Text style={{ color: colors.primary, fontSize: appFontSize + 4, fontWeight: '900' }}>{title}</Text>
        <TouchableOpacity onPress={closeMenu} style={styles.iconBtn}>
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>
    );
  }

  function renderMenuItem(icon, title, viewTarget) {
    return (
      <TouchableOpacity style={[styles.menuItem, { borderBottomColor: colors.border }]} onPress={() => { triggerHaptic(); setActiveView(viewTarget); }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}><Ionicons name={icon} size={24} color={colors.subtext} style={{ marginRight: 15 }} /><Text style={{ color: colors.text, fontSize: appFontSize + 2, fontWeight: 'bold' }}>{title}</Text></View>
        <Ionicons name="chevron-forward" size={20} color={colors.subtext} />
      </TouchableOpacity>
    );
  }

  return (
    <Modal visible={isModalVisible} transparent animationType="none">
      <View style={styles.overlay}>
        {/* Animated Background Overlay */}
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim }]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={closeMenu} activeOpacity={1}>
            <BlurView intensity={isDark ? 50 : 20} tint="dark" style={StyleSheet.absoluteFillObject} />
          </TouchableOpacity>
        </Animated.View>

        {/* Animated Sliding Menu */}
        <Animated.View style={[styles.panel, { backgroundColor: isDark ? '#0A1929' : '#FCFAF5', borderRightColor: colors.border, transform: [{ translateX: slideAnim }] }]}>
          
          {activeView === 'main' && (
            <View style={{ flex: 1 }}>
              {renderHeader('Bible Tools', false)}
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={{ paddingVertical: 10 }}>
                  {renderMenuItem('language', 'Language & Versions', 'language')}
                  {renderMenuItem('cloud-download', 'Download Bible Versions', 'downloads')}
                  {renderMenuItem('heart', 'My Favorites', 'favorites')}
                  {renderMenuItem('text', 'Display Settings', 'display')}
                </View>
              </ScrollView>
            </View>
          )}

          {activeView === 'language' && (
            <View style={{ flex: 1 }}>{renderHeader('Language')}
              <ScrollView contentContainerStyle={{ padding: 20 }}>
                <Text style={{ color: colors.subtext, fontSize: appFontSize - 2, fontWeight: 'bold', marginBottom: 15, textTransform: 'uppercase' }}>Reading Mode</Text>
                {['tamil', 'english', 'both'].map((lang) => (
                  <TouchableOpacity key={lang} style={[styles.optionCard, { backgroundColor: colors.card, borderColor: bibleLanguage === lang ? colors.primary : colors.border }]} onPress={() => { triggerHaptic(); setBibleLanguage(lang); }}>
                    <Text style={{ color: bibleLanguage === lang ? colors.primary : colors.text, fontSize: appFontSize, fontWeight: 'bold', textTransform: 'capitalize' }}>{lang === 'both' ? 'Parallel (Tamil & English)' : lang}</Text>
                    {bibleLanguage === lang && <Ionicons name="checkmark-circle" size={24} color={colors.primary} />}
                  </TouchableOpacity>
                ))}

                {(bibleLanguage === 'english' || bibleLanguage === 'both') && (
                  <>
                    <Text style={{ color: colors.subtext, fontSize: appFontSize - 2, fontWeight: 'bold', marginTop: 30, marginBottom: 15, textTransform: 'uppercase' }}>Active English Version</Text>
                    {['KJV', ...VERSIONS.map(ver => ver.id).filter(id => downloadedDBs.includes(`${id}.db`))].map((v) => (
                      <TouchableOpacity key={v} style={[styles.optionCard, { backgroundColor: colors.card, borderColor: activeEnglishVersion === v ? colors.primary : colors.border }]} onPress={() => { triggerHaptic(); setActiveEnglishVersion(v); }}>
                        <Text style={{ color: activeEnglishVersion === v ? colors.primary : colors.text, fontSize: appFontSize, fontWeight: 'bold' }}>{v}</Text>
                        {activeEnglishVersion === v && <Ionicons name="checkmark-circle" size={24} color={colors.primary} />}
                      </TouchableOpacity>
                    ))}
                  </>
                )}
              </ScrollView>
            </View>
          )}

          {activeView === 'downloads' && (
            <View style={{ flex: 1 }}>{renderHeader('Downloads')}
              <ScrollView contentContainerStyle={{ padding: 20 }}>
                {VERSIONS.map((v) => {
                  const isDownloaded = downloadedDBs.includes(`${v.id}.db`);
                  const isDownloading = downloadingId === v.id;
                  return (
                    <View key={v.id} style={[styles.downloadCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <View style={{ flex: 1 }}><Text style={{ color: colors.text, fontSize: appFontSize, fontWeight: 'bold' }}>{v.name}</Text><Text style={{ color: colors.subtext, fontSize: appFontSize - 2 }}>{v.id}</Text></View>
                      {isDownloading ? <Text style={{ color: colors.primary, fontWeight: 'bold' }}>{(downloadProgress * 100).toFixed(0)}%</Text> : isDownloaded ? (
                        <TouchableOpacity onPress={() => deleteVersion(v.id)} style={{ padding: 10, backgroundColor: 'rgba(255,59,48,0.1)', borderRadius: 10 }}><Ionicons name="trash" size={20} color="#FF3B30" /></TouchableOpacity>
                      ) : (
                        <TouchableOpacity onPress={() => downloadVersion(v)} style={{ padding: 10, backgroundColor: colors.glow, borderRadius: 10 }}><Ionicons name="download" size={20} color={colors.primary} /></TouchableOpacity>
                      )}
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {activeView === 'display' && (
            <View style={{ flex: 1 }}>{renderHeader('Display')}
              <ScrollView contentContainerStyle={{ padding: 20 }}>
                <Text style={{ color: colors.subtext, fontSize: appFontSize - 2, fontWeight: 'bold', marginBottom: 15, textTransform: 'uppercase' }}>Text Size: {bibleFontSize}</Text>
                <Slider minimumValue={14} maximumValue={40} step={1} value={bibleFontSize} onValueChange={setBibleFontSize} minimumTrackTintColor={colors.primary} maximumTrackTintColor={colors.border} />

                <Text style={{ color: colors.subtext, fontSize: appFontSize - 2, fontWeight: 'bold', marginTop: 30, marginBottom: 15, textTransform: 'uppercase' }}>Line Spacing: {bibleLineHeight}</Text>
                <Slider minimumValue={20} maximumValue={60} step={1} value={bibleLineHeight} onValueChange={setBibleLineHeight} minimumTrackTintColor={colors.primary} maximumTrackTintColor={colors.border} />

                <Text style={{ color: colors.subtext, fontSize: appFontSize - 2, fontWeight: 'bold', marginTop: 30, marginBottom: 15, textTransform: 'uppercase' }}>Letter Spacing: {bibleLetterSpacing}</Text>
                <Slider minimumValue={0} maximumValue={5} step={0.5} value={bibleLetterSpacing} onValueChange={setBibleLetterSpacing} minimumTrackTintColor={colors.primary} maximumTrackTintColor={colors.border} />

                <TouchableOpacity style={[styles.optionCard, { justifyContent: 'center', backgroundColor: colors.glow, borderColor: colors.primary, marginTop: 40 }]} onPress={() => { triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy); restoreDefaultTextSettings(); }}>
                  <Ionicons name="refresh" size={20} color={colors.primary} style={{ marginRight: 10 }} /><Text style={{ color: colors.primary, fontSize: appFontSize, fontWeight: 'bold' }}>Restore Default Settings</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          )}

          {activeView === 'favorites' && (
            <View style={{ flex: 1 }}>{renderHeader('My Favorites')}
              <ScrollView contentContainerStyle={{ padding: 20 }}>
                {myFavorites.length === 0 && <Text style={{ color: colors.subtext, textAlign: 'center', marginTop: 20 }}>No favorites saved yet.</Text>}
                {myFavorites.map(f => (
                  <View key={f.id} style={[styles.userDataCard, { backgroundColor: colors.card, borderColor: colors.border, flexDirection: 'row', alignItems: 'center' }]}>
                    <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }} onPress={() => onJumpToVerse(f.book_id, f.chapter, f.verse)}>
                      <Ionicons name="heart" size={20} color="#FF3B30" style={{ marginRight: 10 }} />
                      <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: appFontSize }}>
                        {getBookName(f.book_id)} {f.chapter}:{f.verse}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => deleteFavorite(f.id)} style={{ padding: 5 }}><Ionicons name="trash" size={18} color="#FF3B30" /></TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, flexDirection: 'row' },
  panel: { width: '85%', height: '100%', borderRightWidth: 1, paddingTop: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15, paddingBottom: 20, borderBottomWidth: 1 },
  iconBtn: { padding: 5 },
  menuItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1 },
  optionCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 15, borderWidth: 1, borderRadius: 15, marginBottom: 10 },
  downloadCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderWidth: 1, borderRadius: 15, marginBottom: 10 },
  userDataCard: { padding: 15, borderWidth: 1, borderRadius: 15, marginBottom: 10 }
});
