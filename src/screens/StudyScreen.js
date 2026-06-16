import React, { useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSettings } from '../context/SettingsContext';

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
            style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]} 
            onPress={() => navigation.navigate('Dictionary')}
          >
            <View style={[styles.iconContainer, { backgroundColor: 'rgba(0, 240, 255, 0.1)' }]}>
              <Ionicons name="book" size={32} color={colors.primary} />
            </View>
            <View style={styles.textContainer}>
              <Text style={[styles.cardTitle, { color: colors.text, fontSize: appFontSize + 2 }]}>Bible Dictionary</Text>
              <Text style={[styles.cardSub, { color: colors.subtext, fontSize: appFontSize, fontFamily: 'Tamil003' }]}>வேதாகம அகராதி</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={colors.subtext} />
          </TouchableOpacity>
        </Animated.View>

        {/* Concordance Card */}
        <Animated.View style={{ opacity: cardOpacities[1], transform: [{ translateY: cardAnims[1] }] }}>
          <TouchableOpacity 
            style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]} 
            onPress={() => navigation.navigate('Concordance')}
          >
            <View style={[styles.iconContainer, { backgroundColor: 'rgba(255, 59, 48, 0.1)' }]}>
              <Ionicons name="search" size={32} color="#FF3B30" />
            </View>
            <View style={styles.textContainer}>
              <Text style={[styles.cardTitle, { color: colors.text, fontSize: appFontSize + 2 }]}>Concordance</Text>
              <Text style={[styles.cardSub, { color: colors.subtext, fontSize: appFontSize, fontFamily: 'Tamil003' }]}>வார்த்தை விளக்கம்</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={colors.subtext} />
          </TouchableOpacity>
        </Animated.View>

        {/* NEW: Bible Verse Explanations Card */}
        <Animated.View style={{ opacity: cardOpacities[2], transform: [{ translateY: cardAnims[2] }] }}>
          <TouchableOpacity 
            style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]} 
            onPress={() => navigation.navigate('StudyExplanations')}
          >
            <View style={[styles.iconContainer, { backgroundColor: 'rgba(46, 204, 113, 0.1)' }]}>
              <Ionicons name="library" size={32} color="#2ECC71" />
            </View>
            <View style={styles.textContainer}>
              <Text style={[styles.cardTitle, { color: colors.text, fontSize: appFontSize + 2 }]}>Verse Explanations</Text>
              <Text style={[styles.cardSub, { color: colors.subtext, fontSize: appFontSize, fontFamily: 'Tamil003' }]}>வசன விளக்கம்</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={colors.subtext} />
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
  card: { flexDirection: 'row', alignItems: 'center', padding: 20, borderRadius: 20, borderWidth: 1, marginBottom: 15 },
  iconContainer: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  textContainer: { flex: 1 },
  cardTitle: { fontWeight: 'bold', marginBottom: 5 },
  cardSub: { fontWeight: '500' }
});
