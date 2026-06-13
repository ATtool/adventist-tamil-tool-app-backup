import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSettings } from '../context/SettingsContext';

export default function StudyScreen() {
  const navigation = useNavigation();
  const { colors, appFontSize } = useSettings();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      
      {/* HEADER */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Bible Tool & Study notes</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Dictionary Card */}
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

        {/* Concordance Card */}
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

        {/* NEW: Bible Verse Explanations Card */}
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
