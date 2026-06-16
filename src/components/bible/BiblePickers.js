import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, FlatList, ScrollView, Animated, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import booksData from '../../data/books.json'; 

const { height } = Dimensions.get('window');

// ✨ Custom Animated Bubble for satisfying, bouncy clicks!
const AnimatedBubble = ({ onPress, style, children }) => {
  const scale = useRef(new Animated.Value(1)).current;
  
  const handlePressIn = () => Animated.spring(scale, { toValue: 0.85, useNativeDriver: true }).start();
  const handlePressOut = () => Animated.spring(scale, { toValue: 1, friction: 3, tension: 40, useNativeDriver: true }).start();
  
  return (
    <TouchableOpacity activeOpacity={0.8} onPressIn={handlePressIn} onPressOut={handlePressOut} onPress={onPress}>
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </TouchableOpacity>
  );
};

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

  const [isModalVisible, setIsModalVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(height)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setIsModalVisible(true);
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, friction: 9, tension: 60, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true })
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: height, duration: 250, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 0, duration: 250, useNativeDriver: true })
      ]).start(() => {
        setIsModalVisible(false);
      });
    }
  }, [visible]);

  const renderBookItem = ({ item }) => (
    <TouchableOpacity style={[styles.bookListItem, { borderBottomColor: colors.border }]} onPress={() => onBookSelect(item.id)}>
      <Text style={{ color: colors.text, fontSize: appFontSize + 2, fontFamily: bibleLanguage === 'english' ? undefined : 'Tamil008' }}>
        {bibleLanguage === 'english' ? item.name_en : item.name_ta}
      </Text>
      <Ionicons name="chevron-forward" size={20} color={colors.subtext} />
    </TouchableOpacity>
  );

  return (
    <Modal visible={isModalVisible} transparent animationType="none">
      <View style={styles.modalOverlay}>
        
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim }]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose}>
            <BlurView intensity={isDark ? 50 : 80} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFillObject} />
          </TouchableOpacity>
        </Animated.View>
        
        <Animated.View style={[styles.bottomSheet, { backgroundColor: isDark ? '#12161E' : '#FFFFFF', borderColor: colors.border, transform: [{ translateY: slideAnim }] }]}>
          
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
                <AnimatedBubble key={ch} style={[styles.bubble, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => onChapterSelect(ch)}>
                  <Text style={{ color: colors.text, fontSize: appFontSize + 2, fontWeight: 'bold' }}>{ch}</Text>
                </AnimatedBubble>
              ))}
            </ScrollView>
          )}

          {pickerStep === 'verse' && (
            <ScrollView contentContainerStyle={styles.bubbleGrid} showsVerticalScrollIndicator={false}>
              {availableVerses.map(v => (
                <AnimatedBubble key={v} style={[styles.bubble, { backgroundColor: colors.glow, borderColor: colors.primary }]} onPress={() => onVerseSelect(v)}>
                  <Text style={{ color: colors.primary, fontSize: appFontSize + 2, fontWeight: 'bold' }}>{v}</Text>
                </AnimatedBubble>
              ))}
            </ScrollView>
          )}

        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  bottomSheet: { width: '100%', maxHeight: '75%', borderTopLeftRadius: 30, borderTopRightRadius: 30, borderWidth: 1, overflow: 'hidden', paddingBottom: 30 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1 },
  testamentTabs: { flexDirection: 'row', marginBottom: 10 },
  tabBtn: { flex: 1, paddingVertical: 15, alignItems: 'center' },
  bookListItem: { paddingVertical: 10, paddingHorizontal: 10, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between' },
  bubbleGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', padding: 20, paddingBottom: 60 },
  bubble: { width: 60, height: 60, borderRadius: 30, borderWidth: 1, justifyContent: 'center', alignItems: 'center', margin: 8 }
});
