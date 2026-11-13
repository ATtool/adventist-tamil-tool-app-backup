import MixedText from '../MixedText.js';
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSettings } from '../../context/SettingsContext'; // We imported the tailor!

export default function BibleHeader({ 
  bookName, 
  chapter, 
  onMenuPress, 
  onBookPress, 
  onChapterPress, 
  onSearchPress 
}) {
  const { colors, isDark, bibleLanguage, typography } = useSettings();

  return (
    <View style={styles.headerWrapper}>
      <BlurView intensity={isDark ? 40 : 80} tint={isDark ? "dark" : "light"} style={[styles.actionHeader, { borderColor: colors.border }]}>
        
        <TouchableOpacity onPress={onMenuPress} style={styles.iconBtn}>
          <Ionicons name="menu" size={28} color={colors.text} />
        </TouchableOpacity>
        
        <View style={styles.centerPickersContainer}>
          <TouchableOpacity onPress={onBookPress} style={[styles.pickerBtn, { borderRightWidth: 1, borderRightColor: colors.border, flexDirection: 'row', flex: 1 }]}>
            <MixedText numberOfLines={1} adjustsFontSizeToFit style={{ color: colors.primary, fontSize: typography.body.fontSize, fontFamily: bibleLanguage === 'english' ? undefined : 'Tamil008', flexShrink: 1, includeFontPadding: false }}>
              {bookName}
            </MixedText>
            <Ionicons name="caret-down" size={12} color={colors.primary} style={{ marginLeft: 4, flexShrink: 0 }} />
          </TouchableOpacity>
          
          <TouchableOpacity onPress={onChapterPress} style={[styles.pickerBtn, { flexDirection: 'row', flexShrink: 1 }]}>
            <MixedText numberOfLines={1} adjustsFontSizeToFit style={{ color: colors.primary, fontSize: typography.body.fontSize, fontWeight: '900', flexShrink: 1, includeFontPadding: false }}>
              {chapter}
            </MixedText>
            <Ionicons name="caret-down" size={12} color={colors.primary} style={{ marginLeft: 4, flexShrink: 0 }} />
          </TouchableOpacity>
        </View>
        
        <TouchableOpacity onPress={onSearchPress} style={styles.iconBtn}>
          <Ionicons name="search" size={26} color={colors.text} />
        </TouchableOpacity>
        
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  headerWrapper: { paddingHorizontal: 15, paddingBottom: 10, paddingTop: 5 },
  actionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  iconBtn: { padding: 8 },
  centerPickersContainer: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(128,128,128,0.1)', borderRadius: 15, marginHorizontal: 10, height: 40 },
  pickerBtn: { flex: 1, justifyContent: 'center', alignItems: 'center', height: '100%', paddingHorizontal: 5 }
});