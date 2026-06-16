import React, { useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSettings } from '../context/SettingsContext';

const BRIGHT_YELLOW = '#FFD700';

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
            style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]} 
            onPress={() => openScreen('ZionSongs')}
          >
            <View style={[styles.iconContainer, { backgroundColor: 'rgba(48, 209, 88, 0.1)' }]}>
              <Ionicons name="musical-notes" size={28} color="#30D158" />
            </View>
            <View style={styles.textContainer}>
              <Text style={[styles.tamilText, { color: colors.text, fontSize: appFontSize + 4 }]}>
                சீயோன் இனிய கீதங்கள்
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={colors.subtext} />
          </TouchableOpacity>
        </Animated.View>

        {/* Box 2: Thirumarai Hope */}
        <Animated.View style={{ opacity: cardOpacities[1], transform: [{ translateY: cardAnims[1] }] }}>
          <TouchableOpacity 
            style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]} 
            onPress={() => openScreen('ThirumaraiHope')}
          >
            <View style={[styles.iconContainer, { backgroundColor: 'rgba(255, 159, 10, 0.1)' }]}>
              <Ionicons name="star" size={28} color="#FF9F0A" />
            </View>
            <View style={styles.textContainer}>
              <Text style={[styles.tamilText, { color: colors.text, fontSize: appFontSize + 4 }]}>
                திருமறைத்திருப் பாடல்கள்
              </Text>
              {/* Bright Yellow Text */}
              <Text style={[styles.tamilSubText, { color: BRIGHT_YELLOW, fontSize: appFontSize - 2 }]}>
                ( நம்பிக்கையின் கீதங்கள் புத்தக வரிசை )
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={colors.subtext} />
          </TouchableOpacity>
        </Animated.View>

        {/* Box 3: Thirumarai Old */}
        <Animated.View style={{ opacity: cardOpacities[2], transform: [{ translateY: cardAnims[2] }] }}>
          <TouchableOpacity 
            style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]} 
            onPress={() => openScreen('ThirumaraiOld')}
          >
            <View style={[styles.iconContainer, { backgroundColor: 'rgba(0, 240, 255, 0.1)' }]}>
              <Ionicons name="book" size={28} color={colors.primary} />
            </View>
            <View style={styles.textContainer}>
              <Text style={[styles.tamilText, { color: colors.text, fontSize: appFontSize + 4 }]}>
                திருமறைத்திருப் பாடல்கள்
              </Text>
              {/* Bright Yellow Text */}
              <Text style={[styles.tamilSubText, { color: BRIGHT_YELLOW, fontSize: appFontSize - 2 }]}>
                ( பழைய புத்தக வரிசை )
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={colors.subtext} />
          </TouchableOpacity>
        </Animated.View>

        {/* Box 4: Other Songs */}
        <Animated.View style={{ opacity: cardOpacities[3], transform: [{ translateY: cardAnims[3] }] }}>
          <TouchableOpacity 
            style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]} 
            onPress={() => openScreen('OtherSongs')}
          >
            <View style={[styles.iconContainer, { backgroundColor: 'rgba(191, 90, 242, 0.1)' }]}>
              <Ionicons name="library" size={28} color="#BF5AF2" />
            </View>
            <View style={styles.textContainer}>
              <Text style={[styles.tamilText, { color: colors.text, fontSize: appFontSize + 4 }]}>
                இதர பாடல்கள்
              </Text>
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
  iconContainer: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  textContainer: { flex: 1 },
  tamilText: { fontFamily: 'Tamil003', marginBottom: 4 },
  tamilSubText: { fontFamily: 'Tamil003', fontWeight: 'bold' }
});
