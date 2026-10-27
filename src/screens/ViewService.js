import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Animated, Dimensions, Modal, Alert, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSettings } from '../context/SettingsContext';
import * as SQLite from 'expo-sqlite';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import Slider from '@react-native-community/slider';
import QRCode from 'react-native-qrcode-svg';
import ViewShot from 'react-native-view-shot';

import { ref, set } from "firebase/database";
import { db } from "../../firebaseSetup"; 

import booksData from '../data/books.json';

const { height } = Dimensions.get('window');
const NEWLINE = String.fromCharCode(10);
const NEON_BLUE = '#00F0FF';

// SMART PARSER: Strips [Chorus], numbers [Verse X], and prevents Chorus repeats
const parseLyricStanzas = (text) => {
  if (!text) return [];
  const rawLines = text.split(NEWLINE);
  const stanzas = [];
  let currentNumber = null;
  let currentLines = [];
  
  let seenChorusText = null;
  let isCurrentBlockChorus = false;

  const isRefrainLine = (line, nextLine) => {
    const trimmed = line.trim();
    if (trimmed.indexOf('~') !== 0) return false;
    if (nextLine === undefined) return true;
    return nextLine.trim() === '';
  };

  const flush = () => {
    while (currentLines.length > 0 && currentLines[currentLines.length - 1].content.trim() === '') currentLines.pop();
    while (currentLines.length > 0 && currentLines[0].content.trim() === '') currentLines.shift();

    if (currentLines.length > 0) {
      const blockText = currentLines.map(l => l.content).join('\n').trim();
      
      if (isCurrentBlockChorus) {
        if (!seenChorusText) {
          seenChorusText = blockText; 
          stanzas.push({ number: currentNumber, lines: currentLines });
        } else if (seenChorusText !== blockText) {
          stanzas.push({ number: currentNumber, lines: currentLines }); 
        }
      } else {
        stanzas.push({ number: currentNumber, lines: currentLines });
      }
    }
    
    currentLines = [];
    currentNumber = null;
    isCurrentBlockChorus = false;
  };

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const trimmed = line.trim();

    if (trimmed.toLowerCase() === '[chorus]') {
      flush();
      isCurrentBlockChorus = true;
      continue;
    }

    const verseMatch = trimmed.match(/^\[Verse\s+(\d+)\]$/i);
    if (verseMatch) {
      flush();
      currentNumber = verseMatch[1] + ".";
      continue;
    }

    const numMatch = trimmed.match(/^\s*(\d{1,3}[.)])\s*(.*)$/);
    if (numMatch && !isCurrentBlockChorus) {
      flush();
      currentNumber = numMatch[1];
      const rest = line.substring(line.indexOf(numMatch[1]) + numMatch[1].length).trim();
      const nextLine = rawLines[i + 1];
      if (rest) {
        currentLines.push({ content: rest, isRefrain: isRefrainLine(rest, nextLine) });
      }
      continue;
    }

    if (trimmed === '') {
      flush();
      continue;
    }

    const nextLine = rawLines[i + 1];
    currentLines.push({ content: line, isRefrain: isRefrainLine(line, nextLine) });
  }
  flush(); 

  return stanzas;
};

export default function ViewService() {
  const navigation = useNavigation();
  const route = useRoute();
  const { service } = route.params; 
  
  const { colors, isDark, appFontSize, hapticsEnabled, lyricsSize, setLyricsSize, lyricsSpacing, setLyricsSpacing, lyricsLineHeight, setLyricsLineHeight, restoreDefaultTextSettings } = useSettings();

  const [expandedId, setExpandedId] = useState(null);
  const [fetchedContent, setFetchedContent] = useState({});
  const [isLoadingContent, setIsLoadingContent] = useState(false);

  const [showTextSettings, setShowTextSettings] = useState(false);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [shareId, setShareId] = useState(service?.shareId || null);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [isSharingImage, setIsSharingImage] = useState(false);
  const inviteCardRef = useRef(null);
  
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

  const handleOpenInviteModal = async () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    setShowInviteModal(true);
    setIsGeneratingLink(true);

    try {
      const shortId = shareId || Math.random().toString(36).substring(2, 8).toUpperCase(); 
      const serviceRef = ref(db, 'services/' + shortId);
      
      const sanitizedService = JSON.parse(JSON.stringify({ ...service, shareId: shortId }));
      await set(serviceRef, sanitizedService); 
      setShareId(shortId);
    } catch (error) {
      console.error("Firebase Error:", error);
      Alert.alert("Connection Error", "Ensure you have internet access to generate a sharing link.");
      setShowInviteModal(false);
    } finally {
      setIsGeneratingLink(false);
    }
  };

  const formattedDate = new Date(service.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  // 3-IN-1 MASTER SHARE: Captures the card (QR + ID + Link) AND shares the text message
  const handleShareAllInOne = async () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    if (!shareId || isSharingImage) return;

    const message =
      `🙏 *You're Invited to "${service.name}"*\n` +
      `📅 Date: ${formattedDate}\n\n` +
      `🔑 *SERVICE ID:* ${shareId}\n\n` +
      `📲 *Click to Open Directly in App:*\n` +
      `https://adventisttamil.app/join?id=${shareId}\n\n` +
      `📥 *Don't have the app? Download on Play Store:*\n` +
      `https://play.google.com/store/apps/details?id=com.adventisttamiltool.adventisttamiltool`;

    setIsSharingImage(true);
    try {
      const uri = await inviteCardRef.current.capture();
      // Share both the QR image and the text message together
      await Share.share(
        {
          title: `Invite - ${service.name}`,
          message: message,
          url: uri,
        },
        {
          dialogTitle: `Invite - ${service.name}`,
        }
      );
    } catch (error) {
      console.error("SHARE ERROR:", error);
      Alert.alert("Error", "Could not share the invite.");
    } finally {
      setIsSharingImage(false);
    }
  };

  const handleExpand = async (block) => {
    triggerHaptic();
    if (expandedId === block.id) { setExpandedId(null); return; }
    setExpandedId(block.id);
    if (fetchedContent[block.id] || (!block.data.number && !block.data.chapter && !block.data.lyrics)) return;

    setIsLoadingContent(true);
    let content = '';
    
    try {
      if (block.category === 'song' && block.data.book && (block.data.number || block.data.lyrics)) {
        if (block.data.lyrics) {
          content = block.data.lyrics;
        } else {
          let dbName = block.data.book === 'Zion' ? 'zion.db' : 'Thirumarai.db';
          const sqliteDb = await SQLite.openDatabaseAsync(dbName);
          
          const tableRes = await sqliteDb.getAllAsync("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'android_metadata'");
          const tableName = tableRes && tableRes.length > 0 ? tableRes.find(t => t.name === 'songs' || t.name === 'SongListTable')?.name || tableRes[0].name : 'SongListTable';
          
          let query = '';
          if (block.data.book === 'Zion') query = `SELECT lyrics FROM "${tableName}" WHERE song_number = ? LIMIT 1`;
          else if (block.data.book === 'Hope') query = `SELECT lyrics FROM "${tableName}" WHERE Song_number_by_Nambikaiyen_Geethagal = ? LIMIT 1`;
          else if (block.data.book === 'Old') query = `SELECT lyrics FROM "${tableName}" WHERE song_number = ? LIMIT 1`;
          
          const result = await sqliteDb.getAllAsync(query, [block.data.number]);
          if (result && result.length > 0) content = result[0].lyrics; else content = "Lyrics not found.";
          await sqliteDb.closeAsync().catch(() => {});
        }
      } 
      else if ((block.category === 'bible' || block.category === 'tithe') && block.data.book && block.data.chapter && block.data.verse) {
        const isEnglishBible = /^[0-9a-zA-Z\s]+$/.test(block.data.book);
        const dbName = isEnglishBible ? 'KJV.db' : 'TAMIL.db';

        const bookObj = booksData.find(b => b.name_ta === block.data.book || b.name_en === block.data.book);
        if (bookObj) {
          const sqliteDb = await SQLite.openDatabaseAsync(dbName);
          const tableRes = await sqliteDb.getAllAsync("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'android_metadata'");
          
          if (tableRes && tableRes.length > 0) {
            const query = `SELECT text FROM "${tableRes[0].name}" WHERE book_id = ? AND chapter = ? AND verse = ? LIMIT 1`;
            const result = await sqliteDb.getAllAsync(query, [bookObj.id, parseInt(block.data.chapter), parseInt(block.data.verse)]);
            if (result && result.length > 0) content = result[0].text; else content = "Verse not found.";
          }
          await sqliteDb.closeAsync().catch(() => {});
        }
      }
    } catch (error) { content = "Error loading content."; }

    if (content) setFetchedContent(prev => ({ ...prev, [block.id]: content }));
    setIsLoadingContent(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
            <Ionicons name="chevron-back" size={28} color={colors.primary} />
          </TouchableOpacity>
          
          <Text style={[styles.headerTitle, { color: colors.text }]}>Live Service</Text>
          
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity onPress={() => { triggerHaptic(); setShowTextSettings(true); }} style={{ marginRight: 12 }}>
              <View style={{ backgroundColor: colors.primary + '15', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 }}>
                <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: 16 }}>Aa</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={handleOpenInviteModal}
              style={{ backgroundColor: '#FFCC00', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, flexDirection: 'row', alignItems: 'center', shadowColor: '#FFCC00', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 5 }}
            >
              <Ionicons name="qr-code-outline" size={16} color="#000" style={{ marginRight: 5 }} />
              <Text style={{ color: '#000', fontWeight: 'bold', fontSize: 15 }}>Invite</Text>
            </TouchableOpacity>
          </View>
        </View>

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
                      
                      {block.category === 'person' && block.data?.ledBy ? (
                        <Text style={{ color: colors.primary, fontSize: 14, marginTop: 2 }}>Led by: {block.data.ledBy}</Text>
                      ) : null}
                      
                      {block.category === 'song' && block.data?.book && block.data?.number ? (
                        <Text style={{ color: colors.primary, fontSize: 14, marginTop: 2, fontFamily: 'Tamil003', includeFontPadding: false }}>
                          {block.data.book} #{block.data.number} {block.data?.title ? `- ${block.data.title}` : ''} {block.data.ledBy ? `(By ${block.data.ledBy})` : ''}
                        </Text>
                      ) : null}
                      
                      {block.category === 'bible' && block.data?.book && block.data?.chapter ? (
                        <Text style={{ color: colors.primary, fontSize: 14, marginTop: 2, fontFamily: 'Tamil003', includeFontPadding: false }}>
                          {block.data.book} {block.data.chapter}:{block.data.verse} {block.data.ledBy ? `(By ${block.data.ledBy})` : ''}
                        </Text>
                      ) : null}

                      {block.category === 'tithe' && (
                        <View>
                          {block.data?.ledBy ? <Text style={{ color: colors.primary, fontSize: 14, marginTop: 2 }}>Led by: {block.data.ledBy}</Text> : null}
                          {block.data?.book && block.data?.chapter ? <Text style={{ color: colors.subtext, fontSize: 13, marginTop: 2, fontFamily: 'Tamil003', includeFontPadding: false }}>{block.data.book} {block.data.chapter}:{block.data.verse}</Text> : null}
                        </View>
                      )}
                      
                      {block.category === 'note' && block.data?.note ? (
                         <Text style={{ color: colors.subtext, fontSize: 14, marginTop: 2 }} numberOfLines={1}>{block.data.note}</Text>
                      ) : null}

                    </View>
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={[styles.expandedContent, { borderTopColor: colors.border, backgroundColor: isDark ? '#121212' : '#F9F9F9' }]}>
                      {isLoadingContent && (!fetchedContent[block.id]) ? <ActivityIndicator size="small" color={colors.primary} /> : (
                        block.category === 'song' ? (
                          parseLyricStanzas(fetchedContent[block.id]).map((stanza, sIdx) => (
                            <View key={sIdx} style={{ flexDirection: 'row', marginBottom: stanza.number ? 22 : 18 }}>
                              <View style={{ width: 34 }}>
                                {stanza.number && (
                                  <Text style={{ color: '#FFFFFF', fontSize: lyricsSize, fontFamily: 'Tamil003', lineHeight: lyricsLineHeight, includeFontPadding: false }}>
                                    {stanza.number}
                                  </Text>
                                )}
                              </View>
                              <View style={{ flex: 1 }}>
                                {stanza.lines.map((line, lineIdx) => (
                                  // Pure white text for both Tamil and Thanglish, locked to Tamil003
                                  <Text
                                    key={lineIdx}
                                    style={{
                                      color: line.isRefrain ? NEON_BLUE : colors.text,
                                      fontSize: lyricsSize,
                                      fontFamily: 'Tamil003',
                                      lineHeight: lyricsLineHeight,
                                      letterSpacing: lyricsSpacing,
                                      includeFontPadding: false,
                                    }}
                                  >
                                    {line.content.trim() === '' ? ' ' : line.content}
                                  </Text>
                                ))}
                              </View>
                            </View>
                          ))
                        ) : (
                          // Bible verses (both Tamil and English) locked to Tamil003
                          <Text style={{ color: colors.text, fontSize: lyricsSize, fontFamily: 'Tamil003', lineHeight: lyricsLineHeight, letterSpacing: lyricsSpacing, includeFontPadding: false }}>
                            {fetchedContent[block.id]}
                          </Text>
                        )
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </ScrollView>
      </SafeAreaView>

      <Modal visible={showInviteModal} transparent={true} animationType="fade" onRequestClose={() => setShowInviteModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.qrModalContainer, { backgroundColor: isDark ? '#12161E' : '#FFFFFF', borderColor: colors.border }]}>
            
            <View style={styles.qrHeader}>
              <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800' }}>Invite to Service</Text>
              <TouchableOpacity onPress={() => setShowInviteModal(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            {isGeneratingLink ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={{ color: colors.text, marginTop: 15 }}>Connecting to cloud...</Text>
              </View>
            ) : (
              <>
                <Text style={{ color: colors.subtext, textAlign: 'center', marginBottom: 14, fontSize: 14 }}>
                  Share the Link, ID, or QR Code so your friends can sync this agenda.
                </Text>

                <ViewShot ref={inviteCardRef} collapsable={false} options={{ format: 'png', quality: 1 }}>
                  <View style={styles.inviteCard} collapsable={false}>
                    <Text style={styles.inviteHeader}>You're Invited!</Text>
                    <Text style={styles.inviteServiceName}>{service.name}</Text>
                    <Text style={styles.inviteDate}>{formattedDate}</Text>

                    <View style={styles.qrWrapper}>
                      <QRCode 
                        value={shareId ? `adventisttamil://join?id=${shareId}` : 'x'} 
                        size={185} 
                        color="#000000" 
                        backgroundColor="#FFFFFF" 
                      />
                    </View>

                    <Text style={styles.inviteIdLabel}>SERVICE ID</Text>
                    <Text style={styles.inviteId}>{shareId}</Text>

                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#0A84FF', marginBottom: 6 }}>
                      https://adventisttamil.app/join?id={shareId}
                    </Text>

                    <Text style={styles.inviteNote}>Scan the QR code, click the link, or enter the ID in the Adventist Tamil app to join.</Text>
                  </View>
                </ViewShot>

                <View style={{ marginTop: 18 }}>
                  <TouchableOpacity 
                    onPress={handleShareAllInOne} 
                    style={[styles.shareLinkBtn, { backgroundColor: isSharingImage ? colors.border : colors.primary }]}
                    disabled={isSharingImage}
                  >
                    {isSharingImage ? (
                      <ActivityIndicator color="#000" />
                    ) : (
                      <>
                        <Ionicons name="share-social" size={20} color="#000" style={{ marginRight: 8 }} />
                        <Text style={{ color: '#000', fontWeight: 'bold', fontSize: 16 }}>Share Invite (QR + ID + Link)</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}

          </View>
        </View>
      </Modal>

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
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(4,6,12,0.82)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  qrModalContainer: { width: '100%', maxWidth: 380, borderRadius: 26, padding: 22, borderWidth: 1, elevation: 14 },
  qrHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(128,128,128,0.15)', justifyContent: 'center', alignItems: 'center' },
  shareLinkBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 13, borderRadius: 12 },

  inviteCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 20, alignItems: 'center' },
  inviteHeader: { fontSize: 19, fontWeight: 'bold', color: '#0A1929', marginBottom: 4 },
  inviteServiceName: { fontSize: 16, fontWeight: '600', color: '#0A1929', textAlign: 'center' },
  inviteDate: { fontSize: 13, color: '#666666', marginTop: 4, marginBottom: 14 },
  qrWrapper: { padding: 12, backgroundColor: '#FFFFFF', borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#EEEEEE' },
  inviteIdLabel: { fontSize: 11, fontWeight: '700', color: '#999999', letterSpacing: 1 },
  inviteId: { fontSize: 20, fontWeight: 'bold', color: '#0A1929', letterSpacing: 2, marginTop: 4, marginBottom: 10 },
  inviteNote: { fontSize: 12, color: '#444444', textAlign: 'center', lineHeight: 17 },

  settingsCard: { position: 'absolute', bottom: 0, width: '100%', maxHeight: '80%', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 30, borderWidth: 1 },
  settingsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
  settingLabel: { fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 15 },
  restoreBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 16, borderRadius: 16, marginTop: 40, marginBottom: 20, borderWidth: 1 },
});