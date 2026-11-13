import MixedText from '../MixedText.js';
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../../context/SettingsContext';

const VerseRenderer = React.memo(({
  item, 
  isTargetHighlighted, 
  isSelected, 
  isFavorite, 
  isDark, 
  colors, 
  bibleLanguage, 
  bibleFontSize, 
  bibleLineHeight, 
  bibleLetterSpacing,
  highlightedWord,
  onToggleSelection,
  onLongPress
}) => {
  const { typography } = useSettings();

  let bgStyle = { padding: 10, borderRadius: 12 };
  if (isTargetHighlighted) bgStyle.backgroundColor = isDark ? 'rgba(0, 240, 255, 0.2)' : 'rgba(180, 95, 6, 0.15)';
  else if (isSelected) bgStyle.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)';

  const renderHighlightedText = (text, query) => {
    if (!query || !text) return text;
    const safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${safeQuery})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, index) => 
      regex.test(part) ? <MixedText key={index} style={{ color: '#FF3B30', textDecorationLine: 'underline' }}>{part}</MixedText> : <MixedText key={index}>{part}</MixedText>
    );
  };

  return (
    <TouchableOpacity 
      style={[styles.verseContainer, bgStyle]} 
      activeOpacity={0.7} 
      onLongPress={() => onLongPress(item)}
      onPress={() => onToggleSelection(item)}
    >
      <View style={{ width: 30, alignItems: 'center', marginRight: 10, marginTop: 5 }}>
        <View style={[styles.verseNumBubble, { backgroundColor: isSelected ? colors.primary : colors.glow, borderColor: colors.primary }]}>
          <MixedText style={{ color: isSelected ? (isDark ? '#000' : '#FFF') : colors.primary, fontWeight: 'bold', fontSize: typography.caption.fontSize }}>
            {item.verse}
          </MixedText>
        </View>
        {isFavorite && <Ionicons name="heart" size={16} color="#FF3B30" style={{ marginTop: 6 }} />}
      </View>

      <View style={{ flex: 1 }}>
        {(bibleLanguage === 'tamil' || bibleLanguage === 'both') && item.text_ta ? (
          // Fixed! Now dynamically responding to bibleFontSize and bibleLineHeight
          <MixedText style={{ color: colors.text, fontSize: bibleFontSize, lineHeight: bibleLineHeight, letterSpacing: bibleLetterSpacing, fontFamily: 'Tamil003', marginBottom: bibleLanguage === 'both' ? 10 : 0 }}>
            {renderHighlightedText(item.text_ta, highlightedWord)}
          </MixedText>
        ) : null}
        
        {(bibleLanguage === 'english' || bibleLanguage === 'both') && item.text_en ? (
          // English font dynamically scales at -2px so it matches the visual weight of Tamil text
          <MixedText style={{ color: bibleLanguage === 'both' ? colors.subtext : colors.text, fontSize: Math.max(12, bibleFontSize - 2), lineHeight: bibleLineHeight - 4, letterSpacing: bibleLetterSpacing }}>
            {renderHighlightedText(item.text_en, highlightedWord)}
          </MixedText>
        ) : null}
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  verseContainer: { flexDirection: 'row', marginBottom: 5, marginHorizontal: -10 },
  verseNumBubble: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' }
});

export default VerseRenderer;