import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSettings } from '../context/SettingsContext';
import { CameraView, useCameraPermissions, scanFromURLAsync } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';

// Firebase Imports
import { ref, get, child } from "firebase/database";
import { db } from "../../firebaseSetup"; // Going up two folders to find the setup file

// --- ACCENT PALETTE FOR THE 3 OPTION CARDS ---
const ACCENT_SCAN = '#3F8CFF';
const ACCENT_GALLERY = '#9B6BFF';
const ACCENT_ID = '#FFC72C';

export default function JoinService() {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors, hapticsEnabled } = useSettings();
  
  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState('select'); // 'select', 'scan', 'link'
  const [linkInput, setLinkInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanned, setScanned] = useState(false);

  const triggerHaptic = (style = Haptics.ImpactFeedbackStyle.Light) => {
    if (hapticsEnabled) Haptics.impactAsync(style);
  };

  // --- INTERCEPT DEEP LINK ---
  useEffect(() => {
    if (route.params?.id) {
      processInvitationData(route.params.id);
    }
  }, [route.params?.id]);

  // --- DOWNLOAD DATA FROM FIREBASE ---
  const processInvitationData = async (dataString) => {
    setIsProcessing(true);
    try {
      let extractedId = '';
      
      // If it's the full URL, get the ID at the end. Otherwise, assume they typed the ID directly.
      if (dataString.includes('id=')) {
        extractedId = dataString.split('id=')[1].trim();
      } else {
        extractedId = dataString.trim();
      }

      // Fetch from Firebase Realtime Database
      const dbRef = ref(db);
      const snapshot = await get(child(dbRef, `services/${extractedId}`));

      if (snapshot.exists()) {
        const serviceData = snapshot.val();
        triggerHaptic(Haptics.ImpactFeedbackStyle.Success);
        setIsProcessing(false);
        
        // Use .navigate instead of .replace for Tab Navigators!
        navigation.navigate('ViewService', { service: serviceData });
      } else {
        throw new Error("ID not found in cloud database.");
      }

    } catch (error) {
      setIsProcessing(false);
      setScanned(false);
      triggerHaptic(Haptics.ImpactFeedbackStyle.Error);
      
      console.error("FIREBASE ERROR DETAILED:", error); 
      Alert.alert("Invalid Invitation", "This link or QR Code has expired or is invalid.");
    }
  };

  const handleBarCodeScanned = ({ type, data }) => {
    if (scanned) return;
    setScanned(true);
    processInvitationData(data);
  };

  const handleLinkSubmit = () => {
    if (!linkInput) return;
    processInvitationData(linkInput.trim());
  };

  // --- BROWSE FROM GALLERY & DECODE QR FROM IMAGE ---
  const handlePickFromGallery = async () => {
    triggerHaptic();
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert("Permission Needed", "We need access to your photos to scan a QR code from an image.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
        allowsEditing: false,
      });

      if (result.canceled) return;

      const imageUri = result.assets[0].uri;
      setIsProcessing(true);

      const scannedResults = await scanFromURLAsync(imageUri, ['qr']);

      if (scannedResults && scannedResults.length > 0) {
        processInvitationData(scannedResults[0].data);
      } else {
        setIsProcessing(false);
        Alert.alert("No QR Code Found", "We couldn't find a QR code in that image. Please try a different photo.");
      }
    } catch (error) {
      setIsProcessing(false);
      console.error("GALLERY SCAN ERROR:", error);
      Alert.alert("Error", "Something went wrong reading that image.");
    }
  };

  // --- BACK BUTTON: GO BACK ONE STEP AT A TIME ---
  const handleHeaderBack = () => {
    triggerHaptic();
    if (mode !== 'select') {
      setMode('select');
      setScanned(false);
    } else {
      navigation.goBack();
    }
  };

  const handleCancelScan = () => {
    triggerHaptic();
    setScanned(false);
    setMode('select');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={handleHeaderBack} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color={colors.primary} />
          <Text style={{ color: colors.primary, fontSize: 17 }}>Back</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>

        {mode === 'select' && (
          <View style={[styles.heroBadge, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '40' }]}>
            <Ionicons name="people-circle-outline" size={40} color={colors.primary} />
          </View>
        )}

        <Text style={[styles.title, { color: colors.text }]}>Join a Service</Text>
        <Text style={[styles.subtitle, { color: colors.subtext }]}>Scan a QR code or enter the service ID to sync the agenda to your device.</Text>

        {mode === 'select' && (
          <View style={{ marginTop: 26, width: '100%' }}>
            <TouchableOpacity 
              style={[styles.optionCard, { backgroundColor: colors.card, borderLeftColor: ACCENT_SCAN }]}
              onPress={() => {
                triggerHaptic();
                if (!permission?.granted) requestPermission();
                setMode('scan');
              }}
            >
              <View style={[styles.iconCircle, { backgroundColor: ACCENT_SCAN + '22' }]}>
                <Ionicons name="scan-outline" size={22} color={ACCENT_SCAN} />
              </View>
              <View style={styles.optionTextWrap}>
                <Text style={[styles.optionTitle, { color: colors.text }]}>Scan QR Code</Text>
                <Text style={[styles.optionSubtitle, { color: colors.subtext }]}>Use your camera</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.subtext} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.optionCard, { backgroundColor: colors.card, borderLeftColor: ACCENT_GALLERY }]}
              onPress={handlePickFromGallery}
            >
              <View style={[styles.iconCircle, { backgroundColor: ACCENT_GALLERY + '22' }]}>
                <Ionicons name="image-outline" size={22} color={ACCENT_GALLERY} />
              </View>
              <View style={styles.optionTextWrap}>
                <Text style={[styles.optionTitle, { color: colors.text }]}>Choose from Gallery</Text>
                <Text style={[styles.optionSubtitle, { color: colors.subtext }]}>Pick a saved QR image</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.subtext} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.optionCard, { backgroundColor: colors.card, borderLeftColor: ACCENT_ID }]}
              onPress={() => { triggerHaptic(); setMode('link'); }}
            >
              <View style={[styles.iconCircle, { backgroundColor: ACCENT_ID + '22' }]}>
                <Ionicons name="key-outline" size={22} color={ACCENT_ID} />
              </View>
              <View style={styles.optionTextWrap}>
                <Text style={[styles.optionTitle, { color: colors.text }]}>Enter ID</Text>
                <Text style={[styles.optionSubtitle, { color: colors.subtext }]}>Type the 6-character code</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.subtext} />
            </TouchableOpacity>
          </View>
        )}

        {mode === 'scan' && (
          <View style={styles.scannerWrapper}>
            {!permission ? (
              <ActivityIndicator size="large" color={colors.primary} />
            ) : !permission.granted ? (
              <Text style={{ color: colors.text, textAlign: 'center' }}>We need your permission to access the camera.</Text>
            ) : (
              <View style={[styles.cameraBox, { borderColor: ACCENT_SCAN }]}>
                <CameraView 
                  style={StyleSheet.absoluteFillObject} 
                  facing="back"
                  onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                  barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                />
                <View style={styles.scannerOverlay}>
                  <View style={[styles.scannerCorner, styles.topLeft, { borderColor: ACCENT_SCAN }]} />
                  <View style={[styles.scannerCorner, styles.topRight, { borderColor: ACCENT_SCAN }]} />
                  <View style={[styles.scannerCorner, styles.bottomLeft, { borderColor: ACCENT_SCAN }]} />
                  <View style={[styles.scannerCorner, styles.bottomRight, { borderColor: ACCENT_SCAN }]} />
                </View>
              </View>
            )}
            
            <TouchableOpacity style={styles.cancelScanBtn} onPress={handleCancelScan}>
              <Text style={{ color: colors.primary, fontSize: 16, fontWeight: 'bold' }}>Cancel Scan</Text>
            </TouchableOpacity>
          </View>
        )}

        {mode === 'link' && (
          <View style={{ width: '100%', marginTop: 24 }}>
            <View style={[styles.heroBadgeSmall, { backgroundColor: ACCENT_ID + '20', borderColor: ACCENT_ID + '50' }]}>
              <Ionicons name="key-outline" size={26} color={ACCENT_ID} />
            </View>
            <Text style={{ color: colors.text, marginBottom: 10, fontWeight: 'bold', fontSize: 16, textAlign: 'center' }}>Enter Service ID</Text>
            <View style={[styles.inputBox, { backgroundColor: colors.card, borderColor: ACCENT_ID + '60' }]}>
              <Ionicons name="key" size={20} color={ACCENT_ID} style={{ marginRight: 10 }} />
              <TextInput
                style={{ flex: 1, color: colors.text, fontSize: 18, letterSpacing: 2, fontWeight: '600' }}
                placeholder="e.g. A7B9K2"
                placeholderTextColor={colors.subtext}
                value={linkInput}
                onChangeText={setLinkInput}
                autoCapitalize="characters"
                autoCorrect={false}
              />
            </View>

            <TouchableOpacity 
              style={[styles.joinBtn, { backgroundColor: isProcessing ? colors.border : ACCENT_ID }]}
              onPress={handleLinkSubmit}
              disabled={isProcessing}
            >
              {isProcessing ? <ActivityIndicator color="#000" /> : <Text style={{ color: '#101010', fontWeight: 'bold', fontSize: 16 }}>Load Service</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={{ alignSelf: 'center', marginTop: 20 }} onPress={() => setMode('select')}>
              <Text style={{ color: colors.subtext, fontSize: 16 }}>Back</Text>
            </TouchableOpacity>
          </View>
        )}

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 12, borderBottomWidth: 1 },
  backBtn: { flexDirection: 'row', alignItems: 'center', padding: 5 },
  content: { flex: 1, padding: 25, alignItems: 'center' },

  heroBadge: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 14,
  },
  heroBadgeSmall: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 14,
  },

  title: { fontSize: 25, fontWeight: '800', marginBottom: 8, letterSpacing: 0.3 },
  subtitle: { fontSize: 14.5, textAlign: 'center', lineHeight: 21, paddingHorizontal: 10 },
  
  optionCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderLeftWidth: 4,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  iconCircle: { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  optionTextWrap: { flex: 1 },
  optionTitle: { fontSize: 16, fontWeight: '700' },
  optionSubtitle: { fontSize: 12, marginTop: 2 },

  scannerWrapper: { flex: 1, width: '100%', alignItems: 'center', marginTop: 20 },
  cameraBox: { width: 280, height: 280, borderRadius: 24, overflow: 'hidden', borderWidth: 2 },
  scannerOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  scannerCorner: { position: 'absolute', width: 40, height: 40, borderWidth: 4 },
  topLeft: { top: 20, left: 20, borderBottomWidth: 0, borderRightWidth: 0 },
  topRight: { top: 20, right: 20, borderBottomWidth: 0, borderLeftWidth: 0 },
  bottomLeft: { bottom: 20, left: 20, borderTopWidth: 0, borderRightWidth: 0 },
  bottomRight: { bottom: 20, right: 20, borderTopWidth: 0, borderLeftWidth: 0 },
  cancelScanBtn: { marginTop: 30, paddingVertical: 8, paddingHorizontal: 20 },

  inputBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 15, paddingVertical: 14, marginBottom: 20 },
  joinBtn: { paddingVertical: 16, borderRadius: 14, alignItems: 'center', width: '100%' }
});
