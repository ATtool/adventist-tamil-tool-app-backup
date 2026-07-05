import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import ViewShot from 'react-native-view-shot';
import QRCode from 'react-native-qrcode-svg';
import { useSettings } from '../context/SettingsContext';

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
  const [shareTarget, setShareTarget] = useState(null);
  const viewShotRef = useRef(null);

  const triggerHaptic = (style = Haptics.ImpactFeedbackStyle.Light) => {
    if (hapticsEnabled) Haptics.impactAsync(style);
  };

  // Fetch services whenever the screen comes into focus
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
        // Sort by newest date first
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

  // --- SHARE: builds one invite image (QR + ID + note) and opens the native share sheet ---
  const handleShare = (item) => {
    triggerHaptic();
    setShareTarget(item);
  };

  useEffect(() => {
    if (!shareTarget) return;

    // Wait one tick so the hidden invite card re-renders with the new service before capturing it
    const timer = setTimeout(async () => {
      try {
        const uri = await viewShotRef.current.capture();
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(uri, {
            mimeType: 'image/png',
            dialogTitle: `Invite - ${shareTarget.name}`,
          });
        } else {
          Alert.alert("Sharing Unavailable", "Sharing isn't available on this device.");
        }
      } catch (error) {
        console.error("SHARE ERROR:", error);
        Alert.alert("Error", "Could not create the invite to share.");
      } finally {
        setShareTarget(null);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [shareTarget]);

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
              style={styles.shareBtn} 
              onPress={() => handleShare(item)}
            >
              <Ionicons name="share-social-outline" size={20} color={colors.primary} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.deleteBtn} 
              onPress={() => confirmDelete(item.id, item.name)}
            >
              <Ionicons name="trash-outline" size={22} color="#FF3B30" />
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
          {/* Empty view for balance */}
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
            keyExtractor={(item) => item.id}
            renderItem={renderServiceCard}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
          />
        )}

      </SafeAreaView>

      {/* Hidden invite card used only to render the shareable image. Kept off-screen. */}
      <View style={styles.offscreenWrapper} pointerEvents="none">
        <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1 }}>
          <View style={styles.inviteCard}>
            <Text style={styles.inviteHeader}>You're Invited!</Text>
            <Text style={styles.inviteServiceName}>{shareTarget?.name || ''}</Text>
            <Text style={styles.inviteDate}>{shareTarget ? formatServiceDate(shareTarget.date) : ''}</Text>

            <View style={styles.qrWrapper}>
              <QRCode value={shareTarget?.id ? String(shareTarget.id) : 'x'} size={190} />
            </View>

            <Text style={styles.inviteIdLabel}>SERVICE ID</Text>
            <Text style={styles.inviteId}>{shareTarget?.id || ''}</Text>

            <Text style={styles.inviteNote}>Your friend is asking you to join the service. Scan the QR code or enter the ID above in the app to join.</Text>
          </View>
        </ViewShot>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 10, 
    paddingVertical: 12, 
    borderBottomWidth: 1 
  },
  headerBtn: { flexDirection: 'row', alignItems: 'center', padding: 5, width: 80 },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  listContainer: { padding: 15, paddingBottom: 100 },
  
  card: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 15,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  cardDate: {
    fontSize: 13,
    fontWeight: '600',
  },
  shareBtn: {
    padding: 10,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    borderRadius: 10,
    marginRight: 8,
  },
  deleteBtn: {
    padding: 10,
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderRadius: 10,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderTopWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.01)',
  },
  
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 15,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Off-screen invite card (captured as an image, never shown to the user directly)
  offscreenWrapper: {
    position: 'absolute',
    top: 0,
    left: -9999,
  },
  inviteCard: {
    width: 300,
    backgroundColor: '#FFFFFF',
    padding: 24,
    alignItems: 'center',
  },
  inviteHeader: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0A1929',
    marginBottom: 6,
  },
  inviteServiceName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#0A1929',
    textAlign: 'center',
  },
  inviteDate: {
    fontSize: 14,
    color: '#666666',
    marginTop: 4,
    marginBottom: 18,
  },
  qrWrapper: {
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 16,
  },
  inviteIdLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#999999',
    letterSpacing: 1,
  },
  inviteId: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0A1929',
    letterSpacing: 2,
    marginTop: 4,
    marginBottom: 16,
  },
  inviteNote: {
    fontSize: 13,
    color: '#444444',
    textAlign: 'center',
    lineHeight: 19,
  },
});
