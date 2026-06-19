import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Animated, Dimensions, Share, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSettings } from '../context/SettingsContext';
import * as SQLite from 'expo-sqlite';
import * as Haptics from 'expo-haptics';
import Slider from '@react-native-community/slider';
import QRCode from 'react-native-qrcode-svg';

// Firebase Imports
import { ref, set } from "firebase/database";
import { db } from "../../firebaseSetup"; // Going up two folders to find the setup file!

import booksData from '../data/books.json';

const { height, width } = Dimensions.get('window');

export default function ViewService() {
  const navigation = useNavigation();
  const route = useRoute();
  const { service } = route.params; 
  
  const { colors, isDark, appFontSize, hapticsEnabled, lyricsSize, setLyricsSize, lyricsSpacing, setLyricsSpacing, lyricsLineHeight, setLyricsLineHeight, restoreDefaultTextSettings } = useSettings();

  const [expandedId, setExpandedId] = useState(null);
  const [fetchedContent, setFetchedContent] = useState({});
  const [isLoadingContent, setIsLoadingContent] = useState(false);

  // Modals & Firebase State
  const [showTextSettings, setShowTextSettings] = useState(false);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [shareId, setShareId] = useState(null);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  
  const settingsSlideAnim = useRef(new Animated.Value(height)).current;
  const settingsFadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (showTextSettings) {
      setSettingsModalVisible(true);
      Animated.parallel([
        Animated.spring(settingsSlideAnim, { toValue: 0, friction: 9, tension: 65, useNativeDriver: true }),
        Animated.timing(settingsFadeAnim, { toValue: 1, duration: 200, useNativeDriver: true })
      ]).start();
    } else if (settingsModalVisible) {
      Animated.parallel([
        Animated.timing(settingsSlideAnim, { toValue: height, duration: 250, useNativeDriver: true }),
        Animated.timing(settingsFadeAnim, { toValue: 0, duration: 250, useNativeDriver: true })
      ]).start(() => setSettingsModalVisible(false));
    }
  }, [showTextSettings]);

  const triggerHaptic = (style = Haptics.ImpactFeedbackStyle.Light) => {
    if (hapticsEnabled) Haptics.impactAsync(style);
  };

  // --- OPEN INVITE MODAL & UPLOAD TO FIREBASE ---
  const handleOpenInviteModal = async () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    setShowInviteModal(true);
    
    // Only upload to Firebase if we haven't already generated an ID for this session
    if (!shareId) {
      setIsGeneratingLink(true);
      try {
        const shortId = Math.random().toString(36).substring(2, 8).toUpperCase(); // e.g. A7B9K2
        const serviceRef = ref(db, 'services/' + shortId);
        
        await set(serviceRef, service); // Uploads JSON to Firebase!
        setShareId(shortId);
        
      } catch (error) {
        console.error("Firebase Error:", error);
        Alert.alert("Connection Error", "Ensure you have internet access to generate a sharing link.");
        setShowInviteModal(false);
      } finally {
        setIsGeneratingLink(false);
      }
    }
  };

  const handleShareLink = async () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    const inviteLink = `https://adventisttamiltool.app/join?id=${shareId}`;
    let shareText = `*You're invited to join the service: ${service.name}*\n\nClick the link below to open the live agenda in your app:\n\n${inviteLink}`;

    try {
      await Share.share({ message: shareText });
    } catch (error) {
      console.warn("Error sharing:", error.message);
    }
  };

  // --- FETCH FROM SQLITE ---
  const handleExpand = async (block) => {
    triggerHaptic();
    if (expandedId === block.id) { setExpandedId(null); return; }
    setExpandedId(block.id);
    if (fetchedContent[block.id] || (!block.data.number && !block.data.chapter)) return;

    setIsLoadingContent(true);
    let content = '';
    
    try {
      if (block.category === 'song' && block.data.book && block.data.number) {
        let dbName = block.data.book === 'Zion' ? 'zion.db' : 'Thirumarai.db';
        const sqliteDb = await SQLite.openDatabaseAsync(dbName);
        let query = '';
        if (block.data.book === 'Zion') query = `SELECT lyrics FROM songs WHERE song_number = ? LIMIT 1`;
        else if (block.data.book === 'Hope') query = `SELECT lyrics FROM SongListTable WHERE Song_number_by_Nambikaiyen_Geethagal = ? LIMIT 1`;
        else if (block.data.book === 'Old') query = `SELECT lyrics FROM SongListTable WHERE song_number = ? LIMIT 1`;
        
        const result = await sqliteDb.getAllAsync(query, [block.data.number]);
        if (result && result.length > 0) content = result[0].lyrics; else content = "Lyrics not found.";
        await sqliteDb.closeAsync().catch(() => {});
      } 
      else if ((block.category === 'bible' || block.category === 'tithe') && block.data.book && block.data.chapter && block.data.verse) {
        const bookObj = booksData.find(b => b.name_ta === block.data.book);
        if (bookObj) {
          const sqliteDb = await SQLite.openDatabaseAsync('TAMIL.db');
          const tableRes = await sqliteDb.getAllAsync("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'android_metadata'");
          const query = `SELECT text FROM "${tableRes[0].name}" WHERE book_id = ? AND chapter = ? AND verse = ? LIMIT 1`;
          
          const result = await sqliteDb.getAllAsync(query, [bookObj.id, parseInt(block.data.chapter), parseInt(block.data.verse)]);
          if (result && result.length > 0) content = result[0].text; else content = "Verse not found.";
          await sqliteDb.closeAsync().catch(() => {});
        }
      }
    } catch (error) { content = "Error loading content."; }

    if (content) setFetchedContent(prev => ({ ...prev, [block.id]: content }));
    setIsLoadingContent(false);
  };

  const formattedDate = new Date(service.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        
        {/* PREMIUM HEADER */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
            <Ionicons name="chevron-back" size={28} color={colors.primary} />
          </TouchableOpacity>
          
          <Text style={[styles.headerTitle, { color: colors.text }]}>Live Service</Text>
          
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {/* Font Size Button */}
            <TouchableOpacity onPress={() => { triggerHaptic(); setShowTextSettings(true); }} style={{ marginRight: 12 }}>
              <View style={{ backgroundColor: colors.primary + '15', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 }}>
                <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: 16 }}>Aa</Text>
              </View>
            </TouchableOpacity>

            {/* 🔥 THE BRIGHT YELLOW INVITE BUTTON 🔥 */}
            <TouchableOpacity 
              onPress={handleOpenInviteModal}
              style={{ backgroundColor: '#FFCC00', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, flexDirection: 'row', alignItems: 'center', shadowColor: '#FFCC00', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 5 }}
            >
              <Ionicons name="qr-code-outline" size={16} color="#000" style={{ marginRight: 5 }} />
              <Text style={{ color: '#000', fontWeight: 'bold', fontSize: 15 }}>Invite</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* AGENDA LIST */}
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={[styles.titleCard, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }]}>
            <Text style={[styles.serviceName, { color: colors.primary }]}>{service.name}</Text>
            <Text style={[styles.serviceDate, { color: colors.text }]}>{formattedDate}</Text>
          </View>

          <View style={styles.agendaContainer}>
            {service.agenda.map((block, index) => {
              const isExpanded = expandedId === block.id;
              return (
                <View key={block.id} style={[styles.blockWrapper, { backgroundColor: colors.card, borderColor: isExpanded ? colors.primary : colors.border }]}>
                  <TouchableOpacity style={styles.blockHeader} activeOpacity={0.7} onPress={() => handleExpand(block)}>
                    <View style={styles.blockIndex}><Text style={{ color: colors.subtext, fontWeight: 'bold' }}>{index + 1}</Text></View>
                    <View style={[styles.blockIconBadge, { backgroundColor: block.color + '20' }]}><Ionicons name={block.icon} size={20} color={block.color} /></View>
                    <View style={{ flex: 1, marginLeft: 15 }}>
                      <Text style={{ color: colors.text, fontSize: 18, fontWeight: 'bold' }}>{block.title}</Text>
                      {block.category === 'song' && <Text style={{ color: colors.primary, fontSize: 14, marginTop: 2 }}>{block.data.book} #{block.data.number}</Text>}
                      {block.category === 'bible' && <Text style={{ color: colors.primary, fontSize: 14, marginTop: 2 }}>{block.data.book} {block.data.chapter}:{block.data.verse}</Text>}
                    </View>
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={[styles.expandedContent, { borderTopColor: colors.border, backgroundColor: isDark ? '#121212' : '#F9F9F9' }]}>
                      {isLoadingContent && (!fetchedContent[block.id]) ? <ActivityIndicator size="small" color={colors.primary} /> : (
                        <Text style={{ color: colors.text, fontSize: lyricsSize, lineHeight: lyricsLineHeight, letterSpacing: lyricsSpacing, fontFamily: block.category === 'song' ? 'Tamil003' : undefined }}>
                          {fetchedContent[block.id]}
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* INVITATION & QR MODAL */}
      <Modal visible={showInviteModal} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.qrModalContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
            
            <View style={styles.qrHeader}>
              <Text style={{ color: colors.text, fontSize: 20, fontWeight: 'bold' }}>Invite to Service</Text>
              <TouchableOpacity onPress={() => setShowInviteModal(false)}>
                <Ionicons name="close-circle" size={28} color={colors.subtext} />
              </TouchableOpacity>
            </View>

            {isGeneratingLink ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={{ color: colors.text, marginTop: 15 }}>Connecting to cloud...</Text>
              </View>
            ) : (
              <>
                <Text style={{ color: colors.subtext, textAlign: 'center', marginBottom: 20, fontSize: 15 }}>
                  Ask others to scan this QR code or share the link below to join instantly.
                </Text>

                {/* Perfect, Tiny QR Code! */}
                <View style={{ padding: 15, backgroundColor: '#FFFFFF', borderRadius: 16, alignSelf: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 }}>
                  <QRCode 
                    value={`https://adventisttamiltool.app/join?id=${shareId}`} 
                    size={220} 
                    color="#000000" 
                    backgroundColor="#FFFFFF" 
                  />
                </View>
                
                <Text style={{ color: colors.text, textAlign: 'center', marginTop: 15, fontWeight: 'bold', letterSpacing: 2, fontSize: 18 }}>
                  ID: {shareId}
                </Text>

                <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 20 }}>
                  <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
                </View>

                {/* Share Link Button */}
                <TouchableOpacity onPress={handleShareLink} style={[styles.shareLinkBtn, { backgroundColor: '#FFCC00' }]}>
                  <Ionicons name="link" size={20} color="#000" style={{ marginRight: 8 }} />
                  <Text style={{ color: '#000', fontWeight: 'bold', fontSize: 16 }}>Share Joining Link</Text>
                </TouchableOpacity>
              </>
            )}

          </View>
        </View>
      </Modal>

      {/* TEXT SETTINGS MODAL */}
      {settingsModalVisible && (
        <Animated.View style={[StyleSheet.absoluteFill, { zIndex: 999 }]} pointerEvents={showTextSettings ? 'auto' : 'none'}>
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.7)', opacity: settingsFadeAnim }]}>
            <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowTextSettings(false)} />
          </Animated.View>
          
          <Animated.View style={[styles.settingsCard, { backgroundColor: isDark ? '#12161E' : '#FFFFFF', borderColor: colors.border, transform: [{ translateY: settingsSlideAnim }] }]}>
            <View style={styles.settingsHeader}>
              <Text style={{ color: colors.text, fontSize: appFontSize + 2, fontWeight: 'bold' }}>Reading Preferences</Text>
              <TouchableOpacity onPress={() => { triggerHaptic(); setShowTextSettings(false); }}>
                <Ionicons name="close" size={28} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.settingLabel, { color: colors.primary, fontSize: appFontSize - 2 }]}>Live Screen Font Size</Text>
              <Text style={{ color: colors.subtext, fontSize: appFontSize }}>Size: {lyricsSize}</Text>
              <Slider minimumValue={12} maximumValue={45} step={1} value={lyricsSize} onValueChange={setLyricsSize} minimumTrackTintColor={colors.primary} maximumTrackTintColor={colors.border} />
              
              <Text style={{ color: colors.subtext, fontSize: appFontSize, marginTop: 15 }}>Line Spacing: {lyricsLineHeight}</Text>
              <Slider minimumValue={20} maximumValue={70} step={1} value={lyricsLineHeight} onValueChange={setLyricsLineHeight} minimumTrackTintColor={colors.primary} maximumTrackTintColor={colors.border} />
              
              <Text style={{ color: colors.subtext, fontSize: appFontSize, marginTop: 15 }}>Letter Spacing: {lyricsSpacing}</Text>
              <Slider minimumValue={0} maximumValue={5} step={0.5} value={lyricsSpacing} onValueChange={setLyricsSpacing} minimumTrackTintColor={colors.primary} maximumTrackTintColor={colors.border} />
              
              <TouchableOpacity onPress={() => { triggerHaptic(Haptics.ImpactFeedbackStyle.Success); restoreDefaultTextSettings(); }}>
                <View style={[styles.restoreBtn, { backgroundColor: colors.primary + '15', borderColor: colors.primary }]}>
                  <Ionicons name="refresh" size={20} color={colors.primary} />
                  <Text style={{ color: colors.primary, fontWeight: 'bold', marginLeft: 8, fontSize: appFontSize }}>Restore Defaults</Text>
                </View>
              </TouchableOpacity>
            </ScrollView>
          </Animated.View>
        </Animated.View>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 12, borderBottomWidth: 1 },
  headerBtn: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  scrollContent: { padding: 15, paddingBottom: 60 },
  titleCard: { padding: 25, borderRadius: 16, borderWidth: 1, alignItems: 'center', marginBottom: 25 },
  serviceName: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  serviceDate: { fontSize: 15, fontWeight: '600' },
  agendaContainer: { paddingBottom: 20 },
  blockWrapper: { borderRadius: 16, borderWidth: 1, marginBottom: 15, overflow: 'hidden' },
  blockHeader: { flexDirection: 'row', alignItems: 'center', padding: 15 },
  blockIndex: { width: 20, alignItems: 'center', marginRight: 5 },
  blockIconBadge: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  expandedContent: { padding: 20, borderTopWidth: 1 },
  
  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  qrModalContainer: { width: '100%', borderRadius: 24, padding: 25, borderWidth: 1, elevation: 10, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 15 },
  qrHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  shareLinkBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 15, borderRadius: 14 },
  
  // Settings Modal Styles
  settingsCard: { position: 'absolute', bottom: 0, width: '100%', maxHeight: '80%', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 30, borderWidth: 1 },
  settingsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
  settingLabel: { fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 15 },
  restoreBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 16, borderRadius: 16, marginTop: 40, marginBottom: 20, borderWidth: 1 },
});
