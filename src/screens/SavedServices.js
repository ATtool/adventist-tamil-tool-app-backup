import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert, Modal, ActivityIndicator, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import ViewShot from 'react-native-view-shot';
import QRCode from 'react-native-qrcode-svg';
import { useSettings } from '../context/SettingsContext';

import { ref, set } from "firebase/database";
import { db } from "../../firebaseSetup";

const formatServiceDate = (date) => {
  return new Date(date).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
  });
};

export default function SavedServices() {
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const { colors, isDark, hapticsEnabled } = useSettings();
  
  const [services, setServices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Invite Modal State
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [activeService, setActiveService] = useState(null);
  const [shareId, setShareId] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSharingImage, setIsSharingImage] = useState(false);
  const inviteCardRef = useRef(null);

  const triggerHaptic = (style = Haptics.ImpactFeedbackStyle.Light) => {
    if (hapticsEnabled) Haptics.impactAsync(style);
  };

  useEffect(() => {
    if (isFocused) {
      loadSavedServices();
    }
  }, [isFocused]);

  const loadSavedServices = async () => {
    setIsLoading(true);
    try {
      const storedServices = await AsyncStorage.getItem('@saved_services');
      if (storedServices) {
        let parsed = JSON.parse(storedServices);
        parsed.sort((a, b) => new Date(b.date) - new Date(a.date));
        setServices(parsed);
      } else {
        setServices([]);
      }
    } catch (error) {
      console.error("Error loading services:", error);
      Alert.alert("Error", "Could not load your saved services.");
    } finally {
      setIsLoading(false);
    }
  };

  const confirmDelete = (id, name) => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      "Delete Service",
      `Are you sure you want to delete "${name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive", 
          onPress: () => deleteService(id) 
        }
      ]
    );
  };

  const deleteService = async (id) => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      const updatedServices = services.filter(service => service.id !== id);
      await AsyncStorage.setItem('@saved_services', JSON.stringify(updatedServices));
      setServices(updatedServices);
    } catch (error) {
      console.error("Error deleting service:", error);
      Alert.alert("Error", "Could not delete the service.");
    }
  };

  const openService = (service) => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('ViewService', { service });
  };

  const editService = (service) => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate('CreateService', { editService: service });
  };

  // --- UPLOAD TO FIREBASE & OPEN SHARE MODAL ---
  const handleShare = async (item) => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    setActiveService(item);
    setShowInviteModal(true);
    setIsUploading(true);

    try {
      // Reuse existing 6-char shareId if already generated, or create a new one
      const code = item.shareId || Math.random().toString(36).substring(2, 8).toUpperCase();
      const updatedItem = { ...item, shareId: code };

      // Clean undefined fields and upload to Firebase
      const sanitizedService = JSON.parse(JSON.stringify(updatedItem));
      await set(ref(db, 'services/' + code), sanitizedService);

      setShareId(code);

      // Save the shareId locally so future edits update the same cloud service
      const updatedList = services.map(s => s.id === item.id ? updatedItem : s);
      setServices(updatedList);
      await AsyncStorage.setItem('@saved_services', JSON.stringify(updatedList));
    } catch (error) {
      console.error("FIREBASE UPLOAD ERROR:", error);
      Alert.alert("Connection Error", "Please check your internet connection to share this service.");
      setShowInviteModal(false);
    } finally {
      setIsUploading(false);
    }
  };

  const buildShareMessage = (srv, code) => {
    const formatted = srv ? formatServiceDate(srv.date) : '';
    return (
      `🙏 *You're Invited to "${srv?.name || 'Worship Service'}"*\n` +
      `📅 Date: ${formatted}\n\n` +
      `🔑 *SERVICE ID:* ${code}\n\n` +
      `📲 *Open Directly in App:*\n` +
      `adventisttamil://join?id=${code}\n\n` +
      `(Copy this message or enter ID *${code}* in Adventist Tamil Tool -> Join Service)\n\n` +
      `📥 *Don't have the app? Download on Play Store:*\n` +
      `https://play.google.com/store/apps/details?id=com.adventisttamiltool.adventisttamiltool`
    );
  };

  // Option 1: Share Link + ID + Play Store as Text
  const handleShareTextInvite = async () => {
    if (!shareId || !activeService) return;
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await Share.share({
        message: buildShareMessage(activeService, shareId),
      });
    } catch (error) {
      console.error("TEXT SHARE ERROR:", error);
    }
  };

  // Option 2: Share Uncut QR Code Image
  const handleShareQRImage = async () => {
    if (!shareId || !activeService || isSharingImage) return;
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    setIsSharingImage(true);
    try {
      const uri = await inviteCardRef.current.capture();
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: `Invite - ${activeService.name}`,
        });
      } else {
        Alert.alert("Sharing Unavailable", "Sharing isn't available on this device.");
      }
    } catch (error) {
      console.error("QR SHARE ERROR:", error);
      Alert.alert("Error", "Could not capture the QR image.");
    } finally {
      setIsSharingImage(false);
    }
  };

  const renderServiceCard = ({ item }) => {
    const formattedDate = formatServiceDate(item.date);

    return (
      <TouchableOpacity 
        style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]} 
        activeOpacity={0.7}
        onPress={() => openService(item)}
      >
        <View style={styles.cardHeader}>
          <View style={styles.titleRow}>
            <View style={[styles.iconBadge, { backgroundColor: colors.primary + '15' }]}>
              <Ionicons name="calendar" size={20} color={colors.primary} />
            </View>
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={[styles.cardDate, { color: colors.primary }]}>
                {formattedDate}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity 
              style={[styles.actionBtn, { backgroundColor: 'rgba(0, 122, 255, 0.1)' }]} 
              onPress={() => handleShare(item)}
            >
              <Ionicons name="share-social-outline" size={20} color={colors.primary} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionBtn, { backgroundColor: 'rgba(52, 199, 89, 0.1)' }]} 
              onPress={() => editService(item)}
            >
              <Ionicons name="pencil" size={20} color="#34C759" />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionBtn, { backgroundColor: 'rgba(255, 59, 48, 0.1)', marginRight: 0 }]} 
              onPress={() => confirmDelete(item.id, item.name)}
            >
              <Ionicons name="trash-outline" size={20} color="#FF3B30" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
          <Text style={{ color: colors.subtext, fontSize: 13, fontWeight: '500' }}>
            <Ionicons name="list" size={14} color={colors.subtext} /> {item.agenda?.length || 0} Agenda Items
          </Text>
          <Ionicons name="chevron-forward" size={18} color={colors.subtext} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
            <Ionicons name="chevron-back" size={28} color={colors.primary} />
            <Text style={{ color: colors.primary, fontSize: 17 }}>Back</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>My Services</Text>
          <View style={styles.headerBtn} /> 
        </View>

        {/* List */}
        {!isLoading && services.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="albums-outline" size={60} color={colors.border} />
            <Text style={[styles.emptyStateTitle, { color: colors.text }]}>No Services Yet</Text>
            <Text style={[styles.emptyStateText, { color: colors.subtext }]}>
              Services you create in the Builder will appear here.
            </Text>
          </View>
        ) : (
          <FlatList
            data={services}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderServiceCard}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
          />
        )}

      </SafeAreaView>

      {/* VISIBLE INVITE MODAL (Captures QR directly from the visible card so it NEVER cuts off!) */}
      <Modal visible={showInviteModal} transparent={true} animationType="fade" onRequestClose={() => setShowInviteModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.qrModalContainer, { backgroundColor: isDark ? '#12161E' : '#FFFFFF', borderColor: colors.border }]}>
            
            <View style={styles.qrHeader}>
              <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800' }}>Share Service</Text>
              <TouchableOpacity onPress={() => setShowInviteModal(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            {isUploading ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={{ color: colors.text, marginTop: 15 }}>Syncing service to cloud...</Text>
              </View>
            ) : (
              <>
                <ViewShot ref={inviteCardRef} collapsable={false} options={{ format: 'png', quality: 1 }}>
                  <View style={styles.inviteCard} collapsable={false}>
                    <Text style={styles.inviteHeader}>You're Invited!</Text>
                    <Text style={styles.inviteServiceName}>{activeService?.name || ''}</Text>
                    <Text style={styles.inviteDate}>{activeService ? formatServiceDate(activeService.date) : ''}</Text>

                    <View style={styles.qrWrapper}>
                      <QRCode 
                        value={shareId ? `adventisttamil://join?id=${shareId}` : 'x'} 
                        size={180} 
                        color="#000000" 
                        backgroundColor="#FFFFFF" 
                      />
                    </View>

                    <Text style={styles.inviteIdLabel}>SERVICE ID</Text>
                    <Text style={styles.inviteId}>{shareId}</Text>

                    <Text style={styles.inviteNote}>Scan the QR code or enter the ID in Adventist Tamil Tool to join.</Text>
                  </View>
                </ViewShot>

                <View style={{ marginTop: 18 }}>
                  <TouchableOpacity 
                    onPress={handleShareTextInvite} 
                    style={[styles.shareLinkBtn, { backgroundColor: colors.primary, marginBottom: 10 }]}
                  >
                    <Ionicons name="link" size={20} color="#000" style={{ marginRight: 8 }} />
                    <Text style={{ color: '#000', fontWeight: 'bold', fontSize: 15 }}>Share Link, ID & Store Link</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    onPress={handleShareQRImage} 
                    style={[styles.shareLinkBtn, { backgroundColor: isSharingImage ? colors.border : '#FFCC00' }]}
                    disabled={isSharingImage}
                  >
                    {isSharingImage ? (
                      <ActivityIndicator color="#000" />
                    ) : (
                      <>
                        <Ionicons name="qr-code" size={20} color="#000" style={{ marginRight: 8 }} />
                        <Text style={{ color: '#000', fontWeight: 'bold', fontSize: 15 }}>Share QR Code Image</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}

          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 12, borderBottomWidth: 1 },
  headerBtn: { flexDirection: 'row', alignItems: 'center', padding: 5, width: 80 },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  listContainer: { padding: 15, paddingBottom: 100 },
  card: { borderRadius: 16, borderWidth: 1, marginBottom: 15, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15 },
  titleRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  iconBadge: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  cardTitle: { fontSize: 17, fontWeight: 'bold', marginBottom: 4 },
  cardDate: { fontSize: 13, fontWeight: '600' },
  actionBtn: { padding: 10, borderRadius: 10, marginRight: 8, justifyContent: 'center', alignItems: 'center' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 12, borderTopWidth: 1, backgroundColor: 'rgba(0,0,0,0.01)' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyStateTitle: { fontSize: 20, fontWeight: 'bold', marginTop: 15, marginBottom: 8 },
  emptyStateText: { fontSize: 15, textAlign: 'center', lineHeight: 22 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(4,6,12,0.82)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  qrModalContainer: { width: '100%', maxWidth: 380, borderRadius: 26, padding: 22, borderWidth: 1, elevation: 14 },
  qrHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
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
});