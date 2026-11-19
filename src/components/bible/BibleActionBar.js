import MixedText from '../MixedText.js';
import React, { useEffect, useRef } from 'react';
import { TouchableOpacity, StyleSheet, Platform, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSettings } from '../../context/SettingsContext';

export default function BibleActionBar({
  colors: propColors,
  isDark: propDark,
  selectedVerses,
  userFavorites,
  onCancel,
  onFavorite,
  onCrossRef,
  onShare,
  onConcordance,
  onExplanations
}) {
  const settings = useSettings();
  const colors = propColors || settings.colors;
  const isDark = propDark !== undefined ? propDark : settings.isDark;
  const typography = settings.typography;
  const slideAnim = useRef(new Animated.Value(100)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (selectedVerses.length > 0) {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 50, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true })
      ]).start();
    } else {
      // Reset values when hidden so it animates again next time
      slideAnim.setValue(100);
      fadeAnim.setValue(0);
    }
  }, [selectedVerses.length]);

  if (selectedVerses.length === 0) return null;

  const safeFavorites = userFavorites || [];
  const allFavorited = selectedVerses.every(v => safeFavorites.includes(v.verse));

  const ActionBtn = ({ icon, text, onPress, highlight }) => {
    const btnColor = highlight ? "#FF3B30" : (isDark ? "#FFD700" : colors.primary);
    return (
      <TouchableOpacity style={styles.actionBtn} onPress={onPress}>
        <Ionicons name={icon} size={24} color={btnColor} />
        <MixedText style={{ color: btnColor, fontSize: typography.caption.fontSize, fontWeight: 'bold', marginTop: 6 }}>{text}</MixedText>
      </TouchableOpacity>
    );
  };

  return (
    <Animated.View style={[
      styles.floatingActionBar, 
      { 
        borderColor: colors.border,
        backgroundColor: Platform.OS === 'android' ? (isDark ? 'rgba(10, 25, 41, 0.85)' : 'rgba(255, 255, 255, 0.95)') : 'transparent',
        shadowColor: isDark ? '#000' : '#888',
        shadowOpacity: isDark ? 0.3 : 0.1,
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }]
      }
    ]}>
      <BlurView intensity={90} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFillObject} />
      
      <ActionBtn icon="close-circle-outline" text="Cancel" onPress={onCancel} />
      
      <ActionBtn 
        icon={allFavorited ? "heart" : "heart-outline"} 
        text={allFavorited ? "Unfavorite" : "Favorite"} 
        onPress={onFavorite} 
        highlight={allFavorited}
      />
      
      {selectedVerses.length === 1 && (
        <>
          <ActionBtn icon="git-network-outline" text="Cross-Ref" onPress={onCrossRef} />
          <ActionBtn icon="search-outline" text="Concordance" onPress={onConcordance} />
          <ActionBtn icon="library-outline" text="Explanations" onPress={onExplanations} />
        </>
      )}
      
      <ActionBtn icon="share-social-outline" text="Share" onPress={onShare} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  floatingActionBar: { 
    position: 'absolute', 
    bottom: Platform.OS === 'ios' ? 110 : 85, 
    left: 20, right: 20, borderRadius: 25, borderWidth: 1, 
    flexDirection: 'row', justifyContent: 'space-around', 
    paddingVertical: 15, overflow: 'hidden', 
    shadowOffset: {width: 0, height: 4}, shadowRadius: 5, elevation: 10,
    zIndex: 100
  },
  actionBtn: { alignItems: 'center', flex: 1, zIndex: 1, paddingHorizontal: 2 },
});
