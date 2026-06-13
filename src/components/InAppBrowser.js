import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Animated, Dimensions, ActivityIndicator, Linking, Share, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useSettings } from '../context/SettingsContext';

const { height } = Dimensions.get('window');

export default function InAppBrowser({ visible, url, title, onClose }) {
  const { colors, isDark, appFontSize, hapticsEnabled } = useSettings();
  const webviewRef = useRef(null);

  const [currentUrl, setCurrentUrl] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const slideAnim = useRef(new Animated.Value(height)).current;

  useEffect(() => {
    if (visible && url) {
      setCurrentUrl(url);
      Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start();
    } else {
      Animated.timing(slideAnim, { toValue: height, duration: 250, useNativeDriver: true }).start();
      setShowMenu(false);
    }
  }, [visible, url]);

  const triggerHaptic = (style = Haptics.ImpactFeedbackStyle.Light) => {
    if (hapticsEnabled) Haptics.impactAsync(style);
  };

  const handleClose = () => {
    triggerHaptic();
    onClose();
  };

  const handleOpenInBrowser = async () => {
    triggerHaptic();
    try {
      await Linking.openURL(currentUrl);
    } catch (error) {}
    setShowMenu(false);
  };

  const handleShare = async () => {
    triggerHaptic();
    try {
      await Share.share({ message: currentUrl });
    } catch (error) {}
    setShowMenu(false);
  };

  const getDomain = (link) => {
    try {
      const domain = new URL(link).hostname;
      return domain.replace('www.', '');
    } catch (e) {
      return 'Loading...';
    }
  };

  return (
    <Modal visible={visible} transparent animationType="none">
      <View style={styles.overlay}>
        
        <Animated.View style={[styles.panel, { transform: [{ translateY: slideAnim }], backgroundColor: colors.background }]}>
          <SafeAreaView style={{ flex: 1 }} edges={['top']}>

            {/* HEADER */}
            <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
              <TouchableOpacity onPress={handleClose} style={styles.iconBtn}>
                <Ionicons name="close" size={28} color={colors.text} />
              </TouchableOpacity>

              <View style={styles.titleContainer}>
                <Text style={[styles.title, { color: colors.text, fontSize: appFontSize }]} numberOfLines={1}>
                  {title || 'Browser'}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="lock-closed" size={10} color={colors.subtext} style={{ marginRight: 4 }} />
                  <Text style={[styles.url, { color: colors.subtext, fontSize: appFontSize - 4 }]} numberOfLines={1}>
                    {getDomain(currentUrl)}
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row' }}>
                <TouchableOpacity onPress={() => { triggerHaptic(); setShowMenu(!showMenu); }} style={styles.iconBtn}>
                  <Ionicons name="ellipsis-vertical" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>
            </View>

            {/* WEBVIEW ENGINE */}
            <View style={{ flex: 1, backgroundColor: colors.background }}>
              {currentUrl ? (
                <WebView
                  ref={webviewRef}
                  source={{ uri: currentUrl }}
                  style={{ flex: 1, backgroundColor: 'transparent' }}
                  javaScriptEnabled={true}
                  domStorageEnabled={true}
                  onNavigationStateChange={(navState) => {
                    setCanGoBack(navState.canGoBack);
                    setCanGoForward(navState.canGoForward);
                    if (navState.url && navState.url.startsWith('http')) {
                      setCurrentUrl(navState.url);
                    }
                  }}
                  onLoadStart={() => setIsLoading(true)}
                  onLoadEnd={() => setIsLoading(false)}
                  startInLoadingState={true}
                  renderLoading={() => (
                    <View style={styles.loader}>
                      <ActivityIndicator size="large" color={colors.primary} />
                    </View>
                  )}
                />
              ) : null}
            </View>

            {/* BOTTOM NAVIGATION BAR */}
            <View style={[styles.bottomBar, { borderTopColor: colors.border, backgroundColor: colors.card }]}>
              <TouchableOpacity onPress={() => { triggerHaptic(); webviewRef.current?.goBack(); }} disabled={!canGoBack} style={{ opacity: canGoBack ? 1 : 0.3 }}>
                <Ionicons name="chevron-back" size={28} color={colors.text} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { triggerHaptic(); webviewRef.current?.goForward(); }} disabled={!canGoForward} style={{ opacity: canGoForward ? 1 : 0.3 }}>
                <Ionicons name="chevron-forward" size={28} color={colors.text} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { triggerHaptic(); webviewRef.current?.reload(); }}>
                <Ionicons name="refresh" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* SOLID BACKGROUND MENU */}
            {showMenu && (
              <TouchableOpacity
                style={[StyleSheet.absoluteFill, { zIndex: 100, elevation: 100 }]}
                activeOpacity={1}
                onPress={() => setShowMenu(false)}
              >
                <View style={[
                  styles.dropdownMenu, 
                  { 
                    backgroundColor: isDark ? '#1E293B' : '#FFFFFF', 
                    borderColor: isDark ? '#334155' : '#E2E8F0' 
                  }
                ]}>
                  <TouchableOpacity style={[styles.menuItem, { borderBottomColor: isDark ? '#334155' : '#E2E8F0', borderBottomWidth: 1 }]} onPress={handleShare}>
                    <Ionicons name="share-social-outline" size={20} color={isDark ? '#FFF' : '#000'} style={{ marginRight: 10 }} />
                    <Text style={{ color: isDark ? '#FFF' : '#000', fontSize: appFontSize, fontWeight: 'bold' }}>Share / Copy Link</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.menuItem} onPress={handleOpenInBrowser}>
                    <Ionicons name="compass-outline" size={20} color={isDark ? '#FFF' : '#000'} style={{ marginRight: 10 }} />
                    <Text style={{ color: isDark ? '#FFF' : '#000', fontSize: appFontSize, fontWeight: 'bold' }}>Open in External Browser</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            )}

          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  panel: { width: '100%', height: '95%', borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden', elevation: 20, shadowColor: '#000', shadowOffset: { width: 0, height: -5 }, shadowOpacity: 0.3, shadowRadius: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, paddingVertical: 12, borderBottomWidth: 1, zIndex: 5 },
  iconBtn: { padding: 8 },
  titleContainer: { flex: 1, alignItems: 'center', marginHorizontal: 10 },
  title: { fontWeight: 'bold', marginBottom: 2 },
  url: { fontWeight: '500' },
  loader: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', zIndex: 1 },
  bottomBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingVertical: 12, borderTopWidth: 1, paddingBottom: Platform.OS === 'ios' ? 20 : 12 },
  dropdownMenu: { position: 'absolute', top: 60, right: 15, borderRadius: 12, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.8, shadowRadius: 8, elevation: 20, width: 230 },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 15 }
});