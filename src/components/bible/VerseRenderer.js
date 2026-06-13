import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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

  let bgStyle = { padding: 10, borderRadius: 12 };
  if (isTargetHighlighted) bgStyle.backgroundColor = isDark ? 'rgba(0, 240, 255, 0.2)' : 'rgba(180, 95, 6, 0.15)';
  else if (isSelected) bgStyle.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)';

  const renderHighlightedText = (text, query) => {
    if (!query || !text) return text;
    const safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${safeQuery})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, index) => 
      regex.test(part) ? <Text key={index} style={{ color: '#FF3B30', fontWeight: 'bold' }}>{part}</Text> : <Text key={index}>{part}</Text>
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
          <Text style={{ color: isSelected ? (isDark ? '#000' : '#FFF') : colors.primary, fontWeight: 'bold', fontSize: 12 }}>
            {item.verse}
          </Text>
        </View>
        {isFavorite && <Ionicons name="heart" size={16} color="#FF3B30" style={{ marginTop: 6 }} />}
      </View>

      <View style={{ flex: 1 }}>
        {(bibleLanguage === 'tamil' || bibleLanguage === 'both') && item.text_ta ? (
          <Text style={{ color: colors.text, fontSize: bibleFontSize, lineHeight: bibleLineHeight, letterSpacing: bibleLetterSpacing, fontFamily: 'Tamil003', marginBottom: bibleLanguage === 'both' ? 10 : 0 }}>
            {renderHighlightedText(item.text_ta, highlightedWord)}
          </Text>
        ) : null}
        
        {(bibleLanguage === 'english' || bibleLanguage === 'both') && item.text_en ? (
          <Text style={{ color: bibleLanguage === 'both' ? colors.subtext : colors.text, fontSize: bibleFontSize - 2, lineHeight: bibleLineHeight - 2, letterSpacing: bibleLetterSpacing }}>
            {renderHighlightedText(item.text_en, highlightedWord)}
          </Text>
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
