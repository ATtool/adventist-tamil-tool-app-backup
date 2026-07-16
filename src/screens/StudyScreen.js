import React, { useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSettings } from '../context/SettingsContext';

// --- ACCENT PALETTE FOR THE 3 STUDY TOOL CARDS ---
const ACCENT_DICT = '#00F0FF';
const ACCENT_CONC = '#FF3B30';
const ACCENT_VERSE = '#2ECC71';

export default function StudyScreen() {
  const navigation = useNavigation();
  const { colors, appFontSize } = useSettings();

  // --- ANIMATION VALUES ---
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const cardAnims = useRef([...Array(3)].map(() => new Animated.Value(50))).current; 
  const cardOpacities = useRef([...Array(3)].map(() => new Animated.Value(0))).current;

  // --- PLAY ANIMATION ON TAB FOCUS ---
  useFocusEffect(
    useCallback(() => {
      headerOpacity.setValue(0);
      cardAnims.forEach(anim => anim.setValue(50));
      cardOpacities.forEach(anim => anim.setValue(0));

      const animations = cardAnims.map((anim, index) => {
        return Animated.parallel([
          Animated.spring(anim, { toValue: 0, friction: 8, tension: 50, useNativeDriver: true }),
          Animated.timing(cardOpacities[index], { toValue: 1, duration: 300, useNativeDriver: true })
        ]);
      });

      Animated.sequence([
        Animated.timing(headerOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.stagger(100, animations)
      ]).start();

      return () => {};
    }, [])
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      
      {/* HEADER */}
      <Animated.View style={[styles.header, { borderBottomColor: colors.border, opacity: headerOpacity }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Bible Tool & Study notes</Text>
      </Animated.View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Dictionary Card */}
        <Animated.View style={{ opacity: cardOpacities[0], transform: [{ translateY: cardAnims[0] }] }}>
          <TouchableOpacity 
            activeOpacity={0.75}
            style={[styles.card, { backgroundColor: colors.card, borderLeftColor: ACCENT_DICT }]} 
            onPress={() => navigation.navigate('Dictionary')}
          >
            <View style={[styles.iconContainer, { backgroundColor: ACCENT_DICT + '22' }]}>
              <Ionicons name="book" size={22} color={colors.primary} />
            </View>
            <View style={styles.textContainer}>
              <Text style={[styles.cardTitle, { color: colors.text, fontSize: 16 }]} allowFontScaling={false}>Bible Dictionary</Text>
              <Text style={[styles.cardSub, { color: colors.subtext, fontSize: appFontSize, fontFamily: 'Tamil003' }]} allowFontScaling={false}>வேதாகம அகராதி</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.subtext} />
          </TouchableOpacity>
        </Animated.View>

        {/* Concordance Card */}
        <Animated.View style={{ opacity: cardOpacities[1], transform: [{ translateY: cardAnims[1] }] }}>
          <TouchableOpacity 
            activeOpacity={0.75}
            style={[styles.card, { backgroundColor: colors.card, borderLeftColor: ACCENT_CONC }]} 
            onPress={() => navigation.navigate('Concordance')}
          >
            <View style={[styles.iconContainer, { backgroundColor: ACCENT_CONC + '22' }]}>
              <Ionicons name="search" size={22} color={ACCENT_CONC} />
            </View>
            <View style={styles.textContainer}>
              <Text style={[styles.cardTitle, { color: colors.text, fontSize: 16 }]} allowFontScaling={false}>Concordance</Text>
              <Text style={[styles.cardSub, { color: colors.subtext, fontSize: appFontSize, fontFamily: 'Tamil003' }]} allowFontScaling={false}>வார்த்தை விளக்கம்</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.subtext} />
          </TouchableOpacity>
        </Animated.View>

        {/* NEW: Bible Verse Explanations Card */}
        <Animated.View style={{ opacity: cardOpacities[2], transform: [{ translateY: cardAnims[2] }] }}>
          <TouchableOpacity 
            activeOpacity={0.75}
            style={[styles.card, { backgroundColor: colors.card, borderLeftColor: ACCENT_VERSE }]} 
            onPress={() => navigation.navigate('StudyExplanations')}
          >
            <View style={[styles.iconContainer, { backgroundColor: ACCENT_VERSE + '22' }]}>
              <Ionicons name="library" size={22} color={ACCENT_VERSE} />
            </View>
            <View style={styles.textContainer}>
              <Text style={[styles.cardTitle, { color: colors.text, fontSize: 16 }]} allowFontScaling={false}>Verse Explanations</Text>
              <Text style={[styles.cardSub, { color: colors.subtext, fontSize: appFontSize, fontFamily: 'Tamil003' }]} allowFontScaling={false}>வசன விளக்கம்</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.subtext} />
          </TouchableOpacity>
        </Animated.View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 20, borderBottomWidth: 1 },
  headerTitle: { fontSize: 22, fontWeight: 'bold' },
  scrollContent: { padding: 15, paddingBottom: 40 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderLeftWidth: 4,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  iconContainer: { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  textContainer: { flex: 1 },
  cardTitle: { fontWeight: 'bold', marginBottom: 3, includeFontPadding: false },
  cardSub: { includeFontPadding: false }
});
