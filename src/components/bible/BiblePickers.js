import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, FlatList, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import booksData from '../../data/books.json'; // Importing data directly

export default function BiblePickers({
  visible,
  pickerStep,
  selectedTestament,
  availableChapters,
  availableVerses,
  colors,
  isDark,
  appFontSize,
  bibleLanguage,
  onClose,
  onBack,
  onTestamentSelect,
  onBookSelect,
  onChapterSelect,
  onVerseSelect
}) {

  const renderBookItem = ({ item }) => (
    <TouchableOpacity style={[styles.bookListItem, { borderBottomColor: colors.border }]} onPress={() => onBookSelect(item.id)}>
      <Text style={{ color: colors.text, fontSize: appFontSize + 2, fontFamily: bibleLanguage === 'english' ? undefined : 'Tamil008' }}>
        {bibleLanguage === 'english' ? item.name_en : item.name_ta}
      </Text>
      <Ionicons name="chevron-forward" size={20} color={colors.subtext} />
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <BlurView intensity={isDark ? 50 : 80} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFillObject} />
        
        <View style={[styles.bottomSheet, { backgroundColor: isDark ? '#12161E' : '#FFFFFF', borderColor: colors.border }]}>
          
          <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
            {pickerStep !== 'book' ? (
              <TouchableOpacity onPress={onBack} style={{ padding: 5 }}>
                <Ionicons name="arrow-back" size={24} color={colors.text} />
              </TouchableOpacity>
            ) : <View style={{ width: 34 }} />}
            
            <Text style={{ color: colors.text, fontSize: appFontSize + 2, fontWeight: 'bold' }}>
              {pickerStep === 'book' ? 'Select Book' : pickerStep === 'chapter' ? 'Select Chapter' : 'Select Verse'}
            </Text>
            
            <TouchableOpacity onPress={onClose} style={{ padding: 5 }}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {pickerStep === 'book' && (
            <>
              <View style={styles.testamentTabs}>
                <TouchableOpacity style={[styles.tabBtn, selectedTestament === 'OT' && { borderBottomColor: colors.primary, borderBottomWidth: 3 }]} onPress={() => onTestamentSelect('OT')}>
                  <Text style={{ color: selectedTestament === 'OT' ? colors.primary : colors.subtext, fontWeight: 'bold', fontSize: appFontSize }}>Old Testament</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tabBtn, selectedTestament === 'NT' && { borderBottomColor: colors.primary, borderBottomWidth: 3 }]} onPress={() => onTestamentSelect('NT')}>
                  <Text style={{ color: selectedTestament === 'NT' ? colors.primary : colors.subtext, fontWeight: 'bold', fontSize: appFontSize }}>New Testament</Text>
                </TouchableOpacity>
              </View>
              <FlatList 
                data={booksData.filter(b => b.testament === selectedTestament)} 
                keyExtractor={item => item.id.toString()} 
                renderItem={renderBookItem} 
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }} 
                showsVerticalScrollIndicator={false} 
              />
            </>
          )}

          {pickerStep === 'chapter' && (
            <ScrollView contentContainerStyle={styles.bubbleGrid} showsVerticalScrollIndicator={false}>
              {availableChapters.map(ch => (
                <TouchableOpacity key={ch} style={[styles.bubble, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => onChapterSelect(ch)}>
                  <Text style={{ color: colors.text, fontSize: appFontSize + 2, fontWeight: 'bold' }}>{ch}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {pickerStep === 'verse' && (
            <ScrollView contentContainerStyle={styles.bubbleGrid} showsVerticalScrollIndicator={false}>
              {availableVerses.map(v => (
                <TouchableOpacity key={v} style={[styles.bubble, { backgroundColor: colors.glow, borderColor: colors.primary }]} onPress={() => onVerseSelect(v)}>
                  <Text style={{ color: colors.primary, fontSize: appFontSize + 2, fontWeight: 'bold' }}>{v}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, justifyContent: 'flex-end' }, // Forces modal safely to bottom
  bottomSheet: { width: '100%', maxHeight: '75%', borderTopLeftRadius: 30, borderTopRightRadius: 30, borderWidth: 1, overflow: 'hidden', paddingBottom: 30 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1 },
  testamentTabs: { flexDirection: 'row', marginBottom: 10 },
  tabBtn: { flex: 1, paddingVertical: 15, alignItems: 'center' },
  bookListItem: { paddingVertical: 10, paddingHorizontal: 10, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between' },
  bubbleGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', padding: 20, paddingBottom: 60 },
  bubble: { width: 60, height: 60, borderRadius: 30, borderWidth: 1, justifyContent: 'center', alignItems: 'center', margin: 8 }
});
