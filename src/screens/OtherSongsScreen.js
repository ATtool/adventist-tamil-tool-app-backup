import React, { useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSettings } from '../context/SettingsContext';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

// -------------------------------------------------------------
// Reusable Premium Click Animation Wrapper
// -------------------------------------------------------------
const ScalePressable = ({ children, onPress, style, scaleTo = 0.90 }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const handlePressIn = () => Animated.spring(scale, { toValue: scaleTo, useNativeDriver: true, friction: 5 }).start();
  const handlePressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 5 }).start();
  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <TouchableOpacity onPressIn={handlePressIn} onPressOut={handlePressOut} onPress={onPress} activeOpacity={0.8} delayPressIn={50}>
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
};

export default function OtherSongsScreen() {
  const navigation = useNavigation();
  const { colors, isDark, appFontSize, hapticsEnabled } = useSettings();

  // Entrance Animation Refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;

  const triggerHaptic = useCallback(() => { 
    if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); 
  }, [hapticsEnabled]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 7, tension: 40, useNativeDriver: true })
    ]).start();
  }, []);

  const handleGoBack = () => {
    triggerHaptic();
    navigation.goBack();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient colors={isDark ? ['#0A1929', colors.background] : ['#FFFFFF', colors.background]} style={StyleSheet.absoluteFillObject} />
      
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <ScalePressable onPress={handleGoBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={28} color={colors.text} />
          </ScalePressable>
          
          <Text style={[styles.headerTitle, { color: colors.text, fontSize: appFontSize + 4 }]}>
            இதர பாடல்கள்
          </Text>
          
          <View style={{ width: 40 }} /> 
        </View>

        {/* Animated Coming Soon Content */}
        <View style={styles.content}>
          <Animated.View style={[styles.card, { 
            backgroundColor: colors.card, 
            borderColor: colors.border,
            shadowColor: isDark ? 'transparent' : '#ccc',
            elevation: isDark ? 0 : 8,
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }]}>
            
            <View style={[styles.iconCircle, { backgroundColor: colors.glow, borderColor: colors.primary }]}>
              <Ionicons name="musical-notes" size={50} color={colors.primary} />
            </View>
            
            <Text style={[styles.titleText, { color: colors.text, fontSize: appFontSize + 6 }]}>
              Other Songs
            </Text>
            
            <Text style={[styles.subtitleText, { color: colors.subtext, fontSize: appFontSize }]}>
              We are carefully curating and preparing more beautiful songs for this section.
            </Text>
            
            <View style={[styles.badge, { backgroundColor: colors.primary + '20' }]}>
              <Ionicons name="time-outline" size={16} color={colors.primary} style={{ marginRight: 6 }} />
              <Text style={{ color: colors.primary, fontWeight: '900', fontSize: appFontSize - 2, textTransform: 'uppercase', letterSpacing: 1.5 }}>
                Coming Soon
              </Text>
            </View>

          </Animated.View>
        </View>
        
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1 
  },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 15, 
    paddingVertical: 15, 
    borderBottomWidth: 1 
  },
  backButton: { 
    padding: 5 
  },
  headerTitle: { 
    fontFamily: 'Tamil008', // Upgraded to the bolder Tamil font
    flex: 1, 
    textAlign: 'center' 
  },
  content: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 20 
  },
  card: {
    width: '90%',
    borderRadius: 24,
    borderWidth: 1,
    padding: 30,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  titleText: {
    fontFamily: 'Tamil008',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitleText: {
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 30,
    paddingHorizontal: 10,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  }
});
