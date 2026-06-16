import React, { useEffect, useRef } from 'react';
import { TouchableOpacity, StyleSheet, Platform, Text, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

export default function BibleActionBar({
  colors,
  isDark,
  selectedVerses,
  userFavorites,
  onCancel,
  onFavorite,
  onCrossRef,
  onShare
}) {
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

  const ActionBtn = ({ icon, text, onPress, highlight }) => (
    <TouchableOpacity style={styles.actionBtn} onPress={onPress}>
      <Ionicons name={icon} size={24} color={highlight ? "#FF3B30" : "#FFD700"} />
      <Text style={{ color: highlight ? "#FF3B30" : "#FFD700", fontSize: 11, fontWeight: 'bold', marginTop: 6 }}>{text}</Text>
    </TouchableOpacity>
  );

  return (
    <Animated.View style={[
      styles.floatingActionBar, 
      { 
        borderColor: colors.border,
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
        <ActionBtn icon="git-network-outline" text="Cross-Ref" onPress={onCrossRef} />
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
    backgroundColor: Platform.OS === 'android' ? 'rgba(10, 25, 41, 0.85)' : 'transparent', 
    shadowColor: '#000', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.3, shadowRadius: 5, elevation: 10,
    zIndex: 100
  },
  actionBtn: { alignItems: 'center', flex: 1, zIndex: 1 },
});
