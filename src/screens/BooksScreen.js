import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons'; 
import { LinearGradient } from 'expo-linear-gradient';
import { useSettings } from '../context/SettingsContext';

export default function BooksScreen({ navigation }) {
  const { colors } = useSettings();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <View style={styles.container}>
        
        {/* Header Section */}
        <View style={styles.headerContainer}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>நூலகம்</Text>
          <Text style={[styles.headerSubtitle, { color: colors.subtext }]}>Spiritual Library</Text>
        </View>
        
        {/* Stunning EGW Books Card */}
        <TouchableOpacity 
          activeOpacity={0.8}
          onPress={() => navigation.navigate('EGWBooksList')}
          style={styles.cardWrapper}
        >
          <LinearGradient
            colors={['#1A2980', '#26D0CE']} // A beautiful deep blue to glowing cyan gradient
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientCard}
          >
            <View style={styles.cardContent}>
              {/* Left Side: Icon */}
              <View style={styles.iconCircle}>
                <Ionicons name="library" size={32} color="#FFFFFF" />
              </View>
              
              {/* Middle: Text */}
              <View style={styles.textContainer}>
                <Text style={styles.cardTitleTamil}>எலன் ஜி. வைட் நூல்கள்</Text>
                <Text style={styles.cardTitleEnglish}>Spirit of Prophecy Books</Text>
                <Text style={styles.cardDescription}>
                  Explore the writings and counsels for the last days.
                </Text>
              </View>

              {/* Right Side: Arrow */}
              <View style={styles.arrowContainer}>
                <Ionicons name="chevron-forward-circle" size={28} color="rgba(255,255,255,0.8)" />
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 20,
  },
  headerContainer: {
    marginTop: 20,
    marginBottom: 30,
  },
  headerTitle: {
    fontSize: 32,
    fontFamily: 'Tamil003', 
  },
  headerSubtitle: {
    fontSize: 16,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    fontWeight: '600',
  },
  cardWrapper: {
    borderRadius: 20,
    elevation: 8, // Adds a nice shadow on Android
    shadowColor: '#00F0FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  gradientCard: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  textContainer: {
    flex: 1,
  },
  cardTitleTamil: {
    fontSize: 20,
    fontFamily: 'Tamil003',
    color: '#FFFFFF',
    marginBottom: 2,
    // Android requires strict font families without extra bold weights
  },
  cardTitleEnglish: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#E0E0E0',
  },
  cardDescription: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 6,
    lineHeight: 16,
  },
  arrowContainer: {
    marginLeft: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
