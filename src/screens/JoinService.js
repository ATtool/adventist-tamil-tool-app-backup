import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSettings } from '../context/SettingsContext';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';

// Firebase Imports
import { ref, get, child } from "firebase/database";
import { db } from "../../firebaseSetup"; // Going up two folders to find the setup file

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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => { triggerHaptic(); navigation.goBack(); }} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color={colors.primary} />
          <Text style={{ color: colors.primary, fontSize: 17 }}>Back</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        
        <Text style={[styles.title, { color: colors.text }]}>Join a Service</Text>
        <Text style={[styles.subtitle, { color: colors.subtext }]}>Scan a QR code or paste an invitation link to sync the service agenda to your device.</Text>

        {mode === 'select' && (
          <View style={{ marginTop: 40, width: '100%' }}>
            <TouchableOpacity 
              style={[styles.optionCard, { backgroundColor: colors.card, borderColor: colors.primary, borderWidth: 1 }]}
              onPress={() => {
                triggerHaptic();
                if (!permission?.granted) requestPermission();
                setMode('scan');
              }}
            >
              <View style={[styles.iconCircle, { backgroundColor: colors.primary + '20' }]}>
                <Ionicons name="qr-code-outline" size={32} color={colors.primary} />
              </View>
              <Text style={[styles.optionTitle, { color: colors.text }]}>Scan QR Code</Text>
              <Text style={{ color: colors.subtext, marginTop: 5 }}>Point your camera at the host's screen</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.optionCard, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}
              onPress={() => { triggerHaptic(); setMode('link'); }}
            >
              <View style={[styles.iconCircle, { backgroundColor: colors.text + '20' }]}>
                <Ionicons name="link-outline" size={32} color={colors.text} />
              </View>
              <Text style={[styles.optionTitle, { color: colors.text }]}>Paste Link / Enter ID</Text>
              <Text style={{ color: colors.subtext, marginTop: 5 }}>Enter a link or the 6-character code</Text>
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
              <View style={styles.cameraBox}>
                <CameraView 
                  style={StyleSheet.absoluteFillObject} 
                  facing="back"
                  onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                  barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                />
                <View style={styles.scannerOverlay}>
                  <View style={[styles.scannerCorner, styles.topLeft]} />
                  <View style={[styles.scannerCorner, styles.topRight]} />
                  <View style={[styles.scannerCorner, styles.bottomLeft]} />
                  <View style={[styles.scannerCorner, styles.bottomRight]} />
                </View>
              </View>
            )}
            
            <TouchableOpacity style={{ marginTop: 30 }} onPress={() => setMode('select')}>
              <Text style={{ color: colors.primary, fontSize: 16, fontWeight: 'bold' }}>Cancel Scan</Text>
            </TouchableOpacity>
          </View>
        )}

        {mode === 'link' && (
          <View style={{ width: '100%', marginTop: 30 }}>
            <Text style={{ color: colors.text, marginBottom: 10, fontWeight: 'bold', fontSize: 16 }}>Invitation Link or Code</Text>
            <View style={[styles.inputBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="link" size={20} color={colors.subtext} style={{ marginRight: 10 }} />
              <TextInput
                style={{ flex: 1, color: colors.text, fontSize: 16 }}
                placeholder="https://... or A7B9K2"
                placeholderTextColor={colors.subtext}
                value={linkInput}
                onChangeText={setLinkInput}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <TouchableOpacity 
              style={[styles.joinBtn, { backgroundColor: isProcessing ? colors.border : '#FFCC00' }]}
              onPress={handleLinkSubmit}
              disabled={isProcessing}
            >
              {isProcessing ? <ActivityIndicator color="#000" /> : <Text style={{ color: '#000', fontWeight: 'bold', fontSize: 16 }}>Load Service</Text>}
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
  title: { fontSize: 26, fontWeight: 'bold', marginTop: 10, marginBottom: 10 },
  subtitle: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
  
  optionCard: { width: '100%', padding: 20, borderRadius: 16, alignItems: 'center', marginBottom: 20, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  iconCircle: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  optionTitle: { fontSize: 18, fontWeight: 'bold' },

  scannerWrapper: { flex: 1, width: '100%', alignItems: 'center', marginTop: 30 },
  cameraBox: { width: 280, height: 280, borderRadius: 24, overflow: 'hidden', borderWidth: 2, borderColor: '#000' },
  scannerOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  scannerCorner: { position: 'absolute', width: 40, height: 40, borderColor: '#00FF00', borderWidth: 4 },
  topLeft: { top: 20, left: 20, borderBottomWidth: 0, borderRightWidth: 0 },
  topRight: { top: 20, right: 20, borderBottomWidth: 0, borderLeftWidth: 0 },
  bottomLeft: { bottom: 20, left: 20, borderTopWidth: 0, borderRightWidth: 0 },
  bottomRight: { bottom: 20, right: 20, borderTopWidth: 0, borderLeftWidth: 0 },

  inputBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 15, paddingVertical: 12, marginBottom: 20 },
  joinBtn: { paddingVertical: 16, borderRadius: 12, alignItems: 'center', width: '100%' }
});
