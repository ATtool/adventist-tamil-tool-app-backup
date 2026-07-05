import React, { useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons'; 
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSettings } from '../context/SettingsContext';

export default function BooksScreen({ navigation }) {
  const { colors } = useSettings();

  // --- ANIMATION VALUES ---
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const cardAnims = useRef([...Array(1)].map(() => new Animated.Value(50))).current; 
  const cardOpacities = useRef([...Array(1)].map(() => new Animated.Value(0))).current;

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
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <View style={styles.container}>
        
        {/* Animated Header Section */}
        <Animated.View style={[styles.headerContainer, { opacity: headerOpacity }]}>
          <Text style={[styles.headerTitle, { color: colors.text }]} allowFontScaling={false}>நூலகம்</Text>
          <Text style={[styles.headerSubtitle, { color: colors.subtext }]} allowFontScaling={false}>Spiritual Library</Text>
        </Animated.View>
        
        {/* Animated Stunning EGW Books Card */}
        <Animated.View style={{ opacity: cardOpacities[0], transform: [{ translateY: cardAnims[0] }] }}>
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
                  <Text style={styles.cardTitleTamil} allowFontScaling={false}>எலன் ஜி. வைட் நூல்கள்</Text>
                  <Text style={styles.cardTitleEnglish} allowFontScaling={false}>Spirit of Prophecy Books</Text>
                  <Text style={styles.cardDescription} allowFontScaling={false}>
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
        </Animated.View>

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
    includeFontPadding: false,
  },
  headerSubtitle: {
    fontSize: 16,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    fontWeight: '600',
    includeFontPadding: false,
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
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
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
    includeFontPadding: false,
    // Android requires strict font families without extra bold weights
  },
  cardTitleEnglish: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#E0E0E0',
    includeFontPadding: false,
  },
  cardDescription: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 6,
    lineHeight: 16,
    includeFontPadding: false,
  },
  arrowContainer: {
    marginLeft: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
