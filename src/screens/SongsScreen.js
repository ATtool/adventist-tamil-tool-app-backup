import React, { useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSettings } from '../context/SettingsContext';

const BRIGHT_YELLOW = '#FFD700';

// --- ACCENT PALETTE FOR THE 4 SONG CATEGORY CARDS ---
const ACCENT_ZION = '#30D158';
const ACCENT_HOPE = '#FF9F0A';
const ACCENT_OLD = '#00F0FF';
const ACCENT_OTHER = '#BF5AF2';

export default function SongsScreen() {
  const navigation = useNavigation();
  const { colors, appFontSize } = useSettings();

  // --- ANIMATION VALUES ---
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const cardAnims = useRef([...Array(4)].map(() => new Animated.Value(50))).current; 
  const cardOpacities = useRef([...Array(4)].map(() => new Animated.Value(0))).current;

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

  const openScreen = (screenName) => {
    navigation.navigate(screenName);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      
      {/* Animated Header */}
      <Animated.View style={[styles.header, { borderBottomColor: colors.border, opacity: headerOpacity }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Songs Directory</Text>
      </Animated.View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Box 1: Zion */}
        <Animated.View style={{ opacity: cardOpacities[0], transform: [{ translateY: cardAnims[0] }] }}>
          <TouchableOpacity 
            activeOpacity={0.75}
            style={[styles.card, { backgroundColor: colors.card, borderLeftColor: ACCENT_ZION }]} 
            onPress={() => openScreen('ZionSongs')}
          >
            <View style={[styles.iconContainer, { backgroundColor: ACCENT_ZION + '22' }]}>
              <Ionicons name="musical-notes" size={22} color={ACCENT_ZION} />
            </View>
            <View style={styles.textContainer}>
              <Text style={[styles.tamilText, { color: colors.text, fontSize: appFontSize + 7, lineHeight: appFontSize + 10 }]}>
                சீயோன் இனிய கீதங்கள்
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.subtext} />
          </TouchableOpacity>
        </Animated.View>

        {/* Box 2: Thirumarai Hope */}
        <Animated.View style={{ opacity: cardOpacities[1], transform: [{ translateY: cardAnims[1] }] }}>
          <TouchableOpacity 
            activeOpacity={0.75}
            style={[styles.card, { backgroundColor: colors.card, borderLeftColor: ACCENT_HOPE }]} 
            onPress={() => openScreen('ThirumaraiHope')}
          >
            <View style={[styles.iconContainer, { backgroundColor: ACCENT_HOPE + '22' }]}>
              <Ionicons name="star" size={22} color={ACCENT_HOPE} />
            </View>
            <View style={styles.textContainer}>
              <Text style={[styles.tamilText, { color: colors.text, fontSize: appFontSize + 7, lineHeight: appFontSize + 10 }]}>
                திருமறைத்திருப் பாடல்கள்
              </Text>
              {/* Bright Yellow Text */}
              <Text style={[styles.tamilSubText, { color: BRIGHT_YELLOW, fontSize: appFontSize +1, lineHeight: appFontSize + 2 }]}>
                ( நம்பிக்கையின் கீதங்கள் புத்தக வரிசை )
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.subtext} />
          </TouchableOpacity>
        </Animated.View>

        {/* Box 3: Thirumarai Old */}
        <Animated.View style={{ opacity: cardOpacities[2], transform: [{ translateY: cardAnims[2] }] }}>
          <TouchableOpacity 
            activeOpacity={0.75}
            style={[styles.card, { backgroundColor: colors.card, borderLeftColor: ACCENT_OLD }]} 
            onPress={() => openScreen('ThirumaraiOld')}
          >
            <View style={[styles.iconContainer, { backgroundColor: ACCENT_OLD + '22' }]}>
              <Ionicons name="book" size={22} color={colors.primary} />
            </View>
            <View style={styles.textContainer}>
              <Text style={[styles.tamilText, { color: colors.text, fontSize: appFontSize + 7, lineHeight: appFontSize + 8 }]}>
                திருமறைத்திருப் பாடல்கள்
              </Text>
              {/* Bright Yellow Text */}
              <Text style={[styles.tamilSubText, { color: BRIGHT_YELLOW, fontSize: appFontSize +1, lineHeight: appFontSize + 2 }]}>
                ( பழைய புத்தக வரிசை )
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.subtext} />
          </TouchableOpacity>
        </Animated.View>

        {/* Box 4: Other Songs */}
        <Animated.View style={{ opacity: cardOpacities[3], transform: [{ translateY: cardAnims[3] }] }}>
          <TouchableOpacity 
            activeOpacity={0.75}
            style={[styles.card, { backgroundColor: colors.card, borderLeftColor: ACCENT_OTHER }]} 
            onPress={() => openScreen('OtherSongs')}
          >
            <View style={[styles.iconContainer, { backgroundColor: ACCENT_OTHER + '22' }]}>
              <Ionicons name="library" size={22} color={ACCENT_OTHER} />
            </View>
            <View style={styles.textContainer}>
              <Text style={[styles.tamilText, { color: colors.text, fontSize: appFontSize + 7, lineHeight: appFontSize + 8 }]}>
                இதர பாடல்கள்
              </Text>
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
  textContainer: { flex: 1, justifyContent: 'center' },
  tamilText: { 
    fontFamily: 'Tamil003', 
    marginBottom: 2
  },
  tamilSubText: { 
    fontFamily: 'Tamil003'
  }
});
