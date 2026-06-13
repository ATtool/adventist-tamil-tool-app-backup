import React from 'react';
import { TouchableOpacity, StyleSheet, Platform, Text } from 'react-native';
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
    <BlurView intensity={90} tint={isDark ? "dark" : "light"} style={[styles.floatingActionBar, { borderColor: colors.border }]}>
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
    </BlurView>
  );
}

const styles = StyleSheet.create({
  floatingActionBar: { 
    position: 'absolute', 
    bottom: Platform.OS === 'ios' ? 110 : 85, 
    left: 20, right: 20, borderRadius: 25, borderWidth: 1, 
    flexDirection: 'row', justifyContent: 'space-around', 
    paddingVertical: 15, overflow: 'hidden', 
    backgroundColor: Platform.OS === 'android' ? '#0A1929' : 'transparent', 
    shadowColor: '#000', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.3, shadowRadius: 5, elevation: 10,
    zIndex: 100
  },
  actionBtn: { alignItems: 'center', flex: 1 },
});
